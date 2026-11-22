// Avatars simulés du scénario guidé : un cercle de couleur avec une initiale ou un
// pictogramme, encodé en data URI pour tenir dans le champ `avatar` existant sans
// ajouter d'image au dépôt. Module pur (aucun accès disque, aucune interface), lu à
// la fois par le seed serveur et par la vue MJ.
function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch])
}

// Silhouette de tête de dragon, volontairement simple : on veut un repère visuel
// distinct des initiales des héros, pas une illustration.
const DRAGON_PATH = 'M18 44 L26 30 L22 18 L32 26 L42 18 L38 30 L46 44 L38 40 L32 46 L26 40 Z'

export function avatarSvg({ color, initial, pictogram }) {
  const content =
    pictogram === 'dragon'
      ? `<path d="${DRAGON_PATH}" fill="#ffffff"/>`
      : `<text x="32" y="42" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="28" font-weight="600" fill="#ffffff">${escapeXml(initial || '?')}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${escapeXml(color)}"/>${content}</svg>`
}

export function avatarDataUri(options) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(options))}`
}
