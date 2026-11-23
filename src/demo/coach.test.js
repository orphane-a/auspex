import { describe, expect, it } from 'vitest'
import { dimHole, HOLE_MARGIN } from './coach.js'

describe('dimHole (découpe du voile de la démo, ticket 102)', () => {
  it('renvoie null sans rectangle : le voile couvre alors tout l’écran', () => {
    expect(dimHole(null)).toBeNull()
    expect(dimHole(undefined)).toBeNull()
  })

  it('agrandit le rectangle du bouton de 6 px de chaque côté, comme le cadre du repère', () => {
    expect(HOLE_MARGIN).toBe(6)
    expect(dimHole({ top: 100, left: 40, width: 120, height: 44 })).toEqual({ top: 94, left: 34, width: 132, height: 56 })
  })

  it('accepte une marge différente', () => {
    expect(dimHole({ top: 10, left: 10, width: 10, height: 10 }, 0)).toEqual({ top: 10, left: 10, width: 10, height: 10 })
  })

  it('garde les positions négatives (bouton en partie hors de l’écran)', () => {
    expect(dimHole({ top: -20, left: 0, width: 50, height: 30 })).toEqual({ top: -26, left: -6, width: 62, height: 42 })
  })

  it('ignore un rectangle vide ou invalide, sans découpe fantôme', () => {
    expect(dimHole({ top: 0, left: 0, width: 0, height: 0 })).toBeNull()
    expect(dimHole({ top: 0, left: 0, width: 10, height: -1 })).toBeNull()
    expect(dimHole({ top: NaN, left: 0, width: 10, height: 10 })).toBeNull()
    expect(dimHole({ top: 0, left: 0 })).toBeNull()
  })
})
