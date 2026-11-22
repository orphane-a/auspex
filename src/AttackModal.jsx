import { FictifBadge } from './Avatar.jsx'
import { CloseIcon, ErrorMsg } from './FocusParts.jsx'

// Modale « Engager le combat » (ticket 99) : champs numérotés dans l'ordre du choix,
// libellés en toutes lettres, pied fixe avec le récapitulatif, les erreurs et le bouton.

function PickGroup({ title, options, emptyHint, describe }) {
  return (
    <div>
      <p className="pick-group">{title}</p>
      {options.length === 0 ? (
        <p className="whoall-hint">{emptyHint}</p>
      ) : (
        <div className="picks">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`pick${o.isActive ? ' on' : ''}${o.connected ? '' : ' dis'}`}
              aria-pressed={o.isActive}
              onClick={o.select}
            >
              <span>
                <span className="pick-name">
                  {o.name}
                  {o.fictional && <FictifBadge />}
                  {!o.connected && <span className="tag">Non connecté</span>}
                </span>
                <span className="sub">{describe(o)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const describeAttacker = (o) => `Dextérité ${o.dexterity}`
const describeTarget = (o) => `Esquive ${o.dodgeScore}, ${o.pvCurrent} point${o.pvCurrent > 1 ? 's' : ''} de vie`

export default function AttackModal({ vals }) {
  const attacker = vals.attackModalAttackerEntity
  const defender = vals.attackModalDefenderEntity

  const errors = []
  if (vals.attackerIsDefender) errors.push("Un combattant ne peut pas s'attaquer lui-même. Choisissez une autre cible.")
  if (vals.attackerCharacterDisconnected && attacker)
    errors.push(`${attacker.name} n'est pas connecté. Il ne pourrait pas lancer son jet d'attaque, l'attaque ne peut donc pas être lancée.`)
  if (vals.defenderCharacterDisconnected && defender)
    errors.push(`${defender.name} n'est pas connecté. Il ne pourrait pas lancer son esquive, l'attaque ne peut donc pas être lancée.`)
  if (attacker && vals.weaponOptions.length === 0) errors.push(`${attacker.name} n'a aucune arme utilisable. Choisissez un autre attaquant.`)
  if (vals.attackError) errors.push(vals.attackError)

  const canSummarize = attacker && defender && vals.attackModalWeaponName && !vals.attackerIsDefender
  return (
    <div className="modal-overlay">
      <div className="modal-sheet wide" role="dialog" aria-modal="true" aria-labelledby="h-attack-modal">
        <div className="modal-head">
          <h2 id="h-attack-modal">Engager le combat</h2>
          <button type="button" className="close-x" onClick={vals.closeAttack} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <div className="two">
            <fieldset className="field">
              <legend>
                <span className="n">1</span> Attaquant <span className="hint">Il lance le jet d'attaque.</span>
              </legend>
              <PickGroup title="PNJ" options={vals.attackerNpcOptions} emptyHint="Aucun PNJ importé." describe={describeAttacker} />
              <PickGroup title="Joueurs" options={vals.attackerCharacterOptions} emptyHint="Aucun personnage importé." describe={describeAttacker} />
            </fieldset>
            <fieldset className="field">
              <legend>
                <span className="n">2</span> Cible <span className="hint">Elle pourra tenter une esquive.</span>
              </legend>
              <PickGroup title="Joueurs" options={vals.defenderCharacterOptions} emptyHint="Aucun personnage importé." describe={describeTarget} />
              <PickGroup title="PNJ" options={vals.defenderNpcOptions} emptyHint="Aucun PNJ importé." describe={describeTarget} />
            </fieldset>
          </div>
          <div className="two">
            <fieldset className="field">
              <legend>
                <span className="n">3</span> Arme
              </legend>
              {vals.weaponOptions.length > 0 ? (
                <div className="picks">
                  {vals.weaponOptions.map((w) => (
                    <button key={w.name} type="button" className={`pick${w.isActive ? ' on' : ''}`} aria-pressed={w.isActive} onClick={w.select}>
                      <span>
                        <span className="pick-name">{w.name}</span>
                        <span className="sub">
                          {w.damage} dégâts, {w.modesSentence}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="whoall-hint">Cet attaquant n'a aucune arme utilisable pour cette séquence.</p>
              )}
            </fieldset>
            <fieldset className="field">
              <legend>
                <span className="n">4</span> Mode de tir <span className="hint">Semi-auto et auto peuvent toucher plusieurs fois.</span>
              </legend>
              {vals.fireModeOptions.length > 0 ? (
                <div className="chips">
                  {vals.fireModeOptions.map((m) => (
                    <button key={m.key} type="button" className={`chipb${m.isActive ? ' on' : ''}`} aria-pressed={m.isActive} onClick={m.select}>
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="whoall-hint">Choisissez d'abord une arme.</p>
              )}
            </fieldset>
          </div>
          {vals.attackModalAttackerFictional && attacker && (
            <p className="msg-info">{attacker.name} est un personnage fictif : son jet d'attaque sera lancé automatiquement.</p>
          )}
          {vals.attackModalDefenderFictional && defender && (
            <p className="msg-info">{defender.name} est un personnage fictif : son esquive sera lancée automatiquement.</p>
          )}
        </div>
        <div className="modal-foot">
          {errors.map((e) => (
            <ErrorMsg key={e}>{e}</ErrorMsg>
          ))}
          <div className="foot-row">
            <p className="summary" aria-live="polite">
              {canSummarize ? (
                <>
                  <strong>{attacker.name}</strong> attaque <strong>{defender.name}</strong> : {vals.attackModalWeaponName}
                  {vals.attackModalFireModeLabel ? `, ${vals.attackModalFireModeLabel.toLowerCase()}` : ''}. Jet d'attaque sur un seuil de{' '}
                  <strong>{vals.attackModalAttackerThreshold}</strong>, puis esquive de {defender.name} sur un seuil de <strong>{vals.attackModalDefenderThreshold}</strong>.
                </>
              ) : (
                'Choisissez un attaquant, une cible et une arme.'
              )}
            </p>
            <button type="button" className="btn" disabled={vals.attackLaunchDisabled} onClick={vals.launchAttack}>
              Engager le combat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
