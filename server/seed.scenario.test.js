import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// Instance de démo (ticket 97) : même règle que seed.test.js — DATA_DIR temporaire
// posé avant l'import dynamique de db.js, closeDb() avant de supprimer le dossier.
let db
let seed
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-seed-scenario-test-'))
  process.env.DATA_DIR = tmpDir
  process.env.SCENARIO = 'dragon'
  db = await import('./db.js')
  seed = await import('./seed.js')
})

afterAll(() => {
  delete process.env.SCENARIO
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('seed en mode démo (SCENARIO=dragon)', () => {
  it('crée exactement les 3 personnages du scénario et le dragon, sans Djoko ni PNJ_test', async () => {
    await seed.seedIfEmpty()
    await seed.seedNpcsIfEmpty()

    const characters = db.listCharacters()
    expect(characters.map((c) => c.name)).toEqual(['Aldric', 'Ysolde', 'Brannoc'])
    expect(characters.every((c) => c.avatar.startsWith('data:image/svg+xml'))).toBe(true)
    expect(characters.every((c) => c.weapons.length > 0 && c.skills.length >= 6)).toBe(true)
    expect(characters.find((c) => c.name === 'Aldric').pv).toMatchObject({ current: 40, max: 40 })

    const npcs = db.listNpcs()
    expect(npcs).toHaveLength(1)
    expect(npcs[0]).toMatchObject({ name: 'Le dragon rouge', dodgeBonus: 10, pv: { current: 60, max: 60 } })
  })

  it('ne duplique rien au redémarrage', async () => {
    await seed.seedIfEmpty()
    await seed.seedNpcsIfEmpty()
    expect(db.listCharacters()).toHaveLength(3)
    expect(db.listNpcs()).toHaveLength(1)
  })

  it('recrée le scénario à la remise à zéro : PV, jets et attaque effacés', async () => {
    const [aldric, ysolde] = db.listCharacters()
    const [dragon] = db.listNpcs()
    db.updatePvCurrent(aldric.id, 5)
    db.updateNpcPvCurrent(dragon.id, 12)
    db.setRequest({ id: 1, skill: 'Perception', malus: null, concernedCharacterIds: [aldric.id, ysolde.id] })
    db.patchRoll(ysolde.id, { roll: 10, target: 55, status: 'success', degrees: 5 })
    const codeBefore = db.getTableState().code

    expect(await seed.resetScenarioTable()).toBe(true)

    const characters = db.listCharacters()
    expect(characters.map((c) => c.name)).toEqual(['Aldric', 'Ysolde', 'Brannoc'])
    expect(characters[0].pv.current).toBe(40)
    const npcs = db.listNpcs()
    expect(npcs).toHaveLength(1)
    expect(npcs[0]).toMatchObject({ name: 'Le dragon rouge', dodgeBonus: 10, pv: { current: 60 } })
    const state = db.getTableState()
    expect(state).toMatchObject({ request: null, rolls: {}, attack: null })
    expect(state.code).not.toBe(codeBefore)
  })
})
