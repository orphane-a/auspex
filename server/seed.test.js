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

// Sans mode démo (ticket 97, critère 8) : le seed habituel ne doit pas bouger.
describe('sans SCENARIO', () => {
  it("n'active aucun scénario et ne crée aucune donnée de démo", async () => {
    expect(process.env.SCENARIO).toBeUndefined()
    expect(seed.activeScenario()).toBeNull()
    expect(await seed.resetScenarioTable()).toBe(false)
    expect(db.listCharacters().map((c) => c.name)).not.toContain('Aldric')
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

describe('personnages fictifs (ticket 94)', () => {
  it('crée Djoko et trois fictifs distincts sur une table vide', async () => {
    db.resetTable()
    await seed.seedIfEmpty()

    const characters = db.listCharacters()
    expect(characters.map((c) => c.name)).toEqual(['Djoko', 'Vex', 'Soeur Ilia', 'Kael'])
    const fictional = characters.filter((c) => c.fictional)
    expect(fictional).toHaveLength(3)
    expect(new Set(fictional.map((c) => c.cls)).size).toBe(3)
    expect(characters.find((c) => c.name === 'Djoko').fictional).toBe(false)
    for (const c of fictional) {
      // Valides pour toutes les routes : test, attaque (Dex + arme), esquive, dégâts.
      expect(c.skills.length).toBeGreaterThan(0)
      expect(c.characteristics.Dex).toBeGreaterThan(0)
      expect(c.characteristics.Agi).toBeGreaterThan(0)
      expect(c.weapons.length).toBeGreaterThan(0)
      expect(c.pv.max).toBeGreaterThan(0)
      expect(c.avatar).toBeNull()
    }
  })

  it('reste idempotent : un second amorçage ne crée rien', async () => {
    await seed.seedIfEmpty()
    await seed.seedIfEmpty()
    expect(db.listCharacters()).toHaveLength(4)
  })

  it("ne touche jamais une table qui contient déjà de vrais personnages", async () => {
    db.resetTable()
    db.addCharacter({ name: 'Alice', skills: [] })
    db.addCharacter({ name: 'Bob', skills: [] })

    await seed.seedIfEmpty()

    expect(db.listCharacters().map((c) => c.name)).toEqual(['Alice', 'Bob'])
  })

  it("addFictionalCharacters n'ajoute rien si des fictifs sont déjà présents", async () => {
    db.resetTable()
    expect(await seed.addFictionalCharacters()).toBe(3)
    expect(await seed.addFictionalCharacters()).toBe(0)
    expect(db.listCharacters().filter((c) => c.fictional)).toHaveLength(3)
  })

  it('AUSPEX_FICTIFS=0 désactive les fictifs', async () => {
    db.resetTable()
    process.env.AUSPEX_FICTIFS = '0'
    try {
      expect(seed.fictionalEnabled()).toBe(false)
      await seed.seedIfEmpty()
      expect(db.listCharacters().map((c) => c.name)).toEqual(['Djoko'])
    } finally {
      delete process.env.AUSPEX_FICTIFS
    }
  })
})
