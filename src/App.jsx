import { useState } from 'react'
import { useTableState } from './useTableState'
import GmView from './GmView.jsx'
import PlayerView from './PlayerView.jsx'
import MjHome from './screens/MjHome.jsx'
import JoinTable from './screens/JoinTable.jsx'
import SplitScreen from './SplitScreen.jsx'
import DiceHelp from './DiceHelp.jsx'

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

  const subtitle = activeView === 'mj' ? 'Maître de jeu' : vals.myCharacter ? `Joueur, table ${vals.tableCode}` : 'Joueur'
  const otherPath = routeView === 'mj' ? '/joueur' : '/mj'

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
            <div className="brand-subtitle">{subtitle}</div>
          </div>
        </div>
        {!routeView && (
          <div className="view-tabs" role="group" aria-label="Choix de la vue">
            <button className={`view-tab ${view === 'mj' ? 'active' : ''}`} aria-pressed={view === 'mj'} onClick={() => setView('mj')}>
              Vue MJ
            </button>
            <button className={`view-tab ${view === 'joueur' ? 'active' : ''}`} aria-pressed={view === 'joueur'} onClick={() => setView('joueur')}>
              Vue Joueur
            </button>
          </div>
        )}
        <div className="top-right">
          {/* Lien vers l'autre vue, en petit dans la barre plutôt qu'un bandeau qui coûtait de la hauteur. */}
          {routeView && !isEmbedded && (
            <a className="route-link" href={otherPath} target="_blank" rel="noreferrer">
              Ouvrir la {routeView === 'mj' ? 'vue Joueur' : 'vue MJ'}
            </a>
          )}
          <DiceHelp />
          <span className="online-chip">
            <span className="status-dot" aria-hidden="true" />
            En ligne
          </span>
        </div>
      </header>

      <main className="app-main">
        {vals.loading ? (
          <div className="helper-text">Connexion au serveur…</div>
        ) : activeView === 'mj' ? (
          showMjHome ? (
            <div className="screen-scroll">
              <MjHome vals={vals} onGoToDashboard={() => setMjSubView('dashboard')} />
            </div>
          ) : (
            <GmView vals={vals} onManageCharacters={() => setMjSubView('home')} />
          )
        ) : vals.myCharacter ? (
          <PlayerView vals={vals} />
        ) : (
          <div className="screen-scroll">
            <JoinTable vals={vals} />
          </div>
        )}
      </main>
    </div>
  )
}
