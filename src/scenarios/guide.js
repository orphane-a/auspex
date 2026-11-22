// Déroulé du scénario guidé (ticket 97, retour du 22/11) : logique pure, sans
// interface ni accès réseau. À partir de la progression gardée dans le navigateur et
// du snapshot de la table, `nextMove` dit au guide :
//   - `say`     : la consigne à afficher dans la popin ;
//   - `target`  : le bouton d'Auspex à montrer du doigt (repère visuel) ;
//   - `auto`    : l'action que le guide joue lui même pour l'autre côté de la table
//                 quand on joue seul (jets des compagnons, ordres du MJ, etc.) ;
//   - `result`  : le texte de suite une fois l'action résolue, avec `canContinue`.
// Le guide ne passe que par les routes REST existantes : ni le schéma, ni le
// snapshot, ni les règles de combat ne changent.
import { attackOutcomeLabel, FIRE_MODE_LABELS } from '../gameLogic.js'
import { stepOutcome } from './index.js'

export const INITIAL_PROGRESS = { step: 0, phase: 'story', round: 1, turn: 0, baseAttackId: null, ending: null }

// Les identifiants changent à chaque remise à zéro : on retrouve tout par le nom.
export function castOf(scenario, table) {
  const members = scenario.characters.map((sc) => ({ ...sc, entity: table.characters.find((c) => c.name === sc.name) || null }))
  const hero = members.find((m) => m.played) || null
  const companions = members.filter((m) => !m.played && m.entity)
  const dragon = table.npcs.find((n) => n.name === scenario.npc.name) || null
  return { members, hero, companions, dragon }
}

function combatant(side, cast) {
  if (side.type === 'npc') return cast.dragon ? { type: 'npc', id: cast.dragon.id, name: cast.dragon.name } : null
  const m = cast.members.find((x) => x.name === side.name)
  return m?.entity ? { type: 'character', id: m.entity.id, name: m.name } : null
}

function malusLabel(malus) {
  return malus ? `malus ${malus}` : 'sans malus'
}

function testMove({ step, mode, solo, table, cast }) {
  const { skill, malus } = step.test
  const present = cast.members.filter((m) => m.entity)
  const request = table.request && table.request.skill === skill ? table.request : null

  if (!request) {
    if (mode === 'mj') {
      return {
        say: `Ordonnez un test de ${skill} (${malusLabel(malus)}) à toute l'équipe.`,
        target: { kind: 'launchTest', skill, malus },
      }
    }
    if (solo) {
      return {
        say: `Le MJ demande un test de ${skill} à toute l'équipe…`,
        auto: { kind: 'createRequest', key: `request:${step.title}`, skill, malus, ids: present.map((m) => m.entity.id) },
      }
    }
    return { say: `Attendez que le MJ ordonne le test de ${skill}.` }
  }

  const concerned = present.filter((m) => request.concernedCharacterIds.includes(m.entity.id))
  const rolls = concerned.map((m) => ({ member: m, roll: table.rolls[m.entity.id] || null }))
  const pending = rolls.filter((r) => !r.roll).map((r) => r.member)

  if (pending.length === 0 && rolls.length > 0) {
    const outcome = stepOutcome(rolls.map((r) => r.roll))
    return {
      rolls,
      result: { ok: outcome === 'success', text: outcome === 'success' ? step.success : step.failure },
      canContinue: true,
    }
  }

  const heroPending = pending.find((m) => m.played)
  const companionsPending = pending.filter((m) => !m.played)
  const companionIds = companionsPending.map((m) => m.entity.id)

  if (mode === 'mj') {
    // Les compagnons sont joués par le MJ : le guide lance leurs dés. Le héros aussi
    // quand on joue seul ; sinon on attend la vue joueur.
    const ids = [...companionIds, ...(solo && heroPending ? [heroPending.entity.id] : [])]
    return {
      rolls,
      say: heroPending && !solo ? `Les compagnons lancent les dés. En attente du jet de ${heroPending.name} sur la vue joueur.` : 'Les dés roulent…',
      auto: ids.length ? { kind: 'roll', key: `roll:${request.id}:${ids.join(',')}`, ids } : null,
    }
  }

  if (heroPending && heroPending.entity.id === table.myCharacterId) {
    return { rolls, say: `Cliquez sur LANCER pour le test de ${skill}.`, target: { kind: 'playerRoll' } }
  }
  return {
    rolls,
    say: solo ? 'Vos compagnons lancent les dés…' : 'En attente des jets des compagnons, lancés par le MJ.',
    auto: solo && companionIds.length ? { kind: 'roll', key: `roll:${request.id}:${companionIds.join(',')}`, ids: companionIds } : null,
  }
}

function combatMove({ step, progress, mode, solo, table, cast }) {
  const turn = step.combat.turns[progress.turn]
  const attacker = combatant(turn.attacker, cast)
  const defender = combatant(turn.defender, cast)
  const base = { turn, round: progress.round, rounds: step.combat.rounds }
  if (!attacker || !defender) return { ...base, say: 'La table de démo est incomplète. Recommencez la démo.' }

  const a = table.attack
  const mine =
    a && a.id !== progress.baseAttackId && a.attacker.type === attacker.type && a.attacker.id === attacker.id && a.defender.type === defender.type && a.defender.id === defender.id
      ? a
      : null
  const fireModeLabel = FIRE_MODE_LABELS[turn.fireMode]

  if (!mine) {
    if (a && ['pending-attack-roll', 'pending-dodge'].includes(a.outcome)) {
      return { ...base, say: 'Une autre attaque est en cours. Terminez la ou annulez la avec [X] sur la carte d’attaque.' }
    }
    if (mode === 'mj') {
      return {
        ...base,
        say: `Lancez l'attaque : ${attacker.name} contre ${defender.name}, ${turn.weapon}, ${fireModeLabel.toLowerCase()}.`,
        target: { kind: 'attackModal', attacker, defender, weapon: turn.weapon, fireModeLabel },
      }
    }
    if (solo) {
      return {
        ...base,
        say: `${attacker.name} attaque ${defender.name}…`,
        auto: {
          kind: 'launchAttack',
          key: `attack:${progress.round}:${progress.turn}:${progress.baseAttackId}`,
          payload: { attackerType: attacker.type, attackerId: attacker.id, defenderType: defender.type, defenderId: defender.id, weaponName: turn.weapon, fireMode: turn.fireMode },
        },
      }
    }
    return { ...base, say: `Attendez que le MJ lance l'attaque de ${attacker.name}.` }
  }

  if (mine.outcome === 'pending-attack-roll') {
    if (mode === 'joueur') return { ...base, say: "Cliquez sur LANCER pour votre jet d'attaque.", target: { kind: 'playerRoll' } }
    if (solo) return { ...base, say: `${attacker.name} lance son jet d'attaque…`, auto: { kind: 'attackRoll', key: `attackRoll:${mine.id}`, characterId: attacker.id } }
    return { ...base, say: `En attente du jet d'attaque de ${attacker.name} sur la vue joueur.` }
  }

  if (mine.outcome === 'pending-dodge') {
    if (defender.type === 'npc') {
      if (mode === 'mj') return { ...base, say: `Touché ! Lancez l'esquive de ${defender.name}.`, target: { kind: 'npcDodge' } }
      if (solo) return { ...base, say: `Touché ! ${defender.name} tente d'esquiver…`, auto: { kind: 'npcDodge', key: `npcDodge:${mine.id}` } }
      return { ...base, say: `Touché ! Le MJ lance l'esquive de ${defender.name}.` }
    }
    if (mode === 'joueur') return { ...base, say: 'Attaque entrante ! Cliquez sur ESQUIVER.', target: { kind: 'playerDodge' } }
    if (solo) return { ...base, say: `${defender.name} tente d'esquiver…`, auto: { kind: 'dodge', key: `dodge:${mine.id}`, characterId: defender.id } }
    return { ...base, say: `En attente de l'esquive de ${defender.name} sur la vue joueur.` }
  }

  // « ok » = bonne nouvelle pour l'équipe : Aldric touche, ou le dragon le rate.
  const heroAttacks = attacker.type === 'character'
  const ok = heroAttacks ? mine.outcome === 'hit' : mine.outcome !== 'hit'
  return { ...base, result: { ok, text: attackOutcomeLabel(mine) }, canContinue: true }
}

export function nextMove({ scenario, progress, mode, solo, table }) {
  const cast = castOf(scenario, table)
  if (cast.members.every((m) => !m.entity)) return { empty: true }
  if (mode === 'joueur' && !table.myCharacterId) {
    return { say: `Rejoignez la table en jouant ${cast.hero?.name}.`, join: cast.hero?.entity || null }
  }
  if (progress.ending) return { ending: scenario.endings[progress.ending] }
  const step = scenario.steps[progress.step]
  if (progress.phase === 'story') return { story: true, canContinue: true }
  if (step.test) return testMove({ step, mode, solo, table, cast })
  return combatMove({ step, progress, mode, solo, table, cast })
}

// Progression après « Suite ». Le combat s'arrête dès que le dragon tombe, sinon
// après le dernier tour du dernier round (le dragon s'envole) ou si le héros tombe.
export function advance({ scenario, progress, table }) {
  const step = scenario.steps[progress.step]
  if (progress.phase === 'story') return { ...progress, phase: 'play', round: 1, turn: 0, baseAttackId: table.attack?.id ?? null }
  if (step.test) {
    if (progress.step + 1 >= scenario.steps.length) return { ...progress, ending: 'escape' }
    return { ...INITIAL_PROGRESS, step: progress.step + 1 }
  }
  const cast = castOf(scenario, table)
  if (cast.dragon && cast.dragon.pv.current <= 0) return { ...progress, ending: 'victory' }
  if (cast.hero?.entity && cast.hero.entity.pv.current <= 0) return { ...progress, ending: 'retreat' }
  const baseAttackId = table.attack?.id ?? null
  if (progress.turn + 1 < step.combat.turns.length) return { ...progress, turn: progress.turn + 1, baseAttackId }
  if (progress.round < step.combat.rounds) return { ...progress, round: progress.round + 1, turn: 0, baseAttackId }
  return { ...progress, ending: 'escape' }
}
