// Repères visuels du scénario guidé (ticket 97, retour du 22/11) : retrouve dans la
// page le vrai bouton d'Auspex sur lequel cliquer, sans rien changer à l'interface.
// Les boutons sont retrouvés par leur classe et leur texte, tels qu'Auspex les
// affiche ; si l'un d'eux change de libellé, le repère disparaît simplement et la
// consigne écrite reste.
//
// Ticket 99 : les modales sont découpées en champs numérotés (« 1 Compétence »,
// « 2 Malus »…), les choix sont des `.chipb` / `.pick` marqués `.on`, et les dés se
// lancent depuis le `.roll-zone` des écrans du joueur.
import { malusDisplay } from '../explain.js'

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
const visible = (el) => !!el && el.getClientRects().length > 0 && !el.disabled
const isActive = (el) => el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true'

function findButton(root, selector, predicate) {
  if (!root) return null
  return [...root.querySelectorAll(selector)].find((el) => visible(el) && predicate(text(el))) || null
}

function openModal(title) {
  return [...document.querySelectorAll('.modal-sheet')].find((m) => text(m.querySelector('.modal-head h2') || m).startsWith(title)) || null
}

// Champ numéroté d'une modale : la légende commence par son numéro (`.n`).
function field(modal, n) {
  return [...modal.querySelectorAll('fieldset.field')].find((f) => text(f.querySelector('legend .n') || f) === String(n)) || null
}

// Dans un champ de la modale d'attaque, les listes sont précédées de leur titre (« PNJ », « Joueurs »).
function pickInGroup(fieldset, groupTitle, name) {
  if (!fieldset) return null
  const label = [...fieldset.querySelectorAll('.pick-group')].find((l) => text(l) === groupTitle)
  const list = label?.nextElementSibling
  if (!list) return null
  return [...list.querySelectorAll('.pick')].find((b) => text(b.querySelector('.pick-name') || b).startsWith(name)) || null
}

function gmAction(label) {
  return findButton(document, '.actions .btn', (t) => t.includes(label))
}

function launchTestTarget({ skill, malus }) {
  const modal = openModal('Ordonner un test')
  if (!modal) {
    const open = gmAction('Ordonner un test')
    if (open) return { el: open, hint: 'Ordonner un test' }
    // Les résultats du test précédent sont encore affichés : on les referme d'abord.
    return { el: gmAction('Nouveau test'), hint: 'Nouveau test' }
  }
  const skills = field(modal, 1)
  const chip = findButton(skills, '.chipb', (t) => t === skill)
  if (!chip) {
    const all = findButton(skills, '.skill-tab', (t) => t === 'Toutes')
    if (all && !isActive(all)) return { el: all, hint: 'Toutes les compétences' }
  }
  if (chip && !isActive(chip)) return { el: chip, hint: skill }
  const malusField = field(modal, 2)
  const activeMalus = malusField && [...malusField.querySelectorAll('.chipb')].find(isActive)
  const wanted = malus ? malusDisplay(malus) : null
  if (wanted && (!activeMalus || text(activeMalus) !== wanted)) return { el: findButton(malusField, '.chipb', (t) => t === wanted), hint: `Malus ${wanted}` }
  if (!wanted && activeMalus) return { el: activeMalus, hint: 'Retirer le malus' }
  const all = findButton(field(modal, 3), '.chipb', (t) => t.startsWith("Toute l'équipe"))
  if (all && !isActive(all)) return { el: all, hint: "Toute l'équipe" }
  return { el: findButton(modal, '.modal-foot .btn', (t) => t.includes("Transmettre l'ordre")), hint: "Transmettre l'ordre" }
}

function attackModalTarget({ attacker, defender, weapon, fireModeLabel }) {
  const modal = openModal('Engager le combat')
  if (!modal) return { el: gmAction('Lancer une attaque'), hint: 'Lancer une attaque' }
  const group = (who) => (who.type === 'npc' ? 'PNJ' : 'Joueurs')
  const atk = pickInGroup(field(modal, 1), group(attacker), attacker.name)
  if (atk && !isActive(atk)) return { el: atk, hint: `Attaquant : ${attacker.name}` }
  const def = pickInGroup(field(modal, 2), group(defender), defender.name)
  if (def && !isActive(def)) return { el: def, hint: `Cible : ${defender.name}` }
  const weaponField = field(modal, 3)
  const w = weaponField && [...weaponField.querySelectorAll('.pick')].find((b) => text(b.querySelector('.pick-name') || b) === weapon)
  if (w && !isActive(w)) return { el: w, hint: weapon }
  const mode = findButton(field(modal, 4), '.chipb', (t) => t === fireModeLabel)
  if (mode && !isActive(mode)) return { el: mode, hint: fireModeLabel }
  return { el: findButton(modal, '.modal-foot .btn', (t) => t.includes('Engager le combat')), hint: 'Engager le combat' }
}

export function resolveTarget(target) {
  if (!target) return null
  switch (target.kind) {
    case 'launchTest':
      return launchTestTarget(target)
    case 'attackModal':
      return attackModalTarget(target)
    case 'npcDodge':
      return { el: findButton(document, '.attack-live .btn', (t) => t.includes('esquive du PNJ')), hint: 'Esquive du dragon' }
    // Le même bouton sert au test (« Lancer le dé ») et à l'attaque (« Lancer l'attaque ») :
    // le repère reprend son libellé.
    case 'playerRoll': {
      const el = findButton(document, '.roll-zone .btn:not(.danger)', () => true)
      return { el, hint: el ? text(el) : 'Lancer le dé' }
    }
    case 'playerDodge':
      return { el: findButton(document, '.roll-zone .btn.danger', () => true), hint: "Lancer l'esquive" }
    default:
      return null
  }
}
