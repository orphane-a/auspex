import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DemoHome, { CHOICES } from './DemoHome.jsx'
import { dragonScenario as dragon } from '../scenarios/dragon.js'

const rendre = (scenario) => renderToStaticMarkup(createElement(DemoHome, { scenario }))

describe('DemoHome (ticket 103)', () => {
  it('affiche la pastille, le titre et le préambule sur Auspex et la démo', () => {
    const html = rendre(dragon)
    expect(html).toContain('>Démo</p>')
    expect(html).toContain(dragon.title)
    expect(html).toContain('MJ humain')
    expect(html).toContain('équipe de joueurs')
    expect(html).toContain('à distance')
    expect(html).toContain("Cette démo simule l&#x27;histoire qu&#x27;aurait racontée un MJ humain")
    expect(html).not.toContain('Une courte aventure pour découvrir Auspex')
    expect(html).not.toMatch(/[—–]/)
  })

  it('propose deux choix avec les liens /mj et /joueur', () => {
    expect(CHOICES.map((c) => c.href)).toEqual(['/mj', '/joueur'])
    const html = rendre(dragon)
    expect(html).toContain('href="/mj"')
    expect(html).toContain('href="/joueur"')
    expect(html).not.toContain('href="/?vues=deux"')
  })

  it('affiche l\'image de couverture en deux colonnes quand elle existe', () => {
    const html = rendre(dragon)
    expect(html).toContain('class="demo-home-inner"')
    expect(html).toContain(`src="${dragon.cover.src}"`)
  })

  it('sans image de couverture, passe en une colonne sans figure vide', () => {
    const html = rendre({ ...dragon, cover: undefined })
    expect(html).toContain('class="demo-home-inner sans-image"')
    expect(html).not.toContain('<figure')
    expect(html).not.toContain('<img')
  })
})
