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
  Sa page d'accueil (`src/demo/DemoHome.jsx`) rappelle à quoi sert Auspex et tient sans
  défilement à partir de 1024 x 600 : deux colonnes dès 1024 px de large, l'image de
  couverture est la seule partie élastique (masquée en une colonne sous 700 px de haut).
  Pendant la démo, un voile léger assombrit Auspex pour faire ressortir la popin du guide,
  avec une découpe sur le bouton à cliquer (`.demo-dim`, rendu par `src/demo/DemoGuide.jsx`).
  Il est purement visuel (aucun clic bloqué). Son intensité se règle par ambiance dans
  `src/styles.css` avec les jetons `--demo-dim` (45 %), `--demo-dim-reduit` (25 %, popin
  réduite) et `--demo-dim-modale` (20 %, au dessus d'une modale).

Au premier démarrage, la base `server/table.sqlite` est créée et peuplée à partir des fiches
d'exemple dans `PNJ_test/`.

Voir [`AGENTS.md`](AGENTS.md) pour l'architecture détaillée et les conventions du projet.
