import { useState } from 'react'
import Avatar from './Avatar.jsx'
import CharacteristicsRadar from './CharacteristicsRadar.jsx'
import PvBar, { PvStatusBadge } from './PvBar.jsx'

export default function PlayerView({ vals }) {
  const [showArmor, setShowArmor] = useState(false)
  const [showSkills, setShowSkills] = useState(true)
  const myChar = vals.myCharacter

  return (
    <div className="player-card">
      <section className="player-header" aria-labelledby="h-perso">
        <div className="player-header-left">
          <Avatar src={vals.me.avatar} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="h-perso" className="player-header-name">
              {vals.me.name}
            </h2>
            <p className="player-header-cls">
              {vals.me.cls} · Table <span className="player-header-code">{vals.tableCode}</span>
            </p>
            {myChar && <PvStatusBadge statusKey={vals.myPvStatus.key} label={vals.myPvStatus.label} />}
          </div>
        </div>
        {myChar && (
          <PvBar large label={`Points de vie de ${vals.me.name}`} current={myChar.pv.current} max={myChar.pv.max} ratio={vals.myPvRatio} statusKey={vals.myPvStatus.key} />
        )}
      </section>

      {vals.isMeDown && (
        <div className="down-banner" role="alert">
          Hors de combat
        </div>
      )}
      {vals.damageNoticeText && (
        <div className="damage-notice" role="status">
          {vals.damageNoticeText}
        </div>
      )}
      {vals.attackAttackerNoticeText && (
        <div className="damage-notice" role="status">
          {vals.attackAttackerNoticeText}
        </div>
      )}

      {/* Même encart "X attaque Y" que la vue MJ, sur tous les écrans joueur liés à
          l'attaque — le sens du combat doit rester clair même quand ce n'est pas au
          joueur d'agir (retour MJ). */}
      {(vals.attackPendingForMeAsAttacker || vals.attackWaitingForDodgeAsAttacker || vals.attackPendingForMe || vals.attackResolvedForMe) && (
        <div className="attack-card">
          <div className="attack-card-title">
            <span>⚔️ {vals.attackDirectionText}</span>
          </div>
        </div>
      )}

      {vals.pScreenMain && (
        <div className="player-body">
          <p className="pending-banner" role="status" style={{ margin: 0 }}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            En attente d'un ordre du Maître de Jeu.
          </p>
          {vals.characteristicTendencies.length >= 3 && (
            <>
              <h2 className="section-title">Caractéristiques</h2>
              <div className="radar-card">
                <CharacteristicsRadar tendencies={vals.characteristicTendencies} />
              </div>
            </>
          )}
          <h2 className="section-title">Équipement et compétences</h2>
          <button className="armor-toggle" aria-expanded={showArmor} aria-controls="armor-list" onClick={() => setShowArmor((s) => !s)}>
            Armure
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {showArmor && (
            <div className="armor-list" id="armor-list">
              {vals.myArmorList.map((a) => (
                <div key={a.key} className="armor-row">
                  <span>{a.label}</span>
                  <span>{a.value}</span>
                </div>
              ))}
            </div>
          )}
          <button className="armor-toggle" aria-expanded={showSkills} aria-controls="skills-panel" onClick={() => setShowSkills((s) => !s)}>
            Compétences
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {showSkills && (
            <div className="skills-panel" id="skills-panel">
              {vals.mySkillGroups.map((group) => (
                <div key={group.characteristic} className="char-group">
                  <h3 className="char-group-label skill-group-label">{group.characteristicName}</h3>
                  <ul className="skills-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {group.skills.map((skill) => (
                      <li key={skill} className="skill-row">
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vals.attackPendingForMeAsAttacker && (
        <div className="request-screen">
          <div className="order-badge">➤ Vous attaquez</div>
          <div className="request-skill">Test de Dextérité</div>

          <div className="stat-pill-row">
            <div className="stat-pill">
              <div className="stat-pill-label">Arme</div>
              <div className="stat-pill-value">{vals.attack.weaponName}</div>
            </div>
            <div className="stat-pill stat-pill-highlight">
              <div className="stat-pill-label">Seuil</div>
              <div className="stat-pill-value">{vals.attackAttackerThreshold}</div>
            </div>
            <div className="stat-pill">
              <div className="stat-pill-label">Mod</div>
              <div className="stat-pill-value">+00</div>
            </div>
          </div>

          {!vals.rollingAttack && (
            <>
              <pre className="dice-art">{'┌───────────┐\n│  ▖ 1d100 ▗ │\n│  ░░▓██▓░░  │\n│  > ROLL <  │\n└───────────┘'}</pre>
              <button className="roll-button" onClick={vals.rollAttack}>
                <div className="glyph">➤</div>
                <div className="label">LANCER</div>
                <div className="roll-button-sub">1d100</div>
              </button>
            </>
          )}
          {vals.rollingAttack && (
            <div className="rolling-circle">
              <div className="glyph">⚄</div>
            </div>
          )}
          <div className="request-hint">Réussite si résultat ≤ {vals.attackAttackerThreshold}.</div>
        </div>
      )}

      {vals.attackWaitingForDodgeAsAttacker && (
        <div className="request-screen">
          <div className="order-badge">⚔ Touché ! ({vals.attackRollDegreeText})</div>
          <div className="attack-card-status" style={{ marginTop: 12 }}>
            En attente de l'esquive de {vals.attackDefenderEntity?.name}…
          </div>
        </div>
      )}

      {vals.attackPendingForMe && (
        <div className="request-screen incoming-attack">
          <div className="incoming-attack-banner">⚠ Attaque entrante</div>
          <div className="order-badge">
            {vals.attackAttackerEntity?.name} · {vals.attack.weaponName} · {vals.attackFireModeLabel}
          </div>
          <div className="request-skill">Esquive</div>

          <div className="stat-pill-row">
            <div className="stat-pill stat-pill-highlight">
              <div className="stat-pill-label">Seuil</div>
              <div className="stat-pill-value">{vals.attackDefenderThreshold}</div>
            </div>
            <div className="stat-pill">
              <div className="stat-pill-label">Agi</div>
              <div className="stat-pill-value">{vals.myCharacter?.characteristics?.Agi ?? 0}</div>
            </div>
            <div className="stat-pill">
              <div className="stat-pill-label">Mod</div>
              <div className="stat-pill-value">+00</div>
            </div>
          </div>

          {!vals.dodging && (
            <>
              <pre className="dice-art danger">{'┌───────────┐\n│  ▖ 1d100 ▗ │\n│  ░░▓██▓░░  │\n│ > DODGE <  │\n└───────────┘'}</pre>
              <button className="roll-button danger" onClick={vals.rollDodge}>
                <div className="glyph">↯</div>
                <div className="label">ESQUIVER</div>
                <div className="roll-button-sub">1d100</div>
              </button>
            </>
          )}
          {vals.dodging && (
            <div className="rolling-circle danger">
              <div className="glyph">⚄</div>
            </div>
          )}
          <div className="request-hint">Esquive réussie si résultat ≤ {vals.attackDefenderThreshold}.</div>
        </div>
      )}

      {vals.attackResolvedForMe && (
        <div className="player-body">
          <div className={`result-card ${vals.attack.outcome === 'hit' ? 'is-fail' : 'is-success'}`}>
            {vals.attack.outcome !== 'hit' && <div className="result-card-skill">Esquive</div>}
            <div className="result-card-label">
              {vals.attackOutcomeText}
            </div>
          </div>
          <button className="back-btn" onClick={vals.dismissAttack}>
            ← Mes compétences
          </button>
        </div>
      )}

      {vals.pScreenRequest && (
        <div className="request-screen">
          <div className="order-badge">✦ Ordre du MJ</div>
          <div className="request-skill">{vals.reqSkill}</div>
          {vals.reqMalus && <div className="request-flavor">Malus {vals.reqMalus}</div>}

          {vals.showRollBtn && (
            <>
              <pre className="dice-art">{'┌───────────┐\n│  ▖ 1d100 ▗ │\n│  ░░▓██▓░░  │\n│  > ROLL <  │\n└───────────┘'}</pre>
              <button className="roll-button" onClick={vals.rollDice}>
                <div className="glyph">⚄</div>
                <div className="label">LANCER</div>
              </button>
            </>
          )}
          {vals.rolling && (
            <div className="rolling-circle">
              <div className="glyph">⚄</div>
            </div>
          )}
          <div className="request-hint">Le seuil est calculé pour vous.</div>
        </div>
      )}

      {vals.pScreenResult && (
        <div className="player-body">
          {/* useTableState n'expose pas isSuccess pour mon propre jet : on relit le libellé de statusMeta(). */}
          <div className={`result-card${vals.myLabel === 'RÉUSSITE' ? ' is-success' : vals.myLabel === 'ÉCHEC' ? ' is-fail' : ''}`}>
            <div className="result-card-skill">{vals.reqSkill}</div>
            <div className="result-card-label">
              {vals.myLabel}
            </div>
            <div className="result-card-degree">{vals.myDegree}</div>
          </div>
          <div className="section-label">Le reste de l'escouade</div>
          <div className="teammates-list">
            {vals.teammates.map((t) => (
              <div key={t.id} className={`teammate-row${t.isSuccess ? ' is-success' : t.isFail ? ' is-fail' : ''}`}>
                <div className="teammate-row-left">
                  <Avatar src={t.avatar} size="sm" />
                  <span className="teammate-name">{t.name}</span>
                </div>
                <div className="teammate-result">
                  <div className="teammate-label">
                    {t.label}
                  </div>
                  <div className="teammate-degree">{t.degreeText}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="back-btn" onClick={vals.dismissResult}>
            ← Mes compétences
          </button>
        </div>
      )}
    </div>
  )
}
