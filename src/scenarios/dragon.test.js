import { describe, it, expect } from 'vitest'
import { dragonScenario } from './dragon.js'
import { getScenario, stepOutcome } from './index.js'
import { avatarSvg } from './avatar.js'

describe('scénario du dragon (ticket 97)', () => {
  it('est enregistré sous la valeur attendue par SCENARIO', () => {
    expect(getScenario('dragon')).toBe(dragonScenario)
    expect(getScenario('inconnu')).toBeNull()
    expect(getScenario('')).toBeNull()
  })

  it('contient 5 étapes : 4 tests de compétence puis une attaque', () => {
    expect(dragonScenario.steps).toHaveLength(5)
    expect(dragonScenario.steps.slice(0, 4).every((s) => s.test && s.success && s.failure)).toBe(true)
    expect(dragonScenario.steps[4].attack).toBeTruthy()
  })

  it('vise à chaque étape une compétence présente chez les 3 personnages', () => {
    expect(dragonScenario.characters).toHaveLength(3)
    for (const step of dragonScenario.steps.filter((s) => s.test)) {
      for (const c of dragonScenario.characters) {
        expect(c.skills.map((s) => s.name)).toContain(step.test.skill)
      }
    }
  })

  it('donne à chacun au moins une étape où il a le meilleur score', () => {
    const bestByStep = dragonScenario.steps
      .filter((s) => s.test)
      .map((step) => {
        const scores = dragonScenario.characters.map((c) => ({ name: c.name, score: c.skills.find((s) => s.name === step.test.skill).score }))
        return scores.sort((a, b) => b.score - a.score)[0].name
      })
    for (const c of dragonScenario.characters) expect(bestByStep).toContain(c.name)
  })

  it('a les compétences minimales, une arme et des PV pour chaque personnage', () => {
    const required = ['Perception', 'Discrétion', 'Athlétisme', 'Fouille', 'Connaissance des arcanes', 'Esquive']
    for (const c of dragonScenario.characters) {
      expect(c.skills.map((s) => s.name)).toEqual(expect.arrayContaining(required))
      expect(c.weapons.length).toBeGreaterThan(0)
      expect(c.pvBase).toBeGreaterThan(0)
      expect(Object.keys(c.characteristics).sort()).toEqual(['Agi', 'Cha', 'Dex', 'For', 'Int', 'Per', 'Vol'])
    }
  })

  it("ne joue qu'Aldric, qui porte l'arme de l'attaque finale", () => {
    expect(dragonScenario.characters.filter((c) => c.played).map((c) => c.name)).toEqual(['Aldric'])
    const { attacker, weapon } = dragonScenario.steps[4].attack
    const aldric = dragonScenario.characters.find((c) => c.name === attacker)
    expect(aldric.weapons.map((w) => w.name)).toContain(weapon)
  })

  it('a le dragon comme seul PNJ, avec une arme et un bonus d’esquive', () => {
    expect(Array.isArray(dragonScenario.npc)).toBe(false)
    expect(dragonScenario.npc.name).toBe('Le dragon rouge')
    expect(dragonScenario.npc.weapons.length).toBeGreaterThan(0)
    expect(dragonScenario.npc.dodgeBonus).toBe(10)
  })

  it('génère des avatars SVG en data URI, de couleurs distinctes', () => {
    const all = [...dragonScenario.characters, dragonScenario.npc]
    for (const e of all) expect(e.avatar.startsWith('data:image/svg+xml')).toBe(true)
    expect(new Set(all.map((e) => e.color)).size).toBe(all.length)
    expect(avatarSvg({ color: '#000', initial: '<' })).toContain('&lt;')
  })
})

describe('stepOutcome', () => {
  it('réussit dès qu’un personnage réussit, échoue si tous échouent', () => {
    expect(stepOutcome([])).toBeNull()
    expect(stepOutcome([{ status: 'fail' }, { status: 'success' }])).toBe('success')
    expect(stepOutcome([{ status: 'fail' }, { status: 'fail' }, { status: 'fail' }])).toBe('failure')
  })
})
