import { useEffect, useState } from 'react'
import { useTableState } from './useTableState'
import GmView from './GmView.jsx'
import PlayerView from './PlayerView.jsx'
import MjHome from './screens/MjHome.jsx'
import JoinTable from './screens/JoinTable.jsx'
import SplitScreen from './SplitScreen.jsx'
import { useScenario } from './useScenario'
import DemoGuide from './demo/DemoGuide.jsx'
import DemoHome from './demo/DemoHome.jsx'
import { api, getSocket } from './api.js'
import { appliquerAmbiance } from './ambianceDom.js'

const ROUTES = { '/mj': 'mj', '/joueur': 'joueur' }
// Dans une iframe de l'écran partagé, le bandeau « ouvrir l'autre vue » est inutile.
const isEmbedded = window.self !== window.top

export default function App() {
  // La racine affiche les deux vues côte à côte ; /mj et /joueur restent des vues seules.
  if (window.location.pathname === '/') return <Root />
  return <TableApp />
}

// En démo, la racine laisse choisir son côté de la table (ticket 97, retour du
// 22/11) : on peut jouer seul côté MJ ou côté joueur, ou à deux côte à côte.
function Root() {
  const { loading, scenario } = useScenario()
  useAmbianceDeLaTable()
  if (loading) return null
  const bothViews = new URLSearchParams(window.location.search).get('vues') === 'deux'
  return scenario && !bothViews ? <DemoHome scenario={scenario} /> : <SplitScreen />
}

// La racine n'a pas l'état complet de la table : elle ne lit que l'ambiance, pour que
// ses en-têtes de panneaux suivent la table comme les deux vues qu'elle encadre.
function useAmbianceDeLaTable() {
  useEffect(() => {
    const socket = getSocket()
    const onUpdate = (data) => appliquerAmbiance(data?.ambiance, { memoriser: true })
    socket.on('state:update', onUpdate)
    api.getTable().then(onUpdate, () => {})
    return () => socket.off('state:update', onUpdate)
  }, [])
}

function TableApp() {
  const routeView = ROUTES[window.location.pathname]
  const [view, setView] = useState(routeView ?? 'mj')
  const [mjSubView, setMjSubView] = useState(null) // null = decide from data; 'home' | 'dashboard' once the MJ picks
  const vals = useTableState()
  const { scenario } = useScenario()
  const activeView = routeView ?? view
  // Connexion joueur (ticket 100) : l'écran reste en Cyber tant que le code tapé ne
  // correspond pas à la table, puis prend l'ambiance de la table.
  const [joinCodeOk, setJoinCodeOk] = useState(false)
  const onJoinScreen = activeView === 'joueur' && !vals.myCharacter && !scenario
  const ambianceAffichee = onJoinScreen && !joinCodeOk ? 'cyber' : vals.ambiance
  useEffect(() => {
    if (vals.loading) return
    appliquerAmbiance(ambianceAffichee, { memoriser: ambianceAffichee === vals.ambiance })
  }, [vals.loading, ambianceAffichee, vals.ambiance])

  // En démo, une table vide reste sur la vue MJ : la popin du guide propose alors
  // de recommencer la démo plutôt que d'importer des fiches.
  const showMjHome = mjSubView === 'home' || (mjSubView === null && vals.characters.length === 0 && !scenario)

  return (
    <div className="app-shell">
      <header className="stage-header">
        <div className="brand">
          <svg className="brand-mark" aria-hidden="true" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'var(--accent)' }}>
            <rect x="10" y="10" width="36" height="36" transform="rotate(45 28 28)" />
            <circle cx="28" cy="28" r="7" />
          </svg>
          <div>
            <h1 className="brand-title" style={{ margin: 0 }}>AUSPEX</h1>
            <div className="brand-subtitle">{activeView === 'mj' ? 'Maître de jeu' : 'Joueur'}</div>
          </div>
        </div>
        <div className="stage-header-chips">
          {scenario && (
            <span className="demo-chip" title="Table de démonstration, distincte de la vraie table">
              Démo
            </span>
          )}
          <span className="online-chip">
            <span className="status-dot" aria-hidden="true" />
            En ligne
          </span>
        </div>
      </header>

      {routeView ? (
        !isEmbedded && <div className="route-banner">
          Fenêtre dédiée · <strong>{routeView === 'mj' ? 'Vue MJ' : 'Vue Joueur'}</strong> — ouvrir{' '}
          <a href={routeView === 'mj' ? '/joueur' : '/mj'} target="_blank" rel="noreferrer">
            la {routeView === 'mj' ? 'vue Joueur' : 'vue MJ'} dans une autre fenêtre
          </a>{' '}
          pour tester les deux côte à côte.
        </div>
      ) : (
        <div className="view-tabs">
          <button className={`view-tab ${view === 'mj' ? 'active' : ''}`} onClick={() => setView('mj')}>
            Vue MJ
          </button>
          <button className={`view-tab ${view === 'joueur' ? 'active' : ''}`} onClick={() => setView('joueur')}>
            Vue Joueur
          </button>
        </div>
      )}

      {vals.loading ? (
        <div className="helper-text">Connexion au serveur…</div>
      ) : activeView === 'mj' ? (
        showMjHome ? (
          <MjHome vals={vals} onGoToDashboard={() => setMjSubView('dashboard')} onStayHome={() => setMjSubView('home')} />
        ) : (
          <GmView vals={vals} onManageCharacters={() => setMjSubView('home')} />
        )
      ) : vals.myCharacter ? (
        <PlayerView vals={vals} />
      ) : (
        <JoinTable vals={vals} lockedCode={scenario ? vals.tableCode : null} onCodeStatus={setJoinCodeOk} />
      )}

      {scenario && !vals.loading && <DemoGuide key={activeView} vals={vals} scenario={scenario} mode={activeView} embedded={isEmbedded} />}
    </div>
  )
}
