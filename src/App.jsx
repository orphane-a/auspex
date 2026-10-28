import { useState } from 'react'
import { useTableState } from './useTableState'
import GmView from './GmView.jsx'
import PlayerView from './PlayerView.jsx'
import MjHome from './screens/MjHome.jsx'
import JoinTable from './screens/JoinTable.jsx'
import SplitScreen from './SplitScreen.jsx'

const ROUTES = { '/mj': 'mj', '/joueur': 'joueur' }
// Dans une iframe de l'écran partagé, le bandeau « ouvrir l'autre vue » est inutile.
const isEmbedded = window.self !== window.top

export default function App() {
  // La racine affiche les deux vues côte à côte ; /mj et /joueur restent des vues seules.
  if (window.location.pathname === '/') return <SplitScreen />
  return <TableApp />
}

function TableApp() {
  const routeView = ROUTES[window.location.pathname]
  const [view, setView] = useState(routeView ?? 'mj')
  const [mjSubView, setMjSubView] = useState(null) // null = decide from data; 'home' | 'dashboard' once the MJ picks
  const vals = useTableState()
  const activeView = routeView ?? view

  const showMjHome = mjSubView === 'home' || (mjSubView === null && vals.characters.length === 0)

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
        <span className="online-chip">
          <span className="status-dot" aria-hidden="true" />
          En ligne
        </span>
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
          <MjHome vals={vals} onGoToDashboard={() => setMjSubView('dashboard')} />
        ) : (
          <GmView vals={vals} onManageCharacters={() => setMjSubView('home')} />
        )
      ) : vals.myCharacter ? (
        <PlayerView vals={vals} />
      ) : (
        <JoinTable vals={vals} />
      )}
    </div>
  )
}
