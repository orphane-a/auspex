import XLSX from 'xlsx'
import JSZip from 'jszip'
import { HIT_LOCATIONS, parseWeaponMode } from '../src/gameLogic.js'

const NAME_COL = 'B'
const CHARACTERISTIC_COL = 'T'
const SCORE_COL = 'V'
const MODE_COL = 'Q'
const DAMAGE_COL = 'AE'

// Raw characteristics (V2 §8) are searched by label the same way as everything
// else in this file — sheet layout varies enough between characters that we can't
// pin exact cells, only the label text and "value lives a couple rows below it".
const CHARACTERISTIC_SEARCH_TERMS = {
  For: 'force',
  Per: 'perception',
  Dex: 'dexterite',
  Agi: 'agilite',
  Int: 'intelligence',
  Vol: 'volonte',
  Cha: 'charisme',
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCharacteristic(value) {
  const text = normalizeText(value)
  if (!text) return ''
  return text[0].toUpperCase() + text.slice(1).toLowerCase()
}

// Accent/case-insensitive comparison for free-text label matching (e.g. "Dextérité"
// vs. "dexterite", "Tête" vs. "tete").
const DIACRITICS_RE = /[̀-ͯ]/g

function normalizeForMatch(value) {
  return normalizeText(value).toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '')
}

function colToIndex(col) {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function indexToCol(n) {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellAt(sheet, col, row) {
  return sheet[`${col}${row}`]
}

// Scans the whole sheet for the first cell whose normalized text equals `target`
// (e.g. "points de vie", "armures") and returns its address as {col, row}.
function findLabelAddr(sheet, target) {
  for (const addr in sheet) {
    if (addr[0] === '!') continue
    const m = addr.match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    if (normalizeForMatch(sheet[addr]?.v) === target) return { col: m[1], row: Number(m[2]) }
  }
  return null
}

// Reads numeric cells near a label, scanning top-to-bottom then left-to-right
// within a small window below it — mirrors how these homebrew sheets lay out a
// label above its value(s), possibly split across a couple of columns (e.g. PV
// max/current side by side).
function findNumbersNear(sheet, { col, row }, { rowSpan = 3, colSpan = 15, count = 2 } = {}) {
  const startCol = colToIndex(col)
  const numbers = []
  for (let r = row + 1; r <= row + rowSpan && numbers.length < count; r++) {
    for (let c = startCol; c <= startCol + colSpan && numbers.length < count; c++) {
      const v = cellAt(sheet, indexToCol(c), r)?.v
      if (typeof v === 'number') numbers.push(v)
    }
  }
  return numbers
}

// PV (V2 §8): "Points de vie" label, then the first two numbers found just below
// it are max (as imported) and current — on a fresh sheet both are the same value.
function extractPv(sheet) {
  const label = findLabelAddr(sheet, 'points de vie')
  if (!label) return { pvBase: 10, pvCurrent: 10 }
  const [first, second] = findNumbersNear(sheet, label, { rowSpan: 3, colSpan: 15, count: 2 })
  const pvBase = first != null ? Math.round(first) : 10
  const pvCurrent = second != null ? Math.round(second) : pvBase
  return { pvBase, pvCurrent }
}

// Armor (V2 §8): anchor on "Armures" (or "Localisations"), then walk the rows below
// it looking for each of the 7 known location names in column B, reading the armor
// value on that same row in the anchor's column.
function extractArmor(sheet) {
  const anchor = findLabelAddr(sheet, 'armures') || findLabelAddr(sheet, 'localisations')
  const armor = {}
  if (!anchor) return armor
  for (let row = anchor.row; row <= anchor.row + 20; row++) {
    const location = HIT_LOCATIONS.find((l) => normalizeForMatch(l.label) === normalizeForMatch(cellAt(sheet, NAME_COL, row)?.v))
    if (!location) continue
    const raw = cellAt(sheet, anchor.col, row)?.v
    armor[location.key] = typeof raw === 'number' ? Math.round(raw) : 0
  }
  return armor
}

// Raw characteristics (V2 §8), used only for the non-formé fallback (never shown
// to the player as-is) — one label lookup per characteristic, same near-value logic.
function extractCharacteristics(sheet) {
  const characteristics = {}
  for (const [key, term] of Object.entries(CHARACTERISTIC_SEARCH_TERMS)) {
    const label = findLabelAddr(sheet, term)
    const [value] = label ? findNumbersNear(sheet, label, { rowSpan: 3, colSpan: 5, count: 1 }) : []
    characteristics[key] = value != null ? Math.round(value) : 0
  }
  return characteristics
}

// Weapons (V2 §10) — "Compétences d'Armes" table, previously out of scope (cahier
// des charges V1 §7). Only rows carrying both a name and a "Mode" string count as
// a usable weapon row; this naturally skips melee weapons that have no fire mode
// on this homebrew's sheets (e.g. Djoko's "Epée énergétique").
function extractWeapons(sheet) {
  const label = findLabelAddr(sheet, "competences d'armes")
  if (!label) return []
  const headerRow = label.row + 2
  const boundary = findLabelAddr(sheet, 'localisations') || findLabelAddr(sheet, 'armures')
  const maxRow = boundary ? boundary.row - 1 : headerRow + 34
  const weapons = []
  for (let row = headerRow + 2; row <= maxRow; row++) {
    const name = normalizeText(cellAt(sheet, NAME_COL, row)?.v)
    const modeRaw = normalizeText(cellAt(sheet, MODE_COL, row)?.v)
    if (!name || !modeRaw) continue
    const rawDamage = cellAt(sheet, DAMAGE_COL, row)?.v
    weapons.push({ name, modeRaw, mode: parseWeaponMode(modeRaw), damage: typeof rawDamage === 'number' ? Math.round(rawDamage) : 0 })
  }
  return weapons
}

function findCharacterSheet(workbook) {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    for (const addr in sheet) {
      if (addr[0] === '!') continue
      if (sheet[addr]?.v === 'COMPETENCES') return { name, sheet }
    }
  }
  return null
}

// Column B also carries unrelated sections (identity fields, weapon skills, wound
// locations...), so we can't just read from row 1 downward — we index every
// non-empty label row first, then anchor on the "De Base"/"Avancées" markers.
function indexLabelRows(sheet) {
  const rows = []
  for (let row = 1; row <= 1000; row++) {
    const label = normalizeText(sheet[`${NAME_COL}${row}`]?.v).toLowerCase()
    if (label) rows.push({ row, label })
  }
  return rows
}

function readSkillRow(sheet, row) {
  const name = normalizeText(sheet[`${NAME_COL}${row}`]?.v)
  const characteristic = normalizeCharacteristic(sheet[`${CHARACTERISTIC_COL}${row}`]?.v)
  const rawScore = sheet[`${SCORE_COL}${row}`]?.v
  if (!name || !characteristic || typeof rawScore !== 'number') return null
  return { name, characteristic, score: Math.round(rawScore) }
}

function extractSkills(sheet) {
  const labelRows = indexLabelRows(sheet)
  const baseRow = labelRows.find((r) => r.label === 'de base')?.row
  const advRow = labelRows.find((r) => r.label === 'avancées' || r.label === 'avancees')?.row
  if (!baseRow || !advRow || advRow <= baseRow) {
    throw new Error('Fichier reconnu mais sections "De Base"/"Avancées" introuvables.')
  }

  const skills = []

  for (const { row } of labelRows) {
    if (row <= baseRow || row >= advRow) continue
    const skill = readSkillRow(sheet, row)
    if (skill) skills.push(skill)
  }

  // The advanced table has no closing marker, so we stop at the first gap of more
  // than one blank row (a real section boundary, e.g. "Blessures :" further down).
  let lastRow = advRow
  for (const { row } of labelRows) {
    if (row <= advRow) continue
    if (row - lastRow > 2) break
    lastRow = row
    const skill = readSkillRow(sheet, row)
    if (skill) skills.push(skill)
  }

  if (skills.length === 0) {
    throw new Error('Fichier reconnu mais aucune compétence exploitable trouvée.')
  }

  return skills
}

// --- Portrait extraction -----------------------------------------------------
// The skills grid lives in cell values SheetJS already parses, but an embedded
// picture is a packaging-level relationship (sheet -> drawing -> media) that
// SheetJS's community edition doesn't expose. We read the raw zip parts instead.

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`))
  return m ? m[1] : null
}

function parseRelationships(xml) {
  const map = new Map()
  const tagRe = /<Relationship\b[^>]*\/>/g
  let m
  while ((m = tagRe.exec(xml))) {
    const id = attr(m[0], 'Id')
    const target = attr(m[0], 'Target')
    if (id && target) map.set(id, target)
  }
  return map
}

function parseWorkbookSheetNames(xml) {
  const sheets = []
  const tagRe = /<sheet\b[^>]*\/>/g
  let m
  while ((m = tagRe.exec(xml))) {
    const name = attr(m[0], 'name')
    const rId = attr(m[0], 'r:id')
    if (name && rId) sheets.push({ name, rId })
  }
  return sheets
}

function parsePictures(xml) {
  const pics = []
  const picRe = /<xdr:pic>([\s\S]*?)<\/xdr:pic>/g
  let m
  while ((m = picRe.exec(xml))) {
    const block = m[1]
    const cNvPr = block.match(/<xdr:cNvPr\b[^>]*>/)?.[0]
    const blip = block.match(/<a:blip\b[^>]*>/)?.[0]
    const embedId = blip ? attr(blip, 'r:embed') : null
    if (embedId) pics.push({ title: cNvPr ? attr(cNvPr, 'title') : null, embedId })
  }
  return pics
}

// Resolves an OPC relative Target (e.g. "../media/image2.png") against the zip
// folder containing the file that declared it (e.g. "xl/drawings").
function resolveZipPath(baseDir, target) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = baseDir.split('/').filter(Boolean)
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

function mimeFromPath(p) {
  const ext = p.split('.').pop().toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'bmp') return 'image/bmp'
  return 'application/octet-stream'
}

// Finds the character's portrait, if any. This homebrew template also embeds a
// generic "Warhammer 40,000 Roleplay" logo on every sheet, so we can't just grab
// "the" image — we prefer the one explicitly titled "Image" (this template's
// portrait slot), falling back to the largest embedded file otherwise.
async function extractPortrait(buffer, sheetName) {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
    const workbookRelsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
    if (!workbookXml || !workbookRelsXml) return null

    const sheetEntry = parseWorkbookSheetNames(workbookXml).find((s) => s.name === sheetName)
    if (!sheetEntry) return null
    const workbookRels = parseRelationships(workbookRelsXml)
    const sheetTarget = workbookRels.get(sheetEntry.rId)
    if (!sheetTarget) return null
    const sheetPath = resolveZipPath('xl', sheetTarget)

    const sheetRelsXml = await zip.file(`xl/worksheets/_rels/${sheetPath.split('/').pop()}.rels`)?.async('string')
    if (!sheetRelsXml) return null
    const sheetRels = parseRelationships(sheetRelsXml)
    const drawingTarget = [...sheetRels.values()].find((t) => t.includes('drawing'))
    if (!drawingTarget) return null
    const drawingPath = resolveZipPath('xl/worksheets', drawingTarget)

    const drawingXml = await zip.file(drawingPath)?.async('string')
    const drawingRelsXml = await zip.file(`xl/drawings/_rels/${drawingPath.split('/').pop()}.rels`)?.async('string')
    if (!drawingXml || !drawingRelsXml) return null

    const drawingRels = parseRelationships(drawingRelsXml)
    const pics = parsePictures(drawingXml)
    if (pics.length === 0) return null

    let chosen = pics.find((p) => (p.title || '').trim().toLowerCase() === 'image')
    if (!chosen) {
      const sized = await Promise.all(
        pics.map(async (p) => {
          const target = drawingRels.get(p.embedId)
          const mediaPath = target ? resolveZipPath('xl/drawings', target) : null
          const file = mediaPath ? zip.file(mediaPath) : null
          const size = file ? (await file.async('uint8array')).length : 0
          return { ...p, size }
        }),
      )
      chosen = sized.sort((a, b) => b.size - a.size)[0]
    }
    if (!chosen) return null

    const mediaTarget = drawingRels.get(chosen.embedId)
    if (!mediaTarget) return null
    const mediaPath = resolveZipPath('xl/drawings', mediaTarget)
    const file = zip.file(mediaPath)
    if (!file) return null

    const base64 = await file.async('base64')
    return `data:${mimeFromPath(mediaPath)};base64,${base64}`
  } catch {
    return null // a missing/malformed portrait should never block the skills import
  }
}

// Reads the skills grid out of a character sheet shaped like PJ_Djoko_mk4.xlsx:
// a "COMPETENCES" section with "De Base" and "Avancées" sub-tables, skill name in
// column B, linked characteristic in column T, and the final computed score (0-100,
// already including trained/career/misc bonuses) in column V — plus the embedded
// portrait image, if the sheet has one.
export async function parseCharacterSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const found = findCharacterSheet(workbook)
  if (!found) {
    throw new Error('Fichier non reconnu : aucune section "COMPETENCES" trouvée.')
  }

  const skills = extractSkills(found.sheet)
  const avatar = await extractPortrait(buffer, found.name)
  const { pvBase, pvCurrent } = extractPv(found.sheet)
  const armor = extractArmor(found.sheet)
  const characteristics = extractCharacteristics(found.sheet)
  // Weapons (V3 §3/§4) — same "Compétences d'Armes" table and extractWeapons already
  // used for an NPC sheet, so a player can be picked as attacker just like an NPC.
  const weapons = extractWeapons(found.sheet)

  return { skills, avatar, pvBase, pvCurrent, armor, characteristics, weapons }
}

// Reads an NPC/enemy sheet (V2 §10/§11) — same PV/armor/characteristics logic as
// a player sheet, plus the weapons table, minus the skills grid: NPC sheets don't
// necessarily have a "COMPETENCES" section at all (these are lightweight enemy
// stat blocks, not full player sheets), so unlike parseCharacterSheet this doesn't
// search for one — it just reads the sheet's first tab directly.
export async function parseNpcSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) {
    throw new Error('Fichier non reconnu : aucune feuille trouvée.')
  }

  const { pvBase, pvCurrent } = extractPv(sheet)
  const armor = extractArmor(sheet)
  const characteristics = extractCharacteristics(sheet)
  const weapons = extractWeapons(sheet)

  return { pvBase, pvCurrent, armor, characteristics, weapons }
}
