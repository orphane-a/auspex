import { useState } from 'react'

export default function LaunchModal({ vals }) {
  const [skillTab, setSkillTab] = useState('all')
  const activeGroups =
    skillTab === 'all' ? vals.skillGroups : vals.skillGroupsByCharacter.find((c) => c.id === skillTab)?.groups || []

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="panel-stripe" />
        <div className="modal-titlebar">
          <span>Ordonner un test</span>
          <button className="modal-close" onClick={vals.closeLaunch}>
            ✕
          </button>
        </div>
        <div className="modal-content">
          <div className="section-label">Compétence à tester</div>
          <div className="skill-tab-row">
            <button className={`skill-tab ${skillTab === 'all' ? 'active' : ''}`} onClick={() => setSkillTab('all')}>
              Toutes
            </button>
            {vals.skillGroupsByCharacter.map((c) => (
              <button key={c.id} className={`skill-tab ${skillTab === c.id ? 'active' : ''}`} onClick={() => setSkillTab(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          {activeGroups.length === 0 ? (
            <div className="whoall-hint">Aucune compétence pour ce personnage.</div>
          ) : (
            activeGroups.map((group) => (
              <div key={group.characteristic} className="char-group">
                <div className="char-group-label">{group.characteristicName}</div>
                <div className="chip-row">
                  {group.chips.map((c) => (
                    <button key={c.name} className={`chip ${c.isActive ? 'active' : ''}`} onClick={c.select}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="section-label">Malus</div>
          <div className="malus-row">
            {vals.malusOpts.map((m) => (
              <button key={m.label} className={`malus-btn ${m.isActive ? 'active' : ''}`} onClick={m.set}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="section-label">Joueurs concernés</div>
          <div className="who-row">
            <button className={`who-btn ${vals.whoMode === 'all' ? 'active' : ''}`} onClick={vals.setWhoAll}>
              Toute l'équipe
            </button>
            <button className={`who-btn ${vals.whoMode === 'some' ? 'active' : ''}`} onClick={vals.setWhoSome}>
              Sélection
            </button>
          </div>

          {vals.whoMode === 'some' ? (
            <div className="selectable-list">
              {vals.selectable.map((p) => (
                <button key={p.id} className={`selectable-row ${p.isChosen ? 'chosen' : ''}`} onClick={p.toggle}>
                  <span className={`checkbox ${p.isChosen ? 'chosen' : ''}`} />
                  <span className={`selectable-label ${p.isChosen ? 'chosen' : ''}`}>{p.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="whoall-hint">Concerne toute l'équipe connectée ({vals.connectedCount} joueurs).</div>
          )}

          <button className="primary-btn" onClick={vals.sendRequest}>
            ▶ Transmettre l'ordre
          </button>
        </div>
      </div>
    </div>
  )
}
