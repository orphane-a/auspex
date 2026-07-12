export default function AttackModal({ vals }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="panel-stripe" />
        <div className="modal-titlebar">
          <span>🎯 Attaque ennemie</span>
          <button className="modal-close" onClick={vals.closeAttack}>
            ✕
          </button>
        </div>
        <div className="modal-content">
          <div className="section-label">Cible</div>
          {vals.attackTargetOptions.length === 0 ? (
            <div className="whoall-hint">Aucun joueur connecté à cibler.</div>
          ) : (
            <div className="selectable-list">
              {vals.attackTargetOptions.map((t) => (
                <button key={t.id} className={`selectable-row ${t.isActive ? 'chosen' : ''}`} onClick={t.select}>
                  <span className={`checkbox ${t.isActive ? 'chosen' : ''}`} />
                  <span className={`selectable-label ${t.isActive ? 'chosen' : ''}`}>{t.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="section-label" style={{ marginTop: 4 }}>
            PNJ attaquant
          </div>
          {vals.npcOptions.length === 0 ? (
            <div className="whoall-hint">Aucun PNJ importé — ajoutez-en un depuis l'écran Personnages.</div>
          ) : (
            <div className="chip-row">
              {vals.npcOptions.map((n) => (
                <button key={n.id} className={`chip ${n.isActive ? 'active' : ''}`} onClick={n.select}>
                  {n.name}
                </button>
              ))}
            </div>
          )}

          {vals.npcOptions.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 4 }}>
                Arme
              </div>
              {vals.weaponOptions.length === 0 ? (
                <div className="whoall-hint">Ce PNJ n'a aucune arme utilisable pour cette séquence.</div>
              ) : (
                <div className="chip-row">
                  {vals.weaponOptions.map((w) => (
                    <button key={w.name} className={`chip ${w.isActive ? 'active' : ''}`} onClick={w.select}>
                      {w.name}
                    </button>
                  ))}
                </div>
              )}

              {vals.weaponOptions.length > 0 && (
                <>
                  <div className="section-label" style={{ marginTop: 4 }}>
                    Mode de tir
                  </div>
                  <div className="who-row">
                    {vals.fireModeOptions.map((m) => (
                      <button key={m.key} className={`who-btn ${m.isActive ? 'active' : ''}`} onClick={m.select}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {vals.attackError && <div className="form-error">{vals.attackError}</div>}

          <button
            className="primary-btn"
            style={{ marginTop: 16 }}
            disabled={vals.attackTargetOptions.length === 0 || vals.weaponOptions.length === 0 || vals.fireModeOptions.length === 0}
            onClick={vals.launchAttack}
          >
            ▶ Lancer l'attaque
          </button>
        </div>
      </div>
    </div>
  )
}
