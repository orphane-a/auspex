// Un personnage fictif (ticket 94) n'a jamais de portrait : cercle en pointillé et
// silhouette au trait, pour le repérer d'un coup d'oeil sans couleur nouvelle.
export default function Avatar({ src, size, fictional }) {
  const className = `avatar${size ? ` ${size}` : ''}${fictional ? ' fictif' : ''}`
  if (fictional) {
    const px = size === 'sm' ? 18 : size === 'lg' ? 36 : 26
    return (
      <div className={className}>
        <svg aria-hidden="true" width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" />
        </svg>
      </div>
    )
  }
  if (src) return <img src={src} alt="" className={className} />
  return <div className={className} />
}

// Mention « fictif » à côté du nom : le pointillé et le mot se lisent sans la couleur.
export function FictifBadge() {
  return <span className="badge-fictif">fictif</span>
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}
