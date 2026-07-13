import { HIT_LOCATIONS } from './gameLogic'

const VIEW_W = 200
const VIEW_H = 350

// Anchor point (SVG viewBox coords) for each hit location's value badge —
// each one sits over the matching silhouette shape drawn below, front-facing
// (so "bras/jambe droit" — the character's right — renders on the viewer's left).
const ZONE_ANCHORS = {
  tete: { x: 100, y: 30 },
  brasDroit: { x: 30, y: 138 },
  brasGauche: { x: 170, y: 138 },
  poitrine: { x: 100, y: 96 },
  abdomen: { x: 100, y: 161 },
  jambeDroite: { x: 79, y: 267 },
  jambeGauche: { x: 121, y: 267 },
}

function zoneOpacity(value) {
  return Math.min(0.55, 0.08 + Math.max(0, value) * 0.045)
}

// Body-part outline for one hit location, shaded by its armor value so the
// figure itself reads as a "coverage map" in addition to the printed numbers.
function ArmorShape({ locationKey, value, ...svgProps }) {
  return <rect className="armor-shape" style={{ fillOpacity: zoneOpacity(value) }} {...svgProps} />
}

export default function ArmorDiagram({ armor, editable = false, onChange }) {
  return (
    <div className="armor-diagram">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="armor-diagram-svg" role="img" aria-label="Schéma d'armure par localisation">
        <circle cx="100" cy="30" r="24" className="armor-shape" style={{ fillOpacity: zoneOpacity(armor.tete || 0) }} />
        <rect x="92" y="50" width="16" height="16" className="armor-shape armor-shape-neck" />
        <ArmorShape locationKey="brasDroit" value={armor.brasDroit || 0} x="14" y="68" width="32" height="140" rx="15" />
        <ArmorShape locationKey="brasGauche" value={armor.brasGauche || 0} x="154" y="68" width="32" height="140" rx="15" />
        <ArmorShape locationKey="poitrine" value={armor.poitrine || 0} x="60" y="64" width="80" height="64" rx="16" />
        <ArmorShape locationKey="abdomen" value={armor.abdomen || 0} x="64" y="132" width="72" height="58" rx="14" />
        <ArmorShape locationKey="jambeDroite" value={armor.jambeDroite || 0} x="62" y="194" width="34" height="146" rx="16" />
        <ArmorShape locationKey="jambeGauche" value={armor.jambeGauche || 0} x="104" y="194" width="34" height="146" rx="16" />
      </svg>
      {HIT_LOCATIONS.map((loc) => {
        const anchor = ZONE_ANCHORS[loc.key]
        const value = armor[loc.key] || 0
        return (
          <div
            key={loc.key}
            className="armor-badge"
            style={{ left: `${(anchor.x / VIEW_W) * 100}%`, top: `${(anchor.y / VIEW_H) * 100}%` }}
            title={loc.label}
          >
            <span className="armor-badge-label">{loc.label}</span>
            {editable ? (
              <input
                className="armor-badge-input"
                type="number"
                defaultValue={value}
                onBlur={(e) => onChange(loc.key, Number(e.target.value))}
              />
            ) : (
              <span className="armor-badge-value">{value}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
