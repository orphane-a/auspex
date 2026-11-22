// `npm run demo` : lance l'instance de démo du scénario guidé en local, avec sa
// propre base (server/demo-data/, ignorée par git) pour ne jamais toucher à la table
// habituelle. Les variables doivent être posées avant l'import de db.js, qui ouvre
// le fichier SQLite dès son chargement — d'où l'import dynamique.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.SCENARIO ||= 'dragon'
process.env.DATA_DIR ||= path.join(__dirname, 'demo-data')

await import('./index.js')
