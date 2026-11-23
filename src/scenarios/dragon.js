// Scénario guidé « Le dragon de Pierrenoire » (ticket 97) : données pures, sans
// interface ni accès disque. Le serveur s'en sert pour le seed de la table de démo,
// la vue MJ pour le panneau guidé. Modifier un nom, un score ou un texte ici suffit.
import { avatarDataUri } from './avatar.js'

const NO_ARMOR = { tete: 0, brasDroit: 0, brasGauche: 0, poitrine: 0, abdomen: 0, jambeDroite: 0, jambeGauche: 0 }

function armor(value, overrides = {}) {
  return { ...Object.fromEntries(Object.keys(NO_ARMOR).map((k) => [k, value])), ...overrides }
}

function skills(scores) {
  const linked = {
    Perception: 'Per',
    Discrétion: 'Agi',
    Athlétisme: 'For',
    Fouille: 'Per',
    'Connaissance des arcanes': 'Int',
    Esquive: 'Agi',
  }
  return Object.entries(scores).map(([name, score]) => ({ name, characteristic: linked[name], score }))
}

// Illustrations de la démo : des planches de BD découpées, rangées dans public/demo/.
// Chaque image porte un texte alternatif, lu par les lecteurs d'écran.
function img(file, alt) {
  return { src: `/demo/${file}.webp`, alt }
}

const MELEE = { single: false, semiCapacity: null, autoCapacity: null, melee: true }
const SINGLE_SHOT = { single: true, semiCapacity: null, autoCapacity: null }

export const dragonScenario = {
  id: 'dragon',
  title: 'Le dragon de Pierrenoire',
  cover: img('chateau', 'Le château de Pierrenoire de nuit sous la pleine lune, une lueur rouge à sa plus haute tour.'),
  team: img('equipe', 'Aldric, Ysolde et Brannoc côte à côte dans un couloir de pierre éclairé à la torche.'),
  characters: [
    {
      name: 'Aldric',
      cls: 'Chevalier',
      role: 'héros de la démo',
      played: true,
      color: '#2f5fb8',
      avatar: avatarDataUri({ color: '#2f5fb8', initial: 'A' }),
      pvBase: 40,
      armor: armor(4, { tete: 3 }),
      characteristics: { For: 45, Agi: 35, Int: 25, Per: 35, Vol: 40, Cha: 35, Dex: 70 },
      skills: skills({ Perception: 35, Discrétion: 25, Athlétisme: 55, Fouille: 30, 'Connaissance des arcanes': 20, Esquive: 40 }),
      weapons: [{ name: 'Épée longue', modeRaw: null, mode: MELEE, damage: 12 }],
    },
    {
      name: 'Ysolde',
      cls: 'Rôdeuse',
      role: 'jouée par le MJ',
      played: false,
      color: '#2c6b44',
      avatar: avatarDataUri({ color: '#2c6b44', initial: 'Y' }),
      pvBase: 32,
      armor: armor(2),
      characteristics: { For: 30, Agi: 50, Int: 30, Per: 50, Vol: 30, Cha: 30, Dex: 50 },
      skills: skills({ Perception: 55, Discrétion: 60, Athlétisme: 40, Fouille: 35, 'Connaissance des arcanes': 25, Esquive: 50 }),
      weapons: [
        { name: 'Arc long', modeRaw: 'C/-/-', mode: SINGLE_SHOT, damage: 9 },
        { name: 'Dague', modeRaw: null, mode: MELEE, damage: 6 },
      ],
    },
    {
      name: 'Brannoc',
      cls: 'Mage',
      role: 'joué par le MJ',
      played: false,
      color: '#6a43a8',
      avatar: avatarDataUri({ color: '#6a43a8', initial: 'B' }),
      pvBase: 26,
      armor: armor(1),
      characteristics: { For: 20, Agi: 30, Int: 55, Per: 40, Vol: 50, Cha: 35, Dex: 35 },
      skills: skills({ Perception: 40, Discrétion: 30, Athlétisme: 20, Fouille: 50, 'Connaissance des arcanes': 65, Esquive: 30 }),
      weapons: [{ name: 'Bâton ferré', modeRaw: null, mode: MELEE, damage: 7 }],
    },
  ],
  // Combat réglé pour une démo courte (retour du 22/11 : trop d'échecs). Aldric touche
  // 7 fois sur 10 (Dex 70), le dragon esquive peu (Agi 20 ÷ 2, sans bonus) et tombe en
  // deux coups d'épée (20 PV, armure 2). Il frappe juste lui aussi (Dex 65), sans
  // pouvoir abattre Aldric en trois tours (griffes 10 moins armure 4).
  npc: {
    name: 'Le dragon rouge',
    color: '#9c2f22',
    avatar: avatarDataUri({ color: '#9c2f22', pictogram: 'dragon' }),
    pvBase: 20,
    armor: armor(2),
    dodgeBonus: 0,
    characteristics: { For: 60, Agi: 20, Int: 40, Per: 45, Vol: 50, Cha: 40, Dex: 65 },
    weapons: [
      { name: 'Griffes', modeRaw: null, mode: MELEE, damage: 10 },
      { name: 'Souffle de feu', modeRaw: 'C/-/-', mode: SINGLE_SHOT, damage: 14 },
    ],
  },
  steps: [
    {
      title: 'La porte dérobée',
      read: "La nuit tombe sur le château de Pierrenoire. Les grandes portes sont closes. On raconte qu'une vieille porte de service se cache quelque part dans la muraille, sous le lierre.",
      image: img('porte', 'Ysolde pose la main sur une poignée de fer rouillée cachée sous le lierre de la muraille.'),
      test: { skill: 'Perception', malus: null },
      success: "Sous le lierre, une poignée de fer rouillée. La porte grince mais s'ouvre. L'équipe se glisse dans le château.",
      failure: "Personne ne trouve la porte. L'équipe finit par escalader la muraille, les mains écorchées, et retombe de l'autre côté.",
    },
    {
      title: 'La cour aux sentinelles',
      read: 'Derrière la muraille, une cour pavée. Deux gardes de pierre semblent dormir debout, mais leurs yeux brillent dans le noir. Il faut traverser sans bruit.',
      image: img('cour', "Deux gardes de pierre aux yeux brillants surveillent la cour, l'équipe avance dans l'ombre du mur."),
      test: { skill: 'Discrétion', malus: '+10' },
      success: "Ysolde guide les autres d'ombre en ombre. Les gardes de pierre ne bougent pas. L'équipe atteint la porte de la bibliothèque.",
      failure: "Un caillou roule sous une botte. Les gardes tournent la tête, lentement. L'équipe court se cacher dans la bibliothèque, essoufflée mais entière.",
    },
    {
      title: 'La bibliothèque',
      read: "Des rayons couverts de poussière montent jusqu'au plafond. Quelque part ici dort un plan du château, roulé dans un étui de cuir.",
      image: img('bibliotheque', 'Brannoc déroule un vieux plan sur une table, dans une bibliothèque éclairée à la bougie.'),
      test: { skill: 'Fouille', malus: null },
      success: "Brannoc déroule le plan sur une table. Une croix rouge marque la plus haute tour : la salle du trône. Le chemin passe par un vieil escalier.",
      failure: "Pas de plan, mais une odeur de fumée descend d'un escalier au fond de la salle. L'équipe décide de la suivre.",
    },
    {
      title: "L'escalier effondré",
      read: "L'escalier de la tour s'est écroulé à mi hauteur. Il manque une dizaine de marches au dessus du vide. Plus haut, une lueur rouge danse sur les murs.",
      image: img('escalier', "Aldric saute au dessus du vide d'un escalier effondré et tend la main à Ysolde et Brannoc."),
      test: { skill: 'Athlétisme', malus: null },
      success: 'Aldric saute le premier et tend la main aux autres. La porte de la tour est juste au dessus.',
      failure: "Une marche cède, quelqu'un se rattrape de justesse. Après un long détour par les remparts, l'équipe arrive enfin devant la porte de la tour.",
    },
    {
      title: 'La salle du trône',
      read: "Au sommet de la tour, un trône brisé. Sur un lit de pièces d'or, le dragon rouge ouvre un œil. La chaleur monte. Aldric lève son épée.",
      image: img('trone', "Dans la salle du trône, le dragon rouge ouvre un œil sur son lit de pièces d'or, face à l'épée d'Aldric."),
      // Un tour : Aldric frappe, puis le dragon riposte. Après `rounds` tours sans
      // victoire, le dragon s'envole (fin « escape ») : la démo ne s'éternise jamais.
      combat: {
        rounds: 3,
        turns: [
          {
            attacker: { type: 'character', name: 'Aldric' },
            defender: { type: 'npc' },
            weapon: 'Épée longue',
            fireMode: 'melee',
            read: 'Aldric charge et abat son épée sur le dragon.',
            image: img('attaque-aldric', 'Aldric abat son épée sur le dragon rouge dans une gerbe d\'étincelles.'),
          },
          {
            attacker: { type: 'npc' },
            defender: { type: 'character', name: 'Aldric' },
            weapon: 'Griffes',
            fireMode: 'melee',
            read: 'Le dragon rugit et lance ses griffes vers Aldric.',
            image: img('griffes-dragon', 'Le dragon rugit et lance ses griffes vers Aldric, qui se protège derrière son bouclier.'),
          },
        ],
      },
    },
  ],
  endings: {
    victory: {
      title: 'Le dragon est vaincu',
      image: img('fin-victoire', 'Le dragon est à terre, Aldric tient une écaille rouge, Ysolde et Brannoc sourient derrière lui.'),
      text: 'Le château retrouve le silence. Aldric, Ysolde et Brannoc repartent avec une écaille rouge en souvenir.',
    },
    escape: {
      title: "Le dragon s'envole, l'équipe survit",
      image: img('fin-fuite', "Le dragon blessé brise un vitrail et s'envole dans la nuit, l'équipe le regarde partir."),
      text: 'Blessé, le dragon brise un vitrail et disparaît dans la nuit. Il reviendra peut être.',
    },
    retreat: {
      title: "L'équipe bat en retraite",
      image: img('fin-retraite', 'Soutenu par Ysolde et Brannoc, Aldric blessé descend l\'escalier en retraite.'),
      text: "Aldric tombe à genoux. Ysolde et Brannoc le soutiennent et dévalent l'escalier. Ils reviendront, mieux préparés.",
    },
  },
}

