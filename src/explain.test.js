import { describe, it, expect } from 'vitest'
import {
  malusValue,
  malusDisplay,
  testThreshold,
  thresholdCalcText,
  rollSummary,
  rollGapText,
  attackStep,
  bulletsText,
  attackResultTitle,
  attackOutcomeFacts,
  armorCells,
  launchSummary,
  testOf,
} from './explain.js'

const djoko = {
  skills: [
    { name: 'Esquive', characteristic: 'Agi', score: 40 },
    { name: 'Vigilance', characteristic: 'Per', score: 45 },
  ],
  characteristics: { Agi: 42, Per: 38, For: 30 },
  armor: { tete: 2, brasDroit: 3 },
}

describe('malus', () => {
  it('lit « +10 » comme 10 points retirés, comme le serveur', () => {
    expect(malusValue('+10')).toBe(10)
    expect(malusValue(null)).toBe(0)
    expect(malusValue('abc')).toBe(0)
  })
  it('affiche le malus avec un signe moins', () => {
    expect(malusDisplay('+20')).toBe('-20')
    expect(malusDisplay(null)).toBe('')
  })
})

describe('testThreshold', () => {
  it('retire le malus au score de la compétence', () => {
    const t = testThreshold(djoko, 'Esquive', 'Agi', '+10')
    expect(t).toMatchObject({ score: 40, malus: 10, target: 30, trained: true, characteristicName: 'Agilité' })
    expect(thresholdCalcText(t)).toBe('Esquive 40, liée à l’Agilité, moins un malus de 10 = seuil de 30')
  })
  it('sans malus, le seuil est le score', () => {
    const t = testThreshold(djoko, 'Vigilance', 'Per', null)
    expect(t.target).toBe(45)
    expect(thresholdCalcText(t)).toBe('Vigilance 45, liée à la Perception = seuil de 45')
  })
  it('compétence non apprise : moitié de la caractéristique, comme effectiveSkillScore', () => {
    const t = testThreshold(djoko, 'Athlétisme', 'For', '+20')
    expect(t).toMatchObject({ trained: false, score: 15, target: 0 })
    expect(thresholdCalcText(t)).toBe('Athlétisme non apprise : la moitié de la Force (30), soit 15, moins un malus de 20 = seuil de 0')
  })
  it('renvoie null sans personnage ni compétence', () => {
    expect(testThreshold(null, 'Esquive', 'Agi')).toBeNull()
    expect(testThreshold(djoko, '', 'Agi')).toBeNull()
  })
})

describe('rollSummary et rollGapText', () => {
  it('résume une réussite avec le jet et le seuil', () => {
    expect(rollSummary({ status: 'success', degrees: 2, roll: 34, target: 45 })).toEqual({
      isSuccess: true,
      title: 'Réussite, 2 degrés',
      detail: '34 sur un seuil de 45',
    })
  })
  it('résume un échec à 1 degré au singulier', () => {
    expect(rollSummary({ status: 'fail', degrees: 1, roll: 52, target: 45 }).title).toBe('Échec, 1 degré')
  })
  it('null en attente', () => {
    expect(rollSummary(undefined)).toBeNull()
  })
  it('explique l’écart au seuil', () => {
    expect(rollGapText(23, 30)).toBe('Votre dé fait 23, soit 7 points sous le seuil : c’est réussi.')
    expect(rollGapText(30, 30)).toBe('Votre dé fait 30, pile le seuil : c’est réussi.')
    expect(rollGapText(31, 30)).toBe('Votre dé fait 31, soit 1 point au dessus du seuil : c’est raté.')
    expect(rollGapText(null, 30)).toBe('')
  })
})

describe('séquence de combat', () => {
  const hit = {
    outcome: 'hit',
    degrees: 2,
    dodgeDegrees: 3,
    fireMode: 'single',
    bullets: 1,
    damage: { locationKey: 'brasDroit', locationLabel: 'Bras droit', totalDamage: 7 },
  }

  it('numérote les étapes de 1 à 3', () => {
    expect(attackStep(null)).toBe(0)
    expect(attackStep({ outcome: 'pending-attack-roll' })).toBe(1)
    expect(attackStep({ outcome: 'miss' })).toBe(1)
    expect(attackStep({ outcome: 'pending-dodge' })).toBe(2)
    expect(attackStep({ outcome: 'dodged' })).toBe(2)
    expect(attackStep(hit)).toBe(3)
  })

  it('compte les balles, ou parle du coup au corps à corps', () => {
    expect(bulletsText(hit)).toBe('1 balle touche')
    expect(bulletsText({ ...hit, fireMode: 'auto', bullets: 3 })).toBe('3 balles touchent')
    expect(bulletsText({ ...hit, fireMode: 'melee' })).toBe('Le coup touche')
  })

  it('titre le résultat selon l’issue', () => {
    expect(attackResultTitle(hit, 123)).toBe('Esquive ratée : 7 dégâts subis')
    expect(attackResultTitle(hit, 0)).toBe('Hors de combat : 7 dégâts subis')
    expect(attackResultTitle({ ...hit, damage: { ...hit.damage, totalDamage: 1 } }, 5)).toBe('Esquive ratée : 1 dégât subi')
    expect(attackResultTitle({ outcome: 'dodged' })).toBe('Esquive réussie : aucun dégât')
    expect(attackResultTitle({ outcome: 'miss' })).toBe('L’attaque vous a manqué')
  })

  it('découpe une esquive ratée en six éléments distincts', () => {
    const facts = attackOutcomeFacts(hit, { current: 123, max: 130 })
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ['Attaque', 'Touché, 2 degrés'],
      ['Esquive', 'Ratée, 3 degrés d’échec'],
      ['Localisation', 'Bras droit'],
      ['Balles', '1 balle touche'],
      ['Dégâts subis, armure déduite', '7'],
      ['Points de vie restants', '123 sur 130'],
    ])
  })

  it('une esquive réussie ou une attaque ratée donne moins d’éléments', () => {
    expect(attackOutcomeFacts({ outcome: 'dodged', degrees: 1, dodgeDegrees: 2 }).map((f) => f.value)).toEqual([
      'Touché, 1 degré',
      'Réussie, 2 degrés de réussite',
    ])
    expect(attackOutcomeFacts({ outcome: 'miss', degrees: 1 }).map((f) => f.value)).toEqual(['Ratée, 1 degré d’échec'])
  })
})

describe('armorCells', () => {
  it('liste les 7 localisations et repère la zone touchée', () => {
    const cells = armorCells(djoko.armor, 'brasDroit')
    expect(cells).toHaveLength(7)
    expect(cells.find((c) => c.key === 'tete')).toMatchObject({ value: 2, isEmpty: false, isHit: false })
    expect(cells.find((c) => c.key === 'brasDroit').isHit).toBe(true)
    expect(cells.find((c) => c.key === 'abdomen')).toMatchObject({ value: 0, isEmpty: true })
  })
})

describe('launchSummary', () => {
  it('résume le test, le malus et les joueurs', () => {
    expect(launchSummary({ skill: 'Esquive', malus: '+10', count: 4, fictionalCount: 1 })).toBe('Test d’Esquive, malus de 10, pour 4 joueurs dont 1 fictif.')
    expect(launchSummary({ skill: 'Vigilance', malus: null, count: 1, fictionalCount: 0 })).toBe('Test de Vigilance, sans malus, pour 1 joueur.')
    expect(launchSummary({ skill: 'Vigilance', count: 0 })).toBe('Test de Vigilance : aucun joueur choisi.')
    expect(launchSummary({ skill: '' })).toBe('Choisissez une compétence.')
  })
  it('accorde « de » devant une voyelle', () => {
    expect(testOf('Esquive')).toBe('test d’Esquive')
    expect(testOf('Fouille')).toBe('test de Fouille')
  })
})
