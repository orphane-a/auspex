import { useState } from 'react'
import { FictifBadge } from './Avatar.jsx'
import { CloseIcon, ErrorMsg } from './FocusParts.jsx'
import { launchSummary, malusDisplay } from './explain.js'

// Modale « Ordonner un test » (ticket 99) : en tête et pied fixes, seul le corps défile,
// le bouton « Transmettre l'ordre » reste toujours visible.
export default function LaunchModal({ vals }) {
  const [skillTab, setSkillTab] = useState('all')
  const activeGroups =
    skillTab === 'all' ? vals.skillGroups : vals.skillGroupsByCharacter.find((c) => c.id === skillTab)?.groups || []
  const canSend = !!vals.selectedSkill && vals.concernedCount > 0

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="h-launch-modal">
        <div className="modal-head">
          <h2 id="h-launch-modal">Ordonner un test</h2>
          <button type="button" className="close-x" onClick={vals.closeLaunch} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <fieldset className="field">
            <legend>
              <span className="n">1</span> Compétence à tester
            </legend>
            <div className="skill-tab-row">
              <button type="button" className={`skill-tab ${skillTab === 'all' ? 'active' : ''}`} aria-pressed={skillTab === 'all'} onClick={() => setSkillTab('all')}>
                Toutes
              </button>
              {vals.skillGroupsByCharacter.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`skill-tab ${skillTab === c.id ? 'active' : ''}`}
                  aria-pressed={skillTab === c.id}
                  onClick={() => setSkillTab(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {activeGroups.length === 0 ? (
              <p className="whoall-hint">Aucune compétence pour ce personnage.</p>
            ) : (
              activeGroups.map((group) => (
                <div key={group.characteristic} className="char-group">
                  <p className="pick-group">{group.characteristicName}</p>
                  <div className="chips">
                    {group.chips.map((c) => (
                      <button key={c.name} type="button" className={`chipb${c.isActive ? ' on' : ''}`} aria-pressed={c.isActive} onClick={c.select}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </fieldset>

          <fieldset className="field">
            <legend>
              <span className="n">2</span> Malus <span className="hint">Retiré au seuil de chaque joueur. Facultatif.</span>
            </legend>
            <div className="chips">
              {vals.malusOpts.map((m) => (
                <button key={m.label} type="button" className={`chipb${m.isActive ? ' on' : ''}`} aria-pressed={m.isActive} onClick={m.set}>
                  {malusDisplay(m.label)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>
              <span className="n">3</span> Joueurs concernés
            </legend>
            <div className="chips">
              <button type="button" className={`chipb${vals.whoMode === 'all' ? ' on' : ''}`} aria-pressed={vals.whoMode === 'all'} onClick={vals.setWhoAll}>
                Toute l'équipe
              </button>
              <button type="button" className={`chipb${vals.whoMode === 'some' ? ' on' : ''}`} aria-pressed={vals.whoMode === 'some'} onClick={vals.setWhoSome}>
                Sélection
              </button>
            </div>
            {vals.whoMode === 'some' ? (
              <div className="selectable-list">
                {vals.selectable.map((p) => (
                  <button key={p.id} type="button" className={`selectable-row ${p.isChosen ? 'chosen' : ''}`} aria-pressed={p.isChosen} onClick={p.toggle}>
                    <span className={`checkbox ${p.isChosen ? 'chosen' : ''}`} aria-hidden="true" />
                    <span className={`selectable-label ${p.isChosen ? 'chosen' : ''}`}>{p.name}</span>
                    {p.fictional && <FictifBadge />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="whoall-hint">
                Concerne toute l'équipe présente ({vals.connectedCount} joueur{vals.connectedCount > 1 ? 's' : ''}
                {vals.connectedFictionalCount > 0 ? `, dont ${vals.connectedFictionalCount} fictif${vals.connectedFictionalCount > 1 ? 's' : ''}` : ''}).
              </p>
            )}
            {vals.connectedFictionalCount > 0 && <p className="whoall-hint">Les personnages fictifs lancent leur jet automatiquement.</p>}
          </fieldset>
        </div>
        <div className="modal-foot">
          <ErrorMsg>{vals.launchError}</ErrorMsg>
          <div className="foot-row">
            <p className="summary" aria-live="polite">
              {launchSummary({ skill: vals.selectedSkill, malus: vals.selectedMalus, count: vals.concernedCount, fictionalCount: vals.concernedFictionalCount })}
            </p>
            <button type="button" className="btn" disabled={!canSend} onClick={vals.sendRequest}>
              Transmettre l'ordre
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
