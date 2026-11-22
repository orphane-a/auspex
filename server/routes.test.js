import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest'

// Routes testées en HTTP réel sur un port éphémère (fetch de Node, aucune
// dépendance ajoutée). Même convention que db.test.js : DATA_DIR temporaire posé
// avant l'import dynamique, closeDb() en afterAll.
let db
let seed
let tmpDir
let server
let baseUrl
let broadcasts = 0
const connected = new Set()

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-routes-test-'))
  process.env.DATA_DIR = tmpDir
  db = await import('./db.js')
  seed = await import('./seed.js')
  const { buildSnapshot } = await import('./state.js')
  const { createRoutes } = await import('./routes.js')
  const express = (await import('express')).default
  const presence = {
    isConnected: (id) => connected.has(Number(id)),
    broadcast: () => {
      broadcasts += 1
    },
  }
  const app = express()
  app.use(express.json())
  app.use('/api', createRoutes({ presence, buildSnapshot, autoRollDelayMs: 0 }))
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  vi.restoreAllMocks()
  connected.clear()
  db.resetTable()
  db.setAttack(null)
  await seed.seedIfEmpty()
})

async function call(method, url, body) {
  const res = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

// Les actions automatiques partent dans un setTimeout(0) après la réponse : on
// attend qu'une condition soit vraie plutôt qu'une durée fixe.
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('condition jamais atteinte')
}

const byName = (name) => db.listCharacters().find((c) => c.name === name)

describe('POST /api/table/join (ticket 94)', () => {
  it('refuse un fictif avec une 403 et le message attendu', async () => {
    const { code } = db.getTableState()
    const { status, data } = await call('POST', '/table/join', { code, characterId: byName('Vex').id })
    expect(status).toBe(403)
    expect(data.error).toBe('Ce personnage fictif ne peut pas être choisi par un joueur.')
  })

  it('accepte toujours un vrai personnage', async () => {
    const { code } = db.getTableState()
    const { status, data } = await call('POST', '/table/join', { code, characterId: byName('Djoko').id })
    expect(status).toBe(200)
    expect(data.character.name).toBe('Djoko')
  })
})

describe('GET /api/table', () => {
  it('affiche 3 présents sur 4 sans aucune fenêtre Joueur', async () => {
    const { data } = await call('GET', '/table')
    expect(data.characters).toHaveLength(4)
    expect(data.characters.filter((c) => c.connected)).toHaveLength(3)
  })
})

describe('test de compétence avec des fictifs', () => {
  it('lance automatiquement les jets des fictifs, Djoko reste en attente', async () => {
    const ids = [byName('Vex').id, byName('Soeur Ilia').id, byName('Djoko').id]
    const { status, data } = await call('POST', '/table/request', { skill: 'Esquive', malus: null, concernedCharacterIds: ids })
    expect(status).toBe(200)
    expect(data.rolls).toEqual({})

    await waitFor(() => Object.keys(db.getTableState().rolls).length === 2)
    const { rolls } = db.getTableState()
    for (const id of ids.slice(0, 2)) {
      expect(rolls[id].auto).toBe(true)
      expect(['success', 'fail']).toContain(rolls[id].status)
    }
    expect(rolls[byName('Djoko').id]).toBeUndefined()
  })

  it('utilise le même calcul que pour un vrai joueur', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // d100 = 21
    const vex = byName('Vex')
    const { effectiveSkillScore } = await import('../src/gameLogic.js')
    const { resolveRoll } = await import('./game.js')
    const expected = resolveRoll(effectiveSkillScore(vex, 'Esquive', 'Agi'), '+10')
    await call('POST', '/table/request', { skill: 'Esquive', malus: '+10', concernedCharacterIds: [vex.id] })
    await waitFor(() => db.getTableState().rolls[vex.id])
    const roll = db.getTableState().rolls[vex.id]
    expect(roll.roll).toBe(21)
    expect(roll).toEqual({ ...expected, auto: true })
  })

  it("le retrait des fictifs pendant un test laisse le test continuer pour Djoko", async () => {
    const djoko = byName('Djoko')
    const ids = [byName('Vex').id, djoko.id]
    await call('POST', '/table/request', { skill: 'Esquive', malus: null, concernedCharacterIds: ids })
    await waitFor(() => Object.keys(db.getTableState().rolls).length === 1)

    const removed = await call('DELETE', '/characters/fictional')
    expect(removed.status).toBe(200)
    expect(removed.data.request.concernedCharacterIds).toEqual([djoko.id])
    expect(removed.data.request.fictionalRemoved).toBe(true)
    expect(removed.data.rolls).toEqual({})

    const roll = await call('POST', '/table/roll', { characterId: djoko.id })
    expect(roll.status).toBe(200)
  })
})

describe("séquence d'attaque avec des fictifs", () => {
  it("un PNJ qui touche un fictif : l'esquive part seule et la séquence se termine", async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // d100 = 1 : touche toujours, esquive réussie
    const npc = db.addNpc({ name: 'Culiste', characteristics: { Dex: 50, Agi: 30 }, weapons: [{ name: 'Lame', mode: { melee: true }, damage: 10 }] })
    const vex = byName('Vex')
    const { status, data } = await call('POST', '/table/attack', {
      attackerType: 'npc',
      attackerId: npc.id,
      defenderType: 'character',
      defenderId: vex.id,
      weaponName: 'Lame',
      fireMode: 'melee',
    })
    expect(status).toBe(200)
    expect(data.attack.outcome).toBe('pending-dodge')

    await waitFor(() => ['dodged', 'hit'].includes(db.getTableState().attack?.outcome))
    expect(db.getTableState().attack.dodgeRoll).toBe(1)
  })

  it("un fictif attaquant lance son jet d'attaque seul, sans être connecté", async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // d100 = 100 : raté
    const npc = db.addNpc({ name: 'Culiste', characteristics: { Dex: 30, Agi: 30 }, weapons: [] })
    const kael = byName('Kael')
    const { status, data } = await call('POST', '/table/attack', {
      attackerType: 'character',
      attackerId: kael.id,
      defenderType: 'npc',
      defenderId: npc.id,
      weaponName: kael.weapons[0].name,
      fireMode: kael.weapons[0].mode.melee ? 'melee' : 'single',
    })
    expect(status).toBe(200)
    expect(data.attack.outcome).toBe('pending-attack-roll')
    await waitFor(() => db.getTableState().attack?.outcome === 'miss')
  })

  it('une attaque contre un vrai joueur non connecté reste refusée', async () => {
    const npc = db.addNpc({ name: 'Culiste', characteristics: { Dex: 30 }, weapons: [{ name: 'Lame', mode: { melee: true }, damage: 10 }] })
    const { status } = await call('POST', '/table/attack', {
      attackerType: 'npc',
      attackerId: npc.id,
      defenderType: 'character',
      defenderId: byName('Djoko').id,
      weaponName: 'Lame',
      fireMode: 'melee',
    })
    expect(status).toBe(400)
  })
})

describe('retrait et ajout des fictifs', () => {
  it('retire les fictifs sans toucher aux vrais personnages, aux PNJ ni au code', async () => {
    db.addNpc({ name: 'Culiste' })
    const npcs = db.listNpcs().length
    const { code } = db.getTableState()

    const { status, data } = await call('DELETE', '/characters/fictional')
    expect(status).toBe(200)
    expect(data.removed).toBe(3)
    expect(data.characters.map((c) => c.name)).toEqual(['Djoko'])
    expect(data.npcs).toHaveLength(npcs)
    expect(data.code).toBe(code)
  })

  it('les recrée à la demande, une seule fois', async () => {
    await call('DELETE', '/characters/fictional')
    const added = await call('POST', '/characters/fictional')
    expect(added.status).toBe(201)
    expect(added.data.characters.filter((c) => c.fictional)).toHaveLength(3)

    const again = await call('POST', '/characters/fictional')
    expect(again.status).toBe(409)
  })

  it("refuse l'ajout quand AUSPEX_FICTIFS=0", async () => {
    await call('DELETE', '/characters/fictional')
    process.env.AUSPEX_FICTIFS = '0'
    try {
      const { status, data } = await call('POST', '/characters/fictional')
      expect(status).toBe(403)
      expect(data.error).toBe('Les personnages fictifs sont désactivés sur ce serveur.')
    } finally {
      delete process.env.AUSPEX_FICTIFS
    }
  })

  it('« réinitialiser la table » remet Djoko et les trois fictifs', async () => {
    await call('DELETE', '/characters/fictional')
    const { data } = await call('POST', '/table/reset')
    expect(data.characters.map((c) => c.name)).toEqual(['Djoko', 'Vex', 'Soeur Ilia', 'Kael'])
  })

  it("annule une attaque qui impliquait un fictif retiré", async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const npc = db.addNpc({ name: 'Culiste', characteristics: { Dex: 30 }, weapons: [] })
    const kael = byName('Kael')
    db.setAttack({ id: 1, attacker: { type: 'character', id: kael.id }, defender: { type: 'npc', id: npc.id }, outcome: 'miss' })
    const { data } = await call('DELETE', '/characters/fictional')
    expect(data.attack).toBeNull()
  })
})
