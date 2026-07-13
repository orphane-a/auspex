import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// DATA_DIR points at a persistent volume in production (e.g. Railway), so the
// database survives restarts/redeploys. Defaults to this folder for local dev,
// where the sqlite file always lived next to this script.
const DATA_DIR = process.env.DATA_DIR || __dirname
// better-sqlite3 refuses to create the directory itself — on a freshly attached
// volume (or a first boot before the mount is fully ready), it may not exist yet.
fs.mkdirSync(DATA_DIR, { recursive: true })
const db = new Database(path.join(DATA_DIR, 'table.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cls TEXT,
    skills TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS table_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    code TEXT NOT NULL,
    request TEXT,
    rolls TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS npcs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    characteristics TEXT NOT NULL DEFAULT '{}',
    weapons TEXT NOT NULL DEFAULT '[]',
    pv_base INTEGER NOT NULL DEFAULT 10,
    pv_bonuses TEXT NOT NULL DEFAULT '[]',
    pv_current INTEGER NOT NULL DEFAULT 10,
    armor TEXT NOT NULL DEFAULT '{}'
  );
`)

// Dev-friendly migration: `avatar` was added after the first `characters` table
// shipped, so an existing table.sqlite from before won't have the column yet.
const characterColumns = db.prepare('PRAGMA table_info(characters)').all().map((c) => c.name)
if (!characterColumns.includes('avatar')) {
  db.exec('ALTER TABLE characters ADD COLUMN avatar TEXT')
}
if (!characterColumns.includes('pv_base')) {
  db.exec('ALTER TABLE characters ADD COLUMN pv_base INTEGER NOT NULL DEFAULT 10')
}
if (!characterColumns.includes('pv_current')) {
  db.exec('ALTER TABLE characters ADD COLUMN pv_current INTEGER NOT NULL DEFAULT 10')
}
if (!characterColumns.includes('pv_bonuses')) {
  db.exec("ALTER TABLE characters ADD COLUMN pv_bonuses TEXT NOT NULL DEFAULT '[]'")
}
if (!characterColumns.includes('armor')) {
  db.exec("ALTER TABLE characters ADD COLUMN armor TEXT NOT NULL DEFAULT '{}'")
}
if (!characterColumns.includes('characteristics')) {
  db.exec("ALTER TABLE characters ADD COLUMN characteristics TEXT NOT NULL DEFAULT '{}'")
}
if (!characterColumns.includes('dodge_bonus')) {
  db.exec('ALTER TABLE characters ADD COLUMN dodge_bonus INTEGER NOT NULL DEFAULT 0')
}
// Weapons for a player character (V3 §4) — same shape as an NPC's, so a player can
// be picked as attacker in the generalized attack sequence just like an NPC.
if (!characterColumns.includes('weapons')) {
  db.exec("ALTER TABLE characters ADD COLUMN weapons TEXT NOT NULL DEFAULT '[]'")
}

const tableStateColumns = db.prepare('PRAGMA table_info(table_state)').all().map((c) => c.name)
if (!tableStateColumns.includes('attack')) {
  db.exec('ALTER TABLE table_state ADD COLUMN attack TEXT')
}

// Symmetric to a character's dodge_bonus (V3 §3/§4) — manual-only, never imported,
// lets the MJ make a specific NPC (e.g. a boss) harder to hit despite the sheet
// having no "Esquive" row of its own.
const npcColumns = db.prepare('PRAGMA table_info(npcs)').all().map((c) => c.name)
if (!npcColumns.includes('dodge_bonus')) {
  db.exec('ALTER TABLE npcs ADD COLUMN dodge_bonus INTEGER NOT NULL DEFAULT 0')
}

const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'

function generateTableCode() {
  const letter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)]
  const digits = String(Math.floor(1000 + Math.random() * 9000))
  return `${letter()}${letter()}-${digits}`
}

export function ensureTableState() {
  const existing = db.prepare('SELECT * FROM table_state WHERE id = 1').get()
  if (existing) return existing
  const code = generateTableCode()
  db.prepare('INSERT INTO table_state (id, code, request, rolls) VALUES (1, ?, NULL, ?)').run(code, '{}')
  return db.prepare('SELECT * FROM table_state WHERE id = 1').get()
}

function rowToTableState(row) {
  const attack = row.attack ? JSON.parse(row.attack) : null
  return {
    code: row.code,
    request: row.request ? JSON.parse(row.request) : null,
    rolls: JSON.parse(row.rolls),
    // Une attaque encore en attente au format V2 (npcId/targetCharacterId) ne doit
    // jamais faire planter les clients après ce déploiement (V3 §4) — elle est
    // traitée comme terminée plutôt que lue avec la nouvelle forme attacker/defender.
    attack: attack && attack.attacker && attack.defender ? attack : null,
  }
}

export function getTableState() {
  return rowToTableState(ensureTableState())
}

export function setRequest(request) {
  ensureTableState()
  db.prepare('UPDATE table_state SET request = ? WHERE id = 1').run(request ? JSON.stringify(request) : null)
}

export function setRolls(rolls) {
  ensureTableState()
  db.prepare('UPDATE table_state SET rolls = ? WHERE id = 1').run(JSON.stringify(rolls))
}

export function patchRoll(characterId, roll) {
  const state = getTableState()
  const rolls = { ...state.rolls, [characterId]: roll }
  setRolls(rolls)
  return rolls
}

// Parallel to `request`/`rolls`, not a variant of them (V2 §10) — the three-step
// attack/dodge/damage sequence tracks its own independent piece of table state.
export function setAttack(attack) {
  ensureTableState()
  db.prepare('UPDATE table_state SET attack = ? WHERE id = 1').run(attack ? JSON.stringify(attack) : null)
}

// Ends the current test (back to dashboard) and, when `full` is true, also wipes
// the roster — used by "reset table" vs. just "start a new test".
export function clearRequest() {
  setRequest(null)
  setRolls({})
}

export function resetTable() {
  const code = generateTableCode()
  db.prepare('UPDATE table_state SET code = ?, request = NULL, rolls = ?, attack = NULL WHERE id = 1').run(code, '{}')
  db.prepare('DELETE FROM characters').run()
  return getTableState()
}

function rowToCharacter(row) {
  const bonuses = JSON.parse(row.pv_bonuses)
  return {
    id: row.id,
    name: row.name,
    cls: row.cls || '',
    avatar: row.avatar || null,
    skills: JSON.parse(row.skills),
    pv: { max: row.pv_base + bonuses.reduce((sum, b) => sum + b.amount, 0), current: row.pv_current, base: row.pv_base, bonuses },
    armor: JSON.parse(row.armor),
    characteristics: JSON.parse(row.characteristics),
    dodgeBonus: row.dodge_bonus,
    weapons: JSON.parse(row.weapons),
  }
}

export function listCharacters() {
  return db.prepare('SELECT * FROM characters ORDER BY id ASC').all().map(rowToCharacter)
}

export function getCharacter(id) {
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id)
  return row ? rowToCharacter(row) : null
}

export function addCharacter({ name, cls, skills, avatar, pvBase, pvCurrent, armor, characteristics, weapons }) {
  const result = db
    .prepare(
      'INSERT INTO characters (name, cls, skills, avatar, pv_base, pv_current, pv_bonuses, armor, characteristics, weapons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      name,
      cls || '',
      JSON.stringify(skills),
      avatar || null,
      pvBase ?? 10,
      pvCurrent ?? pvBase ?? 10,
      '[]',
      JSON.stringify(armor || {}),
      JSON.stringify(characteristics || {}),
      JSON.stringify(weapons || []),
    )
  return getCharacter(result.lastInsertRowid)
}

export function removeCharacter(id) {
  db.prepare('DELETE FROM characters WHERE id = ?').run(id)
}

export function updateSkillScore(characterId, skillName, score) {
  const character = getCharacter(characterId)
  if (!character) return null
  const skills = character.skills.map((s) => (s.name === skillName ? { ...s, score } : s))
  db.prepare('UPDATE characters SET skills = ? WHERE id = ?').run(JSON.stringify(skills), characterId)
  return getCharacter(characterId)
}

export function updatePvBase(characterId, value) {
  const character = getCharacter(characterId)
  if (!character) return null
  db.prepare('UPDATE characters SET pv_base = ? WHERE id = ?').run(value, characterId)
  return getCharacter(characterId)
}

// Also used to apply damage/healing (V2 §4/§9) — always clamped to [0, pv_max] so
// a soin excédentaire never overflows and a hit never drives PV below zero.
export function updatePvCurrent(characterId, value) {
  const character = getCharacter(characterId)
  if (!character) return null
  const clamped = Math.max(0, Math.min(character.pv.max, value))
  db.prepare('UPDATE characters SET pv_current = ? WHERE id = ?').run(clamped, characterId)
  return getCharacter(characterId)
}

export function addPvBonus(characterId, bonus) {
  const character = getCharacter(characterId)
  if (!character) return null
  const bonuses = [...character.pv.bonuses, bonus]
  db.prepare('UPDATE characters SET pv_bonuses = ? WHERE id = ?').run(JSON.stringify(bonuses), characterId)
  return getCharacter(characterId)
}

export function removePvBonus(characterId, index) {
  const character = getCharacter(characterId)
  if (!character) return null
  const bonuses = character.pv.bonuses.filter((_, i) => i !== index)
  db.prepare('UPDATE characters SET pv_bonuses = ? WHERE id = ?').run(JSON.stringify(bonuses), characterId)
  return getCharacter(characterId)
}

export function updateArmor(characterId, armor) {
  const character = getCharacter(characterId)
  if (!character) return null
  const merged = { ...character.armor, ...armor }
  db.prepare('UPDATE characters SET armor = ? WHERE id = ?').run(JSON.stringify(merged), characterId)
  return getCharacter(characterId)
}

export function updateDodgeBonus(characterId, value) {
  const character = getCharacter(characterId)
  if (!character) return null
  db.prepare('UPDATE characters SET dodge_bonus = ? WHERE id = ?').run(value, characterId)
  return getCharacter(characterId)
}

// NPCs (V2 §3/§10/§11) : liste séparée des personnages joueurs — pas de rejoint de
// table, pas de suivi de connexion. PV/armure réutilisent le même modèle que les
// personnages joueurs pour ne pas avoir à reprendre l'import quand les PNJ pourront
// eux-mêmes encaisser des dégâts (hors périmètre V2, cf. §11).
function rowToNpc(row) {
  const bonuses = JSON.parse(row.pv_bonuses)
  return {
    id: row.id,
    name: row.name,
    characteristics: JSON.parse(row.characteristics),
    weapons: JSON.parse(row.weapons),
    pv: { max: row.pv_base + bonuses.reduce((sum, b) => sum + b.amount, 0), current: row.pv_current, base: row.pv_base, bonuses },
    armor: JSON.parse(row.armor),
    dodgeBonus: row.dodge_bonus,
  }
}

export function listNpcs() {
  return db.prepare('SELECT * FROM npcs ORDER BY id ASC').all().map(rowToNpc)
}

export function getNpc(id) {
  const row = db.prepare('SELECT * FROM npcs WHERE id = ?').get(id)
  return row ? rowToNpc(row) : null
}

export function addNpc({ name, characteristics, weapons, pvBase, pvCurrent, armor }) {
  const result = db
    .prepare('INSERT INTO npcs (name, characteristics, weapons, pv_base, pv_current, pv_bonuses, armor) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(name, JSON.stringify(characteristics || {}), JSON.stringify(weapons || []), pvBase ?? 10, pvCurrent ?? pvBase ?? 10, '[]', JSON.stringify(armor || {}))
  return getNpc(result.lastInsertRowid)
}

export function removeNpc(id) {
  db.prepare('DELETE FROM npcs WHERE id = ?').run(id)
}

// Mode rapide (V3 §8), symétrique de updatePvCurrent pour un PNJ — un PNJ touché
// en étape 3 de la séquence d'attaque doit avoir où encaisser ses dégâts.
export function updateNpcPvCurrent(npcId, value) {
  const npc = getNpc(npcId)
  if (!npc) return null
  const clamped = Math.max(0, Math.min(npc.pv.max, value))
  db.prepare('UPDATE npcs SET pv_current = ? WHERE id = ?').run(clamped, npcId)
  return getNpc(npcId)
}

export function updateNpcArmor(npcId, armor) {
  const npc = getNpc(npcId)
  if (!npc) return null
  const merged = { ...npc.armor, ...armor }
  db.prepare('UPDATE npcs SET armor = ? WHERE id = ?').run(JSON.stringify(merged), npcId)
  return getNpc(npcId)
}

export function updateNpcDodgeBonus(npcId, value) {
  const npc = getNpc(npcId)
  if (!npc) return null
  db.prepare('UPDATE npcs SET dodge_bonus = ? WHERE id = ?').run(value, npcId)
  return getNpc(npcId)
}

// Lets tests release the file handle before cleaning up a temp DATA_DIR — the
// module never needs to close it during normal server operation.
export function closeDb() {
  db.close()
}
