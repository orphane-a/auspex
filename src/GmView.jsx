import Avatar from './Avatar.jsx'
import LaunchModal from './LaunchModal.jsx'
import AttackModal from './AttackModal.jsx'

export default function GmView({ vals, onManageCharacters }) {
  return (
    <>
      <div className="panel">
        <div className="panel-stripe" />
        <div className="panel-titlebar">
          <div className="panel-titlebar-title">
            <div className="icon-diamond">
              <div className="d" />
              <div className="c" />
            </div>
            <span>Code {vals.tableCode}</span>
          </div>
          <button className="reset-btn" onClick={onManageCharacters}>
            ⚙ Personnages
          </button>
        </div>

        {vals.mjDashboard && (
          <div className="gm-body">
            <div className="gm-top-row">
              <div className="code-card">
                <div className="code-card-label">Code d'accès de la table</div>
                <div className="code-card-value">{vals.tableCode}</div>
                <div className="code-card-hint">À transmettre à vos joueurs · ⎘ Copier</div>
              </div>
              <div className="count-card">
                <div className="count-card-value">
                  {vals.connectedCount}
                  <span> / {vals.totalCount} présents</span>
                </div>
                <div className="count-bar">
                  <div
                    className="count-bar-fill"
                    style={{ width: `${vals.totalCount ? Math.round((vals.connectedCount / vals.totalCount) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="section-label">Ordre de bataille</div>
            <div className="roster-list">
              {vals.roster.map((p) => (
                <div key={p.id} className="roster-row roster-row-wrap" style={{ opacity: p.op }}>
                  <div className="roster-row-left">
                    <Avatar src={p.avatar} />
                    <div>
                      <div className="roster-name">{p.name}</div>
                      <div className="roster-cls">{p.cls}</div>
                    </div>
                  </div>
                  <span className="roster-status" style={{ color: p.statusCol }}>
                    <span className="status-dot" style={{ background: p.dot }} />
                    {p.statusText}
                  </span>
                  <div className="roster-pv-block">
                    <div className="roster-pv-bar">
                      <div className={`roster-pv-bar-fill pv-${p.pvStatusKey}`} style={{ width: `${p.pvRatio * 100}%` }} />
                    </div>
                    <div className="roster-pv-label">
                      {p.pvCurrent} / {p.pvMax} PV · <span className={`pv-tag pv-${p.pvStatusKey}`}>{p.pvStatusLabel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {vals.npcRoster.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: 16 }}>
                  PNJ en jeu
                </div>
                <div className="roster-list">
                  {vals.npcRoster.map((n) => (
                    <div key={n.id} className="roster-row roster-row-wrap">
                      <div className="roster-row-left">
                        <div className="roster-name">{n.name}</div>
                      </div>
                      <div className="roster-pv-block">
                        <div className="roster-pv-bar">
                          <div className={`roster-pv-bar-fill pv-${n.pvStatusKey}`} style={{ width: `${n.pvRatio * 100}%` }} />
                        </div>
                        <div className="roster-pv-label">
                          {n.pvCurrent} / {n.pvMax} PV · <span className={`pv-tag pv-${n.pvStatusKey}`}>{n.pvStatusLabel}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {vals.showAttackCard && (
              <div className="attack-card">
                <div className="attack-card-title">
                  ⚔️ {vals.attackAttackerEntity?.name} attaque {vals.attackDefenderEntity?.name}
                </div>
                {vals.attack.outcome === 'pending-attack-roll' ? (
                  <div className="attack-card-status">En attente du jet d'attaque de {vals.attackAttackerEntity?.name}…</div>
                ) : vals.attack.outcome === 'pending-dodge' ? (
                  <div className="attack-card-status">
                    {vals.attackPendingForNpcDefender ? (
                      <button className="secondary-btn" onClick={vals.rollNpcDodge} disabled={vals.npcDodging}>
                        🎲 Lancer l'esquive du PNJ
                      </button>
                    ) : (
                      "En attente de l'esquive…"
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

            <button className="primary-btn" onClick={vals.openLaunch}>
              ⚔ Ordonner un test
            </button>
            <button className="secondary-btn" style={{ marginTop: 10 }} onClick={vals.openAttack}>
              ⚔️ Attaque
            </button>
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
                <div key={r.id} className="roll-row" style={{ borderColor: r.borderCol, background: r.bgCol }}>
                  <Avatar src={r.avatar} />
                  <div style={{ flex: 1 }}>
                    <div className="roll-row-name">{r.name}</div>
                    <div className="roll-row-cls">{r.cls}</div>
                  </div>
                  <div className="roll-row-result">
                    <div className="roll-row-label" style={{ color: r.textCol }}>
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
}
