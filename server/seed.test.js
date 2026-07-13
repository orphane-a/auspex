import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// Same reasoning as db.test.js: db.js (imported by seed.js) opens its SQLite file
// as an import-time side effect, so this file gets its own DATA_DIR first. The
// PNJ_test/*.xlsx fixtures themselves are real, checked-in files — no mocking.
let db
let seed
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-seed-test-'))
  process.env.DATA_DIR = tmpDir
  db = await import('./db.js')
  seed = await import('./seed.js')
})

afterAll(() => {
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('seedIfEmpty', () => {
  it('imports Djoko with a non-empty weapons list (V3 §3/§4)', async () => {
    await seed.seedIfEmpty()

    const [djoko] = db.listCharacters()
    expect(djoko.name).toBe('Djoko')
    expect(djoko.weapons.length).toBeGreaterThan(0)
  })
})

describe('seedNpcsIfEmpty', () => {
  it('imports the three PNJ_test enemies when the npcs table is empty', async () => {
    await seed.seedNpcsIfEmpty()

    const npcs = db.listNpcs()
    expect(npcs.map((n) => n.name).sort()).toEqual(['Culiste Armé', 'Garde Impérial', 'Marine Renégat'].sort())
    for (const npc of npcs) {
      expect(npc.pv.max).toBeGreaterThan(0)
    }
  })

  it('does not duplicate NPCs on a second call', async () => {
    await seed.seedNpcsIfEmpty()
    await seed.seedNpcsIfEmpty()
    expect(db.listNpcs()).toHaveLength(3)
  })
})
