# Conception V2 — Points de vie, blessures et armure 🩸

Fichier de conception technique, à destination de Claude Code pour l'implémentation. Complète `conception_outil_jdr_w40k.docx` (§7 : ce point était explicitement reporté à la V2) sans le remplacer.

Basé sur l'analyse de `PJ_Djoko_mk4.xlsx` et du code existant (`server/db.js`, `server/xlsxParser.js`, `src/gameLogic.js`, `src/GmView.jsx`, `src/PlayerView.jsx`, `src/useTableState.js`).

## 1. Ce que la fiche de Djoko nous dit déjà

- **Points de vie** : un total Max et un total Actuel (sur la fiche les deux valent 130, car la fiche papier ne suit pas l'usure en cours de partie — l'outil, lui, doit les faire diverger).
- **Localisations** : table standard à 7 zones, chacune avec sa plage de d100 — c'est la même table que Dark Heresy 2e / Rogue Trader 2e / Only War 2e, donc fixe pour tout le monde, pas propre à un personnage :

  | Zone | Plage d100 |
  |---|---|
  | Tête | 01-10 |
  | Bras droit | 11-20 |
  | Bras gauche | 21-30 |
  | Poitrine | 31-50 |
  | Abdomen | 51-70 |
  | Jambe droite | 71-85 |
  | Jambe gauche | 86-00 |

- **Armures** : une valeur par localisation, propre à chaque personnage (dépend de son équipement). Sur la fiche de Djoko, seuls Bras droit/gauche (20) et Poitrine/Abdomen (40) sont renseignés — Tête et Jambes sont à 0 (pas d'équipement dessus). Une localisation sans valeur = armure 0.
- **Section "Blessures :"** (bas de fiche) : un champ libre vide sur la fiche de Djoko. Ce n'est pas une table de blessures critiques structurée, juste une zone de notes papier. **On ne peut donc pas se reposer sur le fichier xlsx pour un futur système de blessures critiques détaillées** — l'outil doit gérer ça lui-même, en interne.
- **Talents impactant les PV max** (ex. "Constitution solide", pris 3 fois par Djoko) : texte libre dans la grille de talents, donc pas d'auto-détection possible depuis le fichier xlsx. En revanche, une fois que le MJ a identifié un tel talent, son effet doit se répercuter **automatiquement** sur le total de PV max dès qu'il est ajouté à la fiche dans l'outil (cf. §3) — pas besoin de retaper un nouveau total à la main. `Résistance aux intoxications` reste une compétence de test classique (déjà gérée par le moteur de jets V1), pas un modificateur permanent : elle ne rentre pas dans ce mécanisme.

## 2. Décisions retenues avec Anne

- Livrable : ce fichier, pensé pour être donné à Claude Code, pas un cahier des charges narratif pour lecture MJ.
- Granularité des blessures : **localisation + armure par zone**, comme sur la fiche — pas de table de blessures critiques détaillées par zone (ex. saignement, étourdissement...) en V2. C'est explicitement mis en "hors périmètre V2" (§7) pour rester dans l'esprit "V1 simple, on complexifie étape par étape" déjà suivi dans le cahier des charges V1.
- Saisie des dégâts côté MJ : **les deux modes disponibles**, au choix du MJ selon l'importance de la scène (détail au §5).
- Rôle des compétences : **Esquive en amont** du jet de dégâts, via une séquence automatisée à trois temps décrite au §10 (mise à jour du 11 juillet, remplace l'ancien "raccourci Esquive/Parade" simple). **Talents type Constitution solide en amont des PV max** : ils augmentent le total de PV max automatiquement dès qu'ils sont ajoutés à la fiche dans l'outil (détail au §3 et §4) — pas de chiffre de réduction de dégâts en V2.

## 3. Modèle de données à ajouter

### Table `characters` (server/db.js)

Nouvelles colonnes :

- `pv_base INTEGER NOT NULL DEFAULT 10` — le total de PV tel qu'importé de la fiche (ou saisi manuellement), **avant** talents.
- `pv_bonuses TEXT NOT NULL DEFAULT '[]'` — JSON, liste de `{ label, amount }` (ex. `{ label: 'Constitution solide', amount: 10 }` — chaque achat de Constitution solide vaut +10 PV, cf. §5). Un talent gagné en cours de campagne (montée de niveau) s'ajoute ici, et le total de PV max se recalcule seul — c'est ce qui rend l'impact "automatique" plutôt que de compter sur le MJ pour retaper un nouveau total à la main. Rien n'empêche d'ajouter plusieurs lignes "Constitution solide" si le talent est acheté plusieurs fois (Djoko l'a acheté 3 fois → 3 lignes de +10, soit +30 PV max).
- `pv_current INTEGER NOT NULL DEFAULT 10`
- `armor TEXT NOT NULL DEFAULT '{}'` — JSON `{ tete, brasDroit, brasGauche, poitrine, abdomen, jambeDroite, jambeGauche }`, valeurs par défaut à 0 si absentes.
- `characteristics TEXT NOT NULL DEFAULT '{}'` — JSON des 7 caractéristiques brutes (`For, Per, Dex, Agi, Int, Vol, Cha`), nécessaires pour calculer un jet non formé (cf. §5). Jamais mises en avant côté joueur (cohérent avec l'esprit V1) : utilisées seulement en coulisses pour ce calcul.
- `dodge_bonus INTEGER NOT NULL DEFAULT 0` — palier de talent d'esquive (0, 10 ou 20, cf. §10), analogue aux talents "Pilotage+10/+20" de la fiche : un bonus fixe qui s'ajoute au score de base de la compétence Esquive au moment du jet d'esquive, réglable par le MJ sans re-upload. À laisser à 0 pour un personnage dont le score Esquive importé inclut déjà ce bonus dans le total (cas de Djoko, cf. §1) — ce champ sert surtout à faire évoluer le bonus en cours de campagne sans re-calculer le score complet.

`pv_max` n'est **pas stocké** : il se calcule à la lecture, `pv_max = pv_base + somme(pv_bonuses.amount)`. `rowToCharacter` expose `pv: { max, current, base, bonuses }`, `armor: {...}`, `characteristics: {...}`.

Fonctions à dupliquer sur le modèle de `updateSkillScore` : `updatePvBase`, `updatePvCurrent`, `addPvBonus` / `removePvBonus`, `updateArmor` — éditables manuellement par le MJ à tout moment, sans re-upload de la fiche (même principe que l'édition des scores de compétences en V1).

### Table `npcs` (nouvelle, server/db.js)

Liste séparée des personnages joueurs (décidé §11) : les PNJ ne rejoignent pas de table, pas de suivi de connexion. Détail complet du schéma et du parsing au §10 (introduit avec l'évolution "dégâts liés aux armes").

### `buildSnapshot` (server/state.js)

Chaque personnage du snapshot embarque déjà tout via `rowToCharacter` — rien à ajouter côté structure, juste vérifier que `pv`/`armor`/`characteristics` traversent bien jusqu'au front (ils le feront automatiquement, `characters` est déjà spreadé tel quel).

### Nouveau statut dérivé (src/gameLogic.js)

```js
export function pvStatus({ current, max }) {
  const ratio = max > 0 ? current / max : 0
  if (current <= 0) return { key: 'horsCombat', label: 'HORS DE COMBAT' }
  if (ratio <= 0.25) return { key: 'critique', label: 'CRITIQUE' }
  if (ratio <= 0.5) return { key: 'blesse', label: 'BLESSÉ' }
  return { key: 'sain', label: 'SAIN' }
}
```

Seuils à ajuster librement à l'usage table ; ils ne changent que l'affichage, pas la mécanique.

## 4. Calcul des dégâts

```js
export const HIT_LOCATIONS = [
  { key: 'tete', label: 'Tête', range: [1, 10] },
  { key: 'brasDroit', label: 'Bras droit', range: [11, 20] },
  { key: 'brasGauche', label: 'Bras gauche', range: [21, 30] },
  { key: 'poitrine', label: 'Poitrine', range: [31, 50] },
  { key: 'abdomen', label: 'Abdomen', range: [51, 70] },
  { key: 'jambeDroite', label: 'Jambe droite', range: [71, 85] },
  { key: 'jambeGauche', label: 'Jambe gauche', range: [86, 100] },
]

export function rollHitLocation() {
  const roll = 1 + Math.floor(Math.random() * 100)
  return HIT_LOCATIONS.find((l) => roll >= l.range[0] && roll <= l.range[1])
}

export function applyDamage(character, { rawDamage, locationKey }) {
  const armor = character.armor[locationKey] || 0
  const reduced = Math.max(0, rawDamage - armor)
  const newCurrent = Math.max(0, character.pv.current - reduced)
  return { locationKey, rawDamage, armor, reduced, newCurrent }
}

export function pvMax(character) {
  return character.pv.base + character.pv.bonuses.reduce((sum, b) => sum + b.amount, 0)
}
```

Le "mode rapide" (ajustement direct, §5) contourne `applyDamage` et modifie `pv.current` directement — c'est voulu, pour les cas où le MJ a déjà fait le calcul de tête ou sur une table papier.

Soins/régénération : une simple remontée de `pv.current` (borné à `pv.max`, cf. §11 — jamais de dépassement), même route que l'ajustement direct.

Repli "non formé" pour un raccourci de compétence (Esquive, cf. §5) quand la compétence n'est pas dans la grille du personnage — la fiche de Djoko confirme que le jeu utilise déjà "caractéristique ÷ 2" pour toute compétence non formée présente dans la grille (ex. Contorsionniste 27,5 = Agilité 55 ÷ 2) ; on applique la même règle quand la compétence est carrément absente de la grille :

```js
export function effectiveSkillScore(character, skillName, linkedCharacteristic) {
  const skill = character.skills.find((s) => s.name === skillName)
  if (skill) return skill.score
  const carac = character.characteristics[linkedCharacteristic]
  return carac ? Math.round(carac / 2) : 0
}
```

## 5. Vue MJ — ce qui change

- **Ordre de bataille** (roster) : chaque ligne personnage affiche en plus une barre de PV (current/max) colorée selon `pvStatus`, et un tag "HORS DE COMBAT" si `current <= 0`.
- Nouveau bouton par personnage (ou sélection multiple comme pour "Ordonner un test") : **"Dégâts"**, ouvrant une modale à deux modes (onglets ou toggle, sur le modèle de `LaunchModal`) :
  - **Mode rapide** : champ "Nouveaux PV" ou "− X PV", validation immédiate. Pas de calcul d'armure — le MJ assume la responsabilité du calcul.
  - **Mode détaillé** : champ "Dégâts bruts", sélection de la localisation (7 boutons) ou bouton "🎲 Tirer au hasard" (`rollHitLocation`), aperçu "Armure : -20 / Dégâts finaux : X" avant validation, puis application (`applyDamage`).
- Écran "Personnages" (gestion, à côté de l'upload xlsx) : champs éditables PV de base, PV actuel, armure par localisation (7 champs) — mêmes patterns d'édition inline que les scores de compétences existants — plus une petite liste "Talents PV" (ajout/suppression d'un `{ label, amount }`) qui fait varier le PV max affiché en direct sans toucher au PV de base. Le bouton "+ Constitution solide" pré-remplit `label: 'Constitution solide'` et `amount: 10` (un achat = +10 PV max, valeur modifiable si besoin avant validation) ; le MJ peut aussi ajouter une ligne libre pour un autre talent, sans valeur pré-remplie.
- Un bouton **"🎯 Attaque ennemie"** par personnage (uniquement les personnages connectés sont sélectionnables comme cible) déclenche la séquence décrite au §10 : le MJ choisit le PNJ attaquant, l'arme utilisée et le mode de tir (si l'arme en propose plusieurs), puis l'outil résout le jet d'attaque, la demande d'esquive envoyée au joueur visé, et les dégâts automatiques en cas d'échec de l'esquive. Remplace l'ancien raccourci "Esquive/Parade" simple.
  - **Parade** : dans cette version maison des règles, Parade n'apparaît pas comme une compétence indépendante de la grille COMPETENCES — elle est liée aux compétences d'armes de la fiche (ex. trait "Equilibrée : Parade +10"). Seule l'Esquive est gérée par cette séquence pour l'instant — noté en point ouvert (§11).
- Nouvel écran (ou section de l'écran "Personnages") **"PNJ / Ennemis"** : upload d'une fiche PNJ (même mécanisme que l'upload de fiche joueur), liste des PNJ déjà uploadés avec leurs armes visibles (nom, mode, dégâts), suppression possible.

## 6. Vue Joueur — ce qui change

- Sous le nom du personnage : une barre de PV (current/max) avec le statut en texte (`pvStatus`), dans le même esprit que le radar de tendances actuel — pas de chiffres bruts d'armure mis en avant, l'armure reste une info secondaire consultable (ex. un petit repli "Armure" listant les 7 zones), pas l'élément central de l'écran.
- Quand le MJ applique des dégâts pendant que le joueur est sur l'app : un bandeau/notification ponctuel "Vous encaissez X dégâts (Y absorbés)" qui s'efface après lecture — cohérent avec le ton "on reste dans l'action" du reste de l'outil.
- Si `pv.current <= 0` : bandeau "HORS DE COMBAT" visible en permanence tant que le MJ ne remonte pas les PV.

## 7. Hors périmètre V2 (reporté à une V3 éventuelle)

- Table de blessures critiques par localisation (effets narratifs type saignement, étourdissement, membre inutilisable...).
- Mort automatique calculée par l'outil (seuil de dégâts massifs) : en V2, "Hors de combat" reste un simple indicateur, la mort du personnage reste une décision du MJ.
- Réduction de dégâts proportionnelle au degré de réussite d'une Esquive/Parade (V2 : succès ou échec suffit, pas de calcul de degré appliqué aux PV).
- Historique horodaté des dégâts subis par personnage.
- Poisons, maladies, dégâts par tour (saignement) nécessitant un suivi dans le temps.

## 8. Extension du parseur xlsx (server/xlsxParser.js)

Dans le même esprit que le parseur de compétences actuel (recherche de libellés, pas d'adresses de cellule figées) :

- **PV** : chercher la cellule dont le texte normalisé vaut "points de vie" (insensible à la casse) ; sur les 2-3 lignes suivantes de la même zone, prendre les deux premiers nombres rencontrés de gauche à droite → `pv_base` (1er), `pv_current` (2e, à défaut égal à `pv_base`). `pv_bonuses` démarre à `[]` à l'import : les talents PV se déclarent ensuite dans l'outil (§5), pas dans le fichier.
- **Armure** : chercher la cellule "Armures" (proche de "Localisations") ; scanner les lignes suivantes, associer chaque nom de localisation reconnu (comparaison insensible à la casse/accents contre les 7 clés de `HIT_LOCATIONS`) au nombre trouvé sur la même ligne, à défaut 0.
- **Caractéristiques brutes** : pour chacune des 7 caractéristiques (Force, Perception, Dextérité, Agilité, Intelligence, Volonté, Charisme), chercher la cellule portant son nom puis le nombre trouvé sur la ligne suivante dans la même zone (même logique de recherche par libellé que pour les PV) → `characteristics.{For,Per,Dex,Agi,Int,Vol,Cha}`. Sert uniquement au calcul de repli non formé (§4/§5), jamais affiché tel quel côté joueur.
- Si "Points de vie", "Armures" ou une caractéristique sont introuvables : ne pas bloquer l'import (contrairement à "COMPETENCES" qui est bloquant) — appliquer les valeurs par défaut (`pv_base: 10`, armure à 0 partout, caractéristique manquante à 0) et laisser le MJ corriger à la main depuis l'écran de gestion des personnages. Cohérent avec le principe déjà énoncé au §12 du cahier des charges V1 ("correction manuelle dans l'outil" en cas de fichier non conforme).

## 9. Routes API à ajouter (server/routes.js)

- `PATCH /characters/:id/pv` — body `{ current }` : ajustement direct (mode rapide + soins), borné à `pv_max` (jamais de dépassement, cf. §11).
- `POST /npcs`, `DELETE /npcs/:id`, `POST /table/attack` et `POST /table/attack/dodge` — cf. détail §10 (fiches PNJ et armes).
- `POST /characters/:id/damage` — body `{ rawDamage, locationKey }` : applique `applyDamage`, renvoie le détail (armure déduite, dégâts finaux) pour affichage MJ avant/après confirmation.
- `PATCH /characters/:id/armor` — body `{ armor: {...} }` : édition manuelle par zone.
- `PATCH /characters/:id/pv-base` — body `{ value }` : correction du total de PV de base (rare, en cas d'erreur d'import).
- `POST /characters/:id/pv-bonuses` — body `{ label, amount }` : ajoute un talent impactant les PV max (ex. Constitution solide) ; `pv_max` se recalcule automatiquement.
- `DELETE /characters/:id/pv-bonuses/:index` — retire un bonus (erreur de saisie, talent perdu...).

Toutes suivent le pattern déjà en place (`respondWithSnapshot`), pour que la mise à jour arrive en direct chez le MJ et le joueur concerné via le même canal socket.

## 10. Séquence d'attaque à distance avec esquive et armes (mise à jour du 11 juillet, v2)

Cadrage initial du 11 juillet (esquive) puis évolution le même jour pour lier les dégâts au profil de l'arme utilisée par le PNJ, plutôt qu'à la valeur brute du jet d'attaque. Trois temps, chacun avec son propre jet sauf le dernier :

1. **Jet d'attaque (MJ)** : le MJ choisit le joueur visé (connecté uniquement), le PNJ attaquant (parmi les fiches PNJ uploadées, cf. plus bas), l'arme utilisée (parmi celles de la fiche du PNJ) et, si l'arme le permet, le mode de tir (coup par coup / semi-auto / auto). L'outil tire 1d100 (`attackRoll`) et le compare à la **Dextérité** du PNJ (`npc.characteristics.Dex`), avec un degré de réussite calculé comme pour un jet classique (même formule que `resolveRoll` dans `server/game.js`, déjà utilisée pour tous les jets de compétence V1 : `degrees = 1 + floor((target - roll) / 10)`, minimum 1 en cas de succès).
   - Si `attackRoll > npc.characteristics.Dex` → **échec de l'attaque**. Message **"Attaque ratée"** affiché au joueur et au MJ (identique des deux côtés). Fin de la séquence.
2. **Jet d'esquive (joueur)**, uniquement si l'attaque a touché : inchangé par rapport au cadrage initial. Le joueur visé reçoit une demande d'esquive (bouton "LANCER" côté joueur). Score d'esquive effectif : `effectiveEsquive = effectiveSkillScore(character, 'Esquive', 'Agi') + character.dodgeBonus` (§3). Le joueur lance son propre d100 (`dodgeRoll`), indépendant de `attackRoll`.
   - Si `dodgeRoll <= effectiveEsquive` → **esquive réussie**, aucun dégât. Message **"Esquivé"** affiché au joueur et au MJ (identique des deux côtés).
3. **Dégâts**, uniquement si l'esquive a échoué — **entièrement reconçu** par rapport au cadrage initial : `attackRoll` de l'étape 1 ne sert plus qu'à déterminer la **localisation** (inversion des chiffres, ex. 45 → 54, cf. ci-dessous), plus le nombre brut de dégâts. Les dégâts viennent maintenant de l'**arme** choisie à l'étape 1 :
   - Nombre de balles qui touchent : 1 en coup par coup ; en semi ou auto, `bullets = min(degrees de l'étape 1, capacité de rafale de l'arme pour ce mode)` — la capacité vient de la colonne "Mode" de la fiche PNJ (cf. plus bas), pas d'un plafond fixe.
   - Localisation unique pour toute la rafale : `hitLocationFromRoll(attackRoll)` (inchangé, §10 v1).
   - Dégâts par balle : `max(0, weapon.damage - armor[locationKey])` — l'armure est déduite **par balle**, pas une seule fois sur le total.
   - Dégâts totaux : `bullets × dégâts par balle`.
   - Affichage du nombre de balles, de la localisation et des dégâts totaux au joueur et au MJ, mise à jour immédiate de la barre de PV.

### Inversion des chiffres d'un d100

Règle classique Dark Heresy/Rogue Trader/Only War : le d100 est lu comme deux chiffres (dizaines/unités), inversés pour donner un second nombre exploitable sans jet supplémentaire. Cas particulier : 100 s'écrit "00", qui reste "00" (donc 100) une fois inversé.

```js
export function reverseD100(roll) {
  const twoDigits = roll === 100 ? '00' : String(roll).padStart(2, '0')
  const reversed = Number(twoDigits.split('').reverse().join(''))
  return reversed === 0 ? 100 : reversed
}

export function hitLocationFromRoll(roll) {
  const locationRoll = reverseD100(roll)
  return HIT_LOCATIONS.find((l) => locationRoll >= l.range[0] && locationRoll <= l.range[1])
}
```

### Fiches PNJ et armes

Le MJ uploade une fiche par PNJ/ennemi type, dans l'esprit des fiches joueur (`PJ_Djoko_mk4.xlsx`) mais stockée à part (cf. §3) : pas de rejoint de table, pas de suivi de connexion, pas forcément de grille de compétences complète. Ce qui est exploité pour cette séquence :

- Les 7 caractéristiques brutes (au minimum Dextérité), avec la même logique de recherche par libellé qu'au §8.
- La table "Compétences d'Armes" de la fiche (jusque-là hors périmètre, cf. cahier des charges V1 §7) : pour chaque arme, le nom (colonne "Type d'arme"), le mode de tir (colonne "Mode", ex. `C/2/-`) et les dégâts (colonne "Dégats").

Format de la colonne "Mode" (ex. `C/2/-`, `C/-/-`) : trois segments séparés par `/`, dans l'ordre coup par coup / semi-auto / auto. "C" = disponible (coup par coup, toujours 1 balle), un nombre = disponible avec cette capacité de rafale, "-" = mode non disponible sur cette arme.

```js
export function parseWeaponMode(modeStr) {
  const [single, semi, auto] = modeStr.split('/').map((s) => s.trim())
  return {
    single: single === 'C',
    semiCapacity: semi === '-' || !semi ? null : Number(semi),
    autoCapacity: auto === '-' || !auto ? null : Number(auto),
  }
}

export function bulletsHit(fireMode, degrees, weapon) {
  if (fireMode === 'single') return 1
  const capacity = fireMode === 'semi' ? weapon.mode.semiCapacity : weapon.mode.autoCapacity
  return Math.min(degrees, capacity || 1)
}

export function resolveWeaponDamage(character, { attackRoll, degrees, weapon, fireMode }) {
  const locationKey = hitLocationFromRoll(attackRoll).key
  const bullets = bulletsHit(fireMode, degrees, weapon)
  const armor = character.armor[locationKey] || 0
  const perBullet = Math.max(0, weapon.damage - armor)
  const totalDamage = perBullet * bullets
  const newCurrent = Math.max(0, character.pv.current - totalDamage)
  return { locationKey, bullets, perBullet, totalDamage, newCurrent }
}
```

### Modèle de données et routes

- Nouvelle table `npcs` (séparée de `characters`, cf. §3) : `id`, `name`, `characteristics` (JSON, 7 caractéristiques brutes), `weapons` (JSON, liste de `{ name, modeRaw, mode: { single, semiCapacity, autoCapacity }, damage }`).
- `table_state.attack` — JSON `{ id, npcId, weaponName, fireMode, targetCharacterId, attackRoll, degrees, outcome, dodgeRoll, bullets, damage }`, `outcome` parmi `'pending-dodge' | 'miss' | 'dodged' | 'hit'`.
- `POST /npcs` — upload multipart d'une fiche PNJ (même route/mécanisme que `POST /characters`, parseur dédié `parseNpcSheet`). `DELETE /npcs/:id`.
- `POST /table/attack` — body `{ npcId, weaponName, fireMode, targetCharacterId }` (remplace l'ancien `enemyScore` du cadrage initial). Tire `attackRoll`, calcule `degrees`, renvoie `outcome: 'miss'` immédiatement si raté, sinon `outcome: 'pending-dodge'`.
- `POST /table/attack/dodge` — inchangé dans son principe : tire `dodgeRoll`, calcule `effectiveEsquive`, résout en `'dodged'` ou `'hit'`. Si `'hit'` : appelle `resolveWeaponDamage`, applique `pv.current`, inclut le détail (balles, localisation, dégâts) dans la réponse.
- Diffusion en direct comme le reste (`respondWithSnapshot` / socket `state:update`) à chaque étape.

## 11. Points à valider avec Anne avant de coder

- Décidé : seuils d'affichage `pvStatus` laissés à mon appréciation (25 % critique / 50 % blessé) — facilement ajustables si l'usage à table montre autre chose.
- Décidé : Esquive absente de la grille → jet de repli quand même, sur caractéristique liée ÷ 2 (`effectiveSkillScore`, §4).
- Décidé : pas de dépassement de `pv.max`, un soin excédentaire ne se garde pas en réserve.
- Décidé : Constitution solide = +10 PV max par achat, pré-rempli dans le formulaire `pv-bonuses` (§5), modifiable pour d'autres talents.
- Décidé : Parade reportée à plus tard, en même temps que l'import des compétences d'armes (regroupées avec les blessures dans le §7 du cahier des charges V1). La séquence d'attaque du §10 ne gère donc que l'Esquive pour l'instant ; Parade sera ajoutée quand ce chantier sera lancé.
- Décidé : messages distincts et identiques des deux côtés — "Attaque ratée" pour un tir manqué (étape 1), "Esquivé" pour une esquive réussie (étape 2). Pas de formulation différente entre joueur et MJ.
- Décidé : un joueur non connecté ne peut pas être ciblé par une "Attaque ennemie" — pas de mode de secours où le MJ lance l'esquive à sa place. La sélection de cible se limite aux personnages connectés (§10).
- Décidé (évolution armes) : à balles multiples (semi/auto), l'armure est déduite **par balle**, pas une seule fois sur le total (§10).
- Décidé (évolution armes) : le nombre de balles qui touchent est plafonné par la **capacité réelle de l'arme** (colonne "Mode" de la fiche PNJ), pas par un plafond fixe universel (§10).
- Décidé (évolution armes) : le MJ choisit désormais le PNJ et l'arme précise (et le mode de tir) dans la fiche PNJ uploadée, au lieu de saisir un score ennemi libre (§10).
- Décidé (évolution armes) : les PNJ sont stockés dans une liste séparée des personnages joueurs, sans suivi de connexion (§3, §10).
- Décidé : les PNJ n'encaissent pas de dégâts dans l'outil pour l'instant (juste des attaquants) ; comment les PJ infligent des dégâts aux PNJ est reporté à une évolution future non cadrée à ce stade. Autant prévoir dès maintenant PV et armure dans le modèle de fiche PNJ (mêmes champs que les personnages joueurs) pour ne pas avoir à reprendre l'import plus tard.
- Décidé : pas besoin de mémoriser le dernier mode de tir choisi par arme, le MJ le resélectionne à chaque attaque.
