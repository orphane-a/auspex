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

const MELEE = { single: false, semiCapacity: null, autoCapacity: null, melee: true }
const SINGLE_SHOT = { single: true, semiCapacity: null, autoCapacity: null }

export const dragonScenario = {
  id: 'dragon',
  title: 'Le dragon de Pierrenoire',
  characters: [
    {
      name: 'Aldric',
      cls: 'Chevalier',
      played: true,
      color: '#2f5fb8',
      avatar: avatarDataUri({ color: '#2f5fb8', initial: 'A' }),
      pvBase: 40,
      armor: armor(4, { tete: 3 }),
      characteristics: { For: 45, Agi: 35, Int: 25, Per: 35, Vol: 40, Cha: 35, Dex: 45 },
      skills: skills({ Perception: 35, Discrétion: 25, Athlétisme: 55, Fouille: 30, 'Connaissance des arcanes': 20, Esquive: 40 }),
      weapons: [{ name: 'Épée longue', modeRaw: null, mode: MELEE, damage: 12 }],
    },
    {
      name: 'Ysolde',
      cls: 'Rôdeuse',
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
  npc: {
    name: 'Le dragon rouge',
    color: '#9c2f22',
    avatar: avatarDataUri({ color: '#9c2f22', pictogram: 'dragon' }),
    pvBase: 60,
    armor: armor(3),
    dodgeBonus: 10,
    characteristics: { For: 60, Agi: 30, Int: 40, Per: 45, Vol: 50, Cha: 40, Dex: 40 },
    weapons: [
      { name: 'Griffes', modeRaw: null, mode: MELEE, damage: 10 },
      { name: 'Souffle de feu', modeRaw: 'C/-/-', mode: SINGLE_SHOT, damage: 14 },
    ],
  },
  steps: [
    {
      title: 'La porte dérobée',
      read: "La nuit tombe sur le château de Pierrenoire. Les grandes portes sont closes. On raconte qu'une vieille porte de service se cache quelque part dans la muraille, sous le lierre.",
      test: { skill: 'Perception', malus: null },
      success: "Sous le lierre, une poignée de fer rouillée. La porte grince mais s'ouvre. L'équipe se glisse dans le château.",
      failure: "Personne ne trouve la porte. L'équipe finit par escalader la muraille, les mains écorchées, et retombe de l'autre côté.",
    },
    {
      title: 'La cour aux sentinelles',
      read: 'Derrière la muraille, une cour pavée. Deux gardes de pierre semblent dormir debout, mais leurs yeux brillent dans le noir. Il faut traverser sans bruit.',
      test: { skill: 'Discrétion', malus: '+10' },
      success: "Ysolde guide les autres d'ombre en ombre. Les gardes de pierre ne bougent pas. L'équipe atteint la porte de la bibliothèque.",
      failure: "Un caillou roule sous une botte. Les gardes tournent la tête, lentement. L'équipe court se cacher dans la bibliothèque, essoufflée mais entière.",
    },
    {
      title: 'La bibliothèque',
      read: "Des rayons couverts de poussière montent jusqu'au plafond. Quelque part ici dort un plan du château, roulé dans un étui de cuir.",
      test: { skill: 'Fouille', malus: null },
      success: "Brannoc déroule le plan sur une table. Une croix rouge marque la plus haute tour : la salle du trône. Le chemin passe par un vieil escalier.",
      failure: "Pas de plan, mais une odeur de fumée descend d'un escalier au fond de la salle. L'équipe décide de la suivre.",
    },
    {
      title: "L'escalier effondré",
      read: "L'escalier de la tour s'est écroulé à mi hauteur. Il manque une dizaine de marches au dessus du vide. Plus haut, une lueur rouge danse sur les murs.",
      test: { skill: 'Athlétisme', malus: null },
      success: 'Aldric saute le premier et tend la main aux autres. La porte de la tour est juste au dessus.',
      failure: "Une marche cède, quelqu'un se rattrape de justesse. Après un long détour par les remparts, l'équipe arrive enfin devant la porte de la tour.",
    },
    {
      title: 'La salle du trône',
      read: "Au sommet de la tour, un trône brisé. Sur un lit de pièces d'or, le dragon rouge ouvre un œil. La chaleur monte. Aldric lève son épée.",
      attack: { attacker: 'Aldric', weapon: 'Épée longue', fireMode: 'melee' },
    },
  ],
  endings: {
    victory: {
      title: 'Le dragon est vaincu',
      text: 'Le château retrouve le silence. Aldric, Ysolde et Brannoc repartent avec une écaille rouge en souvenir.',
    },
    escape: {
      title: "Le dragon s'envole, l'équipe survit",
      text: 'Blessé, le dragon brise un vitrail et disparaît dans la nuit. Il reviendra peut être.',
    },
  },
}

