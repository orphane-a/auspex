import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// db.js opens (and migrates) its SQLite file as a side effect of being imported,
// so each test file gets its own throwaway DATA_DIR and dynamically imports the
// module afterwards — importing it eagerly would touch whatever DATA_DIR (or the
// real dev table.sqlite) happened to be set when the test process started.
let db
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-db-test-'))
  process.env.DATA_DIR = tmpDir
  db = await import('./db.js')
})

afterAll(() => {
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('table state', () => {
  it('creates a table code in the LL-NNNN format on first access', () => {
    const state = db.getTableState()
    expect(state.code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{2}-\d{4}$/)
    expect(state.request).toBeNull()
    expect(state.rolls).toEqual({})
    expect(state.attack).toBeNull()
  })

  it('persists a request and rolls, and clearRequest wipes both', () => {
    db.setRequest({ skill: 'Esquive', malus: '+10' })
    db.setRolls({ 1: { roll: 30, status: 'success', degrees: 2 } })
    expect(db.getTableState().request).toEqual({ skill: 'Esquive', malus: '+10' })

    db.clearRequest()
    expect(db.getTableState().request).toBeNull()
    expect(db.getTableState().rolls).toEqual({})
  })

  it('patchRoll merges into the existing rolls map', () => {
    db.setRolls({ 1: { roll: 10 } })
    const rolls = db.patchRoll(2, { roll: 20 })
    expect(rolls).toEqual({ 1: { roll: 10 }, 2: { roll: 20 } })
  })
})

describe('character CRUD', () => {
  it('creates a character with sane defaults and reads it back unchanged', () => {
    const created = db.addCharacter({ name: 'Djoko', skills: [{ name: 'Esquive', characteristic: 'Agi', score: 30 }] })

    expect(created.name).toBe('Djoko')
    expect(created.cls).toBe('')
    expect(created.pv).toEqual({ max: 10, current: 10, base: 10, bonuses: [] })
    expect(created.armor).toEqual({})
    expect(created.characteristics).toEqual({})
    expect(created.weapons).toEqual([])

    expect(db.getCharacter(created.id)).toEqual(created)
    expect(db.listCharacters().map((c) => c.id)).toContain(created.id)
  })

  it('stores a character weapons list (V3) and reads it back unchanged', () => {
    const weapons = [{ name: 'Lasgun', modeRaw: 'C/2/-', mode: { single: true, semiCapacity: 2, autoCapacity: null }, damage: 5 }]
    const created = db.addCharacter({ name: 'Armed', skills: [], weapons })
    expect(created.weapons).toEqual(weapons)
    expect(db.getCharacter(created.id).weapons).toEqual(weapons)
  })

  it('removes a character', () => {
    const created = db.addCharacter({ name: 'Temp', skills: [] })
    db.removeCharacter(created.id)
    expect(db.getCharacter(created.id)).toBeNull()
  })

  it('updates a single skill score without touching the others', () => {
    const created = db.addCharacter({
      name: 'Skillful',
      skills: [
        { name: 'Esquive', characteristic: 'Agi', score: 30 },
        { name: 'Discrétion', characteristic: 'Agi', score: 20 },
      ],
    })

    const updated = db.updateSkillScore(created.id, 'Esquive', 45)
    expect(updated.skills).toEqual([
      { name: 'Esquive', characteristic: 'Agi', score: 45 },
      { name: 'Discrétion', characteristic: 'Agi', score: 20 },
    ])
  })
})

describe('PV bonuses and current PV clamping', () => {
  it('adding/removing a PV bonus changes pv.max accordingly', () => {
    const created = db.addCharacter({ name: 'Tanky', skills: [], pvBase: 10 })

    const withBonus = db.addPvBonus(created.id, { label: 'Armure renforcée', amount: 5 })
    expect(withBonus.pv.max).toBe(15)

    const withoutBonus = db.removePvBonus(created.id, 0)
    expect(withoutBonus.pv.max).toBe(10)
  })

  it('clamps updatePvCurrent to [0, pv.max]', () => {
    const created = db.addCharacter({ name: 'Fragile', skills: [], pvBase: 10 })

    expect(db.updatePvCurrent(created.id, -5).pv.current).toBe(0)
    expect(db.updatePvCurrent(created.id, 999).pv.current).toBe(10)
    expect(db.updatePvCurrent(created.id, 4).pv.current).toBe(4)
  })
})

describe('armor', () => {
  it('merges new locations into the existing armor without dropping the others', () => {
    const created = db.addCharacter({ name: 'Armored', skills: [], armor: { tete: 2 } })
    const updated = db.updateArmor(created.id, { abdomen: 5 })
    expect(updated.armor).toEqual({ tete: 2, abdomen: 5 })
  })
})

describe('NPCs', () => {
  it('round-trips through addNpc/getNpc/removeNpc', () => {
    const created = db.addNpc({ name: 'Culiste', characteristics: { For: 30 }, weapons: [], pvBase: 12 })
    expect(created.pv).toEqual({ max: 12, current: 12, base: 12, bonuses: [] })
    expect(created.dodgeBonus).toBe(0)
    expect(db.getNpc(created.id).name).toBe('Culiste')

    db.removeNpc(created.id)
    expect(db.getNpc(created.id)).toBeNull()
  })

  it('clamps updateNpcPvCurrent to [0, pv.max]', () => {
    const created = db.addNpc({ name: 'Fragile', pvBase: 10 })

    expect(db.updateNpcPvCurrent(created.id, -5).pv.current).toBe(0)
    expect(db.updateNpcPvCurrent(created.id, 999).pv.current).toBe(10)
    expect(db.updateNpcPvCurrent(created.id, 4).pv.current).toBe(4)
  })

  it('merges new armor locations into an NPC without dropping the others', () => {
    const created = db.addNpc({ name: 'Armored', armor: { tete: 2 } })
    const updated = db.updateNpcArmor(created.id, { abdomen: 5 })
    expect(updated.armor).toEqual({ tete: 2, abdomen: 5 })
  })

  it('sets an NPC dodge bonus, manual-only and independent from the sheet import', () => {
    const created = db.addNpc({ name: 'Boss' })
    expect(db.updateNpcDodgeBonus(created.id, 20).dodgeBonus).toBe(20)
  })
})

describe('resetTable', () => {
  it('wipes all characters and generates a fresh table code', () => {
    db.addCharacter({ name: 'ToBeWiped', skills: [] })
    const before = db.getTableState().code

    const after = db.resetTable()

    expect(db.listCharacters()).toEqual([])
    expect(after.code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{2}-\d{4}$/)
    expect(after.request).toBeNull()
    expect(after.rolls).toEqual({})
    // Not guaranteed to differ (random codes can collide), but the format must hold.
    expect(typeof before).toBe('string')
  })
})
