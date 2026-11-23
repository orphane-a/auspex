# Auspex

Compagnon de table temps réel pour des parties de jeu de rôle Warhammer 40,000 (M41) : une vue MJ
et une vue Joueur synchronisées en direct via Socket.io, avec une base SQLite locale.

## Démarrer

```bash
npm install
npm run dev      # backend (3001) + Vite (5173)
```

- `npm run build` — build de production dans `dist/`
- `npm start` — sert le build + l'API depuis un seul process (`server/index.js`)
- `npm run demo` — instance de démo du scénario guidé « Le dragon de Pierrenoire »
  (`SCENARIO=dragon`, base séparée dans `server/demo-data/`). La démo s'ouvre toujours en
  ambiance Médiéval, celle du scénario ; la table habituelle reste en Cyber par défaut.

Au premier démarrage, la base `server/table.sqlite` est créée et peuplée à partir des fiches
d'exemple dans `PNJ_test/`.

Voir [`AGENTS.md`](AGENTS.md) pour l'architecture détaillée et les conventions du projet.
