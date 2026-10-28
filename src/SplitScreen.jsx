// Écran partagé : les vues /mj et /joueur chargées côte à côte dans deux iframes.
// Chaque iframe a sa propre connexion socket — exactement comme deux fenêtres —
// ce qui permet de tester la synchro MJ ↔ Joueur depuis une seule URL.
const PANES = [
  { path: '/mj', label: 'Vue MJ' },
  { path: '/joueur', label: 'Vue Joueur' },
]

export default function SplitScreen() {
  return (
    <div className="split-screen">
      {PANES.map((pane) => (
        <section key={pane.path} className="split-pane">
          <header className="split-pane-header">
            <span>{pane.label}</span>
            <a href={pane.path} target="_blank" rel="noreferrer">
              ouvrir seule ↗
            </a>
          </header>
          <iframe className="split-pane-frame" src={pane.path} title={pane.label} />
        </section>
      ))}
    </div>
  )
}
