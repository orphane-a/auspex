// Barre de PV lisible et vocalisée (progressbar) — remplace la barre ASCII ▓░,
// que les lecteurs d'écran épelaient caractère par caractère.
export default function PvBar({ label, current, max, ratio, statusKey, large }) {
  return (
    <div className={`pv-block${large ? ' lg' : ''}`}>
      <div className="pv-head">
        <span className="pv-caption">Points de vie</span>
        <span className="pv-value">
          {current}
          <span> / {max}</span>
        </span>
      </div>
      <div className="pv-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={current} aria-valuetext={`${current} sur ${max}`}>
        <div className={`pv-fill pv-${statusKey}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  )
}

const ICONS = {
  sain: <path d="M3 8.5l3.2 3L13 4.5" />,
  blesse: <path d="M8 3v6M8 12.5v.5" />,
  critique: <path d="M8 3v6M8 12.5v.5" />,
  horsCombat: <path d="M4 4l8 8M12 4l-8 8" />,
}

// pvStatus() renvoie des libellés en capitales (« HORS DE COMBAT ») : on les remet
// en casse de phrase, plus rapide à lire en un coup d'œil pendant la partie.
export function PvStatusBadge({ statusKey, label }) {
  const text = label.charAt(0) + label.slice(1).toLowerCase()
  return (
    <span className={`status-badge pv-${statusKey}`}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[statusKey]}
      </svg>
      {text}
    </span>
  )
}
