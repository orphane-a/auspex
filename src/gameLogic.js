export const MALUS_OPTIONS = ['+10', '+20', '+30', '+40', '+50']

// Character sheets only carry the short form (T column: "Agi", "Cha"...) — spelled
// out here since that abbreviation means nothing to a player mid-game. Falls back
// to the raw abbreviation for anything outside this homebrew's usual seven.
const CHARACTERISTIC_NAMES = {
  For: 'Force',
  Agi: 'Agilité',
  Int: 'Intelligence',
  Per: 'Perception',
  Vol: 'Volonté',
  Cha: 'Charisme',
  Dex: 'Dextérité',
}

export function characteristicLabel(abbreviation) {
  return CHARACTERISTIC_NAMES[abbreviation] || abbreviation
}

// Shared by the MJ's skill picker and the player's own skill list — groups any
// list of {name, characteristic, ...} items by characteristic, with the full
// French name attached for display.
export function groupSkillsByCharacteristic(skills) {
  const map = new Map()
  for (const skill of skills) {
    const key = skill.characteristic || '—'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(skill)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    .map(([characteristic, items]) => ({
      characteristic,
      characteristicName: characteristicLabel(characteristic),
      items: [...items].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    }))
}

// For each characteristic linked to at least one of the character's skills, finds
// the single best-trained skill — used to draw a "tendency" radar without ever
// showing a raw score, and to name the standout skill per characteristic.
export function characteristicTendencies(skills) {
  const bestByCharacteristic = new Map()
  for (const skill of skills) {
    const key = skill.characteristic || '—'
    const current = bestByCharacteristic.get(key)
    if (!current || skill.score > current.score) {
      bestByCharacteristic.set(key, { characteristic: key, topSkill: skill.name, score: skill.score })
    }
  }
  return [...bestByCharacteristic.values()].sort((a, b) => a.characteristic.localeCompare(b.characteristic, 'fr'))
}

// Standard Dark Heresy 2e / Rogue Trader 2e / Only War 2e hit location table — same
// for every character, unlike armor which is per-character equipment (V2 §1/§4).
export const HIT_LOCATIONS = [
  { key: 'tete', label: 'Tête', range: [1, 10] },
  { key: 'brasDroit', label: 'Bras droit', range: [11, 20] },
  { key: 'brasGauche', label: 'Bras gauche', range: [21, 30] },
  { key: 'poitrine', label: 'Poitrine', range: [31, 50] },
  { key: 'abdomen', label: 'Abdomen', range: [51, 70] },
  { key: 'jambeDroite', label: 'Jambe droite', range: [71, 85] },
  { key: 'jambeGauche', label: 'Jambe gauche', range: [86, 100] },
]

export function rollD100() {
  return 1 + Math.floor(Math.random() * 100)
}

// Classic Dark Heresy/Rogue Trader/Only War trick (V2 §10): a d100 read as two
// digits (tens/units) can be reversed to get a second usable number for free —
// used to derive a hit location from the attack roll instead of a fresh roll.
// 100 is written "00", which stays "00" (i.e. 100) once reversed.
export function reverseD100(roll) {
  const twoDigits = roll === 100 ? '00' : String(roll).padStart(2, '0')
  const reversed = Number(twoDigits.split('').reverse().join(''))
  return reversed === 0 ? 100 : reversed
}

export function hitLocationFromRoll(roll) {
  const locationRoll = reverseD100(roll)
  return HIT_LOCATIONS.find((l) => locationRoll >= l.range[0] && locationRoll <= l.range[1])
}

// "Mode" column on a weapon sheet (V2 §10), e.g. "C/2/-": three '/'-separated
// segments for coup-par-coup / semi-auto / auto. "C" = available (always 1
// bullet), a number = available with that burst capacity, "-" = unavailable.
export function parseWeaponMode(modeStr) {
  const [single, semi, auto] = modeStr.split('/').map((s) => s.trim())
  return {
    single: single === 'C',
    semiCapacity: semi === '-' || !semi ? null : Number(semi),
    autoCapacity: auto === '-' || !auto ? null : Number(auto),
  }
}

// Bullets that connect (V2 §10/§11): 1 in coup-par-coup ; in semi/auto, capped by
// the weapon's actual burst capacity for that mode, not a universal fixed cap.
export function bulletsHit(fireMode, degrees, weapon) {
  if (fireMode === 'single') return 1
  const capacity = fireMode === 'semi' ? weapon.mode.semiCapacity : weapon.mode.autoCapacity
  return Math.min(degrees, capacity || 1)
}

// Damage now comes from the attacking NPC's weapon profile, not the raw attack
// roll (V2 §10 v2) — `attackRoll` only still supplies the hit location (reversed
// digits, unchanged from v1). Armor is deducted per bullet, not once on the total
// (V2 §11), since multiple hits from the same burst each have to punch through it.
export function resolveWeaponDamage(character, { attackRoll, degrees, weapon, fireMode }) {
  const locationKey = hitLocationFromRoll(attackRoll).key
  const bullets = bulletsHit(fireMode, degrees, weapon)
  const armor = character.armor[locationKey] || 0
  const perBullet = Math.max(0, weapon.damage - armor)
  const totalDamage = perBullet * bullets
  const newCurrent = Math.max(0, character.pv.current - totalDamage)
  return { locationKey, bullets, perBullet, totalDamage, newCurrent }
}

// Thresholds are display-only (V2 §3) — free to retune from table usage without
// touching any mechanic.
export function pvStatus({ current, max }) {
  const ratio = max > 0 ? current / max : 0
  if (current <= 0) return { key: 'horsCombat', label: 'HORS DE COMBAT' }
  if (ratio <= 0.25) return { key: 'critique', label: 'CRITIQUE' }
  if (ratio <= 0.5) return { key: 'blesse', label: 'BLESSÉ' }
  return { key: 'sain', label: 'SAIN' }
}

export function pvMax(character) {
  return character.pv.base + character.pv.bonuses.reduce((sum, b) => sum + b.amount, 0)
}

export function applyDamage(character, { rawDamage, locationKey }) {
  const armor = character.armor[locationKey] || 0
  const reduced = Math.max(0, rawDamage - armor)
  const newCurrent = Math.max(0, character.pv.current - reduced)
  return { locationKey, rawDamage, armor, reduced, newCurrent }
}

// Non-formé fallback (V2 §4/§5): the sheet already halves a characteristic for any
// trained-but-absent skill *within* the grid (e.g. Contorsionniste = Agilité ÷ 2) —
// this extends the same rule to a skill the character's grid doesn't list at all,
// so a raccourci like Esquive stays usable instead of silently rolling against 0.
export function effectiveSkillScore(character, skillName, linkedCharacteristic) {
  const skill = character.skills.find((s) => s.name === skillName)
  if (skill) return skill.score
  const carac = character.characteristics[linkedCharacteristic]
  return carac ? Math.round(carac / 2) : 0
}

// Score d'esquive d'un défenseur PNJ (V3 §3/§5) : un PNJ n'a jamais de grille de
// compétences, donc jamais de score d'Esquive formé — contrairement à
// effectiveSkillScore, pas de recherche dans une liste de compétences, uniquement
// le repli non formé (Agi ÷ 2) plus son dodgeBonus manuel (§4).
export function npcDodgeScore(npc) {
  const base = npc.characteristics.Agi ? Math.round(npc.characteristics.Agi / 2) : 0
  return base + npc.dodgeBonus
}

// Texte de degrés partagé par les jets de compétence (statusMeta) et la séquence
// d'attaque (attackOutcomeLabel), pour garder un seul endroit qui pluralise
// "degré(s)" et choisisse "de réussite"/"d'échec".
function degreeLabel(degrees, isSuccess) {
  return `${degrees} degré${degrees > 1 ? 's' : ''}${isSuccess ? ' de réussite' : ' d’échec'}`
}

// Single source of truth for the attack-sequence outcome text (V2 §10/§11, degrés
// ajoutés en V3) — the wording must be strictly identical on the player's and the
// MJ's screens.
export function attackOutcomeLabel(attack) {
  if (!attack) return ''
  if (attack.outcome === 'miss') return `Attaque ratée (${degreeLabel(attack.degrees, false)})`
  if (attack.outcome === 'dodged') return `Esquivé (${degreeLabel(attack.dodgeDegrees, true)})`
  if (attack.outcome === 'hit' && attack.damage) {
    const { totalDamage, locationLabel } = attack.damage
    const bullets = attack.bullets || 1
    const bulletsText = bullets > 1 ? `${bullets} balles touchent` : '1 balle touche'
    return `${bulletsText} (${locationLabel.toLowerCase()}) — ${totalDamage} dégâts subis (esquive ratée, ${degreeLabel(attack.dodgeDegrees, false)})`
  }
  return ''
}

export function statusMeta(r) {
  const suc = !!r && r.status === 'success'
  const fail = !!r && r.status === 'fail'
  return {
    label: r ? (suc ? 'RÉUSSITE' : 'ÉCHEC') : 'En attente…',
    isSuccess: suc,
    isFail: fail,
    isPending: !r,
    degreeText: r ? degreeLabel(r.degrees, suc) : '',
    borderCol: r ? (suc ? 'rgba(123,163,111,.5)' : 'rgba(198,90,79,.5)') : 'rgba(255,255,255,.1)',
    bgCol: r ? (suc ? 'rgba(123,163,111,.1)' : 'rgba(198,90,79,.1)') : 'rgba(255,255,255,.02)',
    textCol: r ? (suc ? '#8fbf87' : '#c65a4f') : 'rgba(230,224,212,.4)',
  }
}
