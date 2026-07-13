import { characteristicLabel } from './gameLogic'

const SIZE = 300
const CENTER = SIZE / 2
const RADIUS = 88
const LABEL_RADIUS = 132

function axisAngle(index, count) {
  return (Math.PI * 2 * index) / count - Math.PI / 2
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
      const x = CENTER + Math.cos(angle) * RADIUS * fraction
      const y = CENTER + Math.sin(angle) * RADIUS * fraction
      return `${x},${y}`
    })
    .join(' ')

  const gridRings = [0.25, 0.5, 0.75, 1].map((r) =>
    tendencies
      .map((_, i) => {
        const angle = axisAngle(i, n)
        return `${CENTER + Math.cos(angle) * RADIUS * r},${CENTER + Math.sin(angle) * RADIUS * r}`
      })
      .join(' '),
  )

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="radar-svg" role="img" aria-label="Tendances des caractéristiques">
      {gridRings.map((ring, i) => (
        <polygon key={i} points={ring} className="radar-grid" />
      ))}
      {tendencies.map((_, i) => {
        const angle = axisAngle(i, n)
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={CENTER + Math.cos(angle) * RADIUS}
            y2={CENTER + Math.sin(angle) * RADIUS}
            className="radar-axis"
          />
        )
      })}
      <polygon points={shapePoints} className="radar-shape" />
      {tendencies.map((t, i) => {
        const angle = axisAngle(i, n)
        const fraction = Math.max(0.08, Math.min(1, t.score / 100))
        const x = CENTER + Math.cos(angle) * RADIUS * fraction
        const y = CENTER + Math.sin(angle) * RADIUS * fraction
        return <circle key={i} cx={x} cy={y} r="3" className="radar-dot" />
      })}
      {tendencies.map((t, i) => {
        const angle = axisAngle(i, n)
        const cos = Math.cos(angle)
        const x = CENTER + cos * LABEL_RADIUS
        const y = CENTER + Math.sin(angle) * LABEL_RADIUS
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} className="radar-label-char">
            {characteristicLabel(t.characteristic)}
            <tspan x={x} dy="18" className="radar-label-skill">
              {t.topSkill}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
