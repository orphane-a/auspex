import { useEffect, useState } from 'react'
import { api } from './api'
import { getScenario } from './scenarios/index.js'
import { appliquerAmbiance } from './ambianceDom.js'

// Demande une seule fois au serveur s'il tourne en mode démo (ticket 97). Les
// données du scénario sont ensuite lues dans src/scenarios/, partagé avec le seed.
// En cas d'échec, on reste sur la vue habituelle : sans démo, rien ne change.
export function useScenario() {
  const [state, setState] = useState({ loading: true, scenario: null })
  useEffect(() => {
    let cancelled = false
    api
      .getScenario()
      .then((data) => {
        if (cancelled) return
        const scenario = getScenario(data.scenario)
        // Démo (ticket 101) : l'ambiance du scénario est posée (et mémorisée) avant le
        // premier rendu, pour éviter l'éclair Cyber dans un navigateur neuf.
        if (scenario && data.ambiance) appliquerAmbiance(data.ambiance, { memoriser: true })
        setState({ loading: false, scenario })
      })
      .catch(() => !cancelled && setState({ loading: false, scenario: null }))
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
