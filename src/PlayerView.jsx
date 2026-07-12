import { useState } from 'react'
import Avatar from './Avatar.jsx'
import CharacteristicsRadar from './CharacteristicsRadar.jsx'
import ArmorDiagram from './ArmorDiagram.jsx'

export default function PlayerView({ vals }) {
  const [showArmor, setShowArmor] = useState(false)
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
          <div className="roster-pv-bar">
            <div className={`roster-pv-bar-fill pv-${vals.myPvStatus.key}`} style={{ width: `${vals.myPvRatio * 100}%` }} />
          </div>
          <div className="roster-pv-label">
            {myChar.pv.current} / {myChar.pv.max} PV · <span className={`pv-tag pv-${vals.myPvStatus.key}`}>{vals.myPvStatus.label}</span>
          </div>
        </div>
      )}

      {vals.isMeDown && <div className="down-banner">☠ HORS DE COMBAT</div>}
      {vals.damageNoticeText && <div className="damage-notice">{vals.damageNoticeText}</div>}

      {vals.pScreenMain && (
        <div className="player-body">
          {vals.characteristicTendencies.length >= 3 && (
            <div className="radar-card">
              <CharacteristicsRadar tendencies={vals.characteristicTendencies} />
            </div>
          )}
          <div className="search-bar">
            <span>⌕</span>
            <span>Rechercher une compétence…</span>
          </div>
          <div className="pending-banner">
            <span className="glyph">◈</span>
            En attente d'un ordre du Maître de Jeu.
          </div>
          <button className="armor-toggle" onClick={() => setShowArmor((s) => !s)}>
            {showArmor ? '▾' : '▸'} Armure
          </button>
          {showArmor && myChar && <ArmorDiagram armor={myChar.armor} />}

          <div className="section-label">Compétences</div>
          {vals.mySkillGroups.map((group) => (
            <div key={group.characteristic} className="char-group">
              <div className="char-group-label">{group.characteristicName}</div>
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

      {vals.attackPendingForMe && (
        <div className="request-screen">
          <div className="order-badge">⚠ Attaque entrante</div>
          <div className="request-skill">Esquive</div>

          {!vals.dodging && (
            <button className="roll-button" onClick={vals.rollDodge}>
              <div className="glyph">⚄</div>
              <div className="label">LANCER</div>
            </button>
          )}
          {vals.dodging && (
            <div className="rolling-circle">
              <div className="glyph">⚄</div>
            </div>
          )}
          <div className="request-hint">Le seuil est calculé pour vous.</div>
        </div>
      )}

      {vals.attackResolvedForMe && (
        <div className="player-body">
          <div className="result-card" style={{ borderColor: vals.attack.outcome === 'hit' ? 'rgba(198,90,79,.5)' : 'rgba(123,163,111,.5)' }}>
            {vals.attack.outcome !== 'hit' && <div className="result-card-skill">Esquive</div>}
            <div className="result-card-label" style={{ color: vals.attack.outcome === 'hit' ? '#c65a4f' : '#8fbf87' }}>
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
            <button className="roll-button" onClick={vals.rollDice}>
              <div className="glyph">⚄</div>
              <div className="label">LANCER</div>
            </button>
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
