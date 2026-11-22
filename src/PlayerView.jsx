import Avatar, { FictifBadge, Spinner } from './Avatar.jsx'
import PvBar, { PvStatusBadge } from './PvBar.jsx'
import { characteristicLabel } from './gameLogic.js'
import { attackOutcomeFacts, attackResultTitle, attackStep, malusDisplay, rollGapText, testOf, thresholdCalcText } from './explain.js'
import { DiceRule, ErrorMsg, Facts, RollZone, StepLine } from './FocusParts.jsx'

// Vue Joueur (ticket 99) : sur desktop, l'identité, les points de vie et l'armure à
// gauche ; à droite la fiche, remplacée par l'écran d'action pendant un jet ou un combat.
export default function PlayerView({ vals }) {
  const myChar = vals.myCharacter

  return (
    <div className="pl-grid">
      <div className="col col-side">
        <section className="block id-card" aria-labelledby="h-perso">
          <div className="id-top">
            <Avatar src={vals.me.avatar} size="lg" />
            <div className="id-text">
              <h2 id="h-perso" className="id-name">
                {vals.me.name}
              </h2>
              <p className="id-cls">{vals.me.cls}</p>
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

        {vals.pScreenMain && (
          <p className="waiting" role="status">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            En attente d'un ordre du Maître de Jeu.
          </p>
        )}

        <section className="block armor-block" aria-labelledby="h-armure">
          <div className="block-head">
            <h2 id="h-armure">Armure</h2>
            <p>Points retirés aux dégâts</p>
          </div>
          <ul className="armor-grid">
            {vals.myArmorCells.map((a) => (
              <li key={a.key} className={`armor-cell${a.isEmpty ? ' empty' : ''}${a.isHit ? ' hit' : ''}`}>
                <span className="k">
                  {a.label}
                  {a.isHit ? ', touché' : ''}
                </span>
                <span className="v">{a.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="col col-main">
        {vals.pScreenMain && <SheetScreen vals={vals} />}
        {vals.attackPendingForMeAsAttacker && <AttackRollScreen vals={vals} />}
        {vals.attackWaitingForDodgeAsAttacker && <AttackWaitingScreen vals={vals} />}
        {vals.attackPendingForMe && <DodgeScreen vals={vals} />}
        {vals.attackResolvedForMe && <AttackResultScreen vals={vals} />}
        {vals.pScreenRequest && <TestRequestScreen vals={vals} />}
        {vals.pScreenResult && <TestResultScreen vals={vals} />}
      </div>
    </div>
  )
}

// Fiche : caractéristiques en tuiles chiffrées, puis compétences avec leur valeur.
function SheetScreen({ vals }) {
  const characteristics = Object.entries(vals.myCharacter?.characteristics || {}).filter(([, v]) => v > 0)
  return (
    <>
      {characteristics.length > 0 && (
        <section className="block" aria-labelledby="h-carac">
          <div className="block-head">
            <h2 id="h-carac">Caractéristiques</h2>
            <p>Base de vos compétences</p>
          </div>
          <ul className="charac">
            {characteristics.map(([key, value]) => (
              <li key={key}>
                <span className="k">{characteristicLabel(key)}</span>
                <span className="v">{value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="block grow" aria-labelledby="h-skills">
        <div className="block-head">
          <h2 id="h-skills">Compétences</h2>
          <p>Valeur : votre seuil sans malus</p>
        </div>
        <div className="block-body" tabIndex={0} aria-label="Liste des compétences">
          {vals.mySkillGroups.length === 0 && <p className="whoall-hint">Aucune compétence sur cette fiche.</p>}
          {vals.mySkillGroups.map((group) => (
            <div key={group.characteristic} className="skill-group">
              <h3 className="skill-group-label">{group.characteristicName}</h3>
              <ul className="skills">
                {group.skills.map((skill) => (
                  <li key={skill.name} className="skill">
                    <span>{skill.name}</span>
                    <b>{skill.score}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function TestRequestScreen({ vals }) {
  const t = vals.myThreshold
  const facts = t
    ? [
        { label: t.skill, value: t.score },
        ...(t.malus ? [{ label: 'Malus', value: malusDisplay(vals.reqMalus) }] : []),
        { label: 'Seuil', value: t.target, highlight: true },
      ]
    : []
  return (
    <section className="focus-card" aria-labelledby="h-focus">
      <p className="eyebrow">Ordre du Maître de Jeu</p>
      <h2 id="h-focus" className="focus-title">
        Lancez un {testOf(vals.reqSkill)}
      </h2>
      {t && (
        <p className="explain">
          Pour réussir, votre dé doit faire <strong>{t.target} ou moins</strong>.
        </p>
      )}
      {t && <Facts items={facts} />}
      {t && <p className="calc">{thresholdCalcText(t)}</p>}
      {vals.showRollBtn || vals.rolling ? (
        <RollZone label="Lancer le dé" onRoll={vals.rollDice} rolling={vals.rolling} rollingText="Le dé roule…" />
      ) : null}
      <ErrorMsg>{vals.rollError}</ErrorMsg>
      <DiceRule />
    </section>
  )
}

function TestResultScreen({ vals }) {
  const ok = vals.myIsSuccess
  const title = vals.myRollDegrees != null ? `${ok ? 'Réussite' : 'Échec'}, ${degreeText(vals.myRollDegrees, ok)}` : vals.myLabel
  return (
    <section className="focus-card result" aria-labelledby="h-focus">
      <p className="eyebrow">Résultat du {testOf(vals.reqSkill)}</p>
      <h2 id="h-focus" className={`focus-title ${ok ? 'ok' : 'ko'}`} role="status">
        {title}
      </h2>
      {vals.myRollValue != null && (
        <div className="result-line">
          <span className="big-number">{vals.myRollValue}</span>
          <span className="of">sur un seuil de {vals.myRollTarget}</span>
        </div>
      )}
      <p className="explain">{rollGapText(vals.myRollValue, vals.myRollTarget)}</p>
      {vals.teammates.length > 0 && (
        <div className="squad">
          <h3 className="block-kicker">Le reste de l'escouade</h3>
          <ul className="squad-list">
            {vals.teammates.map((t) => (
              <li key={t.id} className={`teammate-row${t.isSuccess ? ' is-success' : t.isFail ? ' is-fail' : ''}`}>
                <div className="teammate-row-left">
                  <Avatar src={t.avatar} size="sm" fictional={t.fictional} />
                  <span className="teammate-name">
                    {t.name}
                    {t.fictional && <FictifBadge />}
                  </span>
                </div>
                <div className="teammate-result">
                  {t.isPending ? (
                    <div className="teammate-wait">
                      <Spinner />
                      {t.isAuto ? 'Jet automatique…' : 'En attente'}
                    </div>
                  ) : (
                    <div className="teammate-label">{t.summaryTitle}</div>
                  )}
                  <div className="teammate-degree">{t.summaryDetail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <button type="button" className="btn ghost" onClick={vals.dismissResult}>
          Retour à ma fiche
        </button>
      </div>
    </section>
  )
}

function degreeText(degrees, isSuccess) {
  return `${degrees} degré${degrees > 1 ? 's' : ''} ${isSuccess ? 'de réussite' : 'd’échec'}`
}

function weaponWithMode(vals) {
  return [vals.attack.weaponName, vals.attackFireModeLabel.toLowerCase()].filter(Boolean).join(', ')
}

// Étape 1 : le joueur attaque, il lance son jet de Dextérité.
function AttackRollScreen({ vals }) {
  const target = vals.attackAttackerThreshold
  return (
    <section className="focus-card" aria-labelledby="h-focus">
      <StepLine step={1} />
      <h2 id="h-focus" className="focus-title">
        À vous d'attaquer !
      </h2>
      <p className="explain">
        Vous attaquez {vals.attackDefenderEntity?.name} : {weaponWithMode(vals)}. Pour toucher, votre dé doit faire <strong>{target} ou moins</strong>. Si vous touchez,
        votre cible pourra tenter une esquive.
      </p>
      <Facts
        items={[
          { label: 'Cible', value: vals.attackDefenderEntity?.name ?? '' },
          { label: 'Arme', value: weaponWithMode(vals) },
          { label: 'Seuil de Dextérité', value: target, highlight: true },
        ]}
      />
      <p className="calc">Seuil d'attaque = votre Dextérité ({target})</p>
      <RollZone label="Lancer l'attaque" onRoll={vals.rollAttack} rolling={vals.rollingAttack} rollingText="Le dé roule…" />
      <ErrorMsg>{vals.rollError}</ErrorMsg>
      <DiceRule text="Dé à 100 faces. L'attaque touche si le résultat est inférieur ou égal au seuil. Chaque tranche de 10 points d'écart ajoute un degré de réussite." />
    </section>
  )
}

// Fin de l'étape 1 côté attaquant : touché, la cible esquive.
function AttackWaitingScreen({ vals }) {
  const a = vals.attack
  return (
    <section className="focus-card" aria-labelledby="h-focus">
      <StepLine step={2} />
      <h2 id="h-focus" className="focus-title ok">
        Touché, {vals.attackRollDegreeText}
      </h2>
      <p className="explain">
        Votre dé fait {a.attackRoll} sur un seuil de {vals.attackAttackerThreshold}. {vals.attackDefenderEntity?.name} tente maintenant d'esquiver. S'il échoue, il subit
        les dégâts de votre arme, moins son armure.
      </p>
      <p className="inline-status" role="status">
        <Spinner />
        En attente de l'esquive de {vals.attackDefenderEntity?.name}…
      </p>
    </section>
  )
}

// Étape 2 : la cible doit esquiver.
function DodgeScreen({ vals }) {
  const target = vals.attackDefenderThreshold
  const attackerName = vals.attackAttackerEntity?.name
  const score = vals.attackDefenderDodgeScore
  const bonus = vals.attackDefenderDodgeBonus
  const calc =
    score == null
      ? `Seuil d'esquive ${target}`
      : `${vals.attackDefenderDodgeTrained ? `Esquive ${score}, liée à l'Agilité` : `Esquive non apprise : la moitié de l'Agilité, soit ${score}`}${
          bonus ? `, plus un bonus d'esquive de ${bonus}` : ''
        } = seuil de ${target}`
  return (
    <section className="focus-card danger" role="alert" aria-labelledby="h-focus">
      <StepLine step={2} danger />
      <h2 id="h-focus" className="focus-title">
        Vous êtes touché, esquivez !
      </h2>
      <p className="explain">
        {attackerName} vous a touché : {weaponWithMode(vals)}. Lancez votre esquive pour éviter les dégâts : avec <strong>{target} ou moins</strong>, vous évitez tout. Au
        dessus, vous subissez les dégâts, moins votre armure.
      </p>
      <Facts
        items={[
          { label: 'Attaquant', value: attackerName ?? '' },
          { label: 'Arme', value: weaponWithMode(vals) },
          { label: "Seuil d'esquive", value: target, highlight: true },
        ]}
      />
      <p className="calc">
        {calc}
        {vals.attack.attackRoll != null ? `. Jet d'attaque ${vals.attack.attackRoll} sur un seuil de ${vals.attackAttackerThreshold}` : ''}
      </p>
      <RollZone label="Lancer l'esquive" onRoll={vals.rollDodge} rolling={vals.dodging} rollingText="Le dé roule…" danger />
      <ErrorMsg>{vals.rollError}</ErrorMsg>
      <DiceRule text="Dé à 100 faces. L'esquive réussit si le résultat est inférieur ou égal au seuil." />
    </section>
  )
}

// Étape 3 (ou fin anticipée) : le résultat, découpé en éléments lisibles.
function AttackResultScreen({ vals }) {
  const a = vals.attack
  const myChar = vals.myCharacter
  const step = attackStep(a)
  const isHit = a.outcome === 'hit'
  const facts = attackOutcomeFacts(a, isHit && myChar ? myChar.pv : null)
  const attackerName = vals.attackAttackerEntity?.name
  let explain = ''
  if (a.outcome === 'miss') {
    explain = `${attackerName} a raté son jet d'attaque (${a.attackRoll} sur un seuil de ${vals.attackAttackerThreshold}). Vous ne subissez aucun dégât.`
  } else if (a.outcome === 'dodged') {
    explain = `Votre dé fait ${a.dodgeRoll} sur un seuil d'esquive de ${vals.attackDefenderThreshold}. Vous évitez l'attaque de ${attackerName}.`
  } else if (isHit && a.damage) {
    const where = a.fireMode === 'melee' ? 'Le coup vous atteint' : 'Le tir vous atteint'
    explain = `Votre dé fait ${a.dodgeRoll} sur un seuil d'esquive de ${vals.attackDefenderThreshold}. ${where} : ${a.damage.locationLabel.toLowerCase()}. Votre armure de cette zone est déduite de chaque ${
      a.fireMode === 'melee' ? 'coup' : 'balle'
    }.`
  }
  return (
    <section className={`focus-card${isHit ? ' danger' : ''}`} aria-labelledby="h-focus">
      <StepLine step={step} danger={isHit} />
      <h2 id="h-focus" className={`focus-title ${isHit ? 'ko' : 'ok'}`} role="status">
        {attackResultTitle(a, myChar?.pv.current)}
      </h2>
      <p className="explain">{explain}</p>
      <ul className="outcome-list">
        {facts.map((f) => (
          <li key={f.key}>
            <span className="k">{f.label}</span>
            <span className={`v${f.tone ? ` ${f.tone}` : ''}`}>{f.value}</span>
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className="btn ghost" onClick={vals.dismissAttack}>
          Retour à ma fiche
        </button>
      </div>
    </section>
  )
}
