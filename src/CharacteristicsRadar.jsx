import { characteristicLabel } from './gameLogic'

const WIDTH = 360
const HEIGHT = 360
const CENTER_X = WIDTH / 2
// Centre abaissé : l'étiquette de l'axe du haut s'empile au-dessus du sommet.
const CENTER_Y = 190
const RADIUS = 92
const LABEL_RADIUS = 112
const SKILL_LINE_MAX_CHARS = 16
const SKILL_LINE_HEIGHT = 15

function axisAngle(index, count) {
  return (Math.PI * 2 * index) / count - Math.PI / 2
}

// Wraps the standout-skill label onto short lines instead of letting a long
// name (e.g. "Connaissance générale (Maelstrom)") run past the radar's frame.
function wrapSkillLabel(text) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > SKILL_LINE_MAX_CHARS && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

// Shows the *shape* of a character's characteristics without ever printing a raw
// score: each axis is scaled by the best-trained skill for that characteristic,
// and labelled with that skill's name so the shape is legible on its own.
export default function CharacteristicsRadar({ tendencies }) {
  const n = tendencies.length
  if (n < 3) return null

  const shapePoints = tendencies
    .map((t, i) => {
      const angle = axisAngle(i, n)
      const fraction = Math.max(0.08, Math.min(1, t.score / 100))
      const x = CENTER_X + Math.cos(angle) * RADIUS * fraction
      const y = CENTER_Y + Math.sin(angle) * RADIUS * fraction
      return `${x},${y}`
    })
    .join(' ')

  const gridRings = [0.25, 0.5, 0.75, 1].map((r) =>
    tendencies
      .map((_, i) => {
        const angle = axisAngle(i, n)
        return `${CENTER_X + Math.cos(angle) * RADIUS * r},${CENTER_Y + Math.sin(angle) * RADIUS * r}`
      })
      .join(' '),
  )

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="radar-svg" role="img" aria-label="Tendances des caractéristiques">
      {gridRings.map((ring, i) => (
        <polygon key={i} points={ring} className="radar-grid" />
      ))}
      {tendencies.map((_, i) => {
        const angle = axisAngle(i, n)
        return (
          <line
            key={i}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={CENTER_X + Math.cos(angle) * RADIUS}
            y2={CENTER_Y + Math.sin(angle) * RADIUS}
            className="radar-axis"
          />
        )
      })}
      <polygon points={shapePoints} className="radar-shape" />
      {tendencies.map((t, i) => {
        const angle = axisAngle(i, n)
        const fraction = Math.max(0.08, Math.min(1, t.score / 100))
        const x = CENTER_X + Math.cos(angle) * RADIUS * fraction
        const y = CENTER_Y + Math.sin(angle) * RADIUS * fraction
        return <circle key={i} cx={x} cy={y} r="3" className="radar-dot" />
      })}
      {tendencies.map((t, i) => {
        const angle = axisAngle(i, n)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const x = CENTER_X + cos * LABEL_RADIUS
        const skillLines = wrapSkillLabel(t.topSkill)
        // Axe du haut : tout le bloc remonte pour ne pas recouvrir la forme.
        const y = CENTER_Y + sin * LABEL_RADIUS - (sin < -0.9 ? skillLines.length * SKILL_LINE_HEIGHT + 4 : 0)
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} className="radar-label-char">
            {characteristicLabel(t.characteristic)}
            {skillLines.map((line, li) => (
              <tspan key={li} x={x} dy={li === 0 ? 18 : SKILL_LINE_HEIGHT} className="radar-label-skill">
                {line}
              </tspan>
            ))}
          </text>
        )
      })}
    </svg>
  )
}
