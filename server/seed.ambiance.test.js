import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'

// Ambiance de la démo (ticket 101) : même règle que seed.scenario.test.js, DATA_DIR
// temporaire posé avant l'import dynamique de db.js, closeDb() avant la suppression.
let db
let seed
let dragonScenario
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-seed-ambiance-test-'))
  process.env.DATA_DIR = tmpDir
  process.env.SCENARIO = 'dragon'
  db = await import('./db.js')
  seed = await import('./seed.js')
  ;({ dragonScenario } = await import('../src/scenarios/dragon.js'))
})

afterEach(() => {
  process.env.SCENARIO = 'dragon'
  dragonScenario.ambiance = 'medieval'
})

afterAll(() => {
  delete process.env.SCENARIO
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('ambiance de la démo (ticket 101)', () => {
  it('le scénario du dragon déclare l\'ambiance Médiéval', () => {
    expect(dragonScenario.ambiance).toBe('medieval')
    expect(seed.ambianceDuScenario(dragonScenario)).toBe('medieval')
  })

  it('retombe sur Cyber sans scénario ou avec une ambiance absente de la liste', () => {
    expect(seed.ambianceDuScenario(null)).toBe('cyber')
    expect(seed.ambianceDuScenario({ id: 'x' })).toBe('cyber')
    for (const ambiance of ['pirate', '', 42, 'MEDIEVAL', '__proto__']) {
      expect(seed.ambianceDuScenario({ id: 'x', ambiance })).toBe('cyber')
    }
  })

  it('crée la table de démo en Médiéval sur une base vide', async () => {
    expect(db.listCharacters()).toHaveLength(0)
    expect(db.getTableState().ambiance).toBe('cyber')
    await seed.seedIfEmpty()
    await seed.seedNpcsIfEmpty()
    seed.appliquerAmbianceDuScenario()
    expect(db.listCharacters()).toHaveLength(3)
    expect(db.getTableState().ambiance).toBe('medieval')
  })

  it('remet en Médiéval une base de démo existante au redémarrage, sans perdre personnages ni code', async () => {
    db.setAmbiance('cyber')
    const { code } = db.getTableState()
    const ids = db.listCharacters().map((c) => c.id)

    // Redémarrage : même séquence que server/index.js.
    await seed.seedIfEmpty()
    await seed.seedNpcsIfEmpty()
    expect(seed.appliquerAmbianceDuScenario()).toBe('medieval')

    const state = db.getTableState()
    expect(state.ambiance).toBe('medieval')
    expect(state.code).toBe(code)
    expect(db.listCharacters().map((c) => c.id)).toEqual(ids)
    expect(db.listNpcs()).toHaveLength(1)
  })

  it('remet aussi en Médiéval une table de démo passée dans une autre ambiance', () => {
    db.setAmbiance('gothique')
    seed.appliquerAmbianceDuScenario()
    expect(db.getTableState().ambiance).toBe('medieval')
  })

  it('« Recommencer la démo » sans ambiance garde Médiéval, une ambiance explicite est respectée', async () => {
    expect(await seed.resetScenarioTable()).toBe(true)
    expect(db.getTableState().ambiance).toBe('medieval')
    expect(db.listCharacters()).toHaveLength(3)
    expect(await seed.resetScenarioTable('espace')).toBe(true)
    expect(db.getTableState().ambiance).toBe('espace')
    expect(db.listCharacters()).toHaveLength(3)
  })

  it('un scénario à ambiance invalide crée sa table en Cyber sans planter', async () => {
    dragonScenario.ambiance = 'pirate'
    db.resetTable('gothique')
    expect(db.listCharacters()).toHaveLength(0)
    await seed.seedIfEmpty()
    expect(db.listCharacters()).toHaveLength(3)
    expect(db.getTableState().ambiance).toBe('cyber')
    expect(seed.appliquerAmbianceDuScenario()).toBe('cyber')
    expect(await seed.resetScenarioTable()).toBe(true)
    expect(db.getTableState().ambiance).toBe('cyber')
  })

  it('hors démo, le démarrage ne touche pas à l\'ambiance', () => {
    delete process.env.SCENARIO
    db.setAmbiance('horreur')
    expect(seed.appliquerAmbianceDuScenario()).toBe(null)
    expect(db.getTableState().ambiance).toBe('horreur')
  })
})
