# Conception V3 : module d'attaque bidirectionnel ⚔️

Fichier de conception technique, destiné à Claude Code pour l'implémentation. Complète `conception_v2_blessures_pv_armure.md` sans le remplacer : la V2 posait la séquence PNJ contre Joueur, la V3 la généralise dans les deux sens et sort le bouton du contexte "par personnage".

Mise à jour du 12 juillet : intègre les réponses d'Anne aux points ouverts de la première version de ce fichier.

## 1. Rappel de l'existant (V2) 📋

La V2 a livré une séquence d'attaque en trois temps, uniquement PNJ vers Joueur :

* Bouton "🎯 Attaque ennemie" affiché sur chaque ligne personnage de la vue MJ (uniquement les personnages connectés).
* Modale `AttackModal.jsx` : choix de la cible (joueur connecté), du PNJ attaquant, de son arme et de son mode de tir.
* Jet d'attaque automatique côté serveur contre la Dextérité brute du PNJ (`npc.characteristics.Dex`).
* Si l'attaque touche, demande d'esquive envoyée au joueur visé : il clique lui même son bouton "LANCER", score testé = `effectiveSkillScore(character, 'Esquive', 'Agi') + dodgeBonus`.
* Si l'esquive échoue, dégâts calculés à partir du profil de l'arme du PNJ (localisation par inversion des chiffres du jet d'attaque, nombre de balles selon le mode de tir, armure du joueur déduite par balle).

Tout ça vit dans `src/gameLogic.js` (fonctions pures), `server/routes.js` (`POST /table/attack` et `POST /table/attack/dodge`), `server/db.js` (table `npcs`, colonne `attack` de `table_state`) et `src/AttackModal.jsx`.

Point resté ouvert en V2 (§11 de ce fichier) : "les PNJ n'encaissent pas de dégâts dans l'outil pour l'instant". C'est précisément ce que la V3 vient combler.

## 2. Objectif de la V3 🎯

D'après notre échange du 12 juillet :

* Le bouton d'attaque quitte les lignes personnage et rejoint les actions globales du MJ (au même endroit que "Nouveau test" ou "Réinitialiser la table").
* Une première modale demande "qui attaque qui" : deux listes distinctes, PNJ et Joueurs, une sélection dans chaque liste (attaquant d'un côté, cible de l'autre).
* Toutes les combinaisons fonctionnent : PNJ contre Joueur, Joueur contre PNJ, mais aussi PNJ contre PNJ et Joueur contre Joueur.
* Quand la cible est un PNJ, il n'y a personne côté client pour lancer le dé d'esquive : c'est le MJ qui le fait à la place du PNJ, en tenant compte de son agilité.

## 3. Décisions retenues avec Anne ✅

* Le bouton "🎯 Attaque ennemie" par personnage disparaît, remplacé par un bouton unique dans les actions globales du MJ, par exemple "⚔️ Attaque".
* Modale 1 ("qui attaque qui") : deux listes, PNJ et Joueurs, chacune avec ses propres entrées. L'attaquant et la cible sont choisis librement, y compris dans la même liste (PNJ contre PNJ, Joueur contre Joueur sont possibles).
* Jet d'attaque : toujours un test de Dextérité brute, quel que soit le camp attaquant. Pas de choix de compétence dans la grille, le MJ ne choisit que l'arme utilisée par l'attaquant (et son mode de tir si besoin). Ça vaut aussi bien pour un PNJ attaquant (inchangé depuis la V2) qu'un Joueur attaquant (nouveau) : les deux testent leur `characteristics.Dex`, déjà importée dans les deux cas.
* Armes du Joueur : le parseur de fiche joueur (`parseCharacterSheet`) est étendu pour lire la table "Compétences d'Armes", exactement comme `extractWeapons` le fait déjà pour les PNJ. Un joueur a donc, comme un PNJ, une liste d'armes avec nom, mode de tir et dégâts.
* Esquive PNJ : vérifié sur les 3 fiches d'exemple (`PNJ_Culiste_Arme.xlsx`, `PNJ_Garde_Imperial.xlsx`, `PNJ_Marine_Renegat.xlsx`), aucune n'a de ligne "Esquive" — seule l'Agilité brute y figure. Le score d'esquive d'un PNJ reste donc un repli non formé, `Agi ÷ 2`. Anne souhaite malgré tout qu'un PNJ puisse bénéficier d'un bonus d'esquive comme un personnage (certains PNJ importants type boss peuvent être esquiveurs), donc un `dodge_bonus` est ajouté à la table `npcs`, sur le même principe que celui des personnages (réglable par le MJ depuis l'outil, jamais lu depuis le fichier, à 0 par défaut).
* Un PNJ n'a pas de notion de connexion (il n'a jamais de client) : tous les PNJ importés restent sélectionnables à tout moment comme attaquant ou comme cible, sans liste de rencontre active à gérer.
* Historique horodaté des dégâts et mort automatique restent hors périmètre, comme déjà décidé en V2 (§10).

## 4. Modèle de données à ajouter ou modifier 🗄️

⚠️ Cette section touche le schéma de la base et la forme du snapshot socket : changements à valider explicitement avant implémentation, conformément à `AGENTS.md`, même si les décisions de fond ci dessus sont actées.

### Table `characters`

* Nouvelle colonne `weapons TEXT NOT NULL DEFAULT '[]'`, même format que celle des PNJ (`{ name, modeRaw, mode, damage }`), remplie par extension du parseur (§7) et par un `rowToCharacter` mis à jour pour l'exposer.

### Table `npcs`

* Nouvelle colonne `dodge_bonus INTEGER NOT NULL DEFAULT 0`, symétrique à celle des personnages, réglable uniquement depuis l'outil (jamais importée).
* Le schéma a déjà `pv_base`, `pv_current`, `pv_bonuses`, `armor` : rien à ajouter côté colonnes. Ce qui manque, c'est la mécanique côté serveur pour que ces champs bougent une fois le PNJ créé (routes d'ajustement symétriques à celles des personnages, §8) : aujourd'hui `db.js` sait lire/écrire ces champs à la création d'un PNJ, mais aucune route n'expose de mise à jour de PV ou d'armure pour un PNJ existant.

### `table_state.attack`

La forme actuelle suppose un attaquant PNJ et une cible personnage :

```js
{ id, npcId, weaponName, fireMode, targetCharacterId, attackRoll, degrees, outcome, dodgeRoll, bullets, damage }
```

Elle doit devenir générique sur les deux camps :

```js
{
  id,
  attacker: { type: 'npc' | 'character', id },
  defender: { type: 'npc' | 'character', id },
  weaponName,
  fireMode,
  attackRoll,
  degrees,
  outcome, // 'miss' | 'pending-dodge' | 'dodged' | 'hit'
  dodgeRoll,
  bullets,
  damage,
}
```

Le jet d'attaque restant toujours automatique côté serveur (§3), il n'y a pas besoin d'un état intermédiaire du type `'pending-attack-roll'` : dès la validation de la modale MJ, l'issue de l'étape 1 est connue, exactement comme en V2.

Chaque consommateur de cette forme (`src/useTableState.js`, `GmView.jsx`, `PlayerView.jsx`, `AttackModal.jsx`) devra être mis à jour en même temps, comme le rappelle `AGENTS.md`.

## 5. Séquence d'attaque généralisée 🎲

Toujours trois temps, chaque étape dépendant maintenant de la nature de l'attaquant et de la cible plutôt que de supposer systématiquement un PNJ attaquant.

### Étape 1 : jet d'attaque (toujours automatique)

Dès validation de la modale MJ (cible, arme, mode de tir), le serveur tire 1d100 contre la Dextérité brute de l'attaquant, qu'il s'agisse d'un PNJ (`npc.characteristics.Dex`, inchangé depuis la V2) ou d'un Joueur (`character.characteristics.Dex`, nouveau, déjà importée en V2 pour le repli non formé). Raté → `outcome: 'miss'`, message "Attaque ratée" identique des deux côtés, fin de séquence.

### Étape 2 : jet d'esquive, uniquement si l'attaque a touché

* **Défenseur Joueur** (inchangé depuis la V2) : le joueur visé clique "LANCER", score testé = `effectiveSkillScore(character, 'Esquive', 'Agi') + character.dodgeBonus`.
* **Défenseur PNJ** (nouveau) : pas de client PNJ, donc pas de bouton à distance. Le MJ déclenche ce jet depuis sa vue (par exemple un bouton "Lancer l'esquive du PNJ" une fois l'attaque validée). Score testé : `Math.round(npc.characteristics.Agi / 2) + npc.dodgeBonus` (repli non formé + bonus manuel, §3 et §4).

### Étape 3 : dégâts, uniquement si l'esquive a échoué

Principe inchangé, mais la cible peut maintenant être un PNJ : localisation par inversion des chiffres du jet d'attaque (`hitLocationFromRoll`), nombre de balles selon le mode de tir et les degrés de réussite, dégâts par balle = dégâts de l'arme moins armure de la cible à cette localisation, armure déduite balle par balle. La cible (Joueur ou PNJ) voit son `pv.current` baisser via la route d'ajustement correspondante (§8).

## 6. Vue MJ 🖥️

* Nouveau bouton "⚔️ Attaque" dans les actions globales (à côté des boutons existants de gestion de table), remplace le bouton par personnage "🎯 Attaque ennemie".
* Modale 1 ("qui attaque qui") : deux listes, PNJ et Joueurs (tous, connectés ou non côté attaquant), sélection libre d'un attaquant et d'une cible, sans restriction de camp.
* Modale 2 (arme et mode de tir) : reprend l'UI actuelle d'`AttackModal.jsx`, simplement rebranchée sur la liste d'armes du camp choisi comme attaquant (PNJ ou Joueur, §4). Plus de choix de compétence à faire, le test est toujours la Dextérité brute (§3).
* Si la cible désignée est un Joueur non connecté : comme en V2, l'attaque ne peut pas être lancée (il faut quelqu'un pour cliquer "LANCER" l'esquive). Un PNJ cible n'a jamais cette contrainte (§3).
* Quand la cible est un PNJ : après un jet d'attaque réussi, un bouton dédié permet au MJ de lancer l'esquive du PNJ à sa place (étape 2, §5). L'affichage du résultat ("Esquivé" / dégâts) reste identique en forme à ce qui existe déjà pour un joueur.
* Roster : les PNJ affichés dans la vue MJ gagnent la même barre de PV que les personnages (déjà prévue en V2 pour eux dans le modèle de données, jamais branchée à l'affichage faute d'usage).
* Écran "Personnages" / "PNJ" : ajout d'un champ `dodge_bonus` éditable pour les PNJ, même pattern que celui déjà en place pour les personnages.

## 7. Vue Joueur 📱

* Défenseur : inchangé depuis la V2 (bandeau d'esquive, notification de dégâts encaissés).
* Attaquant : le jet étant automatique (§5, étape 1), le joueur attaquant n'a rien à cliquer. Une simple notification passive du résultat ("Vous avez touché" / "Vous avez raté votre tir"), sur le même modèle que le bandeau de dégâts encaissés côté défenseur, est une amélioration possible mais non bloquante : à confirmer si utile à l'usage, sinon le MJ peut simplement l'annoncer à voix haute pendant la partie.

## 8. Routes API à ajouter ou modifier 🔌

* `POST /table/attack` : généraliser le body en `{ attackerType, attackerId, defenderType, defenderId, weaponName, fireMode }` (plus de `skillName`, le test est toujours Dextérité brute, §3). Résolution toujours immédiate côté serveur, quel que soit le type d'attaquant.
* `POST /table/attack/dodge` : généraliser pour accepter une esquive résolue soit par le joueur visé (body actuel, inchangé), soit par le MJ pour un PNJ visé (nouveau, sans vérification d'identité puisque c'est le MJ qui agit, score calculé côté serveur à partir de `npc.characteristics.Agi` et `npc.dodgeBonus`).
* Symétrique des routes personnage pour les PNJ : `PATCH /npcs/:id/pv` (mode rapide), `POST /npcs/:id/damage` (mode détaillé), `PATCH /npcs/:id/armor` et `PATCH /npcs/:id/dodge-bonus`, mêmes contrats que leurs équivalents `characters`. Sans elles, un PNJ touché en étape 3 n'a nulle part où encaisser ses dégâts.

## 9. Hors périmètre pour la V3 🚫

* Parade, toujours différée (reportée depuis la V2, liée à l'import des compétences d'armes détaillées).
* Table de blessures critiques par localisation, mort automatique, historique horodaté des dégâts : tous déjà hors périmètre V2, restent hors périmètre V3 (confirmé §3).
* Attaques simultanées ou combat de groupe (plusieurs attaquants sur une même cible en une seule modale) : la séquence reste un affrontement à la fois, comme en V2.
* Notification passive du résultat côté joueur attaquant (§7) : amélioration possible, pas actée pour cette version.
                                                                                                                                                        