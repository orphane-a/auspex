import Avatar from './Avatar.jsx'

function EntityPickRow({ label, options, emptyHint }) {
  return (
    <>
      <div className="section-label" style={{ marginTop: 4 }}>
        {label}
      </div>
      {options.length === 0 ? (
        <div className="whoall-hint">{emptyHint}</div>
      ) : (
        <div className="entity-pick-row">
          {options.map((o) => (
            <button key={`${label}-${o.id}`} className={`entity-pick ${o.isActive ? 'active' : ''}`} onClick={o.select}>
              <Avatar src={o.avatar} />
              <span>
                {o.name}
                {!o.connected ? ' (non connecté)' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default function AttackModal({ vals }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="panel-stripe" />
        <div className="modal-titlebar">
          <span>◈ Engager le combat</span>
          <button className="modal-close" onClick={vals.closeAttack}>
            [X]
          </button>
        </div>
        <div className="modal-content">
          <div className="duel-preview">
            <div className="duel-card duel-card-attacker">
              <div className="duel-card-label">Attaquant</div>
              <Avatar src={vals.attackModalAttackerEntity?.avatar} />
              <div className="duel-card-name">{vals.attackModalAttackerEntity?.name ?? '—'}</div>
              <div className="duel-card-stat">DEX {vals.attackModalAttackerThreshold}</div>
            </div>
            <div className="duel-arrow">
              <span>➤</span>
              <span>ENGAGE</span>
            </div>
            <div className="duel-card duel-card-defender">
              <div className="duel-card-label">Cible</div>
              <Avatar src={vals.attackModalDefenderEntity?.avatar} />
              <div className="duel-card-name">{vals.attackModalDefenderEntity?.name ?? '—'}</div>
              <div className="duel-card-stat">ESQ {vals.attackModalDefenderThreshold}</div>
            </div>
          </div>

          <EntityPickRow label="Attaquant — PNJ" options={vals.attackerNpcOptions} emptyHint="Aucun PNJ importé." />
          <EntityPickRow label="Attaquant — Joueurs" options={vals.attackerCharacterOptions} emptyHint="Aucun personnage importé." />
          <EntityPickRow label="Cible — PNJ" options={vals.defenderNpcOptions} emptyHint="Aucun PNJ importé." />
          <EntityPickRow label="Cible — Joueurs" options={vals.defenderCharacterOptions} emptyHint="Aucun personnage importé." />

          {vals.weaponOptions.length > 0 ? (
            <>
              <div className="section-label" style={{ marginTop: 12 }}>
                Arme
              </div>
              <div className="weapon-row-list">
                {vals.weaponOptions.map((w) => (
                  <button key={w.name} className={`weapon-row ${w.isActive ? 'active' : ''}`} onClick={w.select}>
                    <span>
                      <span className="weapon-row-name">{w.name}</span>
                      <span className="weapon-row-modes">{w.modesText}</span>
                    </span>
                    <span className="weapon-row-damage">{w.damage} dégâts</span>
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
            ➤ Engager le combat
          </button>
        </div>
      </div>
    </div>
  )
}
