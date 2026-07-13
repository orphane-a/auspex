export default function AttackModal({ vals }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet hud-corners">
        <div className="panel-stripe" />
        <div className="modal-titlebar">
          <span>⚔️ Attaque</span>
          <button className="modal-close" onClick={vals.closeAttack}>
            ✕
          </button>
        </div>
        <div className="modal-content">
          <div className="section-label">Attaquant — PNJ</div>
          {vals.attackerNpcOptions.length === 0 ? (
            <div className="whoall-hint">Aucun PNJ importé.</div>
          ) : (
            <div className="chip-row">
              {vals.attackerNpcOptions.map((n) => (
                <button key={`atk-npc-${n.id}`} className={`chip ${n.isActive ? 'active' : ''}`} onClick={n.select}>
                  {n.name}
                </button>
              ))}
            </div>
          )}

          <div className="section-label" style={{ marginTop: 4 }}>
            Attaquant — Joueurs
          </div>
          {vals.attackerCharacterOptions.length === 0 ? (
            <div className="whoall-hint">Aucun personnage importé.</div>
          ) : (
            <div className="chip-row">
              {vals.attackerCharacterOptions.map((c) => (
                <button key={`atk-char-${c.id}`} className={`chip ${c.isActive ? 'active' : ''}`} onClick={c.select}>
                  {c.name}
                  {!c.connected ? ' (non connecté)' : ''}
                </button>
              ))}
            </div>
          )}

          <div className="section-label" style={{ marginTop: 12 }}>
            Cible — PNJ
          </div>
          {vals.defenderNpcOptions.length === 0 ? (
            <div className="whoall-hint">Aucun PNJ importé.</div>
          ) : (
            <div className="chip-row">
              {vals.defenderNpcOptions.map((n) => (
                <button key={`def-npc-${n.id}`} className={`chip ${n.isActive ? 'active' : ''}`} onClick={n.select}>
                  {n.name}
                </button>
              ))}
            </div>
          )}

          <div className="section-label" style={{ marginTop: 4 }}>
            Cible — Joueurs
          </div>
          {vals.defenderCharacterOptions.length === 0 ? (
            <div className="whoall-hint">Aucun personnage importé.</div>
          ) : (
            <div className="chip-row">
              {vals.defenderCharacterOptions.map((c) => (
                <button key={`def-char-${c.id}`} className={`chip ${c.isActive ? 'active' : ''}`} onClick={c.select}>
                  {c.name}
                  {!c.connected ? ' (non connecté)' : ''}
                </button>
              ))}
            </div>
          )}

          {vals.weaponOptions.length > 0 ? (
            <>
              <div className="section-label" style={{ marginTop: 12 }}>
                Arme
              </div>
              <div className="chip-row">
                {vals.weaponOptions.map((w) => (
                  <button key={w.name} className={`chip ${w.isActive ? 'active' : ''}`} onClick={w.select}>
                    {w.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="whoall-hint" style={{ marginTop: 12 }}>
              Cet attaquant n'a aucune arme utilisable pour cette séquence.
            </div>
          )}

          {vals.fireModeOptions.length > 0 && (
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

          {vals.attackerIsDefender && <div className="form-error">Un combattant ne peut pas s'attaquer lui-même.</div>}
          {vals.attackerCharacterDisconnected && (
            <div className="form-error">L'attaquant n'est pas connecté — il ne pourra pas lancer son propre jet.</div>
          )}
          {vals.defenderCharacterDisconnected && (
            <div className="form-error">Ce joueur n'est pas connecté — l'attaque ne peut pas être lancée.</div>
          )}
          {vals.attackError && <div className="form-error">{vals.attackError}</div>}

          <button className="primary-btn" style={{ marginTop: 16 }} disabled={vals.attackLaunchDisabled} onClick={vals.launchAttack}>
            ▶ Lancer l'attaque
          </button>
        </div>
      </div>
    </div>
  )
}
