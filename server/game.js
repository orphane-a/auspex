function rollD100() {
  return 1 + Math.floor(Math.random() * 100)
}

function parseMalus(malus) {
  if (!malus) return 0
  const n = parseInt(String(malus).replace('+', ''), 10)
  return Number.isFinite(n) ? n : 0
}

// Dark Heresy 2e-style d100 resolution (cahier des charges §4): roll under the
// skill score minus the chosen malus. Degrees of success/failure come from how
// many full tens separate the roll from the target. Auto-success/fail on doubles
// and fureur vengeresse are explicitly deferred to V2.
export function resolveRoll(score, malus) {
  const target = Math.max(0, score - parseMalus(malus))
  const roll = rollD100()
  const success = roll <= target
  const degrees = success
    ? Math.max(1, 1 + Math.floor((target - roll) / 10))
    : Math.max(1, 1 + Math.floor((roll - target) / 10))
  return { roll, target, status: success ? 'success' : 'fail', degrees }
}
