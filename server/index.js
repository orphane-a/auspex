import express from 'express'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { buildSnapshot } from './state.js'
import { attachPresence } from './socket.js'
import { createRoutes } from './routes.js'
import { seedIfEmpty } from './seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '../dist')

await seedIfEmpty()

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const presence = attachPresence(io, { getSnapshot: buildSnapshot })

app.use(express.json())
app.use('/api', createRoutes({ presence, buildSnapshot }))

// In dev, Vite serves the frontend on its own port and proxies /api + /socket.io
// here (see vite.config.js). In production there's no Vite dev server, so this
// process also serves the built static files — same origin, no CORS to configure.
app.use(express.static(DIST_DIR))
// No path pattern (rather than '*') — Express 5's path-to-regexp no longer accepts
// a bare wildcard and needs a named one (e.g. '/*splat'); an unpathed middleware
// matches everything without relying on that parsing at all.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

// Hosting platforms (Railway, Render, Fly...) inject PORT and expect the app to
// bind to it. Locally, though, `npm run dev` runs this alongside Vite under
// concurrently, and dev tooling commonly injects its own PORT meant for the web
// process — honoring it here too would steal Vite's port and break its /api proxy
// (which is hardcoded to BACKEND_PORT's default, 3001). `--dev` (set by the
// dev:server script) keeps this process on BACKEND_PORT/3001 regardless of PORT.
const isDevScript = process.argv.includes('--dev')
const PORT = isDevScript ? process.env.BACKEND_PORT || 3001 : process.env.PORT || process.env.BACKEND_PORT || 3001
server.listen(PORT, () => {
  console.log(`Auspex server listening on http://localhost:${PORT}`)
})
