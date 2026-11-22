import { ATTACK_STEPS, DICE_RULE } from './explain.js'

// Briques communes des écrans de jet et de combat (ticket 99, exigence 12) :
// titre, explication, puis chiffres de détail en plus petit.

export function StepLine({ step, danger }) {
  return (
    <div className="eyebrow">
      <span className={`step-chip${danger ? ' danger' : ''}`}>Étape {step} sur 3</span>
      <ol className="steps" aria-label="Étapes du combat">
        {ATTACK_STEPS.map((label, i) => {
          const n = i + 1
          return (
            <li key={label} className={n < step ? 'done' : n === step ? 'now' : ''} aria-current={n === step ? 'step' : undefined}>
              {n} {label}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function Facts({ items }) {
  return (
    <div className="facts">
      {items.map((f) => (
        <div key={f.label} className={`fact${f.highlight ? ' key' : ''}`}>
          <span className="k">{f.label}</span>
          <span className="v">{f.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DiceRule({ text = DICE_RULE }) {
  return (
    <p className="dice-rule">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7v4M8 4.6v.4" strokeLinecap="round" />
      </svg>
      <span>{text}</span>
    </p>
  )
}

// Petit dé « d100 » à la place du dessin ASCII : il tourne pendant le lancer.
export function RollZone({ label, onRoll, rolling, rollingText, danger }) {
  return (
    <div className="roll-zone">
      <span className={`die${rolling ? ' rolling' : ''}`} aria-hidden="true">
        d100
      </span>
      {rolling ? (
        <p className="inline-status" role="status">
          {rollingText}
        </p>
      ) : (
        <button type="button" className={`btn big${danger ? ' danger' : ''}`} onClick={onRoll}>
          {label}
        </button>
      )}
    </div>
  )
}

export function ErrorMsg({ children }) {
  if (!children) return null
  return (
    <p className="msg-error" role="alert">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4.2M8 11v.4" />
      </svg>
      <span>{children}</span>
    </p>
  )
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  )
}
