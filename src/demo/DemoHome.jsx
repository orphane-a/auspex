// Accueil de la démo (ticket 97, retour du 22/11) : on choisit son côté de la table.
// Seul, le guide joue l'autre côté ; à deux, l'écran partagé montre les deux vues.
const CHOICES = [
  { href: '/mj', title: 'Jouer le MJ', text: 'Vous menez la partie. Le guide joue Aldric et ses compagnons.' },
  { href: '/joueur', title: 'Jouer Aldric', text: 'Vous êtes le chevalier. Le guide joue le MJ et vos compagnons.' },
  { href: '/?vues=deux', title: 'Les deux vues côte à côte', text: 'Pour jouer à deux, ou voir la synchronisation en direct.' },
]

export default function DemoHome({ scenario }) {
  return (
    <main className="demo-home">
      <p className="demo-chip">Démo</p>
      <h1 className="demo-home-title">{scenario.title}</h1>
      <p className="demo-home-lead">Une courte aventure pour découvrir Auspex. Un guide raconte l'histoire et montre où cliquer.</p>
      <ul className="demo-home-list">
        {CHOICES.map((c) => (
          <li key={c.href}>
            <a className="demo-home-card" href={c.href}>
              <span className="demo-home-card-title">{c.title}</span>
              <span>{c.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
