import { describe, it, expect } from 'vitest'
import { dragonScenario as scenario } from './dragon.js'
import { nextMove, advance, syncProgress, INITIAL_PROGRESS } from './guide.js'

const ALDRIC = 1
const YSOLDE = 2
const BRANNOC = 3
const DRAGON = 10

function table(overrides = {}) {
  return {
    characters: [
      { id: ALDRIC, name: 'Aldric', pv: { current: 40, max: 40 } },
      { id: YSOLDE, name: 'Ysolde', pv: { current: 32, max: 32 } },
      { id: BRANNOC, name: 'Brannoc', pv: { current: 26, max: 26 } },
    ],
    npcs: [{ id: DRAGON, name: 'Le dragon rouge', pv: { current: 20, max: 20 } }],
    request: null,
    rolls: {},
    attack: null,
    myCharacterId: null,
    ...overrides,
  }
}

const playTest = { ...INITIAL_PROGRESS, phase: 'play' }
const perception = { id: 7, skill: 'Perception', malus: null, concernedCharacterIds: [ALDRIC, YSOLDE, BRANNOC] }
const combat = { ...INITIAL_PROGRESS, step: 4, phase: 'play', baseAttackId: null }

describe('guide : étape de test', () => {
  it('commence par le texte à lire', () => {
    expect(nextMove({ scenario, progress: INITIAL_PROGRESS, mode: 'mj', solo: true, table: table() })).toMatchObject({ story: true })
  })

  it('côté MJ, montre le bouton pour ordonner le test', () => {
    const move = nextMove({ scenario, progress: playTest, mode: 'mj', solo: true, table: table() })
    expect(move.target).toEqual({ kind: 'launchTest', skill: 'Perception', malus: null })
    expect(move.auto).toBeUndefined()
  })

  it("côté joueur seul, le guide ordonne lui même le test à toute l'équipe", () => {
    const move = nextMove({ scenario, progress: playTest, mode: 'joueur', solo: true, table: table({ myCharacterId: ALDRIC }) })
    expect(move.auto).toMatchObject({ kind: 'createRequest', skill: 'Perception', ids: [ALDRIC, YSOLDE, BRANNOC] })
  })

  it("côté joueur à deux, attend l'ordre du MJ sans rien jouer", () => {
    const move = nextMove({ scenario, progress: playTest, mode: 'joueur', solo: false, table: table({ myCharacterId: ALDRIC }) })
    expect(move.auto).toBeUndefined()
    expect(move.target).toBeUndefined()
  })

  it('côté MJ seul, lance les dés des compagnons et du héros ; à deux, seulement des compagnons', () => {
    const t = table({ request: perception })
    expect(nextMove({ scenario, progress: playTest, mode: 'mj', solo: true, table: t }).auto.ids).toEqual([YSOLDE, BRANNOC, ALDRIC])
    expect(nextMove({ scenario, progress: playTest, mode: 'mj', solo: false, table: t }).auto.ids).toEqual([YSOLDE, BRANNOC])
  })

  it('côté joueur, montre le bouton LANCER tant que le héros n’a pas lancé', () => {
    const move = nextMove({ scenario, progress: playTest, mode: 'joueur', solo: true, table: table({ request: perception, myCharacterId: ALDRIC }) })
    expect(move.target).toEqual({ kind: 'playerRoll' })
  })

  it("donne la suite de l'histoire quand tout le monde a lancé", () => {
    const rolls = { [ALDRIC]: { status: 'fail' }, [YSOLDE]: { status: 'success' }, [BRANNOC]: { status: 'fail' } }
    const move = nextMove({ scenario, progress: playTest, mode: 'mj', solo: true, table: table({ request: perception, rolls }) })
    expect(move.result).toEqual({ ok: true, text: scenario.steps[0].success })
    expect(move.canContinue).toBe(true)
  })

  it("passe à l'étape suivante, de retour au texte à lire", () => {
    expect(advance({ scenario, progress: INITIAL_PROGRESS, table: table() })).toMatchObject({ phase: 'play' })
    expect(advance({ scenario, progress: playTest, table: table() })).toEqual({ ...INITIAL_PROGRESS, step: 1 })
  })
})

describe('guide : combat', () => {
  const aldricAttack = (outcome, id = 100) => ({ id, attacker: { type: 'character', id: ALDRIC }, defender: { type: 'npc', id: DRAGON }, outcome, degrees: 2, dodgeDegrees: 1 })

  it("côté MJ, guide la modale d'attaque d'Aldric contre le dragon", () => {
    const move = nextMove({ scenario, progress: combat, mode: 'mj', solo: true, table: table() })
    expect(move.target).toMatchObject({ kind: 'attackModal', weapon: 'Épée longue', fireModeLabel: 'Corps à corps' })
    expect(move.target.attacker.name).toBe('Aldric')
  })

  it("côté joueur seul, lance l'attaque puis montre le bouton du jet d'attaque", () => {
    const t = table({ myCharacterId: ALDRIC })
    expect(nextMove({ scenario, progress: combat, mode: 'joueur', solo: true, table: t }).auto).toMatchObject({
      kind: 'launchAttack',
      payload: { attackerType: 'character', attackerId: ALDRIC, defenderType: 'npc', defenderId: DRAGON, weaponName: 'Épée longue', fireMode: 'melee' },
    })
    const pending = nextMove({ scenario, progress: combat, mode: 'joueur', solo: true, table: { ...t, attack: aldricAttack('pending-attack-roll') } })
    expect(pending.target).toEqual({ kind: 'playerRoll' })
  })

  it("côté MJ seul, lance le jet d'Aldric puis montre l'esquive du dragon", () => {
    expect(nextMove({ scenario, progress: combat, mode: 'mj', solo: true, table: table({ attack: aldricAttack('pending-attack-roll') }) }).auto).toMatchObject({ kind: 'attackRoll', characterId: ALDRIC })
    expect(nextMove({ scenario, progress: combat, mode: 'mj', solo: true, table: table({ attack: aldricAttack('pending-dodge') }) }).target).toEqual({ kind: 'npcDodge' })
  })

  it("présente le résultat du point de vue de l'équipe", () => {
    expect(nextMove({ scenario, progress: combat, mode: 'mj', solo: true, table: table({ attack: aldricAttack('miss') }) }).result.ok).toBe(false)
    expect(nextMove({ scenario, progress: combat, mode: 'mj', solo: true, table: table({ attack: aldricAttack('hit') }) }).result.ok).toBe(true)
  })

  it("ignore l'attaque du tour précédent", () => {
    const progress = { ...combat, baseAttackId: 100 }
    const move = nextMove({ scenario, progress, mode: 'mj', solo: true, table: table({ attack: aldricAttack('hit', 100) }) })
    expect(move.target?.kind).toBe('attackModal')
  })

  it("au tour du dragon, le joueur esquive et le MJ seul esquive à sa place", () => {
    const progress = { ...combat, turn: 1, baseAttackId: 100 }
    const claws = { id: 101, attacker: { type: 'npc', id: DRAGON }, defender: { type: 'character', id: ALDRIC }, outcome: 'pending-dodge', degrees: 1 }
    expect(nextMove({ scenario, progress, mode: 'joueur', solo: true, table: table({ attack: claws, myCharacterId: ALDRIC }) }).target).toEqual({ kind: 'playerDodge' })
    expect(nextMove({ scenario, progress, mode: 'mj', solo: true, table: table({ attack: claws }) }).auto).toMatchObject({ kind: 'dodge', characterId: ALDRIC })
  })

  it('finit sur la victoire dès que le dragon tombe, sinon le dragon s’envole après le dernier tour', () => {
    const dead = table({ npcs: [{ id: DRAGON, name: 'Le dragon rouge', pv: { current: 0, max: 20 } }], attack: aldricAttack('hit') })
    expect(advance({ scenario, progress: combat, table: dead }).ending).toBe('victory')
    const t = table({ attack: aldricAttack('miss') })
    expect(advance({ scenario, progress: combat, table: t })).toMatchObject({ turn: 1, round: 1, baseAttackId: 100 })
    expect(advance({ scenario, progress: { ...combat, turn: 1 }, table: t })).toMatchObject({ turn: 0, round: 2 })
    expect(advance({ scenario, progress: { ...combat, turn: 1, round: 3 }, table: t }).ending).toBe('escape')
  })

  it("propose de rejoindre la table côté joueur, avec le héros", () => {
    const move = nextMove({ scenario, progress: combat, mode: 'joueur', solo: true, table: table() })
    expect(move.join.id).toBe(ALDRIC)
  })
})

describe('guide : la vue joueur rattrape le MJ (retour du 22/11)', () => {
  const discretion = { id: 8, skill: 'Discrétion', malus: '+10', concernedCharacterIds: [ALDRIC, YSOLDE, BRANNOC] }
  const attack = (id, attacker, defender, outcome = 'pending-attack-roll') => ({ id, attacker, defender, outcome })
  const aldric = { type: 'character', id: ALDRIC }
  const dragon = { type: 'npc', id: DRAGON }

  it("rejoint le test d'une étape plus loin, déjà ordonné par le MJ", () => {
    const synced = syncProgress({ scenario, progress: playTest, table: table({ request: discretion }) })
    expect(synced).toMatchObject({ step: 1, phase: 'play' })
  })

  it('ne bouge pas quand la table montre le test de son étape, ou rien', () => {
    expect(syncProgress({ scenario, progress: playTest, table: table({ request: perception }) })).toBe(playTest)
    expect(syncProgress({ scenario, progress: playTest, table: table() })).toBe(playTest)
  })

  it('ne revient jamais en arrière', () => {
    const later = { ...INITIAL_PROGRESS, step: 2, phase: 'play' }
    expect(syncProgress({ scenario, progress: later, table: table({ request: perception }) })).toBe(later)
  })

  it("rejoint le combat quand l'attaque est lancée, au bon tour", () => {
    const fromTest = syncProgress({ scenario, progress: playTest, table: table({ attack: attack(5, dragon, aldric, 'pending-dodge') }) })
    expect(fromTest).toMatchObject({ step: 4, phase: 'play', turn: 1 })
    const fromStory = syncProgress({ scenario, progress: { ...combat, phase: 'story' }, table: table({ attack: attack(5, aldric, dragon) }) })
    expect(fromStory).toMatchObject({ step: 4, phase: 'play', turn: 0 })
  })

  it('passe au tour suivant du combat, et au round suivant quand le tour reboucle', () => {
    const t1 = syncProgress({ scenario, progress: { ...combat, baseAttackId: 4 }, table: table({ attack: attack(5, dragon, aldric, 'pending-dodge') }) })
    expect(t1).toMatchObject({ turn: 1, round: 1 })
    const t0 = syncProgress({ scenario, progress: { ...combat, turn: 1, baseAttackId: 5 }, table: table({ attack: attack(6, aldric, dragon) }) })
    expect(t0).toMatchObject({ turn: 0, round: 2 })
  })

  it("ignore une attaque terminée ou celle déjà jouée à ce tour", () => {
    const done = table({ attack: attack(5, dragon, aldric, 'hit') })
    expect(syncProgress({ scenario, progress: combat, table: done })).toBe(combat)
    const old = { ...combat, baseAttackId: 5 }
    expect(syncProgress({ scenario, progress: old, table: table({ attack: attack(5, dragon, aldric, 'pending-dodge') }) })).toBe(old)
  })
})
