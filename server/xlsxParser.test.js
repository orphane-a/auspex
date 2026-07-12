import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { parseCharacterSheet } from './xlsxParser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DJOKO_SHEET = path.join(__dirname, '..', 'PJ_Djoko_mk4.xlsx')

describe('parseCharacterSheet weapons (V3 §3/§4)', () => {
  it('extracts the same "Compétences d\'Armes" table already used for NPC sheets', async () => {
    const buffer = readFileSync(DJOKO_SHEET)
    const parsed = await parseCharacterSheet(buffer)

    // Djoko's melee weapon ("Epée énergétique") has no fire mode on this sheet and
    // is skipped, same as extractWeapons already does for an NPC sheet.
    expect(parsed.weapons).toEqual([
      {
        name: 'Pistolet bolter Mk III modèle Cérès',
        modeRaw: 'C/2/-',
        mode: { single: true, semiCapacity: 2, autoCapacity: null },
        damage: 100,
      },
      {
        name: 'Canon de poing \nHecuter 10',
        modeRaw: 'C/-/-',
        mode: { single: true, semiCapacity: null, autoCapacity: null },
        damage: 60,
      },
    ])
  })
})
