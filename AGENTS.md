# AGENTS.md

Operating manual for any AI coding agent (Cursor, Claude Code, Codex, …) working in this
repository. Read it top to bottom once before your first change.

## Project

**Auspex** — a real-time tabletop companion app for a Warhammer 40,000 (M41) roleplay campaign.
One GM and one or more players connect to the same table over Socket.io; the GM view and player
view stay in sync live. The invariant that must never break: the GM's snapshot of a character
(wounds, armour, status) and the player's own view of that same character must never diverge.

## Repository layout

| Path | What it is |
| --- | --- |
| `src/` | React 18 frontend (GM view, player view, join/setup screens, socket state hook) |
| `server/` | Express 5 + Socket.io backend (REST API, live sync, SQLite access, xlsx import) |
| `server/table.sqlite` | SQLite DB, gitignored — generated and seeded on first boot |
| `PNJ_test/` | Sample NPC character sheets (`.xlsx`) used to seed a fresh DB |
| `conception_*.md` / `*.docx` | Design notes for the game rules and wireframes (reference only, not code) |

## How we work

- **Small, verifiable steps.** Split unrelated concerns into separate changes; a diff that touches
  both game rules and UI layout in one go is a smell to split.
- **Don't break a live table.** The DB schema, the socket snapshot shape, and the wound/armour
  rules in `src/gameLogic.js` are used during actual play sessions — treat changes to them as
  higher-risk than everything else in the repo.
- **Stay in French for user-facing text.** All UI copy and most in-code comments are French;
  match that, don't switch to English mid-file.

## Mandatory human review

Discuss with the project owner before implementing, rather than shipping straight away:

- Database schema changes (`server/db.js`, anything touching `table.sqlite`).
- Changes to the socket/snapshot protocol (`server/state.js`, `server/socket.js`,
  `src/useTableState.js`) — client and server must stay in lock-step.
- Combat, wound, or armour rule changes (`src/gameLogic.js`, `server/game.js`).

Propose the change and the files it touches, then wait for explicit approval before implementing.

## Stack

- Package manager: npm (see `package-lock.json`)
- Language: plain JavaScript/JSX — no TypeScript, no type checking step
- Frontend: React 18 + Vite
- Backend: Express 5, Socket.io, better-sqlite3
- Tests: Vitest (`npm test`), run in CI on every push/PR to `main` — see "Testing" below.
  No linter configured — don't reference a gate that doesn't exist.

## Code standards

- No new dependency for something the existing manual-validation style already covers
  (`routes.js`, `xlsxParser.js` do plain shape checks on parsed input — follow that pattern).
- Keep `src/gameLogic.js` free of UI and I/O — it's the one place game-rule math should live,
  and it's the most thoroughly unit-tested file in the repo for exactly that reason.
- Comments explain non-obvious intent or trade-offs (see `server/index.js` for the style), never
  narrate what the code does.

## Testing

- `npm test` runs Vitest once (`vitest run`); CI runs the same command plus `npm run build` on
  every push/PR to `main` (`.github/workflows/ci.yml`).
- Tests live next to source: `src/gameLogic.js` → `src/gameLogic.test.js`,
  `server/game.js` → `server/game.test.js`.
- `server/db.js` and `server/state.js` open/migrate a real SQLite file as an import-time side
  effect. Their tests set `process.env.DATA_DIR` to a fresh `mkdtempSync` directory and use a
  dynamic `await import(...)` *after* setting it, so they never touch the real dev `table.sqlite`.
  Call the module's `closeDb()` in `afterAll` before `rmSync`-ing that temp dir — better-sqlite3
  holds the file open, and Windows refuses to delete a directory with an open handle inside it.
- Randomness (`Math.random`, used by `rollD100`/table codes) is mocked with `vi.spyOn` rather than
  asserting on ranges, so outcomes are exact and reproducible.
- Any new gameplay rule in `gameLogic.js`/`server/game.js` should ship with tests in the same
  change — that file is exactly what "Mandatory human review" above is protecting.

## Security

- No secrets in source or committed config. This app has no auth layer today — it's meant to run
  on a trusted local network or private deployment for one table, not to be exposed publicly
  as-is.
- `server/table.sqlite*` must never be committed (gitignored) — it can contain a real campaign's
  character data.

## Development workflow

1. `npm install`, then `npm run dev` (backend on 3001, Vite on 5173, proxied together).
2. Implement in small, reviewable steps — one concern per change.
3. If the change touches the DB schema, the socket protocol, or `gameLogic.js`, flag it and wait
   for the owner's go-ahead before implementing (see "Mandatory human review").
4. `npm test` and `npm run build` before considering a change done — CI runs both on every push
   to `main`, so a broken one here means Railway is about to auto-deploy a broken build.

## Forbidden shortcuts

- Do not commit `server/table.sqlite*` or `node_modules`.
- Do not silently change the socket snapshot shape without updating every consumer
  (`src/useTableState.js` and both views).
- Do not add a new frontend framework, CSS pipeline, or type system without discussing it first —
  this is a small app, not a platform.
