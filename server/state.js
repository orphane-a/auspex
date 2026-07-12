import { getTableState, listCharacters, listNpcs } from './db.js'

// In-memory only (V2 §6) — a transient "you just took damage" toast doesn't need
// to survive a server restart the way `request`/`rolls` do, so it isn't persisted
// to table_state.
let lastDamage = null

export function setLastDamage(damage) {
  lastDamage = damage
}

// Single snapshot shape pushed to every client (MJ and players alike) so the
// frontend never has to reconcile partial updates.
export function buildSnapshot(isConnected) {
  const { code, request, rolls, attack } = getTableState()
  const characters = listCharacters().map((c) => ({ ...c, connected: isConnected(c.id) }))

  // Keyed by name so the MJ's skill picker can group by characteristic even
  // though each character has their own skill grid — first character wins if two
  // disagree on the linked characteristic for a same-named skill (shouldn't happen
  // in practice, everyone uses the same rules).
  const byName = new Map()
  for (const c of characters) {
    for (const s of c.skills) {
      if (!byName.has(s.name)) byName.set(s.name, s.characteristic)
    }
  }
  const availableSkills = [...byName.entries()]
    .map(([name, characteristic]) => ({ name, characteristic }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return { code, request, rolls, characters, availableSkills, lastDamage, attack, npcs: listNpcs() }
}

// Used by the roll route's non-formé fallback (V2 §4/§5): a skill absent from one
// character's own grid may still be known elsewhere, which is where its linked
// characteristic comes from.
export function characteristicForSkillName(skillName) {
  for (const c of listCharacters()) {
    const skill = c.skills.find((s) => s.name === skillName)
    if (skill) return skill.characteristic
  }
  return null
}
