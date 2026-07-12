import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveRoll } from './game.js'

// rollD100() is `1 + Math.floor(Math.random() * 100)`: to force a given roll R,
// Math.random() must land in [ (R-1)/100, R/100 ). Using the midpoint of that
// bucket (rather than its lower edge) keeps this clear of floating-point
// rounding landing one bucket short (e.g. 0.29 * 100 === 28.999999999999996).
function mockRoll(roll) {
  vi.spyOn(Math, 'random').mockReturnValue((roll - 0.5) / 100)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveRoll', () => {
  it('succeeds when the roll is under the target and counts degrees by full tens', () => {
    mockRoll(30)
    expect(resolveRoll(50, null)).toEqual({ roll: 30, target: 50, status: 'success', degrees: 3 })
  })

  it('fails when the roll is over the target', () => {
    mockRoll(45)
    expect(resolveRoll(30, null)).toEqual({ roll: 45, target: 30, status: 'fail', degrees: 2 })
  })

  it('treats an exact match as a 1-degree success', () => {
    mockRoll(50)
    expect(resolveRoll(50, null)).toEqual({ roll: 50, target: 50, status: 'success', degrees: 1 })
  })

  it('subtracts the chosen malus from the score before rolling', () => {
    mockRoll(45)
    expect(resolveRoll(50, '+20')).toEqual({ roll: 45, target: 30, status: 'fail', degrees: 2 })
  })

  it('never lets the target go negative when the malus exceeds the score', () => {
    mockRoll(1)
    expect(resolveRoll(10, '+50').target).toBe(0)
  })

  it('treats a falsy malus the same as no malus', () => {
    mockRoll(30)
    expect(resolveRoll(50, 0).target).toBe(50)
  })
})
