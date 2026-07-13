import { useState } from 'react'
import Avatar from '../Avatar.jsx'
import { HIT_LOCATIONS } from '../gameLogic.js'

function CharacterEditPanel({ vals, character }) {
  const [bonusLabel, setBonusLabel] = useState('')
  const [bonusAmount, setBonusAmount] = useState('10')

  function prefillConstitution() {
    setBonusLabel('Constitution solide')
    setBonusAmount('10')
  }

  function addBonus() {
    const amount = Number(bonusAmount)
    if (!bonusLabel.trim() || !Number.isFinite(amount)) return
    vals.addPvBonus(character.id, bonusLabel.trim(), Math.round(amount))
    setBonusLabel('')
    setBonusAmount('10')
  }

  return (
    <div className="char-edit-panel">
      <div className="char-edit-row">
        <label className="char-edit-label">PV de base</label>
        <input
          className="text-input char-edit-input"
          type="number"
          defaultValue={character.pv.base}
          onBlur={(e) => vals.updatePvBase(character.id, Number(e.target.value))}
        />
      </div>
      <div className="char-edit-row">
        <label className="char-edit-label">PV actuels</label>
        <input
          className="text-input char-edit-input"
          type="number"
          defaultValue={character.pv.current}
          onBlur={(e) => vals.updatePvCurrent(character.id, Number(e.target.value))}
        />
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>
        Talents PV (PV max : {character.pv.max})
      </div>
      {character.pv.bonuses.length > 0 && (
        <div className="pv-bonus-list">
          {character.pv.bonuses.map((b, i) => (
            <div key={i} className="pv-bonus-row">
              <span>
                {b.label} · +{b.amount}
              </span>
              <button className="modal-close" onClick={() => vals.removePvBonus(character.id, i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="char-edit-row">
        <input className="text-input" placeholder="Libellé du talent" value={bonusLabel} onChange={(e) => setBonusLabel(e.target.value)} />
        <input
          className="text-input char-edit-input"
          type="number"
          value={bonusAmount}
          onChange={(e) => setBonusAmount(e.target.value)}
        />
      </div>
      <div className="char-edit-row">
        <button className="secondary-btn" onClick={prefillConstitution}>
          + Constitution solide
        </button>
        <button className="secondary-btn" onClick={addBonus}>
          Ajouter le talent
        </button>
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>
        Armure par localisation
      </div>
      <div className="armor-edit-grid">
        {HIT_LOCATIONS.map((loc) => (
          <div key={loc.key} className="char-edit-row">
            <label className="char-edit-label">{loc.label}</label>
            <input
              className="text-input char-edit-input"
              type="number"
              defaultValue={character.armor[loc.key] || 0}
              onBlur={(e) => vals.updateArmorLocation(character.id, loc.key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>
        Palier de talent d'esquive
      </div>
      <div className="malus-row">
        {[0, 10, 20].map((tier) => (
          <button
            key={tier}
            className={`malus-btn ${character.dodgeBonus === tier ? 'active' : ''}`}
            onClick={() => vals.updateDodgeBonus(character.id, tier)}
          >
            {tier === 0 ? '+0' : `+${tier}`}
          </button>
        ))}
      </div>
    </div>
  )
}

function NpcUploadForm({ vals }) {
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e) {
    e.preventDefault()
    if (!name.trim() || !file) {
      setError('Le nom du PNJ et un fichier sont requis.')
      return
    }
    setError('')
    setUploading(true)
    try {
      await vals.uploadNpc(name.trim(), file)
      setName('')
      setFile(null)
      e.target.reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload}>
      <input className="text-input" placeholder="Nom du PNJ" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="text-input" style={{ marginTop: 10 }} type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files[0] || null)} />
      {error && <div className="form-error">{error}</div>}
      <button className="primary-btn" style={{ marginTop: 14 }} type="submit" disabled={uploading}>
        {uploading ? 'Import en cours…' : '⇪ Importer la fiche PNJ'}
      </button>
    </form>
  )
}

export default function MjHome({ vals, onGoToDashboard }) {
  const [name, setName] = useState('')
  const [cls, setCls] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  async function handleUpload(e) {
    e.preventDefault()
    if (!name.trim() || !file) {
      setError('Le nom du personnage et un fichier sont requis.')
      return
    }
    setError('')
    setUploading(true)
    try {
      await vals.uploadCharacter(name.trim(), cls.trim(), file)
      setName('')
      setCls('')
      setFile(null)
      e.target.reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-stripe" />
      <div className="panel-titlebar">
        <div className="panel-titlebar-title">
          <div className="icon-diamond">
            <div className="d" />
            <div className="c" />
          </div>
          <span>Accueil MJ</span>
        </div>
        <span className="panel-titlebar-tag">Code {vals.tableCode}</span>
      </div>

      <div className="gm-body">
        <button className="secondary-btn" onClick={() => vals.resetTable()}>
          ↻ Créer une nouvelle table
        </button>

        <div className="section-label" style={{ marginTop: 24 }}>
          Uploader une fiche de personnage
        </div>
        <form onSubmit={handleUpload}>
          <input className="text-input" placeholder="Nom du personnage" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="text-input"
            style={{ marginTop: 10 }}
            placeholder="Carrière (optionnel)"
            value={cls}
            onChange={(e) => setCls(e.target.value)}
          />
          <input className="text-input" style={{ marginTop: 10 }} type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files[0] || null)} />
          {error && <div className="form-error">{error}</div>}
          <button className="primary-btn" style={{ marginTop: 14 }} type="submit" disabled={uploading}>
            {uploading ? 'Import en cours…' : '⇪ Importer la fiche'}
          </button>
        </form>

        <div className="section-label" style={{ marginTop: 24 }}>
          Fiches importées
        </div>
        {vals.characters.length === 0 ? (
          <div className="whoall-hint">Aucune fiche importée pour l'instant.</div>
        ) : (
          <div className="roster-list">
            {vals.characters.map((c) => (
              <div key={c.id} className="roster-item">
                <div className="roster-row">
                  <div className="roster-row-left">
                    <Avatar src={c.avatar} />
                    <div>
                      <div className="roster-name">{c.name}</div>
                      <div className="roster-cls">
                        {c.cls || 'Carrière non précisée'} · {c.skills.length} compétences importées · {c.pv.current}/{c.pv.max} PV
                      </div>
                    </div>
                  </div>
                  <div className="roster-actions">
                    <button className="roster-action-btn" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                      {expandedId === c.id ? '▾' : '▸'} PV / Armure
                    </button>
                    <button className="modal-close" onClick={() => vals.deleteCharacter(c.id)}>
                      ✕
                    </button>
                  </div>
                </div>
                {expandedId === c.id && <CharacterEditPanel vals={vals} character={c} />}
              </div>
            ))}
          </div>
        )}

        <div className="section-label" style={{ marginTop: 32 }}>
          🎯 PNJ / Ennemis
        </div>
        <NpcUploadForm vals={vals} />

        <div className="section-label" style={{ marginTop: 24 }}>
          PNJ importés
        </div>
        {vals.npcs.length === 0 ? (
          <div className="whoall-hint">Aucun PNJ importé pour l'instant.</div>
        ) : (
          <div className="roster-list">
            {vals.npcs.map((n) => (
              <div key={n.id} className="roster-item">
                <div className="roster-row">
                  <div className="roster-row-left">
                    <div>
                      <div className="roster-name">{n.name}</div>
                      <div className="roster-cls">
                        {n.weapons.length === 0
                          ? 'Aucune arme exploitable'
                          : n.weapons.map((w) => `${w.name} (${w.modeRaw || 'corps à corps'}, ${w.damage} dégâts)`).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <button className="modal-close" onClick={() => vals.deleteNpc(n.id)}>
                    ✕
                  </button>
                </div>
                <div className="char-edit-panel">
                  <div className="section-label">Palier d'esquive (repli non formé Agi ÷ 2 + ce bonus)</div>
                  <div className="malus-row">
                    {[0, 10, 20].map((tier) => (
                      <button
                        key={tier}
                        className={`malus-btn ${n.dodgeBonus === tier ? 'active' : ''}`}
                        onClick={() => vals.updateNpcDodgeBonus(n.id, tier)}
                      >
                        {tier === 0 ? '+0' : `+${tier}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {vals.characters.length > 0 && (
          <button className="primary-btn" style={{ marginTop: 20 }} onClick={onGoToDashboard}>
            → Aller au tableau de bord
          </button>
        )}
      </div>
    </div>
  )
}
