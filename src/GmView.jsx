import { useState } from 'react'
import Avatar from './Avatar.jsx'
import PvBar, { PvStatusBadge } from './PvBar.jsx'
import LaunchModal from './LaunchModal.jsx'
import AttackModal from './AttackModal.jsx'
import GuidedPanel from './GuidedPanel.jsx'

// Puces de compétences du scénario guidé (ticket 97) : la meilleure valeur de la
// table pour chaque compétence est mise en avant, pour montrer qui brille où.
function DemoSkills({ character, characters }) {
  const best = (name) => Math.max(...characters.map((c) => c.skills.find((s) => s.name === name)?.score ?? 0))
  return (
    <ul className="demo-skills" aria-label={`Compétences de ${character.name}`}>
      {character.skills.map((s) => (
        <li key={s.name} className={`demo-skill${s.score === best(s.name) ? ' best' : ''}`}>
          {s.name} <b>{s.score}</b>
        </li>
      ))}
    </ul>
  )
}

export default function GmView({ vals, scenario, onManageCharacters }) {
  const [copyState, setCopyState] = useState(null) // null | 'ok' | 'error'

  // L'API presse-papiers exige un contexte sécurisé : sur une IP du réseau local en
  // http, elle échoue — on le dit plutôt que de laisser croire que c'est copié.
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(vals.tableCode)
      setCopyState('ok')
    } catch {
      setCopyState('error')
    }
  }

  // En démo, chaque ligne est rattachée à son personnage du scénario (par le nom) pour
  // afficher son rôle et ses compétences ; hors démo, rien ne change.
  const demoMember = (name) => scenario?.characters.find((c) => c.name === name) || null
  const demoNpc = (name) => (scenario && scenario.npc.name === name ? scenario.npc : null)

  const content = (
    <>
      <div className="panel">
        {vals.mjDashboard && (
          <div className="gm-body">
            <section className="code-card" aria-labelledby="h-code">
              <h2 id="h-code" className="code-card-label">
                Code d'accès de la table
              </h2>
              <p className="code-card-value">{vals.tableCode}</p>
              <p className="code-card-hint" role="status">
                {copyState === 'ok' ? 'Code copié ✓' : copyState === 'error' ? 'Copie impossible : notez le code à la main.' : 'À transmettre à vos joueurs'}
              </p>
              <div className="code-card-actions">
                <button type="button" className="primary-btn" style={{ width: 'auto' }} onClick={copyCode}>
                  Copier le code
                </button>
                <button type="button" className="secondary-btn" onClick={onManageCharacters}>
                  Personnages
                </button>
              </div>
            </section>

            <div className="section-head">
              <h2 className="section-label">Joueurs</h2>
              <p className="section-count">
                <strong>{vals.connectedCount}</strong> présent{vals.connectedCount > 1 ? 's' : ''} sur {vals.totalCount}
              </p>
            </div>
            <ul className="roster-list">
              {vals.roster.map((p) => {
                const member = demoMember(p.name)
                const companion = member && !member.played
                const character = member && vals.characters.find((c) => c.id === p.id)
                return (
                  <li key={p.id} className={`roster-row roster-row-wrap${p.connected || companion ? '' : ' offline'}`}>
                    <div className="roster-row-left">
                      <Avatar src={p.avatar} />
                      <div>
                        <h3 className="roster-name">{p.name}</h3>
                        <div className="roster-cls">
                          {member ? `${p.cls}, ${member.role}` : p.cls}
                        </div>
                      </div>
                    </div>
                    <span className={`roster-status${p.connected || companion ? '' : ' offline'}`}>
                      <span className="status-dot" aria-hidden="true" />
                      {companion ? 'Compagnon' : p.statusText}
                    </span>
                    <PvBar label={`Points de vie de ${p.name}`} current={p.pvCurrent} max={p.pvMax} ratio={p.pvRatio} statusKey={p.pvStatusKey} />
                    <PvStatusBadge statusKey={p.pvStatusKey} label={p.pvStatusLabel} />
                    {character && <DemoSkills character={character} characters={vals.characters} />}
                  </li>
                )
              })}
            </ul>

            {vals.npcRoster.length > 0 && (
              <>
                <div className="section-head">
                  <h2 className="section-label">PNJ en jeu</h2>
                  <p className="section-count">
                    <strong>{vals.npcRoster.filter((n) => !n.isDown).length}</strong> actif{vals.npcRoster.filter((n) => !n.isDown).length > 1 ? 's' : ''}
                  </p>
                </div>
                <ul className="roster-list">
                  {vals.npcRoster.map((n) => (
                    <li key={n.id} className="roster-row roster-row-wrap">
                      <div className="npc-head">
                        {demoNpc(n.name) && <Avatar src={demoNpc(n.name).avatar} size="sm" />}
                        <h3 className="roster-name" style={{ fontSize: 18 }}>
                          {n.name}
                        </h3>
                        <PvStatusBadge statusKey={n.pvStatusKey} label={n.pvStatusLabel} />
                      </div>
                      <PvBar label={`Points de vie de ${n.name}`} current={n.pvCurrent} max={n.pvMax} ratio={n.pvRatio} statusKey={n.pvStatusKey} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {vals.showAttackCard && (
              <div className="attack-card">
                <div className="attack-card-title">
                  <span>
                    ⚔️ {vals.attackAttackerEntity?.name} attaque {vals.attackDefenderEntity?.name}
                  </span>
                  {/* Filet de sécurité (V3 §5 v2) : débloque une séquence coincée en attente,
                      même sans résolution — sinon plus aucune attaque n'est possible. */}
                  <button className="modal-close" onClick={vals.cancelAttack} title="Annuler l'attaque" aria-label="Annuler l'attaque">
                    [X]
                  </button>
                </div>
                {vals.attack.outcome === 'pending-attack-roll' ? (
                  <div className="attack-card-status">En attente du jet d'attaque de {vals.attackAttackerEntity?.name}…</div>
                ) : vals.attack.outcome === 'pending-dodge' ? (
                  <div className="attack-card-status">
                    Touché ({vals.attackRollDegreeText})
                    {vals.attackPendingForNpcDefender ? (
                      <button className="secondary-btn" style={{ display: 'block', marginTop: 8 }} onClick={vals.rollNpcDodge} disabled={vals.npcDodging}>
                        🎲 Lancer l'esquive du PNJ
                      </button>
                    ) : (
                      " — en attente de l'esquive…"
                    )}
                  </div>
                ) : (
                  <>
                    <div className="attack-card-result">{vals.attackOutcomeText}</div>
                    <button className="secondary-btn" onClick={vals.dismissAttack}>
                      OK
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="gm-actions">
              <button className="primary-btn" onClick={vals.openLaunch}>
                Ordonner un test
              </button>
              <button className="secondary-btn" onClick={vals.openAttack}>
                Lancer une attaque
              </button>
            </div>
          </div>
        )}

        {vals.mjResults && (
          <div className="gm-body">
            <div className="results-header">
              <div>
                <div className="results-title">{vals.reqSkill}</div>
                {vals.reqMalus && <div className="results-subtitle">Malus {vals.reqMalus}</div>}
              </div>
              <div className="live-tag">
                <span className="live-dot" />
                EN DIRECT · {vals.receivedText}
              </div>
            </div>
            <div className="rolls-list">
              {vals.rollsList.map((r) => (
                <div key={r.id} className={`roll-row${r.isSuccess ? ' is-success' : r.isFail ? ' is-fail' : ''}`}>
                  <Avatar src={r.avatar} />
                  <div style={{ flex: 1 }}>
                    <div className="roll-row-name">{r.name}</div>
                    <div className="roll-row-cls">{r.cls}</div>
                  </div>
                  <div className="roll-row-result">
                    <div className="roll-row-label">
                      {r.label}
                    </div>
                    <div className="roll-row-degree">{r.degreeText}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="secondary-btn" onClick={vals.startNewTest} style={{ marginTop: 20 }}>
              ↩ Nouveau test
            </button>
          </div>
        )}

        {vals.showLaunch && <LaunchModal vals={vals} />}
        {vals.showAttack && <AttackModal vals={vals} />}
      </div>
      <div className="helper-text">Ordonnez un test → il apparaît sur le vox du joueur. Les jets remontent ici en direct.</div>
    </>
  )

  if (!scenario) return content
  return (
    <div className="demo-layout">
      <GuidedPanel vals={vals} scenario={scenario} />
      <div className="demo-main">{content}</div>
    </div>
  )
}
