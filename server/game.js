function rollD100() {
  return 1 + Math.floor(Math.random() * 100)
}

function parseMalus(malus) {
  if (!malus) return 0
  const n = parseInt(String(malus).replace('+', ''), 10)
  return Number.isFinite(n) ? n : 0
}

// Degrés de réussite/d'échec (cahier des charges §4) : nombre de dizaines pleines
// séparant le jet de la cible. Extrait de resolveRoll (V3) pour être réutilisé par
// la séquence d'attaque, qui a déjà son propre jet (attackRoll/dodgeRoll) et n'a
// besoin que du calcul de degrés, pas d'un nouveau jet.
export function degreesFromRoll(roll, target) {
  const success = roll <= target
  const degrees = success
    ? Math.max(1, 1 + Math.floor((target - roll) / 10))
    : Math.max(1, 1 + Math.floor((roll - target) / 10))
  return { status: success ? 'success' : 'fail', degrees }
}

// Dark Heresy 2e-style d100 resolution (cahier des charges §4): roll under the
// skill score minus the chosen malus. Auto-success/fail on doubles and fureur
// vengeresse are explicitly deferred to V2.
export function resolveRoll(score, malus) {
  const target = Math.max(0, score - parseMalus(malus))
  const roll = rollD100()
  const { status, degrees } = degreesFromRoll(roll, target)
  return { roll, target, status, degrees }
}
