import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCharacterSheet } from './xlsxParser.js'
import { addCharacter, getTableState, listCharacters } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_FILE = path.join(__dirname, '..', 'PJ_Djoko_mk4.xlsx')

// Dev convenience: every time the server starts up with an empty table, drop the
// real Djoko sheet back in so testing never starts from a blank MjHome screen.
// Only fires when there are zero characters — a deliberate "reset table" stays empty.
export async function seedIfEmpty() {
  if (listCharacters().length > 0) return
  if (!fs.existsSync(SEED_FILE)) return
  try {
    const buffer = fs.readFileSync(SEED_FILE)
    const { skills, avatar, pvBase, pvCurrent, armor, characteristics } = await parseCharacterSheet(buffer)
    addCharacter({ name: 'Djoko', cls: 'Maître stellaire', skills, avatar, pvBase, pvCurrent, armor, characteristics })
    const { code } = getTableState()
    console.log(`Seed dev : "Djoko" ajouté automatiquement — table ${code}`)
  } catch (err) {
    console.warn('Seed dev : échec de l\'import automatique de Djoko —', err.message)
  }
}
