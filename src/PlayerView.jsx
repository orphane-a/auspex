import { useState } from 'react'
import Avatar from './Avatar.jsx'
import CharacteristicsRadar from './CharacteristicsRadar.jsx'
import { asciiBar } from './gameLogic.js'

export default function PlayerView({ vals }) {
  const [showArmor, setShowArmor] = useState(false)
  const [showSkills, setShowSkills] = useState(true)
  const myChar = vals.myCharacter

  return (
    <div className="player-card">
      <div className="player-header">
        <div className="player-header-left">
          <Avatar src={vals.me.avatar} />
          <div>
            <div className="player-header-name">{vals.me.name}</div>
            <div className="player-header-cls">{vals.me.cls}</div>
          </div>
        </div>
        <span className="player-header-code">
          <span className="status-dot" />
          {vals.tableCode}
        </span>
      </div>

      {myChar && (
        <div className="player-pv-strip">
          <div className="ascii-bar">
            PV[<span className={`pv-tag pv-${vals.myPvStatus.key}`}>{asciiBar(vals.myPvRatio).filled}</span>
            {asciiBar(vals.myPvRatio).empty}] {myChar.pv.current}/{myChar.pv.max}
          </div>
          <div className="roster-pv-label">
            <span className={`pv-tag pv-${vals.myPvStatus.key}`}>{vals.myPvStatus.label}</span>
          </div>
        </div>
      )}

      {vals.isMeDown && <div className="down-banner">☠ HORS DE COMBAT</div>}
      {vals.damageNoticeText && <div className="damage-notice">{vals.damageNoticeText}</div>}
      {vals.attackAttackerNoticeText && <div className="damage-notice">{vals.attackAttackerNoticeText}</div>}

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
          {vals.characteristicTendencies.length >= 3 && (
            <div className="radar-card">
              <CharacteristicsRadar tendencies={vals.characteristicTendencies} />
            </div>
          )}
          <div className="pending-banner">
            <span className="glyph">◈</span>
            En attente d'un ordre du Maître de Jeu.
          </div>
          <button className="armor-toggle" onClick={() => setShowArmor((s) => !s)}>
            {showArmor ? '▾' : '▸'} Armure
          </button>
          <button className="armor-toggle" onClick={() => setShowSkills((s) => !s)}>
            {showSkills ? '▾' : '▸'} Compétences
          </button>

          {showArmor && (
            <div className="armor-list">
              {vals.myArmorList.map((a) => (
                <div key={a.key} className="armor-row">
                  <span>{a.label}</span>
                  <span>{a.value}</span>
                </div>
              ))}
            </div>
          )}
          {showSkills &&
            vals.mySkillGroups.map((group) => (
              <div key={group.characteristic} className="char-group">
                <div className="char-group-label skill-group-label">{group.characteristicName}</div>
                <div className="skills-list">
                  {group.skills.map((skill) => (
                    <div key={skill} className="skill-row">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
          <div className="result-card" style={{ borderColor: vals.attack.outcome === 'hit' ? 'rgba(192,96,58,.5)' : 'rgba(77,255,143,.5)' }}>
            {vals.attack.outcome !== 'hit' && <div className="result-card-skill">Esquive</div>}
            <div className="result-card-label" style={{ color: vals.attack.outcome === 'hit' ? '#ff9d6f' : '#4dff8f' }}>
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
          <div className="result-card" style={{ borderColor: vals.myBorder, background: vals.myBg }}>
            <div className="result-card-skill">{vals.reqSkill}</div>
            <div className="result-card-label" style={{ color: vals.myText }}>
              {vals.myLabel}
            </div>
            <div className="result-card-degree">{vals.myDegree}</div>
          </div>
          <div className="section-label">Le reste de l'escouade</div>
          <div className="teammates-list">
            {vals.teammates.map((t) => (
              <div key={t.id} className="teammate-row" style={{ borderColor: t.borderCol, background: t.bgCol }}>
                <div className="teammate-row-left">
                  <Avatar src={t.avatar} size="sm" />
                  <span className="teammate-name">{t.name}</span>
                </div>
                <div className="teammate-result">
                  <div className="teammate-label" style={{ color: t.textCol }}>
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
