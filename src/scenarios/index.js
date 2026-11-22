// Registre des scénarios guidés disponibles, indexés par la valeur attendue dans la
// variable d'environnement SCENARIO.
import { dragonScenario } from './dragon.js'

export const SCENARIOS = { [dragonScenario.id]: dragonScenario }

export function getScenario(id) {
  return (id && SCENARIOS[id]) || null
}

// Règle de réussite d'une étape (PRD, question ouverte 6) : au moins un succès suffit.
// `null` tant qu'aucun jet n'est arrivé.
export function stepOutcome(rolls) {
  if (!rolls.length) return null
  return rolls.some((r) => r.status === 'success') ? 'success' : 'failure'
}
