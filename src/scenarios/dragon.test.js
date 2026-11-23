import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dragonScenario } from './dragon.js'
import { getScenario, stepOutcome } from './index.js'
import { avatarSvg } from './avatar.js'
import { npcDodgeScore } from '../gameLogic.js'

describe('scénario du dragon (ticket 97)', () => {
  it('est enregistré sous la valeur attendue par SCENARIO', () => {
    expect(getScenario('dragon')).toBe(dragonScenario)
    expect(getScenario('inconnu')).toBeNull()
    expect(getScenario('')).toBeNull()
  })

  it('contient 5 étapes : 4 tests de compétence puis un combat', () => {
    expect(dragonScenario.steps).toHaveLength(5)
    expect(dragonScenario.steps.slice(0, 4).every((s) => s.test && s.success && s.failure)).toBe(true)
    expect(dragonScenario.steps[4].combat.turns.length).toBeGreaterThan(0)
    expect(dragonScenario.steps[4].combat.rounds).toBeGreaterThan(0)
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

  it("ne joue qu'Aldric ; chaque tour du combat oppose Aldric et le dragon avec une arme qu'ils portent", () => {
    expect(dragonScenario.characters.filter((c) => c.played).map((c) => c.name)).toEqual(['Aldric'])
    const aldric = dragonScenario.characters.find((c) => c.name === 'Aldric')
    for (const turn of dragonScenario.steps[4].combat.turns) {
      const attacker = turn.attacker.type === 'npc' ? dragonScenario.npc : dragonScenario.characters.find((c) => c.name === turn.attacker.name)
      const weapon = attacker.weapons.find((w) => w.name === turn.weapon)
      expect(weapon).toBeTruthy()
      expect(weapon.mode[turn.fireMode] ?? weapon.mode.melee).toBe(true)
      const names = [turn.attacker.name ?? dragonScenario.npc.name, turn.defender.name ?? dragonScenario.npc.name]
      expect(names.sort()).toEqual([aldric.name, dragonScenario.npc.name].sort())
    }
  })

  it('a le dragon comme seul PNJ, avec une arme', () => {
    expect(Array.isArray(dragonScenario.npc)).toBe(false)
    expect(dragonScenario.npc.name).toBe('Le dragon rouge')
    expect(dragonScenario.npc.weapons.length).toBeGreaterThan(0)
  })

  // Retour du 22/11 : trop d'échecs pendant le combat. Ces seuils gardent un combat
  // court et lisible si quelqu'un retouche les chiffres.
  it('garde un combat court où les coups portent', () => {
    const { npc, characters, steps } = dragonScenario
    const aldric = characters.find((c) => c.name === 'Aldric')
    const sword = aldric.weapons.find((w) => w.name === 'Épée longue')
    const claws = npc.weapons.find((w) => w.name === 'Griffes')
    expect(aldric.characteristics.Dex).toBeGreaterThanOrEqual(65)
    expect(npc.characteristics.Dex).toBeGreaterThanOrEqual(60)
    expect(npcDodgeScore({ ...npc, dodgeBonus: npc.dodgeBonus })).toBeLessThanOrEqual(15)
    // Le dragon tombe en deux coups d'épée, quelle que soit la localisation.
    const worstArmor = Math.max(...Object.values(npc.armor))
    expect(2 * (sword.damage - worstArmor)).toBeGreaterThanOrEqual(npc.pvBase)
    // Aldric survit à tous les tours du dragon, même touché à chaque fois.
    const aldricArmor = Math.min(...Object.values(aldric.armor))
    expect(steps[4].combat.rounds * (claws.damage - aldricArmor)).toBeLessThan(aldric.pvBase)
  })

  it('génère des avatars SVG en data URI, de couleurs distinctes', () => {
    const all = [...dragonScenario.characters, dragonScenario.npc]
    for (const e of all) expect(e.avatar.startsWith('data:image/svg+xml')).toBe(true)
    expect(new Set(all.map((e) => e.color)).size).toBe(all.length)
    expect(avatarSvg({ color: '#000', initial: '<' })).toContain('&lt;')
  })
})

describe('illustrations de la démo', () => {
  const turns = dragonScenario.steps.flatMap((s) => s.combat?.turns ?? [])
  const images = [
    dragonScenario.cover,
    dragonScenario.team,
    ...dragonScenario.steps.map((s) => s.image),
    ...turns.map((t) => t.image),
    ...Object.values(dragonScenario.endings).map((e) => e.image),
  ]

  it('illustre l’accueil, chaque étape, chaque tour de combat et chaque fin', () => {
    expect(images).toHaveLength(2 + dragonScenario.steps.length + turns.length + Object.keys(dragonScenario.endings).length)
    expect(images.every(Boolean)).toBe(true)
  })

  it('pointe vers des fichiers présents dans public/demo, avec un texte alternatif', () => {
    for (const image of images) {
      expect(image.alt.length).toBeGreaterThan(10)
      expect(existsSync(fileURLToPath(new URL(`../../public${image.src}`, import.meta.url)))).toBe(true)
    }
  })

  it('n’utilise pas deux fois la même image', () => {
    expect(new Set(images.map((i) => i.src)).size).toBe(images.length)
  })
})

describe('stepOutcome', () => {
  it('réussit dès qu’un personnage réussit, échoue si tous échouent', () => {
    expect(stepOutcome([])).toBeNull()
    expect(stepOutcome([{ status: 'fail' }, { status: 'success' }])).toBe('success')
    expect(stepOutcome([{ status: 'fail' }, { status: 'fail' }, { status: 'fail' }])).toBe('failure')
  })
})
