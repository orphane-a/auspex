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
  const djokoSheet = await readDjokoSheet()
  if (djokoSheet) {
    const { skills, avatar, pvBase, pvCurrent, armor, characteristics, weapons } = djokoSheet
    addCharacter({ name: 'Djoko', cls: 'Maître stellaire', skills, avatar, pvBase, pvCurrent, armor, characteristics, weapons })
    const { code } = getTableState()
    console.log(`Seed dev : "Djoko" ajouté automatiquement — table ${code}`)
  }
  // Même condition « table vide » que Djoko : une table qui contient déjà de vrais
  // personnages n'est jamais modifiée (ticket 94, exigence 2).
  await addFictionalCharacters(djokoSheet)
}

async function readDjokoSheet() {
  if (!fs.existsSync(SEED_FILE)) return null
  try {
    return await parseCharacterSheet(fs.readFileSync(SEED_FILE))
  } catch (err) {
    console.warn('Seed dev : échec de l\'import automatique de Djoko —', err.message)
    return null
  }
}

// AUSPEX_FICTIFS=0 désactive les personnages fictifs, pour la prod réelle (ticket 94,
// souhaitable 1). Actifs par défaut, en local comme en préprod.
export function fictionalEnabled() {
  return process.env.AUSPEX_FICTIFS !== '0'
}

// Trois personnages joueurs fictifs (ticket 94) : ils reprennent la fiche de Djoko
// (compétences, caractéristiques, armure, armes) pour rester valides sur toutes les
// routes, avec un nom, une classe et des PV propres. Pas d'avatar : l'interface
// affiche un visuel générique en pointillé. Le nom reste court (« Vex ») : la mention
// « fictif » est un badge à côté du nom, comme dans la maquette.
export const FICTIONAL_CHARACTERS = [
  { name: 'Vex', cls: 'Garde impérial', pv: 110 },
  { name: 'Soeur Ilia', cls: 'Soeur hospitalière', pv: 95 },
  { name: 'Kael', cls: 'Explorateur technique', pv: 120 },
]

// Repli si la fiche de Djoko est absente ou illisible : valeurs fixes suffisantes
// pour un test, une attaque (Dex, une arme) et une esquive (Agi, compétence Esquive).
const FALLBACK_SHEET = {
  skills: [
    { name: 'Esquive', characteristic: 'Agi', score: 40 },
    { name: 'Perception', characteristic: 'Per', score: 40 },
    { name: 'Athlétisme', characteristic: 'For', score: 35 },
  ],
  characteristics: { For: 35, Per: 40, Dex: 40, Agi: 40, Int: 35, Vol: 35, Cha: 30 },
  armor: { tete: 0, brasDroit: 10, brasGauche: 10, poitrine: 20, abdomen: 20, jambeDroite: 0, jambeGauche: 0 },
  weapons: [{ name: 'Fusil laser', modeRaw: 'C/3/-', mode: { single: true, semiCapacity: 3, autoCapacity: null }, damage: 40 }],
}

// Ajoute les fictifs s'il n'y en a encore aucun ; renvoie le nombre ajouté (0 si
// désactivés ou déjà présents), pour que le bouton « Ajouter » ne crée jamais de doublon.
export async function addFictionalCharacters(sheet) {
  if (!fictionalEnabled()) return 0
  if (listCharacters().some((c) => c.fictional)) return 0
  const base = sheet === undefined ? (await readDjokoSheet()) || FALLBACK_SHEET : sheet || FALLBACK_SHEET
  for (const f of FICTIONAL_CHARACTERS) {
    addCharacter({
      name: f.name,
      cls: f.cls,
      skills: base.skills,
      avatar: null,
      pvBase: f.pv,
      pvCurrent: f.pv,
      armor: base.armor,
      characteristics: base.characteristics,
      weapons: base.weapons,
      fictional: true,
    })
  }
  console.log(`Seed dev : ${FICTIONAL_CHARACTERS.length} personnages fictifs ajoutés`)
  return FICTIONAL_CHARACTERS.length
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
