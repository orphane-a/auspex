# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What this is

**Auspex**: a real-time tabletop companion app for a Warhammer 40,000 (M41) roleplay campaign —
a GM view and a player view kept in sync live over Socket.io, backed by SQLite. `AGENTS.md` is
the canonical operating manual; read it before any structural change. The rules below are the
ones that bite if ignored.

## Commands

```bash
npm run dev       # backend (port 3001) + Vite dev server (port 5173), concurrently
npm run build     # vite build -> dist/
npm start         # node server/index.js — serves dist/ + /api from one process
npm run preview   # vite preview, against the production build
```

There is no test suite or lint script configured yet. Don't invent commands that don't exist.

## Local services

No external services to run. `server/table.sqlite` (better-sqlite3, gitignored) is created and
seeded automatically from `PNJ_test/*.xlsx` on first boot if the DB is empty (`server/seed.js`).
`npm install` is the only setup step after pulling.

## Architecture

- `src/` — React 18 frontend. `GmView.jsx` / `PlayerView.jsx` are the two live views,
  `screens/` holds the join/setup screens, `useTableState.js` owns all socket + REST state,
  `gameLogic.js` is pure game-rule helpers (no UI, no I/O — keep it that way).
- `server/` — Express 5 + Socket.io backend. `routes.js` (REST under `/api`), `socket.js`
  (presence + live push), `state.js` (builds the snapshot sent to clients), `db.js`
  (better-sqlite3 access), `xlsxParser.js` (imports character sheets from `.xlsx` exports).
- One-directional dependency: `server/` never imports from `src/`; `src/` talks to the backend
  only through `src/api.js`.
- Dev: Vite proxies `/api` and `/socket.io` to the backend (`vite.config.js`). Prod:
  `server/index.js` also serves `dist/` — same origin, no CORS to configure.

## Mandatory human review

**Changes to the DB schema, the socket/snapshot protocol, or the combat/wound rules in
`gameLogic.js` should be discussed with the project owner before being implemented** — a live
game table depends on these and they're hard to roll back mid-session. Propose the change, then
wait for explicit go-ahead.

## Conventions that bite if ignored

- Plain JS/JSX, no TypeScript, no build-time type checking — don't introduce `.ts` files
  piecemeal.
- No validation library in place; `routes.js` and `xlsxParser.js` do manual shape checks — match
  that style rather than pulling in a new dependency for one call site.
- UI strings and comments in `src/` are French — keep new user-facing text in French.
- `server/table.sqlite*` and `node_modules` are gitignored — never commit generated DB files.
- Conventional Commits for new commits.
