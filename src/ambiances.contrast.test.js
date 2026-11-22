import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { AMBIANCES } from './ambiances.js'

// Ticket 100, critère 8 : chaque ambiance garde la lisibilité actuelle. Les couleurs
// sont lues dans styles.css (seule source), :root étant l'ambiance Cyber et chaque
// bloc :root[data-ambiance='…'] ne faisant que la surcharger.
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function variables(selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return null
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1], m[2]]))
}

function palette(id) {
  const base = variables(':root')
  return id === 'cyber' ? base : { ...base, ...variables(`:root[data-ambiance='${id}']`) }
}

function luminance(hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const TEXTES = ['text', 'text-2', 'accent', 'warn', 'danger', 'danger-strong', 'amber']
const FONDS = ['bg', 'surface', 'surface-2']

describe.each(AMBIANCES.map((a) => a.id))('ambiance %s', (id) => {
  const p = palette(id)

  it('a son bloc de variables et son décor dans styles.css', () => {
    if (id !== 'cyber') expect(variables(`:root[data-ambiance='${id}']`)).not.toBeNull()
    expect(css).toContain(`html[data-ambiance="${id}"]{--orn:`)
  })

  it("montre dans l'aperçu les vraies couleurs de l'ambiance", () => {
    const { apercu } = AMBIANCES.find((a) => a.id === id)
    expect([apercu.fond, apercu.surface, apercu.accent]).toEqual([p.bg, p.surface, p.accent])
  })

  for (const texte of TEXTES) {
    for (const fond of FONDS) {
      it(`${texte} sur ${fond} : au moins 4,5 pour 1`, () => {
        expect(contrast(p[texte], p[fond])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('textes sur aplats (bouton, valeur du code, alertes) : au moins 4,5 pour 1', () => {
    expect(contrast(p['accent-ink'], p.accent)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p['accent-ink'], p['accent-hover'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p['text-strong'], p.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p['warn-ink'], p.warn)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.text, p['warn-bg'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.danger, p['danger-bg'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.text, p['surface-hover'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.placeholder, p.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('contours porteurs et focus : au moins 3 pour 1', () => {
    for (const fond of ['bg', 'surface']) {
      expect(contrast(p['border-strong'], p[fond])).toBeGreaterThanOrEqual(3)
      expect(contrast(p.focus, p[fond])).toBeGreaterThanOrEqual(3)
    }
  })

  it('action, alerte, danger et focus restent distincts', () => {
    const etats = [p.accent, p.warn, p.danger, p.focus].map((c) => c.toLowerCase())
    expect(new Set(etats).size).toBe(4)
  })
})
