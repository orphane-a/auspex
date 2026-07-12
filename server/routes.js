import { Router } from 'express'
import multer from 'multer'
import { parseCharacterSheet, parseNpcSheet } from './xlsxParser.js'
import { resolveRoll } from './game.js'
import { seedIfEmpty } from './seed.js'
import { characteristicForSkillName, setLastDamage } from './state.js'
import { HIT_LOCATIONS, applyDamage, effectiveSkillScore, resolveWeaponDamage, rollD100 } from '../src/gameLogic.js'
import * as db from './db.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

export function createRoutes({ presence, buildSnapshot }) {
  const router = Router()

  const snapshot = () => buildSnapshot(presence.isConnected)
  function respondWithSnapshot(res, status, extra) {
    presence.broadcast()
    res.status(status).json({ ...snapshot(), ...extra })
  }

  router.get('/table', (req, res) => res.json(snapshot()))

  router.post('/table/reset', async (req, res) => {
    db.resetTable()
    await seedIfEmpty() // dev convenience: re-seeds Djoko right away instead of leaving MjHome blank
    respondWithSnapshot(res, 200)
  })

  router.post('/table/end-test', (req, res) => {
    db.clearRequest()
    respondWithSnapshot(res, 200)
  })

  router.post('/table/request', (req, res) => {
    const { skill, malus, concernedCharacterIds } = req.body
    if (!skill || !Array.isArray(concernedCharacterIds) || concernedCharacterIds.length === 0) {
      return res.status(400).json({ error: 'Compétence et joueurs concernés requis.' })
    }
    db.setRequest({ id: Date.now(), skill, malus: malus || null, concernedCharacterIds })
    db.setRolls({})
    respondWithSnapshot(res, 200)
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
    const linkedCharacteristic = characteristicForSkillName(state.request.skill)
    const score = effectiveSkillScore(character, state.request.skill, linkedCharacteristic)
    const roll = resolveRoll(score, state.request.malus)
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
    res.json({ character, code: state.code })
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

  // Étape 1/3 de la séquence d'attaque (V2 §10) : jet d'attaque du MJ pour un
  // ennemi non fiché. Raté ⇒ séquence terminée immédiatement ; touché ⇒ attend
  // le jet d'esquive du joueur visé (étape 2).
  // Étape 1/3 de la séquence d'attaque (V2 §10 v2) : le MJ choisit le PNJ, l'arme
  // et le mode de tir ; le jet d'attaque se résout contre la Dextérité du PNJ avec
  // la même formule de degrés que resolveRoll (server/game.js), déjà utilisée pour
  // tous les jets de compétence V1 — pas de duplication de la logique de degrés.
  router.post('/table/attack', (req, res) => {
    const npcId = Number(req.body.npcId)
    const targetCharacterId = Number(req.body.targetCharacterId)
    const { weaponName, fireMode } = req.body

    const npc = db.getNpc(npcId)
    if (!npc) return res.status(404).json({ error: 'PNJ introuvable.' })
    const weapon = npc.weapons.find((w) => w.name === weaponName)
    if (!weapon) return res.status(400).json({ error: 'Arme introuvable pour ce PNJ.' })
    if (!['single', 'semi', 'auto'].includes(fireMode)) {
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

    const target = db.getCharacter(targetCharacterId)
    if (!target) return res.status(404).json({ error: 'Cible introuvable.' })
    if (!presence.isConnected(target.id)) return res.status(400).json({ error: 'La cible doit être connectée.' })
    const existing = db.getTableState().attack
    if (existing && existing.outcome === 'pending-dodge') {
      return res.status(409).json({ error: "Une attaque est déjà en attente d'esquive." })
    }

    const result = resolveRoll(npc.characteristics.Dex || 0, null)
    const outcome = result.status === 'fail' ? 'miss' : 'pending-dodge'
    db.setAttack({
      id: Date.now(),
      npcId: npc.id,
      weaponName: weapon.name,
      fireMode,
      targetCharacterId: target.id,
      attackRoll: result.roll,
      degrees: result.degrees,
      outcome,
      dodgeRoll: null,
      bullets: null,
      damage: null,
    })
    respondWithSnapshot(res, 200)
  })

  // Étapes 2 et 3 (V2 §10 v2) : jet d'esquive du joueur visé, indépendant du jet
  // d'attaque. Échec ⇒ les dégâts viennent maintenant du profil de l'arme choisie
  // à l'étape 1 (resolveWeaponDamage), `attackRoll` ne servant plus qu'à la
  // localisation (chiffres inversés, inchangé depuis la v1).
  router.post('/table/attack/dodge', (req, res) => {
    const attack = db.getTableState().attack
    if (!attack || attack.outcome !== 'pending-dodge') {
      return res.status(409).json({ error: "Aucune esquive en attente." })
    }
    if (Number(req.body.characterId) !== attack.targetCharacterId) {
      return res.status(403).json({ error: "Ce personnage n'est pas visé par cette attaque." })
    }
    const character = db.getCharacter(attack.targetCharacterId)
    if (!character) return res.status(404).json({ error: 'Personnage introuvable.' })
    const npc = db.getNpc(attack.npcId)
    if (!npc) return res.status(404).json({ error: 'PNJ introuvable.' })
    const weapon = npc.weapons.find((w) => w.name === attack.weaponName)
    if (!weapon) return res.status(404).json({ error: 'Arme introuvable.' })

    const effectiveEsquive = effectiveSkillScore(character, 'Esquive', 'Agi') + character.dodgeBonus
    const dodgeRoll = rollD100()

    if (dodgeRoll <= effectiveEsquive) {
      db.setAttack({ ...attack, dodgeRoll, outcome: 'dodged' })
      return respondWithSnapshot(res, 200)
    }

    const result = resolveWeaponDamage(character, { attackRoll: attack.attackRoll, degrees: attack.degrees, weapon, fireMode: attack.fireMode })
    const updated = db.updatePvCurrent(character.id, result.newCurrent)
    const locationLabel = HIT_LOCATIONS.find((l) => l.key === result.locationKey).label
    db.setAttack({
      ...attack,
      dodgeRoll,
      outcome: 'hit',
      bullets: result.bullets,
      damage: { locationKey: result.locationKey, locationLabel, perBullet: result.perBullet, totalDamage: result.totalDamage },
    })
    respondWithSnapshot(res, 200, { character: updated })
  })

  return router
}
