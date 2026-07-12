import { useState } from 'react'
import Avatar from '../Avatar.jsx'

export default function JoinTable({ vals }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

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
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex. XR-4417"
          autoCapitalize="characters"
        />
        {error && <div className="form-error">{error}</div>}

        <div className="section-label" style={{ marginTop: 20 }}>
          Choisir son personnage
        </div>
        {vals.characters.length === 0 ? (
          <div className="whoall-hint">Aucune fiche n'a encore été importée par le MJ.</div>
        ) : (
          <div className="selectable-list">
            {vals.characters.map((c) => (
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
