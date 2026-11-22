import { AMBIANCE_PAR_DEFAUT, isAmbiance } from './ambiances.js'

// Ticket 100 : l'ambiance est un attribut de <html> (data-ambiance), que styles.css
// traduit en variables. La dernière ambiance de table connue est mémorisée dans le
// navigateur pour être réappliquée au rechargement avant l'arrivée de l'instantané
// (pas d'éclair vert) ; l'instantané fait foi ensuite.
const CLE = 'auspex.ambiance'

export function lireAmbianceMemorisee() {
  try {
    const v = localStorage.getItem(CLE)
    return isAmbiance(v) ? v : AMBIANCE_PAR_DEFAUT
  } catch {
    return AMBIANCE_PAR_DEFAUT
  }
}

export function appliquerAmbiance(id, { memoriser = false } = {}) {
  const ambiance = isAmbiance(id) ? id : AMBIANCE_PAR_DEFAUT
  if (document.documentElement.dataset.ambiance !== ambiance) document.documentElement.dataset.ambiance = ambiance
  if (memoriser) {
    try {
      localStorage.setItem(CLE, ambiance)
    } catch {
      // Stockage indisponible (navigation privée) : seul l'éclair au rechargement revient.
    }
  }
}
