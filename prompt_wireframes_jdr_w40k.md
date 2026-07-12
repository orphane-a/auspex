# Prompt à copier-coller pour générer les wireframes 🎲

Génère des wireframes basse fidélité (noir et blanc ou niveaux de gris, focus sur la structure et pas sur le détail graphique final) pour un outil web compagnon de jeu de rôle Warhammer 40k. L'outil gère les jets de dés automatiquement à partir de la grille de compétences de chaque personnage, pour éviter aux joueurs de consulter leur feuille de personnage papier en pleine partie.

Il y a deux profils d'utilisateurs, donc deux séries d'écrans à produire séparément : la vue MJ (utilisée sur ordinateur ou tablette) et la vue Joueur (utilisée sur smartphone).

## Vue MJ (desktop/tablette)

1. **Accueil MJ** : bouton pour créer une nouvelle table, zone d'upload des fiches de personnage (un fichier par joueur), liste des fiches déjà uploadées avec leur statut (importée avec succès / erreur de format).
2. **Tableau de bord de la table** : code d'accès de la table affiché en évidence (à partager aux joueurs), liste des personnages de la table avec leur statut de connexion (connecté / pas encore rejoint), bouton pour lancer une action de groupe.
3. **Lancement d'une action** : sélection de la compétence ou de l'action à tester, sélection des joueurs concernés (tous ou certains), champ optionnel pour un modificateur de difficulté, bouton pour envoyer la demande de jet à l'équipe.
4. **Résultats en direct** : liste des jets reçus au fur et à mesure, un par joueur, avec le nom du joueur, la compétence testée, réussite ou échec (et le degré de réussite), mise à jour en temps réel sans rafraîchissement.

## Vue Joueur (mobile, écran étroit)

1. **Rejoindre une table** : champ pour saisir le code de table donné par le MJ, puis liste des personnages disponibles pour choisir le sien (pas de compte, pas de mot de passe).
2. **Écran principal** : liste des compétences du personnage sous forme d'actions cliquables (pas de scores bruts mis en avant), barre de recherche pour retrouver une compétence rapidement.
3. **Demande de jet en cours** : notification claire de l'action demandée par le MJ (ou l'action choisie par le joueur), gros bouton unique pour lancer le dé.
4. **Résultat du jet** : résultat individuel bien visible (réussite/échec et degré), puis en dessous les résultats des autres joueurs de l'équipe pour la même action.

## Style visuel

Ambiance Warhammer 40k sobre et lisible : fond sombre, touches gothiques discrètes (bordures, séparateurs, iconographie type aquila ou crâne en filigrane), typographie à empattements pour les titres. Rester lisible et fonctionnel avant tout : c'est un outil utilisé pendant une partie, pas une affiche.

## Format de sortie attendu

Un cadre par écran, huit écrans au total (quatre MJ, quatre Joueur), avec les zones principales annotées (titre, boutons, listes, zones de statut). Précise les interactions clés sur chaque écran (ce qui se passe au clic/tap).
