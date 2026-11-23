import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

// Ticket 100, critère 6 : une base créée avant l'ambiance (table_state sans la
// colonne) est migrée au démarrage, sans perte de données. La base « ancienne »
// est écrite à la main avant l'import dynamique de db.js, qui la migre.
let db
let tmpDir

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-db-ambiance-test-'))
  const old = new Database(path.join(tmpDir, 'table.sqlite'))
  old.exec(`
    CREATE TABLE characters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cls TEXT, skills TEXT NOT NULL);
    CREATE TABLE table_state (id INTEGER PRIMARY KEY CHECK (id = 1), code TEXT NOT NULL, request TEXT, rolls TEXT NOT NULL DEFAULT '{}', attack TEXT);
  `)
  old.prepare('INSERT INTO table_state (id, code, request, rolls) VALUES (1, ?, NULL, ?)').run('XR-4417', '{}')
  old.prepare('INSERT INTO characters (name, cls, skills) VALUES (?, ?, ?)').run('Djoko', 'Maître stellaire', '[]')
  old.close()
  process.env.DATA_DIR = tmpDir
  db = await import('./db.js')
})

afterAll(() => {
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('ambiance de la table (ticket 100)', () => {
  it("migre une ancienne base en cyber, sans perte de données", () => {
    const state = db.getTableState()
    expect(state.ambiance).toBe('cyber')
    expect(state.code).toBe('XR-4417')
    expect(db.listCharacters().map((c) => c.name)).toEqual(['Djoko'])
  })

  it("resetTable enregistre l'ambiance choisie, cyber par défaut", () => {
    expect(db.resetTable('gothique').ambiance).toBe('gothique')
    expect(db.getTableState().ambiance).toBe('gothique')
    expect(db.resetTable().ambiance).toBe('cyber')
  })
})
