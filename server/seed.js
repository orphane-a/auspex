import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCharacterSheet, parseNpcSheet } from './xlsxParser.js'
import { addCharacter, addNpc, getTableState, listCharacters, listNpcs, removeNpc, resetTable, updateNpcDodgeBonus } from './db.js'
import { getScenario } from '../src/scenarios/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_FILE = path.join(__dirname, '..', 'PJ_Djoko_mk4.xlsx')
const NPC_SEED_DIR = path.join(__dirname, '..', 'PNJ_test')

// Dev convenience: every time the server starts up with an empty table, drop the
// real Djoko sheet back in so testing never starts from a blank MjHome screen.
// Only fires when there are zero characters — a deliberate "reset table" stays empty.
export async function seedIfEmpty() {
  if (listCharacters().length > 0) return
  const scenario = activeScenario()
  if (scenario) return seedScenarioCharacters(scenario)
  if (!fs.existsSync(SEED_FILE)) return
  try {
    const buffer = fs.readFileSync(SEED_FILE)
    const { skills, avatar, pvBase, pvCurrent, armor, characteristics, weapons } = await parseCharacterSheet(buffer)
    addCharacter({ name: 'Djoko', cls: 'Maître stellaire', skills, avatar, pvBase, pvCurrent, armor, characteristics, weapons })
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
  const scenario = activeScenario()
  if (scenario) return seedScenarioNpc(scenario)
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

// Scénario guidé (ticket 97) : une instance de démo lancée avec SCENARIO=dragon (et
// son propre DATA_DIR) remplace le seed de Djoko et de PNJ_test/ par les personnages
// et le PNJ du scénario. La variable est relue à chaque appel plutôt qu'à l'import,
// pour que les tests puissent basculer de mode sans recharger le module.
const warnedUnknownScenarios = new Set()

export function activeScenario() {
  const id = (process.env.SCENARIO || '').trim()
  if (!id) return null
  const scenario = getScenario(id)
  if (!scenario && !warnedUnknownScenarios.has(id)) {
    warnedUnknownScenarios.add(id)
    console.warn(`Scénario inconnu : ${id}`)
  }
  return scenario
}

function seedScenarioCharacters(scenario) {
  for (const c of scenario.characters) {
    addCharacter({
      name: c.name,
      cls: c.cls,
      skills: c.skills,
      avatar: c.avatar,
      pvBase: c.pvBase,
      pvCurrent: c.pvBase,
      armor: c.armor,
      characteristics: c.characteristics,
      weapons: c.weapons,
    })
  }
  const { code } = getTableState()
  console.log(`Seed démo : scénario "${scenario.id}" prêt — table ${code}`)
}

function seedScenarioNpc(scenario) {
  const { npc } = scenario
  const created = addNpc({ name: npc.name, characteristics: npc.characteristics, weapons: npc.weapons, pvBase: npc.pvBase, pvCurrent: npc.pvBase, armor: npc.armor })
  if (npc.dodgeBonus) updateNpcDodgeBonus(created.id, npc.dodgeBonus)
}

// « Recommencer la démo » : resetTable() ne vide que les personnages, or le dragon
// doit lui aussi revenir à ses PV de départ — on recrée donc les deux. Renvoie false
// hors mode démo pour que la route garde exactement son comportement habituel.
export async function resetScenarioTable() {
  const scenario = activeScenario()
  if (!scenario) return false
  resetTable()
  for (const npc of listNpcs()) removeNpc(npc.id)
  seedScenarioCharacters(scenario)
  seedScenarioNpc(scenario)
  return true
}
