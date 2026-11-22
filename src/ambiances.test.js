import { describe, it, expect } from 'vitest'
import { AMBIANCES, AMBIANCE_PAR_DEFAUT, isAmbiance, nomAmbiance } from './ambiances.js'

describe('ambiances (ticket 100)', () => {
  it('propose les cinq ambiances, cyber par défaut', () => {
    expect(AMBIANCES.map((a) => a.id)).toEqual(['cyber', 'medieval', 'espace', 'horreur', 'gothique'])
    expect(AMBIANCES.map((a) => a.nom)).toEqual(['Cyber', 'Médiéval', 'Espace', 'Horreur années 20', 'Gothique'])
    expect(AMBIANCE_PAR_DEFAUT).toBe('cyber')
  })

  it("ne reconnaît que les identifiants de la liste", () => {
    expect(isAmbiance('medieval')).toBe(true)
    for (const v of ['Médiéval', 'MEDIEVAL', '', null, undefined, 3, 'toString', 'constructor']) expect(isAmbiance(v)).toBe(false)
  })

  it('donne le nom affiché, cyber pour une valeur inconnue', () => {
    expect(nomAmbiance('horreur')).toBe('Horreur années 20')
    expect(nomAmbiance('inconnue')).toBe('Cyber')
  })
})
