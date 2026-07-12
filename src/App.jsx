import { useState } from 'react'
import { useTableState } from './useTableState'
import GmView from './GmView.jsx'
import PlayerView from './PlayerView.jsx'
import MjHome from './screens/MjHome.jsx'
import JoinTable from './screens/JoinTable.jsx'

const ROUTES = { '/mj': 'mj', '/joueur': 'joueur' }

export default function App() {
  const routeView = ROUTES[window.location.pathname]
  const [view, setView] = useState(routeView ?? 'mj')
  const [mjSubView, setMjSubView] = useState(null) // null = decide from data; 'home' | 'dashboard' once the MJ picks
  const vals = useTableState()
  const activeView = routeView ?? view

  const showMjHome = mjSubView === 'home' || (mjSubView === null && vals.characters.length === 0)

  return (
    <div className="app-shell">
      <div className="stage-header">
        <div className="brand">
          <div className="brand-mark">
            <div className="diamond" />
            <div className="ring" />
            <div className="dot" />
          </div>
          <div>
            <div className="brand-title">AUSPEX</div>
            <div className="brand-subtitle">Companion de partie · M41</div>
          </div>
        </div>
      </div>

      {routeView ? (
        <div className="route-banner">
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
