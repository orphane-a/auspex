import { Router } from 'express'
import multer from 'multer'
import { parseCharacterSheet, parseNpcSheet } from './xlsxParser.js'
import { resolveRoll, degreesFromRoll } from './game.js'
import { activeScenario, addFictionalCharacters, fictionalEnabled, resetScenarioTable, seedIfEmpty } from './seed.js'
import { characteristicForSkillName, setLastDamage } from './state.js'
import { HIT_LOCATIONS, applyDamage, effectiveSkillScore, npcDodgeScore, resolveWeaponDamage, rollD100 } from '../src/gameLogic.js'
import * as db from './db.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Délai avant le jet automatique d'un personnage fictif (ticket 94, souhaitable 4) :
// le MJ voit passer « Jet automatique… » avant le résultat. Les tests passent 0.
const DEFAULT_AUTO_ROLL_DELAY_MS = 1500

export function createRoutes({ presence, buildSnapshot, autoRollDelayMs }) {
  const router = Router()
  const envDelay = Number(process.env.AUSPEX_FICTIFS_DELAI_MS)
  const autoDelay = autoRollDelayMs ?? (Number.isFinite(envDelay) && envDelay >= 0 ? envDelay : DEFAULT_AUTO_ROLL_DELAY_MS)

  // Une action automatique part après le délai, hors de la requête HTTP : une erreur
  // y est journalisée plutôt que de faire tomber le serveur.
  function later(fn) {
    setTimeout(() => {
      try {
        fn()
      } catch (err) {
        console.warn('Jet automatique d\'un personnage fictif impossible —', err.message)
      }
    }, autoDelay)
  }

  const snapshot = () => buildSnapshot(presence.isConnected)
  function respondWithSnapshot(res, status, extra) {
    presence.broadcast()
    res.status(status).json({ ...snapshot(), ...extra })
  }

  router.get('/table', (req, res) => res.json(snapshot()))

  // Mode démo (ticket 97) : exposé par une route à part plutôt que dans le snapshot,
  // pour ne pas toucher au protocole socket. Les textes du scénario restent côté
  // client (src/scenarios/), seul l'identifiant transite.
  router.get('/scenario', (req, res) => res.json({ scenario: activeScenario()?.id ?? null }))

  router.post('/table/reset', async (req, res) => {
    if (!(await resetScenarioTable())) {
      db.resetTable()
      await seedIfEmpty() // dev convenience: re-seeds Djoko right away instead of leaving MjHome blank
    }
    respondWithSnapshot(res, 200)
  })

  router.post('/table/end-test', (req, res) => {
    db.clearRequest()
    respondWithSnapshot(res, 200)
  })

  // Même calcul pour un vrai joueur et pour un fictif (ticket 94, exigence 6).
  function rollForCharacter(character, request) {
    const linkedCharacteristic = characteristicForSkillName(request.skill)
    const score = effectiveSkillScore(character, request.skill, linkedCharacteristic)
    return resolveRoll(score, request.malus)
  }

  // Jets des fictifs concernés par le test `requestId`. Ignoré si le test a changé
  // entre-temps, si le fictif a été retiré ou s'il a déjà lancé.
  function autoRollFictional(requestId) {
    const state = db.getTableState()
    if (!state.request || state.request.id !== requestId) return
    let changed = false
    for (const id of state.request.concernedCharacterIds) {
      if (state.rolls[id]) continue
      const character = db.getCharacter(Number(id))
      if (!character || !character.fictional) continue
      db.patchRoll(id, { ...rollForCharacter(character, state.request), auto: true })
      changed = true
    }
    if (changed) presence.broadcast()
  }

  router.post('/table/request', (req, res) => {
    const { skill, malus, concernedCharacterIds } = req.body
    if (!skill || !Array.isArray(concernedCharacterIds) || concernedCharacterIds.length === 0) {
      return res.status(400).json({ error: 'Compétence et joueurs concernés requis.' })
    }
    const request = { id: Date.now(), skill, malus: malus || null, concernedCharacterIds }
    db.setRequest(request)
    db.setRolls({})
    respondWithSnapshot(res, 200)
    later(() => autoRollFictional(request.id))
  })

  router.post('/table/roll', (req, res) => {
    const { characterId } = req.body
    const state = db.getTableState()
    if (!state.request) return res.status(409).json({ error: 'Aucun test en cours.' })
    if (!state.request.concernedCharacterIds.includes(Number(characterId))) {
      return res.status(403).json({ error: "Ce personnage n'est pas concerné par ce test." })
    }
    if (state.rolls[characterId]) return res.status(409).json({ error: 'Ce personnage a déjà lancé le dé.' })
    const character = db.getCharacter(Number(characterId))
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    const roll = rollForCharacter(character, state.request)
    db.patchRoll(characterId, roll)
    respondWithSnapshot(res, 200, { roll })
  })

  router.post('/table/join', (req, res) => {
    const { code, characterId } = req.body
    const state = db.getTableState()
    if (!code || String(code).toUpperCase() !== state.code.toUpperCase()) {
      return res.status(404).json({ error: 'Code de table invalide.' })
    }
    const character = db.getCharacter(Number(characterId))
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    if (character.fictional) {
      return res.status(403).json({ error: 'Ce personnage fictif ne peut pas être choisi par un joueur.' })
    }
    res.json({ character, code: state.code })
  })

  // Retrait des personnages fictifs (ticket 94, exigence 9) : vrais personnages, PNJ
  // et code de table intacts. Un test en cours continue pour les autres ; une attaque
  // qui impliquait un fictif est annulée, faute de combattant à afficher.
  router.delete('/characters/fictional', (req, res) => {
    const removedIds = db.removeFictionalCharacters()
    const state = db.getTableState()
    if (state.request && removedIds.length > 0) {
      const remaining = state.request.concernedCharacterIds.filter((id) => !removedIds.includes(Number(id)))
      if (remaining.length !== state.request.concernedCharacterIds.length) {
        db.setRequest({ ...state.request, concernedCharacterIds: remaining, fictionalRemoved: true })
        const rolls = Object.fromEntries(Object.entries(state.rolls).filter(([id]) => !removedIds.includes(Number(id))))
        db.setRolls(rolls)
      }
    }
    const involves = (side) => side.type === 'character' && removedIds.includes(side.id)
    if (state.attack && (involves(state.attack.attacker) || involves(state.attack.defender))) db.setAttack(null)
    respondWithSnapshot(res, 200, { removed: removedIds.length })
  })

  router.post('/characters/fictional', async (req, res) => {
    if (!fictionalEnabled()) {
      return res.status(403).json({ error: 'Les personnages fictifs sont désactivés sur ce serveur.' })
    }
    const added = await addFictionalCharacters()
    if (added === 0) return res.status(409).json({ error: 'Les personnages fictifs sont déjà à la table.' })
    respondWithSnapshot(res, 201, { added })
  })

  router.post('/characters', upload.single('file'), async (req, res) => {
    const name = (req.body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Le nom du personnage est requis.' })
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' })
    let parsed
    try {
      parsed = await parseCharacterSheet(req.file.buffer)
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }
    const character = db.addCharacter({
      name,
      cls: (req.body.cls || '').trim(),
      skills: parsed.skills,
      avatar: parsed.avatar,
      pvBase: parsed.pvBase,
      pvCurrent: parsed.pvCurrent,
      armor: parsed.armor,
      characteristics: parsed.characteristics,
      weapons: parsed.weapons,
    })
    respondWithSnapshot(res, 201, { character })
  })

  router.delete('/characters/:id', (req, res) => {
    db.removeCharacter(Number(req.params.id))
    respondWithSnapshot(res, 200)
  })

  // PNJ/ennemis (V2 §3/§10/§11) : liste séparée des personnages joueurs, pas de
  // rejoint de table — même mécanisme d'upload que les fiches joueur.
  router.post('/npcs', upload.single('file'), async (req, res) => {
    const name = (req.body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Le nom du PNJ est requis.' })
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' })
    let parsed
    try {
      parsed = await parseNpcSheet(req.file.buffer)
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }
    const npc = db.addNpc({
      name,
      characteristics: parsed.characteristics,
      weapons: parsed.weapons,
      pvBase: parsed.pvBase,
      pvCurrent: parsed.pvCurrent,
      armor: parsed.armor,
    })
    respondWithSnapshot(res, 201, { npc })
  })

  router.delete('/npcs/:id', (req, res) => {
    db.removeNpc(Number(req.params.id))
    respondWithSnapshot(res, 200)
  })

  // Symétrique des routes personnage (V3 §4/§8) : un PNJ n'a pas de client, donc
  // pas de bandeau "dégâts encaissés" à alimenter via setLastDamage, contrairement
  // à leurs équivalents /characters/:id/pv et /characters/:id/damage.
  router.patch('/npcs/:id/pv', (req, res) => {
    const current = Number(req.body.current)
    if (!Number.isFinite(current)) return res.status(400).json({ error: 'Valeur de PV invalide.' })
    const npc = db.updateNpcPvCurrent(Number(req.params.id), Math.round(current))
    if (!npc) return res.status(404).json({ error: 'PNJ introuvable.' })
    respondWithSnapshot(res, 200, { npc })
  })

  router.post('/npcs/:id/damage', (req, res) => {
    const rawDamage = Number(req.body.rawDamage)
    const location = HIT_LOCATIONS.find((l) => l.key === req.body.locationKey)
    if (!Number.isFinite(rawDamage) || rawDamage < 0 || !location) {
      return res.status(400).json({ error: 'Dégâts ou localisation invalides.' })
    }
    const npc = db.getNpc(Number(req.params.id))
    if (!npc) return res.status(404).json({ error: 'PNJ introuvable.' })
    const result = applyDamage(npc, { rawDamage: Math.round(rawDamage), locationKey: location.key })
    const updated = db.updateNpcPvCurrent(npc.id, result.newCurrent)
    respondWithSnapshot(res, 200, { npc: updated, damage: { ...result, locationLabel: location.label } })
  })

  router.patch('/npcs/:id/armor', (req, res) => {
    const armor = req.body.armor
    if (!armor || typeof armor !== 'object') return res.status(400).json({ error: 'Armure invalide.' })
    const sanitized = {}
    for (const loc of HIT_LOCATIONS) {
      if (armor[loc.key] != null) sanitized[loc.key] = Math.max(0, Math.round(Number(armor[loc.key]) || 0))
    }
    const npc = db.updateNpcArmor(Number(req.params.id), sanitized)
    if (!npc) return res.status(404).json({ error: 'PNJ introuvable.' })
    respondWithSnapshot(res, 200, { npc })
  })

  router.patch('/npcs/:id/dodge-bonus', (req, res) => {
    const value = Number(req.body.value)
    if (!Number.isFinite(value)) return res.status(400).json({ error: "Bonus d'esquive invalide." })
    const npc = db.updateNpcDodgeBonus(Number(req.params.id), Math.round(value))
    if (!npc) return res.status(404).json({ error: 'PNJ introuvable.' })
    respondWithSnapshot(res, 200, { npc })
  })

  router.patch('/characters/:id/skills/:skillName', (req, res) => {
    const score = Number(req.body.score)
    if (!Number.isFinite(score)) return res.status(400).json({ error: 'Score invalide.' })
    const clamped = Math.max(0, Math.min(100, Math.round(score)))
    const character = db.updateSkillScore(Number(req.params.id), req.params.skillName, clamped)
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    respondWithSnapshot(res, 200, { character })
  })

  // Mode rapide (V2 §5/§9) : ajustement direct des PV actuels, aussi utilisé pour les soins.
  // Pas de calcul d'armure ici — le delta observé alimente quand même le bandeau
  // joueur (V2 §6), juste sans détail d'absorption.
  router.patch('/characters/:id/pv', (req, res) => {
    const current = Number(req.body.current)
    if (!Number.isFinite(current)) return res.status(400).json({ error: 'Valeur de PV invalide.' })
    const before = db.getCharacter(Number(req.params.id))
    if (!before) return res.status(404).json({ error: 'Personnage introuvable.' })
    const character = db.updatePvCurrent(before.id, Math.round(current))
    const delta = before.pv.current - character.pv.current
    if (delta > 0) setLastDamage({ id: Date.now(), characterId: character.id, rawDamage: delta, armor: 0, reduced: delta, locationLabel: null })
    respondWithSnapshot(res, 200, { character })
  })

  // Mode détaillé (V2 §4/§5/§9) : applique l'armure de la localisation touchée puis les PV.
  router.post('/characters/:id/damage', (req, res) => {
    const rawDamage = Number(req.body.rawDamage)
    const location = HIT_LOCATIONS.find((l) => l.key === req.body.locationKey)
    if (!Number.isFinite(rawDamage) || rawDamage < 0 || !location) {
      return res.status(400).json({ error: 'Dégâts ou localisation invalides.' })
    }
    const character = db.getCharacter(Number(req.params.id))
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    const result = applyDamage(character, { rawDamage: Math.round(rawDamage), locationKey: location.key })
    const updated = db.updatePvCurrent(character.id, result.newCurrent)
    if (result.reduced > 0) {
      setLastDamage({ id: Date.now(), characterId: character.id, rawDamage: result.rawDamage, armor: result.armor, reduced: result.reduced, locationLabel: location.label })
    }
    respondWithSnapshot(res, 200, { character: updated, damage: { ...result, locationLabel: location.label } })
  })

  router.patch('/characters/:id/armor', (req, res) => {
    const armor = req.body.armor
    if (!armor || typeof armor !== 'object') return res.status(400).json({ error: 'Armure invalide.' })
    const sanitized = {}
    for (const loc of HIT_LOCATIONS) {
      if (armor[loc.key] != null) sanitized[loc.key] = Math.max(0, Math.round(Number(armor[loc.key]) || 0))
    }
    const character = db.updateArmor(Number(req.params.id), sanitized)
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    respondWithSnapshot(res, 200, { character })
  })

  router.patch('/characters/:id/pv-base', (req, res) => {
    const value = Number(req.body.value)
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'PV de base invalide.' })
    const character = db.updatePvBase(Number(req.params.id), Math.round(value))
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    respondWithSnapshot(res, 200, { character })
  })

  // Talent impactant les PV max (V2 §1/§3/§5), ex. Constitution solide : ajouté ici,
  // le PV max se recalcule automatiquement à la lecture (server/db.js#rowToCharacter).
  router.post('/characters/:id/pv-bonuses', (req, res) => {
    const label = (req.body.label || '').trim()
    const amount = Number(req.body.amount)
    if (!label || !Number.isFinite(amount)) return res.status(400).json({ error: 'Libellé et montant requis.' })
    const character = db.addPvBonus(Number(req.params.id), { label, amount: Math.round(amount) })
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    respondWithSnapshot(res, 200, { character })
  })

  router.delete('/characters/:id/pv-bonuses/:index', (req, res) => {
    const character = db.removePvBonus(Number(req.params.id), Number(req.params.index))
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    respondWithSnapshot(res, 200, { character })
  })

  // Palier de talent d'esquive (V2 §3/§10), ajouté au score d'Esquive effectif au
  // moment du jet — indépendant du score importé de la fiche.
  router.patch('/characters/:id/dodge-bonus', (req, res) => {
    const value = Number(req.body.value)
    if (!Number.isFinite(value)) return res.status(400).json({ error: "Bonus d'esquive invalide." })
    const character = db.updateDodgeBonus(Number(req.params.id), Math.round(value))
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    respondWithSnapshot(res, 200, { character })
  })

  // Un attaquant ou un défenseur peut être un PNJ ou un personnage, dans n'importe
  // quelle combinaison (V3 §2/§3) — un seul point de lookup pour les deux routes
  // ci-dessous plutôt que de dupliquer le if/else PNJ-ou-personnage partout.
  function getCombatant(type, id) {
    return type === 'npc' ? db.getNpc(id) : db.getCharacter(id)
  }
  function updateCombatantPv(type, id, value) {
    return type === 'npc' ? db.updateNpcPvCurrent(id, value) : db.updatePvCurrent(id, value)
  }

  // Étape 1/3 de la séquence d'attaque (V3 §5, v2) : jet contre la Dextérité brute
  // de l'attaquant (§3) dans tous les cas — même formule de degrés que resolveRoll
  // (server/game.js). Un PNJ attaquant (inchangé depuis la V2) n'a pas de client :
  // le jet reste automatique, résolu immédiatement à la validation de la modale MJ.
  // Un personnage attaquant lance désormais lui-même son jet (nouveau) : la
  // validation de la modale MJ pose seulement l'intention d'attaque, en attente du
  // jet du joueur (route /table/attack/roll ci-dessous) — symétrique à l'attente de
  // l'esquive côté défenseur.
  router.post('/table/attack', (req, res) => {
    const { attackerType, defenderType, weaponName, fireMode } = req.body
    const attackerId = Number(req.body.attackerId)
    const defenderId = Number(req.body.defenderId)

    if (!['npc', 'character'].includes(attackerType) || !['npc', 'character'].includes(defenderType)) {
      return res.status(400).json({ error: 'Camp attaquant ou défenseur invalide.' })
    }

    const attacker = getCombatant(attackerType, attackerId)
    if (!attacker) return res.status(404).json({ error: 'Attaquant introuvable.' })
    const weapon = attacker.weapons.find((w) => w.name === weaponName)
    if (!weapon) return res.status(400).json({ error: 'Arme introuvable pour cet attaquant.' })
    if (!['single', 'semi', 'auto', 'melee'].includes(fireMode)) {
      return res.status(400).json({ error: 'Mode de tir invalide.' })
    }
    if (fireMode === 'single' && !weapon.mode.single) {
      return res.status(400).json({ error: "Le mode coup par coup n'est pas disponible pour cette arme." })
    }
    if (fireMode === 'semi' && weapon.mode.semiCapacity == null) {
      return res.status(400).json({ error: "Le mode semi-auto n'est pas disponible pour cette arme." })
    }
    if (fireMode === 'auto' && weapon.mode.autoCapacity == null) {
      return res.status(400).json({ error: "Le mode automatique n'est pas disponible pour cette arme." })
    }
    // Corps à corps (V3) : une seule attaque, jamais de rafale.
    if (fireMode === 'melee' && !weapon.mode.melee) {
      return res.status(400).json({ error: "Le mode corps à corps n'est pas disponible pour cette arme." })
    }
    // Un personnage attaquant doit désormais cliquer lui-même son jet (nouveau),
    // donc rester connecté — même contrainte que le personnage visé (inchangé V2).
    // Un fictif lance son jet automatiquement : jamais concerné (ticket 94).
    if (attackerType === 'character' && !attacker.fictional && !presence.isConnected(attacker.id)) {
      return res.status(400).json({ error: "L'attaquant doit être connecté." })
    }

    const defender = getCombatant(defenderType, defenderId)
    if (!defender) return res.status(404).json({ error: 'Cible introuvable.' })
    // Un combattant contre lui-même n'a aucune règle qui le résout (V3 §5 v2).
    if (attackerType === defenderType && attacker.id === defender.id) {
      return res.status(400).json({ error: "Un combattant ne peut pas s'attaquer lui-même." })
    }
    // Un PNJ n'a jamais de client (§3) donc jamais cette contrainte ; un Joueur visé
    // doit rester connecté pour pouvoir cliquer son propre jet d'esquive (inchangé V2).
    if (defenderType === 'character' && !defender.fictional && !presence.isConnected(defender.id)) {
      return res.status(400).json({ error: 'La cible doit être connectée.' })
    }
    const existing = db.getTableState().attack
    if (existing && ['pending-attack-roll', 'pending-dodge'].includes(existing.outcome)) {
      return res.status(409).json({ error: 'Une attaque est déjà en cours.' })
    }

    const base = {
      id: Date.now(),
      attacker: { type: attackerType, id: attacker.id },
      defender: { type: defenderType, id: defender.id },
      weaponName: weapon.name,
      fireMode,
      dodgeRoll: null,
      dodgeDegrees: null,
      bullets: null,
      damage: null,
    }

    if (attackerType === 'character') {
      db.setAttack({ ...base, attackRoll: null, degrees: null, outcome: 'pending-attack-roll' })
      respondWithSnapshot(res, 200)
      return later(() => advanceFictionalAttack(base.id))
    }

    const result = resolveRoll(attacker.characteristics.Dex || 0, null)
    const outcome = result.status === 'fail' ? 'miss' : 'pending-dodge'
    db.setAttack({ ...base, attackRoll: result.roll, degrees: result.degrees, outcome })
    respondWithSnapshot(res, 200)
    later(() => advanceFictionalAttack(base.id))
  })

  // Jet d'attaque d'un personnage, cliqué par le joueur ou lancé pour un fictif.
  function resolveCharacterAttackRoll(attack, attacker) {
    const result = resolveRoll(attacker.characteristics.Dex || 0, null)
    const outcome = result.status === 'fail' ? 'miss' : 'pending-dodge'
    db.setAttack({ ...attack, attackRoll: result.roll, degrees: result.degrees, outcome })
  }

  function isFictionalSide(side) {
    return side.type === 'character' && !!db.getCharacter(side.id)?.fictional
  }

  // Fait avancer seule une séquence où un fictif doit lancer (ticket 94, exigence 7) :
  // son jet d'attaque, puis, s'il est visé, son esquive. Ignoré si l'attaque a changé.
  function advanceFictionalAttack(attackId) {
    const attack = db.getTableState().attack
    if (!attack || attack.id !== attackId) return
    if (attack.outcome === 'pending-attack-roll' && isFictionalSide(attack.attacker)) {
      resolveCharacterAttackRoll(attack, db.getCharacter(attack.attacker.id))
      presence.broadcast()
      later(() => advanceFictionalAttack(attackId))
      return
    }
    if (attack.outcome === 'pending-dodge' && isFictionalSide(attack.defender)) {
      const result = resolveDodge(attack)
      if (result.error) console.warn('Esquive automatique impossible —', result.error)
      presence.broadcast()
    }
  }

  // Étape 1/3, suite (V3 §5, v2) : le personnage attaquant clique lui-même son jet
  // — vérification d'identité, comme pour l'esquive d'un joueur, pour qu'un autre
  // joueur ne puisse pas lancer à sa place.
  router.post('/table/attack/roll', (req, res) => {
    const attack = db.getTableState().attack
    if (!attack || attack.outcome !== 'pending-attack-roll') {
      return res.status(409).json({ error: "Aucun jet d'attaque en attente." })
    }
    if (Number(req.body.characterId) !== attack.attacker.id) {
      return res.status(403).json({ error: "Ce personnage n'est pas l'attaquant de cette séquence." })
    }
    const attacker = db.getCharacter(attack.attacker.id)
    if (!attacker) return res.status(404).json({ error: 'Attaquant introuvable.' })

    resolveCharacterAttackRoll(attack, attacker)
    respondWithSnapshot(res, 200)
    later(() => advanceFictionalAttack(attack.id))
  })

  // Étapes 2 et 3 (V3 §5) : le jet d'esquive est résolu soit par le joueur visé
  // (body { characterId }, inchangé depuis la V2 — vérification d'identité gardée
  // pour qu'un autre joueur ne puisse pas esquiver à sa place), soit par le MJ pour
  // un PNJ visé (§3 : pas de client PNJ, donc pas de vérification d'identité —
  // score calculé côté serveur via npcDodgeScore). Échec ⇒ dégâts depuis le profil
  // de l'arme choisie à l'étape 1 (resolveWeaponDamage), `attackRoll` ne servant
  // plus qu'à la localisation (chiffres inversés, inchangé depuis la v1).
  // La même résolution sert aussi à l'esquive automatique d'un fictif (ticket 94).
  function resolveDodge(attack) {
    const attacker = getCombatant(attack.attacker.type, attack.attacker.id)
    if (!attacker) return { status: 404, error: 'Attaquant introuvable.' }
    const weapon = attacker.weapons.find((w) => w.name === attack.weaponName)
    if (!weapon) return { status: 404, error: 'Arme introuvable.' }

    const defender = getCombatant(attack.defender.type, attack.defender.id)
    if (!defender) {
      return { status: 404, error: attack.defender.type === 'npc' ? 'PNJ introuvable.' : 'Personnage introuvable.' }
    }

    const effectiveEsquive =
      attack.defender.type === 'character' ? effectiveSkillScore(defender, 'Esquive', 'Agi') + defender.dodgeBonus : npcDodgeScore(defender)

    const dodgeRoll = rollD100()
    const { degrees: dodgeDegrees } = degreesFromRoll(dodgeRoll, effectiveEsquive)

    if (dodgeRoll <= effectiveEsquive) {
      db.setAttack({ ...attack, dodgeRoll, dodgeDegrees, outcome: 'dodged' })
      return { status: 200 }
    }

    const result = resolveWeaponDamage(defender, { attackRoll: attack.attackRoll, degrees: attack.degrees, weapon, fireMode: attack.fireMode })
    const updated = updateCombatantPv(attack.defender.type, defender.id, result.newCurrent)
    const locationLabel = HIT_LOCATIONS.find((l) => l.key === result.locationKey).label
    db.setAttack({
      ...attack,
      dodgeRoll,
      dodgeDegrees,
      outcome: 'hit',
      bullets: result.bullets,
      damage: { locationKey: result.locationKey, locationLabel, perBullet: result.perBullet, totalDamage: result.totalDamage },
    })
    return { status: 200, extra: attack.defender.type === 'npc' ? { npc: updated } : { character: updated } }
  }

  router.post('/table/attack/dodge', (req, res) => {
    const attack = db.getTableState().attack
    if (!attack || attack.outcome !== 'pending-dodge') {
      return res.status(409).json({ error: "Aucune esquive en attente." })
    }
    if (attack.defender.type === 'character' && Number(req.body.characterId) !== attack.defender.id) {
      return res.status(403).json({ error: "Ce personnage n'est pas visé par cette attaque." })
    }
    const result = resolveDodge(attack)
    if (result.error) return res.status(result.status).json({ error: result.error })
    respondWithSnapshot(res, 200, result.extra)
  })

  // Filet de sécurité MJ (V3 §5 v2) : débloque une séquence restée coincée en
  // attente (jet d'attaque ou d'esquive jamais fait, client parti, etc.) sans
  // passer par une réinitialisation complète de la table.
  router.post('/table/attack/cancel', (req, res) => {
    db.setAttack(null)
    respondWithSnapshot(res, 200)
  })

  return router
}
