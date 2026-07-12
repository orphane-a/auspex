import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// Same reasoning as db.test.js: db.js (imported by state.js) opens its SQLite file
// as an import-time side effect, so this file gets its own DATA_DIR before either
// module is loaded.
let db
let state
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-state-test-'))
  process.env.DATA_DIR = tmpDir
  db = await import('./db.js')
  state = await import('./state.js')
})

afterAll(() => {
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('buildSnapshot', () => {
  it('flags each character as connected via the isConnected callback', () => {
    const alice = db.addCharacter({ name: 'Alice', skills: [] })
    const bob = db.addCharacter({ name: 'Bob', skills: [] })

    const snapshot = state.buildSnapshot((id) => id === alice.id)

    const byName = Object.fromEntries(snapshot.characters.map((c) => [c.name, c.connected]))
    expect(byName.Alice).toBe(true)
    expect(byName.Bob).toBe(false)
  })

  it('builds the availableSkills list de-duplicated by name and sorted', () => {
    db.resetTable()
    db.addCharacter({
      name: 'Alice',
      skills: [
        { name: 'Esquive', characteristic: 'Agi', score: 30 },
        { name: 'Acrobaties', characteristic: 'Agi', score: 20 },
      ],
    })
    db.addCharacter({
      name: 'Bob',
      // Same skill name as Alice's, on purpose: must not produce a duplicate entry.
      skills: [{ name: 'Esquive', characteristic: 'Agi', score: 40 }],
    })

    const snapshot = state.buildSnapshot(() => false)

    expect(snapshot.availableSkills).toEqual([
      { name: 'Acrobaties', characteristic: 'Agi' },
      { name: 'Esquive', characteristic: 'Agi' },
    ])
  })

  it('surfaces the current table code, request, rolls, and npcs', () => {
    db.resetTable()
    db.setRequest({ skill: 'Esquive', malus: null })
    db.addNpc({ name: 'Culiste', characteristics: {}, weapons: [] })

    const snapshot = state.buildSnapshot(() => false)

    expect(snapshot.code).toBe(db.getTableState().code)
    expect(snapshot.request).toEqual({ skill: 'Esquive', malus: null })
    expect(snapshot.npcs).toHaveLength(1)
    expect(snapshot.npcs[0].name).toBe('Culiste')
  })
})

describe('characteristicForSkillName', () => {
  it("finds a skill's linked characteristic from any character's sheet", () => {
    db.resetTable()
    db.addCharacter({ name: 'Alice', skills: [{ name: 'Esquive', characteristic: 'Agi', score: 30 }] })

    expect(state.characteristicForSkillName('Esquive')).toBe('Agi')
  })

  it('returns null when no character knows the skill', () => {
    db.resetTable()
    expect(state.characteristicForSkillName('Inconnu')).toBeNull()
  })
})
