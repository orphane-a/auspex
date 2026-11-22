import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'

// Scénario inconnu (ticket 97, critère 9) : avertissement clair, aucune donnée de
// démo, et le seed habituel comme si SCENARIO n'était pas défini.
let db
let seed
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-seed-unknown-test-'))
  process.env.DATA_DIR = tmpDir
  process.env.SCENARIO = 'inconnu'
  db = await import('./db.js')
  seed = await import('./seed.js')
})

afterAll(() => {
  delete process.env.SCENARIO
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

// Seed habituel depuis le ticket 94 : Djoko puis les personnages fictifs.
const SEED_HABITUEL = () => ['Djoko', ...seed.FICTIONAL_CHARACTERS.map((f) => f.name)]

describe('seed avec SCENARIO=inconnu', () => {
  it('avertit une seule fois puis retombe sur Djoko et les PNJ_test', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await seed.seedIfEmpty()
    await seed.seedNpcsIfEmpty()

    expect(warn).toHaveBeenCalledWith('Scénario inconnu : inconnu')
    expect(warn.mock.calls.filter((c) => c[0] === 'Scénario inconnu : inconnu')).toHaveLength(1)
    warn.mockRestore()

    expect(db.listCharacters().map((c) => c.name)).toEqual(SEED_HABITUEL())
    expect(db.listNpcs()).toHaveLength(3)
    expect(db.listNpcs().map((n) => n.name)).not.toContain('Le dragon rouge')
  })

  it('garde la remise à zéro habituelle (resetScenarioTable ne fait rien)', async () => {
    expect(await seed.resetScenarioTable()).toBe(false)
    expect(db.listCharacters().map((c) => c.name)).toEqual(SEED_HABITUEL())
  })
})
