import { useEffect, useState } from 'react'
import Avatar from '../Avatar.jsx'
import { nomAmbiance } from '../ambiances.js'

// En démo (ticket 97), `lockedCode` est le code de la table de démo : il est déjà
// rempli et ne se modifie pas. Hors démo, le joueur tape le code donné par le MJ.
export default function JoinTable({ vals, lockedCode, onCodeStatus }) {
  const [typedCode, setCode] = useState('')
  const code = lockedCode ?? typedCode
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  // Ticket 100 : dès que le code correspond à la table, l'écran en prend l'ambiance
  // (App.jsx) ; un code complet mais faux est signalé tout de suite.
  const tableCode = (vals.tableCode || '').toUpperCase()
  const typed = code.trim().toUpperCase()
  const codeOk = tableCode !== '' && typed === tableCode
  const codeFaux = !codeOk && tableCode !== '' && typed.length >= tableCode.length
  useEffect(() => {
    onCodeStatus?.(codeOk)
  }, [codeOk, onCodeStatus])

  async function handlePick(characterId) {
    if (!code.trim()) {
      setError('Entrez le code fourni par le MJ.')
      return
    }
    setError('')
    setJoining(true)
    try {
      await vals.joinTable(code.trim(), characterId)
    } catch (err) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="player-card">
      <div className="player-body">
        <div className="section-label">Code de la table</div>
        <input
          className="text-input"
          aria-label="Code de la table"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          readOnly={lockedCode != null}
          placeholder="Ex. XR-4417"
          autoCapitalize="characters"
        />
        {codeOk && (
          <p className="join-found" role="status">
            <span className="ambiance-ok" aria-hidden="true">
              ✓
            </span>
            Table trouvée, ambiance {nomAmbiance(vals.ambiance)}
          </p>
        )}
        {codeFaux && !error && (
          <div className="form-error" role="alert">
            Code inconnu. Vérifiez le code donné par le MJ.
          </div>
        )}
        {error && <div className="form-error">{error}</div>}

        <div className="section-label" style={{ marginTop: 20 }}>
          Choisir son personnage
        </div>
        {vals.joinableCharacters.length === 0 ? (
          <div className="whoall-hint">Aucune fiche n'a encore été importée par le MJ.</div>
        ) : (
          <div className="selectable-list">
            {vals.joinableCharacters.map((c) => (
              <button key={c.id} className="selectable-row" disabled={joining} onClick={() => handlePick(c.id)}>
                <Avatar src={c.avatar} />
                <span className="selectable-label chosen">{c.name}</span>
                <span className="roster-cls" style={{ marginLeft: 8 }}>
                  {c.cls}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
