import { describe, it, expect } from 'vitest'
import {
  characteristicLabel,
  groupSkillsByCharacteristic,
  characteristicTendencies,
  reverseD100,
  hitLocationFromRoll,
  parseWeaponMode,
  bulletsHit,
  resolveWeaponDamage,
  pvStatus,
  pvMax,
  applyDamage,
  effectiveSkillScore,
  attackOutcomeLabel,
  statusMeta,
} from './gameLogic.js'

describe('characteristicLabel', () => {
  it('spells out a known abbreviation', () => {
    expect(characteristicLabel('Agi')).toBe('Agilité')
    expect(characteristicLabel('For')).toBe('Force')
  })

  it('falls back to the raw abbreviation for anything unknown', () => {
    expect(characteristicLabel('Xyz')).toBe('Xyz')
  })
})

describe('groupSkillsByCharacteristic', () => {
  it('groups, sorts characteristics, and sorts items within each group', () => {
    const skills = [
      { name: 'Intimidation', characteristic: 'For' },
      { name: 'Discrétion', characteristic: 'Agi' },
      { name: 'Acrobaties', characteristic: 'Agi' },
    ]

    const grouped = groupSkillsByCharacteristic(skills)

    expect(grouped.map((g) => g.characteristic)).toEqual(['Agi', 'For'])
    expect(grouped[0].characteristicName).toBe('Agilité')
    expect(grouped[0].items.map((s) => s.name)).toEqual(['Acrobaties', 'Discrétion'])
    expect(grouped[1].items.map((s) => s.name)).toEqual(['Intimidation'])
  })

  it('buckets skills with no characteristic under the fallback key', () => {
    const grouped = groupSkillsByCharacteristic([{ name: 'Mystère' }])
    expect(grouped).toEqual([{ characteristic: '—', characteristicName: '—', items: [{ name: 'Mystère' }] }])
  })
})

describe('characteristicTendencies', () => {
  it('keeps only the best-trained skill per characteristic', () => {
    const skills = [
      { name: 'A', characteristic: 'Agi', score: 30 },
      { name: 'B', characteristic: 'Agi', score: 50 },
      { name: 'C', characteristic: 'For', score: 20 },
    ]

    expect(characteristicTendencies(skills)).toEqual([
      { characteristic: 'Agi', topSkill: 'B', score: 50 },
      { characteristic: 'For', topSkill: 'C', score: 20 },
    ])
  })
})

describe('reverseD100', () => {
  it('reverses the tens and units digits', () => {
    expect(reverseD100(23)).toBe(32)
    expect(reverseD100(1)).toBe(10)
  })

  it('treats 100 ("00") as a fixed point', () => {
    expect(reverseD100(100)).toBe(100)
  })

  it('maps a reversed-to-zero result back to 100', () => {
    expect(reverseD100(10)).toBe(1)
    expect(reverseD100(20)).toBe(2)
  })
})

describe('hitLocationFromRoll', () => {
  it('derives the hit location from the reversed roll', () => {
    expect(hitLocationFromRoll(1).key).toBe('tete') // reversed -> 10
    expect(hitLocationFromRoll(55).key).toBe('abdomen') // reversed -> 55
    expect(hitLocationFromRoll(100).key).toBe('jambeGauche') // reversed -> 100
  })
})

describe('parseWeaponMode', () => {
  it('parses each fire-mode segment independently', () => {
    expect(parseWeaponMode('C/2/-')).toEqual({ single: true, semiCapacity: 2, autoCapacity: null })
    expect(parseWeaponMode('C/-/6')).toEqual({ single: true, semiCapacity: null, autoCapacity: 6 })
    expect(parseWeaponMode('-/-/-')).toEqual({ single: false, semiCapacity: null, autoCapacity: null })
  })
})

describe('bulletsHit', () => {
  const weapon = { mode: { semiCapacity: 3, autoCapacity: null } }

  it('always lands exactly one bullet in coup-par-coup', () => {
    expect(bulletsHit('single', 5, weapon)).toBe(1)
  })

  it('caps semi/auto bullets at the weapon burst capacity', () => {
    expect(bulletsHit('semi', 5, weapon)).toBe(3)
    expect(bulletsHit('semi', 2, weapon)).toBe(2)
  })

  it('falls back to 1 bullet when the weapon has no capacity for that mode', () => {
    expect(bulletsHit('auto', 5, weapon)).toBe(1)
  })
})

describe('resolveWeaponDamage', () => {
  it('resolves location, bullet count, per-bullet armor reduction, and remaining PV', () => {
    const character = { armor: { abdomen: 5 }, pv: { current: 20 } }
    const weapon = { damage: 10, mode: { semiCapacity: 3, autoCapacity: null } }

    const result = resolveWeaponDamage(character, { attackRoll: 55, degrees: 2, weapon, fireMode: 'semi' })

    expect(result).toEqual({ locationKey: 'abdomen', bullets: 2, perBullet: 5, totalDamage: 10, newCurrent: 10 })
  })

  it('never lets a single bullet deal negative damage when armor exceeds weapon damage', () => {
    const character = { armor: { abdomen: 99 }, pv: { current: 20 } }
    const weapon = { damage: 10, mode: { semiCapacity: 1, autoCapacity: null } }

    const result = resolveWeaponDamage(character, { attackRoll: 55, degrees: 1, weapon, fireMode: 'single' })

    expect(result.perBullet).toBe(0)
    expect(result.newCurrent).toBe(20)
  })

  it('never drops current PV below zero', () => {
    const character = { armor: {}, pv: { current: 5 } }
    const weapon = { damage: 50, mode: { semiCapacity: 1, autoCapacity: null } }

    const result = resolveWeaponDamage(character, { attackRoll: 55, degrees: 1, weapon, fireMode: 'single' })

    expect(result.newCurrent).toBe(0)
  })
})

describe('pvStatus', () => {
  it('is hors de combat at zero PV regardless of max', () => {
    expect(pvStatus({ current: 0, max: 20 }).key).toBe('horsCombat')
  })

  it('thresholds critique/blessé/sain on the current/max ratio', () => {
    expect(pvStatus({ current: 5, max: 20 }).key).toBe('critique') // 0.25
    expect(pvStatus({ current: 10, max: 20 }).key).toBe('blesse') // 0.5
    expect(pvStatus({ current: 15, max: 20 }).key).toBe('sain') // 0.75
  })
})

describe('pvMax', () => {
  it('adds every bonus amount to the base', () => {
    const character = { pv: { base: 10, bonuses: [{ amount: 5 }, { amount: 3 }] } }
    expect(pvMax(character)).toBe(18)
  })
})

describe('applyDamage', () => {
  it('reduces raw damage by the location armor before applying it', () => {
    const character = { armor: { abdomen: 5 }, pv: { current: 20 } }
    expect(applyDamage(character, { rawDamage: 12, locationKey: 'abdomen' })).toEqual({
      locationKey: 'abdomen',
      rawDamage: 12,
      armor: 5,
      reduced: 7,
      newCurrent: 13,
    })
  })

  it('never drops current PV below zero', () => {
    const character = { armor: {}, pv: { current: 3 } }
    expect(applyDamage(character, { rawDamage: 50, locationKey: 'tete' }).newCurrent).toBe(0)
  })
})

describe('effectiveSkillScore', () => {
  it("uses the character's own trained score when the skill is on their sheet", () => {
    const character = { skills: [{ name: 'Esquive', score: 35 }], characteristics: { Agi: 40 } }
    expect(effectiveSkillScore(character, 'Esquive', 'Agi')).toBe(35)
  })

  it('falls back to half the linked characteristic when the skill is absent', () => {
    const character = { skills: [], characteristics: { Agi: 41 } }
    expect(effectiveSkillScore(character, 'Acrobaties', 'Agi')).toBe(21) // round(41/2)
  })

  it('falls back to 0 when even the linked characteristic is missing', () => {
    const character = { skills: [], characteristics: {} }
    expect(effectiveSkillScore(character, 'Acrobaties', 'Cha')).toBe(0)
  })
})

describe('attackOutcomeLabel', () => {
  it('returns an empty string for no attack', () => {
    expect(attackOutcomeLabel(null)).toBe('')
  })

  it('labels a miss and a dodge', () => {
    expect(attackOutcomeLabel({ outcome: 'miss' })).toBe('Attaque ratée')
    expect(attackOutcomeLabel({ outcome: 'dodged' })).toBe('Esquivé')
  })

  it('pluralizes "balle(s)" based on the bullet count and reports damage/location', () => {
    expect(
      attackOutcomeLabel({ outcome: 'hit', bullets: 1, damage: { totalDamage: 7, locationLabel: 'Abdomen' } }),
    ).toBe('1 balle touche (abdomen) — 7 dégâts subis')

    expect(
      attackOutcomeLabel({ outcome: 'hit', bullets: 3, damage: { totalDamage: 14, locationLabel: 'Tête' } }),
    ).toBe('3 balles touchent (tête) — 14 dégâts subis')
  })
})

describe('statusMeta', () => {
  it('reports a pending state with no roll', () => {
    const meta = statusMeta(null)
    expect(meta.isPending).toBe(true)
    expect(meta.isSuccess).toBe(false)
    expect(meta.isFail).toBe(false)
    expect(meta.label).toBe('En attente…')
  })

  it('pluralizes degrees of success and labels a success', () => {
    const meta = statusMeta({ status: 'success', degrees: 2 })
    expect(meta.isSuccess).toBe(true)
    expect(meta.label).toBe('RÉUSSITE')
    expect(meta.degreeText).toBe('2 degrés de réussite')
  })

  it('does not pluralize a single degree of failure', () => {
    const meta = statusMeta({ status: 'fail', degrees: 1 })
    expect(meta.isFail).toBe(true)
    expect(meta.label).toBe('ÉCHEC')
    expect(meta.degreeText).toBe('1 degré d’échec')
  })
})
