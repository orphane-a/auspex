// Accueil de la démo (ticket 97, retour du 22/11) : on choisit son côté de la table ;
// le guide joue l'autre côté.
// Ticket 103 : un préambule rappelle à quoi sert Auspex et ce que fait la démo, et la page
// tient dans la hauteur de l'écran. L'image de couverture est la seule partie élastique.
// Retour design du 23/11 : la carte « deux vues côte à côte » n'est plus proposée ici
// (la page /?vues=deux reste accessible par son adresse).
export const CHOICES = [
  { href: '/mj', title: 'Jouer le MJ', text: 'Vous menez la partie. Le guide joue Aldric et ses compagnons.' },
  { href: '/joueur', title: 'Jouer Aldric', text: 'Vous êtes le chevalier. Le guide joue le MJ et vos compagnons.' },
]

export default function DemoHome({ scenario }) {
  const cover = scenario.cover
  return (
    <main className="demo-home">
      <div className={cover ? 'demo-home-inner' : 'demo-home-inner sans-image'}>
        {cover && (
          <figure className="demo-figure demo-home-cover">
            <img src={cover.src} alt={cover.alt} width="480" height="360" decoding="async" />
          </figure>
        )}
        <div className="demo-home-text">
          <p className="demo-chip">Démo</p>
          <h1 className="demo-home-title">{scenario.title}</h1>
          <div className="demo-home-preambule">
            <p className="demo-home-outil">
              Auspex accompagne vos parties de jeu de rôle à distance. Un MJ humain mène l'histoire,
              l'équipe de joueurs suit et agit depuis son propre écran, et tout est synchronisé en direct.
            </p>
            <p className="demo-home-demo">
              <strong>Cette démo simule l'histoire qu'aurait racontée un MJ humain</strong>, pour vous
              montrer comment on utilise l'outil. Un guide vous indique où cliquer.
            </p>
          </div>
          <ul className="demo-home-list">
            {CHOICES.map((c) => (
              <li key={c.href}>
                <a className="demo-home-card" href={c.href}>
                  <span className="demo-home-card-title">{c.title}</span>
                  <span className="demo-home-card-text">{c.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
