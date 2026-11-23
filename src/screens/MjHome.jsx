import { useState } from 'react'
import Avatar, { FictifBadge, Spinner } from '../Avatar.jsx'
import { HIT_LOCATIONS } from '../gameLogic.js'
import { AMBIANCES, AMBIANCE_PAR_DEFAUT, isAmbiance, nomAmbiance } from '../ambiances.js'

// Choix de l'ambiance (ticket 100), juste au dessus du bouton de création. Les
// pastilles et l'emblème montrent toujours les couleurs de chaque ambiance, quelle
// que soit l'ambiance active. Cyber est présélectionnée à chaque visite, sauf en
// démo où c'est l'ambiance du scénario (ticket 101).
function AmbiancePicker({ vals, onStayHome, ambianceInitiale }) {
  const [choix, setChoix] = useState(isAmbiance(ambianceInitiale) ? ambianceInitiale : AMBIANCE_PAR_DEFAUT)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'ok' | 'error', title?, text }

  async function create() {
    setCreating(true)
    setMessage(null)
    // Reste sur l'Accueil MJ : la nouvelle table est réamorcée, et sans cela l'écran
    // basculerait sur le tableau de bord avant d'afficher la confirmation.
    onStayHome?.()
    try {
      const data = await vals.resetTable(choix)
      setMessage({
        kind: 'ok',
        text: `Nouvelle table créée en ambiance ${nomAmbiance(data?.ambiance ?? choix)}. Transmettez le code ${data?.code ?? ''} à vos joueurs.`,
      })
    } catch (err) {
      setMessage(
        err.status === 400
          ? { kind: 'error', title: 'Ambiance inconnue.', text: "Choisissez l'une des cinq ambiances proposées. La table actuelle n'a pas changé." }
          : { kind: 'error', title: "La table n'a pas pu être créée.", text: "Vérifiez la connexion puis réessayez. La table actuelle n'a pas changé." },
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      {message?.kind === 'ok' && (
        <p className="ambiance-toast" role="status">
          <span className="ambiance-ok" aria-hidden="true">
            ✓
          </span>
          {message.text}
        </p>
      )}
      <fieldset className="ambiance-picker" disabled={creating}>
        <legend className="section-label">Ambiance de la table</legend>
        <p className="ambiance-hint">Toute la table verra cette ambiance. Pour en changer, il faudra créer une nouvelle table.</p>
        <div className="ambiance-grid">
          {AMBIANCES.map((a) => (
            <label key={a.id} className={`ambiance-option${choix === a.id ? ' selected' : ''}`}>
              <input type="radio" name="ambiance" value={a.id} checked={choix === a.id} onChange={() => setChoix(a.id)} />
              <span className="ambiance-swatches" aria-hidden="true">
                <i style={{ background: a.apercu.fond }} />
                <i style={{ background: a.apercu.surface }} />
                <i style={{ background: a.apercu.accent }} />
                <b className="ambiance-emblem" style={{ background: a.apercu.fond, color: a.apercu.accent }}>
                  {a.embleme}
                </b>
              </span>
              <span className="ambiance-option-name">{a.nom}</span>
              <span className="ambiance-option-desc">{a.description}</span>
              {choix === a.id && (
                <span className="ambiance-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </label>
          ))}
        </div>
        <button className="primary-btn" type="button" onClick={create}>
          {creating ? (
            <>
              <Spinner /> Création de la table en cours…
            </>
          ) : (
            '↻ Créer une nouvelle table'
          )}
        </button>
        {message?.kind === 'error' && (
          <div className="form-error" role="alert">
            <strong>{message.title}</strong> {message.text}
          </div>
        )}
      </fieldset>
    </>
  )
}

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
                [X]
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

// Encart Personnages fictifs (ticket 94), en haut de l'écran : retrait sans
// confirmation, car l'ajout répare l'action. Le bouton d'ajout n'apparaît que
// lorsqu'aucun fictif n'est présent.
function FictionalPanel({ vals }) {
  const [busy, setBusy] = useState(null) // null | 'remove' | 'add'
  const [message, setMessage] = useState(null) // { kind: 'ok' | 'error', text }
  const names = vals.fictionalCharacters.map((c) => c.name)

  async function remove() {
    setBusy('remove')
    setMessage(null)
    try {
      const { removed } = await vals.removeFictional()
      setMessage({
        kind: 'ok',
        text: `${removed > 1 ? `Les ${removed} personnages fictifs ont été retirés.` : 'Le personnage fictif a été retiré.'} Les autres personnages, les PNJ et le code de table sont inchangés.`,
      })
    } catch {
      setMessage({ kind: 'error', text: 'Impossible de retirer les personnages fictifs. Vérifiez la connexion puis réessayez.' })
    } finally {
      setBusy(null)
    }
  }

  async function add() {
    setBusy('add')
    setMessage(null)
    try {
      await vals.addFictional()
    } catch (err) {
      setMessage({ kind: 'error', text: `Impossible d'ajouter les personnages fictifs. ${err.message}` })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="fictifs-panel" aria-labelledby="h-fictifs">
      <h2 id="h-fictifs">Personnages fictifs</h2>
      {message?.kind === 'ok' && (
        <p className="msg-ok" role="status">
          ✓ {message.text}
        </p>
      )}
      {message?.kind === 'error' && (
        <p className="form-error" role="alert" style={{ margin: '0 0 12px' }}>
          {message.text}
        </p>
      )}
      {names.length > 0 ? (
        <>
          <p className="whoall-hint" style={{ margin: 0 }}>
            {names.length > 1 ? `${names.length} personnages fictifs sont` : 'Un personnage fictif est'} à la table pour tester seul. Retirez les avant une vraie partie.
          </p>
          <div className="fictifs-names">
            {names.map((n) => (
              <span key={n} className="badge-fictif">
                {n}
              </span>
            ))}
          </div>
          <button type="button" className="danger-outline-btn" onClick={remove} disabled={busy !== null}>
            {busy === 'remove' ? (
              <>
                <Spinner />
                Retrait en cours…
              </>
            ) : (
              'Retirer les personnages fictifs'
            )}
          </button>
        </>
      ) : vals.fictionalEnabled ? (
        <>
          <p className="whoall-hint" style={{ margin: '0 0 12px' }}>
            Aucun personnage fictif à la table.
          </p>
          <button type="button" className="secondary-btn" onClick={add} disabled={busy !== null}>
            {busy === 'add' ? (
              <>
                <Spinner />
                Ajout en cours…
              </>
            ) : (
              'Ajouter les personnages fictifs'
            )}
          </button>
        </>
      ) : (
        <p className="whoall-hint" style={{ margin: 0 }}>
          Les personnages fictifs sont désactivés sur ce serveur.
        </p>
      )}
    </section>
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

export default function MjHome({ vals, onGoToDashboard, onStayHome, ambianceInitiale }) {
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
        <span className="panel-titlebar-tag">
          Code {vals.tableCode} · {nomAmbiance(vals.ambiance)}
        </span>
      </div>

      <div className="gm-body">
        <AmbiancePicker vals={vals} onStayHome={onStayHome} ambianceInitiale={ambianceInitiale} />

        <div style={{ marginTop: 24 }}>
          <FictionalPanel vals={vals} />
        </div>

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
                    <Avatar src={c.avatar} fictional={c.fictional} />
                    <div>
                      <div className="roster-name">
                        {c.name}
                        {c.fictional && <FictifBadge />}
                      </div>
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
                      [X]
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
                    [X]
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
