import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCharacterSheet, parseNpcSheet } from './xlsxParser.js'
import { addCharacter, addNpc, getTableState, listCharacters, listNpcs } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_FILE = path.join(__dirname, '..', 'PJ_Djoko_mk4.xlsx')
const NPC_SEED_DIR = path.join(__dirname, '..', 'PNJ_test')

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

// NPC sheets (unlike player sheets) don't carry their own name — routes.js normally
// takes it from the upload form — so the seed files get one here, matched by filename.
const NPC_SEED_NAMES = {
  'PNJ_Culiste_Arme.xlsx': 'Culiste Armé',
  'PNJ_Garde_Imperial.xlsx': 'Garde Impérial',
  'PNJ_Marine_Renegat.xlsx': 'Marine Renégat',
}

// Same dev convenience as seedIfEmpty, for the PNJ_test/ enemy stat blocks — fires
// independently since resetTable() only wipes the characters table, not npcs.
export async function seedNpcsIfEmpty() {
  if (listNpcs().length > 0) return
  if (!fs.existsSync(NPC_SEED_DIR)) return
  for (const [file, name] of Object.entries(NPC_SEED_NAMES)) {
    const filePath = path.join(NPC_SEED_DIR, file)
    if (!fs.existsSync(filePath)) continue
    try {
      const buffer = fs.readFileSync(filePath)
      const { characteristics, weapons, pvBase, pvCurrent, armor } = await parseNpcSheet(buffer)
      addNpc({ name, characteristics, weapons, pvBase, pvCurrent, armor })
      console.log(`Seed dev : PNJ "${name}" ajouté automatiquement`)
    } catch (err) {
      console.warn(`Seed dev : échec de l'import automatique de ${name} —`, err.message)
    }
  }
}
