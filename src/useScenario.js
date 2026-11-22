import { useEffect, useState } from 'react'
import { api } from './api'
import { getScenario } from './scenarios/index.js'

// Demande une seule fois au serveur s'il tourne en mode démo (ticket 97). Les
// données du scénario sont ensuite lues dans src/scenarios/, partagé avec le seed.
// En cas d'échec, on reste sur la vue habituelle : sans démo, rien ne change.
export function useScenario() {
  const [state, setState] = useState({ loading: true, scenario: null })
  useEffect(() => {
    let cancelled = false
    api
      .getScenario()
      .then((data) => !cancelled && setState({ loading: false, scenario: getScenario(data.scenario) }))
      .catch(() => !cancelled && setState({ loading: false, scenario: null }))
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
