// Repères visuels du scénario guidé (ticket 97, retour du 22/11) : retrouve dans la
// page le vrai bouton d'Auspex sur lequel cliquer, sans rien changer à l'interface.
// Les boutons sont retrouvés par leur classe et leur texte, tels qu'Auspex les
// affiche ; si l'un d'eux change de libellé, le repère disparaît simplement et la
// consigne écrite reste.

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
const visible = (el) => !!el && el.getClientRects().length > 0 && !el.disabled
const isActive = (el) => el.classList.contains('active') || el.classList.contains('chosen')

function findButton(root, selector, predicate) {
  return [...root.querySelectorAll(selector)].find((el) => visible(el) && predicate(text(el))) || null
}

function openModal(titleStart) {
  return [...document.querySelectorAll('.modal-sheet')].find((m) => text(m.querySelector('.modal-titlebar') || m).includes(titleStart)) || null
}

// Les listes de la modale d'attaque sont précédées de leur titre (« Attaquant — PNJ »…).
function pickInSection(modal, labelStart, name) {
  const label = [...modal.querySelectorAll('.section-label')].find((l) => text(l).startsWith(labelStart))
  const list = label?.nextElementSibling
  if (!list) return null
  return [...list.querySelectorAll('.entity-pick')].find((b) => text(b.querySelector('.entity-pick-name') || b).startsWith(name)) || null
}

function launchTestTarget({ skill, malus }) {
  const modal = openModal('Ordonner un test')
  if (!modal) return { el: findButton(document, '.gm-actions .primary-btn', (t) => t.includes('Ordonner un test')), hint: 'Ordonner un test' }
  const chip = findButton(modal, '.chip', (t) => t === skill)
  if (chip && !isActive(chip)) return { el: chip, hint: skill }
  const activeMalus = [...modal.querySelectorAll('.malus-btn')].find(isActive)
  if (malus && (!activeMalus || text(activeMalus) !== malus)) return { el: findButton(modal, '.malus-btn', (t) => t === malus), hint: `Malus ${malus}` }
  if (!malus && activeMalus) return { el: activeMalus, hint: 'Retirer le malus' }
  const all = findButton(modal, '.who-btn', (t) => t.startsWith("Toute l'équipe"))
  if (all && !isActive(all)) return { el: all, hint: "Toute l'équipe" }
  return { el: findButton(modal, '.primary-btn', (t) => t.includes("Transmettre l'ordre")), hint: "Transmettre l'ordre" }
}

function attackModalTarget({ attacker, defender, weapon, fireModeLabel }) {
  const modal = openModal('Engager le combat')
  if (!modal) return { el: findButton(document, '.gm-actions .secondary-btn', (t) => t.includes('Lancer une attaque')), hint: 'Lancer une attaque' }
  const side = (who) => (who.type === 'npc' ? 'PNJ' : 'Joueurs')
  const atk = pickInSection(modal, `Attaquant — ${side(attacker)}`, attacker.name)
  if (atk && !isActive(atk)) return { el: atk, hint: `Attaquant : ${attacker.name}` }
  const def = pickInSection(modal, `Cible — ${side(defender)}`, defender.name)
  if (def && !isActive(def)) return { el: def, hint: `Cible : ${defender.name}` }
  const w = [...modal.querySelectorAll('.weapon-row')].find((b) => text(b.querySelector('.weapon-row-name') || b) === weapon)
  if (w && !isActive(w)) return { el: w, hint: weapon }
  const mode = findButton(modal, '.who-btn', (t) => t === fireModeLabel)
  if (mode && !isActive(mode)) return { el: mode, hint: fireModeLabel }
  return { el: findButton(modal, '.primary-btn', (t) => t.includes('Engager le combat')), hint: 'Engager le combat' }
}

export function resolveTarget(target) {
  if (!target) return null
  switch (target.kind) {
    case 'launchTest':
      return launchTestTarget(target)
    case 'attackModal':
      return attackModalTarget(target)
    case 'npcDodge':
      return { el: findButton(document, '.attack-card button', (t) => t.includes('esquive du PNJ')), hint: 'Esquive du dragon' }
    case 'playerRoll':
      return { el: findButton(document, '.roll-button:not(.danger)', () => true), hint: 'Lancer le dé' }
    case 'playerDodge':
      return { el: findButton(document, '.roll-button.danger', () => true), hint: 'Esquiver' }
    default:
      return null
  }
}
