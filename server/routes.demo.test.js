import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'

// POST /api/table/reset en mode démo (ticket 101), en HTTP réel comme routes.test.js :
// DATA_DIR temporaire posé avant l'import dynamique, closeDb() en afterAll.
let db
let seed
let tmpDir
let server
let baseUrl

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'auspex-routes-demo-test-'))
  process.env.DATA_DIR = tmpDir
  process.env.SCENARIO = 'dragon'
  db = await import('./db.js')
  seed = await import('./seed.js')
  const { buildSnapshot } = await import('./state.js')
  const { createRoutes } = await import('./routes.js')
  const express = (await import('express')).default
  const presence = { isConnected: () => false, broadcast: () => {} }
  const app = express()
  app.use(express.json())
  app.use('/api', createRoutes({ presence, buildSnapshot, autoRollDelayMs: 0 }))
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
  await seed.seedIfEmpty()
  await seed.seedNpcsIfEmpty()
  seed.appliquerAmbianceDuScenario()
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  delete process.env.SCENARIO
  db.closeDb()
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await call('POST', '/table/reset', {})
})

async function call(method, url, body) {
  const res = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

describe('démo en Médiéval (ticket 101)', () => {
  it('GET /scenario expose l\'ambiance du scénario', async () => {
    const { status, data } = await call('GET', '/scenario')
    expect(status).toBe(200)
    expect(data).toEqual({ scenario: 'dragon', ambiance: 'medieval' })
  })

  it('l\'instantané de la table de démo est en Médiéval', async () => {
    const { data } = await call('GET', '/table')
    expect(data.ambiance).toBe('medieval')
    expect(data.characters).toHaveLength(3)
  })

  it('POST /table/reset sans ambiance remet la démo en Médiéval, avec ses personnages et son dragon', async () => {
    await call('POST', '/table/reset', { ambiance: 'gothique' })
    for (const body of [{}, undefined]) {
      const { status, data } = await call('POST', '/table/reset', body)
      expect(status).toBe(200)
      expect(data.ambiance).toBe('medieval')
      expect(data.characters.map((c) => c.name)).toEqual(['Aldric', 'Ysolde', 'Brannoc'])
      expect(data.npcs.map((n) => n.name)).toEqual(['Le dragon rouge'])
    }
  })

  it('POST /table/reset avec { ambiance: "espace" } respecte l\'ambiance demandée', async () => {
    const { status, data } = await call('POST', '/table/reset', { ambiance: 'espace' })
    expect(status).toBe(200)
    expect(data.ambiance).toBe('espace')
    expect((await call('GET', '/table')).data.ambiance).toBe('espace')
  })

  it('refuse une ambiance inconnue en 400, la table reste en Médiéval avec son code', async () => {
    const before = (await call('GET', '/table')).data
    const { status, data } = await call('POST', '/table/reset', { ambiance: 'inconnue' })
    expect(status).toBe(400)
    expect(data.error).toBe("Ambiance inconnue. Choisissez l'une des cinq ambiances proposées. La table actuelle n'a pas changé.")
    const after = (await call('GET', '/table')).data
    expect(after.ambiance).toBe('medieval')
    expect(after.code).toBe(before.code)
  })
})
