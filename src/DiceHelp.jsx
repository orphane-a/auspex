import { useEffect, useRef, useState } from 'react'
import { DICE_RULE } from './explain.js'

// Aide « Comment marchent les dés ? » (ticket 99, souhaitable 1 et 2) : la règle du
// d100, les degrés, un exemple chiffré et les mots du jeu, ouverte en un clic.
export default function DiceHelp() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div className="help-wrap" ref={wrapRef}>
      <button type="button" className="help-btn" aria-expanded={open} aria-controls="dice-help" onClick={() => setOpen((o) => !o)}>
        <span className="help-q" aria-hidden="true">
          ?
        </span>
        <span className="help-btn-text">Comment marchent les dés ?</span>
      </button>
      {open && (
        <div className="help-pop" id="dice-help" role="region" aria-label="Comment marchent les dés">
          <p className="help-pop-title">On lance un dé à 100 faces.</p>
          <p>{DICE_RULE}</p>
          <p className="help-pop-example">Exemple : seuil 45, vous faites 23. Réussite, 3 degrés (22 points d’écart).</p>
          <dl className="help-terms">
            <dt>Seuil</dt>
            <dd>Le nombre à ne pas dépasser. Il vient de votre fiche, moins un éventuel malus.</dd>
            <dt>Degré</dt>
            <dd>Mesure de la réussite ou de l’échec : 1, plus 1 par tranche de 10 points d’écart.</dd>
            <dt>Esquive</dt>
            <dd>Jet de la cible touchée. S’il réussit, elle évite tous les dégâts.</dd>
            <dt>Localisation</dt>
            <dd>Partie du corps touchée, lue dans les chiffres inversés du jet d’attaque.</dd>
            <dt>Armure</dt>
            <dd>Points retirés aux dégâts de chaque balle sur la zone touchée.</dd>
            <dt>Mode de tir</dt>
            <dd>Coup par coup : une balle. Semi-auto et auto : plusieurs balles selon les degrés.</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
