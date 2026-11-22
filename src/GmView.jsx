import { useState } from 'react'
import Avatar, { FictifBadge, Spinner } from './Avatar.jsx'
import PvBar, { PvStatusBadge } from './PvBar.jsx'
import LaunchModal from './LaunchModal.jsx'
import AttackModal from './AttackModal.jsx'
import { ATTACK_STEPS, attackStep, malusValue, testOf } from './explain.js'
import { CloseIcon } from './FocusParts.jsx'

// Tableau de bord MJ (ticket 99) : sur desktop, une grille qui tient dans la hauteur
// de l'écran. Les actions restent à gauche, seules les listes défilent dans leur bloc.
export default function GmView({ vals, onManageCharacters }) {
  const [copyState, setCopyState] = useState(null) // null | 'ok' | 'error'

  // L'API presse-papiers exige un contexte sécurisé : sur une IP du réseau local en
  // http, elle échoue. On le dit plutôt que de laisser croire que c'est copié.
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(vals.tableCode)
      setCopyState('ok')
    } catch {
      setCopyState('error')
    }
  }

  const activeNpcs = vals.npcRoster.filter((n) => !n.isDown).length

  return (
    <div className="gm-grid">
      <div className="col col-side">
        <section className="block code-card" aria-labelledby="h-code">
          <div className="code-card-main">
            <h2 id="h-code" className="code-card-label">
              Code d'accès de la table
            </h2>
            <p className="code-card-value">{vals.tableCode}</p>
            <p className="code-card-hint" role="status">
              {copyState === 'ok' ? 'Code copié' : copyState === 'error' ? 'Copie impossible : notez le code à la main.' : 'À transmettre à vos joueurs'}
            </p>
          </div>
          <div className="code-card-actions">
            <button type="button" className="btn" onClick={copyCode}>
              Copier
            </button>
            <button type="button" className="btn ghost" onClick={onManageCharacters}>
              Personnages
            </button>
          </div>
        </section>

        <section className="block actions" aria-labelledby="h-actions">
          <h2 id="h-actions" className="block-kicker">
            Actions
          </h2>
          {vals.mjResults ? (
            <button type="button" className="btn block" onClick={vals.startNewTest}>
              Nouveau test
            </button>
          ) : (
            <button type="button" className="btn block" onClick={vals.openLaunch}>
              Ordonner un test
            </button>
          )}
          <button type="button" className="btn ghost block" onClick={vals.openAttack}>
            Lancer une attaque
          </button>
        </section>

        {vals.showAttackCard && <AttackLive vals={vals} />}

        {!vals.showAttackCard && <Recap vals={vals} />}
      </div>

      {vals.mjDashboard && (
        <>
          <section className="block grow" aria-labelledby="h-joueurs">
            <div className="block-head">
              <h2 id="h-joueurs">Joueurs</h2>
              <p>
                <strong>{vals.connectedCount}</strong> présent{vals.connectedCount > 1 ? 's' : ''} sur {vals.totalCount}
              </p>
            </div>
            <div className="block-body" tabIndex={0} aria-label="Liste des joueurs">
              {vals.roster.length === 0 && (
                <p className="whoall-hint">Aucun personnage à la table. Importez une fiche ou ajoutez les personnages fictifs depuis l'écran Personnages.</p>
              )}
              <ul className="roster-list">
                {vals.roster.map((p) => (
                  <li key={p.id} className={`roster-row${p.connected ? '' : ' offline'}`}>
                    <Avatar src={p.avatar} fictional={p.fictional} />
                    <div className="roster-id">
                      <h3 className="roster-name">
                        {p.name}
                        {p.fictional && <FictifBadge />}
                      </h3>
                      <div className="roster-cls">{p.cls}</div>
                    </div>
                    <span className={`roster-status${p.connected ? '' : ' offline'}`}>
                      <span className="status-dot" aria-hidden="true" />
                      {p.statusText}
                    </span>
                    <div className="roster-pv">
                      <PvBar label={`Points de vie de ${p.name}`} current={p.pvCurrent} max={p.pvMax} ratio={p.pvRatio} statusKey={p.pvStatusKey} compact />
                      <PvStatusBadge statusKey={p.pvStatusKey} label={p.pvStatusLabel} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="block grow" aria-labelledby="h-pnj">
            <div className="block-head">
              <h2 id="h-pnj">PNJ en jeu</h2>
              <p>
                <strong>{activeNpcs}</strong> actif{activeNpcs > 1 ? 's' : ''}
              </p>
            </div>
            <div className="block-body" tabIndex={0} aria-label="Liste des PNJ">
              {vals.npcRoster.length === 0 && <p className="whoall-hint">Aucun PNJ importé. Ajoutez en depuis l'écran Personnages.</p>}
              <ul className="roster-list">
                {vals.npcRoster.map((n) => (
                  <li key={n.id} className="roster-row npc">
                    <div className="roster-id">
                      <h3 className="roster-name">{n.name}</h3>
                    </div>
                    <div className="roster-pv">
                      <PvBar label={`Points de vie de ${n.name}`} current={n.pvCurrent} max={n.pvMax} ratio={n.pvRatio} statusKey={n.pvStatusKey} compact />
                      <PvStatusBadge statusKey={n.pvStatusKey} label={n.pvStatusLabel} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      {vals.mjResults && (
        <section className="block grow span-2" aria-labelledby="h-results">
          <div className="block-head results-head">
            <div>
              <h2 id="h-results">{capitalize(testOf(vals.reqSkill))}</h2>
              <p>{vals.reqMalus ? `Malus de ${malusValue(vals.reqMalus)} appliqué au seuil de chaque joueur` : 'Sans malus'}</p>
            </div>
            <p className="live-tag" role="status">
              <span className="live-dot" aria-hidden="true" />
              En direct, {vals.receivedText}
            </p>
          </div>
          {vals.fictionalRemovedDuringTest && (
            <p className="msg-info results-info" role="status">
              Les personnages fictifs ont été retirés. Le test continue pour les autres personnages.
            </p>
          )}
          <div className="block-body" tabIndex={0} aria-label="Résultats du test">
            <ul className="roster-list">
              {vals.rollsList.map((r) => (
                <li key={r.id} className={`roll-row${r.isSuccess ? ' is-success' : r.isFail ? ' is-fail' : ''}`}>
                  <Avatar src={r.avatar} fictional={r.fictional} />
                  <div className="roster-id">
                    <div className="roll-row-name">
                      {r.name}
                      {r.fictional && <FictifBadge />}
                    </div>
                    <div className="roll-row-cls">{r.cls}</div>
                  </div>
                  <div className="roll-row-result">
                    {r.isPending ? (
                      <div className={`roll-row-wait${r.isAuto ? ' auto-roll' : ''}`} role={r.isAuto ? 'status' : undefined}>
                        <Spinner />
                        {r.isAuto ? 'Jet automatique…' : 'En attente du jet'}
                      </div>
                    ) : (
                      <div className="roll-row-label">{r.summaryTitle}</div>
                    )}
                    <div className="roll-row-degree">{r.summaryDetail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="block-foot">Réussite si le résultat du dé est inférieur ou égal au seuil. Chaque tranche de 10 points d'écart ajoute un degré.</p>
        </section>
      )}

      {vals.showLaunch && <LaunchModal vals={vals} />}
      {vals.showAttack && <AttackModal vals={vals} />}
    </div>
  )
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Encart de l'attaque en cours, toujours visible dans la colonne de gauche.
function AttackLive({ vals }) {
  const attack = vals.attack
  const step = attackStep(attack)
  const attackerName = vals.attackAttackerEntity?.name
  const defenderName = vals.attackDefenderEntity?.name
  const rollLine =
    attack.attackRoll != null ? `Jet d'attaque ${attack.attackRoll} sur un seuil de ${vals.attackAttackerThreshold}` : `Seuil d'attaque : ${vals.attackAttackerThreshold}`
  const dodgeLine = attack.dodgeRoll != null ? `, esquive ${attack.dodgeRoll} sur un seuil de ${vals.attackDefenderThreshold}` : ''

  return (
    <section className="block attack-live" aria-labelledby="h-attack-live">
      <div className="attack-live-head">
        <h2 id="h-attack-live" className="block-kicker">
          {vals.attackIsTerminal ? 'Attaque terminée' : 'Attaque en cours'}
        </h2>
        {/* Filet de sécurité (V3 §5 v2) : débloque une séquence coincée en attente,
            même sans résolution. Sinon plus aucune attaque n'est possible. */}
        {!vals.attackIsTerminal && (
          <button type="button" className="close-x" onClick={vals.cancelAttack} title="Annuler l'attaque" aria-label="Annuler l'attaque">
            <CloseIcon />
          </button>
        )}
      </div>
      <p className="duel-line">
        {attackerName} attaque {defenderName}
      </p>
      <ol className="steps" aria-label="Étapes du combat">
        {ATTACK_STEPS.map((label, i) => (
          <li key={label} className={i + 1 < step || vals.attackIsTerminal ? 'done' : i + 1 === step ? 'now' : ''} aria-current={i + 1 === step ? 'step' : undefined}>
            {i + 1} {label}
          </li>
        ))}
      </ol>
      {attack.outcome === 'pending-attack-roll' ? (
        vals.attackAttackerFictional ? (
          <p className="inline-status auto-roll" role="status">
            <Spinner />
            Jet d'attaque automatique de {attackerName}…
          </p>
        ) : (
          <p className="attack-live-text">En attente du jet d'attaque de {attackerName}.</p>
        )
      ) : attack.outcome === 'pending-dodge' ? (
        <>
          <p className="attack-live-text">
            Touché, {vals.attackRollDegreeText}.{' '}
            {vals.attackDefenderFictional || vals.attackPendingForNpcDefender ? '' : `En attente de l'esquive de ${defenderName}.`}
          </p>
          {vals.attackDefenderFictional ? (
            <p className="inline-status auto-roll" role="status">
              <Spinner />
              Esquive automatique de {defenderName}…
            </p>
          ) : (
            vals.attackPendingForNpcDefender && (
              <button type="button" className="btn ghost block" onClick={vals.rollNpcDodge} disabled={vals.npcDodging}>
                Lancer l'esquive du PNJ
              </button>
            )
          )}
        </>
      ) : (
        <>
          <p className="attack-live-result" role="status">
            {vals.attackOutcomeText}
          </p>
          <button type="button" className="btn ghost block" onClick={vals.dismissAttack}>
            OK
          </button>
        </>
      )}
      <p className="calc">
        {rollLine}
        {dodgeLine}
      </p>
    </section>
  )
}

// Rappel compact du dernier test ou de la dernière attaque (souhaitable 4).
function Recap({ vals }) {
  const t = vals.lastTest
  const lastAttack = vals.attackIsTerminal ? vals.attackOutcomeText : ''
  if (!t && !lastAttack) return null
  return (
    <section className="block recap" aria-labelledby="h-recap">
      <h2 id="h-recap" className="block-kicker">
        {t ? 'Dernier test' : 'Dernière attaque'}
      </h2>
      {t && (
        <p>
          {capitalize(testOf(t.skill))} : {t.successes} réussite{t.successes > 1 ? 's' : ''} sur {t.received}
          {t.received < t.total ? ` (${t.total - t.received} sans jet)` : ''}
        </p>
      )}
      {lastAttack && (
        <p className={t ? 'small' : ''}>
          {t ? 'Dernière attaque : ' : ''}
          {vals.attackAttackerEntity?.name} contre {vals.attackDefenderEntity?.name}. {lastAttack}
        </p>
      )}
    </section>
  )
}
