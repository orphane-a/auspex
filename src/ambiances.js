// Ambiances de table (ticket 100) : seule liste qui fait foi, lue par le serveur
// (contrôle de POST /api/table/reset) et par l'interface (choix sur l'Accueil MJ).
// Ajouter une ambiance = une ligne ici + un bloc :root[data-ambiance="…"] dans
// styles.css. Les couleurs d'aperçu sont celles du bloc CSS : les pastilles
// montrent toujours l'ambiance concernée, quelle que soit l'ambiance active.
// Aucun nom de jeu du commerce : les noms restent génériques.
export const AMBIANCES = [
  { id: 'cyber', nom: 'Cyber', description: 'Noir et vert néon', embleme: '▸', apercu: { fond: '#07120c', surface: '#0e1f16', accent: '#5ef29c' } },
  { id: 'medieval', nom: 'Médiéval', description: 'Châteaux, dragons, encre et or', embleme: '⚜︎', apercu: { fond: '#e6d2a3', surface: '#fdf8ea', accent: '#7a4d08' } },
  { id: 'espace', nom: 'Espace', description: 'Bleu nuit et cyan', embleme: '✦', apercu: { fond: '#050a1a', surface: '#0c1530', accent: '#4fd8ff' } },
  { id: 'horreur', nom: 'Horreur années 20', description: 'Sépia et vert sombre', embleme: '◉', apercu: { fond: '#e6dbc0', surface: '#f2e9d3', accent: '#2c5638' } },
  { id: 'gothique', nom: 'Gothique', description: 'Noir, rouge sang et violet', embleme: '✠', apercu: { fond: '#0d0a10', surface: '#18121e', accent: '#f0607a' } },
]

export const AMBIANCE_PAR_DEFAUT = 'cyber'

export const AMBIANCE_IDS = AMBIANCES.map((a) => a.id)

export function isAmbiance(id) {
  return typeof id === 'string' && AMBIANCE_IDS.includes(id)
}

export function nomAmbiance(id) {
  return AMBIANCES.find((a) => a.id === id)?.nom ?? AMBIANCES[0].nom
}
