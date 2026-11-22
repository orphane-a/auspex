import { useEffect, useState } from 'react'
import { api } from './api'
import Avatar from './Avatar.jsx'
import PvBar from './PvBar.jsx'
import { degreeLabel } from './gameLogic'
import { stepOutcome } from './scenarios/index.js'

// L'étape courante est gardée côté navigateur (ticket 97, exigence 7) : rien en base,
// pour ne toucher ni au schéma ni au snapshot. localStorage peut être indisponible
// (navigation privée) : on retombe alors sur l'état en mémoire.
const STORAGE_KEY = 'auspex.demo.progress'

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (raw && Number.isInteger(raw.step)) return { step: raw.step, finished: !!raw.finished, outcomes: raw.outcomes || {} }
  } catch {
    // stockage illisible ou bloqué : on repart de l'étape 1
  }
  return { step: 0, finished: false, outcomes: {} }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // stockage bloqué : la progression reste en mémoire pour cette session
  }
}

const SERVER_DOWN = 'Vérifiez que le serveur de démo tourne, puis réessayez.'

// Une erreur réseau (fetch rejeté) n'a pas de message utile ; une erreur HTTP porte
// déjà le message du serveur, qu'on affiche tel quel (ex. « Ce personnage a déjà
// lancé le dé. »).
function errorText(err, fallback) {
  return err instanceof TypeError ? `${fallback} ${SERVER_DOWN}` : err.message
}

function malusText(malus) {
  return malus ? `Malus ${malus}` : 'Sans malus'
}

function rollStatus(roll) {
  return roll.status === 'success' ? 'Réussite' : 'Échec'
}

export default function GuidedPanel({ vals, scenario }) {
  const [progress, setProgress] = useState(loadProgress)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const [companionsBusy, setCompanionsBusy] = useState(false)
  const [companionsError, setCompanionsError] = useState('')
  const [attackBusy, setAttackBusy] = useState(false)
  const [attackError, setAttackError] = useState('')
  const [resetPhase, setResetPhase] = useState(null) // null | 'confirm' | 'busy' | 'done'
  const [resetError, setResetError] = useState('')

  const total = scenario.steps.length
  const stepIndex = Math.min(Math.max(progress.step, 0), total - 1)
  const step = scenario.steps[stepIndex]
  const isLast = stepIndex === total - 1

  function update(patch) {
    setProgress((p) => {
      const next = { ...p, ...patch }
      saveProgress(next)
      return next
    })
  }

  // Les personnages du scénario sont retrouvés par leur nom : les identifiants
  // changent à chaque remise à zéro de la table.
  const members = scenario.characters.map((sc) => ({ ...sc, entity: vals.characters.find((c) => c.name === sc.name) || null }))
  const present = members.filter((m) => m.entity)
  const companions = present.filter((m) => !m.played)
  const played = members.find((m) => m.played)
  const dragon = vals.npcs.find((n) => n.name === scenario.npc.name) || null
  const dragonRow = vals.npcRoster.find((n) => n.id === dragon?.id) || null

  const request = vals.request
  const testActive = !!step.test && !!request && request.skill === step.test.skill
  const rows = testActive
    ? present.filter((m) => request.concernedCharacterIds.includes(m.entity.id)).map((m) => ({ ...m, roll: vals.rolls[m.entity.id] || null }))
    : []
  const received = rows.filter((r) => r.roll)
  const allRolled = testActive && rows.length > 0 && received.length === rows.length
  const outcome = allRolled ? stepOutcome(received.map((r) => r.roll)) : null

  // Un nouveau test remet le bouton des compagnons en service.
  useEffect(() => {
    setCompanionsError('')
  }, [request?.id])

  // Le résultat de l'étape est mémorisé pour l'afficher encore une fois l'étape
  // suivante ouverte (critère 5 : un échec donne un texte, jamais un blocage).
  useEffect(() => {
    if (outcome && progress.outcomes[stepIndex] !== outcome) {
      update({ outcomes: { ...progress.outcomes, [stepIndex]: outcome } })
    }
  }, [outcome, stepIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  async function launchTest() {
    if (!step.test || present.length === 0) return
    setLaunching(true)
    setLaunchError('')
    try {
      await api.createRequest({ skill: step.test.skill, malus: step.test.malus, concernedCharacterIds: present.map((m) => m.entity.id) })
    } catch (err) {
      setLaunchError(errorText(err, "Le test n'a pas pu être lancé."))
    } finally {
      setLaunching(false)
    }
  }

  async function rollCompanions() {
    setCompanionsBusy(true)
    setCompanionsError('')
    let firstError = ''
    for (const c of companions) {
      try {
        await api.rollDice(c.entity.id)
      } catch (err) {
        firstError ||= errorText(err, "Le jet n'a pas pu être lancé.")
      }
    }
    setCompanionsError(firstError)
    setCompanionsBusy(false)
  }

  async function launchAttack() {
    const attacker = members.find((m) => m.name === step.attack.attacker)?.entity
    if (!attacker || !dragon) return
    setAttackBusy(true)
    setAttackError('')
    try {
      await api.launchAttack({
        attackerType: 'character',
        attackerId: attacker.id,
        defenderType: 'npc',
        defenderId: dragon.id,
        weaponName: step.attack.weapon,
        fireMode: step.attack.fireMode,
      })
    } catch (err) {
      setAttackError(errorText(err, "L'attaque n'a pas pu être lancée."))
    } finally {
      setAttackBusy(false)
    }
  }

  async function goTo(index) {
    setLaunchError('')
    setAttackError('')
    setResetPhase(null)
    update({ step: index, finished: false })
    // Le test de l'étape quittée est clos pour que la vue MJ revienne au tableau de bord.
    if (request) {
      try {
        await api.endTest()
      } catch {
        // sans conséquence : le prochain « Lancer le test » remplace la demande
      }
    }
  }

  async function confirmReset() {
    setResetPhase('busy')
    setResetError('')
    try {
      await vals.resetTable()
      update({ step: 0, finished: false, outcomes: {} })
      setLaunchError('')
      setAttackError('')
      setCompanionsError('')
      setResetPhase('done')
    } catch (err) {
      setResetError(errorText(err, "La démo n'a pas pu être remise à zéro."))
      setResetPhase('confirm')
    }
  }

  const resetBlock =
    resetPhase === 'confirm' || resetPhase === 'busy' ? (
      <div className="guide-dialog" role="dialog" aria-labelledby="guide-reset-title">
        <h4 id="guide-reset-title">Recommencer la démo ?</h4>
        <p>
          Les PV et les jets sont remis à zéro. {scenario.characters.map((c) => c.name).join(', ')} et {scenario.npc.name.toLowerCase()} sont recréés. La table de
          Djoko n'est pas touchée.
        </p>
        {resetError && (
          <div className="guide-alert err" role="alert">
            {resetError}
          </div>
        )}
        <div className="guide-btn-row">
          <button type="button" className="primary-btn" onClick={confirmReset} disabled={resetPhase === 'busy'}>
            {resetPhase === 'busy' ? (
              <>
                <span className="guide-spinner" aria-hidden="true" /> Remise à zéro…
              </>
            ) : (
              'Recommencer'
            )}
          </button>
          <button type="button" className="secondary-btn" onClick={() => setResetPhase(null)} disabled={resetPhase === 'busy'}>
            Annuler
          </button>
        </div>
      </div>
    ) : (
      <>
        {resetPhase === 'done' && (
          <div className="guide-alert info" role="status">
            La démo est prête. Retour à l'étape 1.
          </div>
        )}
        <button type="button" className="guide-link" onClick={() => setResetPhase('confirm')}>
          Recommencer la démo
        </button>
      </>
    )

  const playerHint = (
    <p className="guide-hint">
      <a href="/joueur" target="_blank" rel="noreferrer">
        Ouvrez la vue joueur
      </a>{' '}
      dans une autre fenêtre et choisissez {played?.name}. Code de la table : <strong className="mono">{vals.tableCode}</strong>
    </p>
  )

  const header = (
    <div className="guide-top">
      <h2 className="guide-heading">Scénario guidé</h2>
      <span className="guide-count">{progress.finished ? 'Démo terminée' : `Étape ${stepIndex + 1} sur ${total}`}</span>
    </div>
  )

  const progressBar = (
    <ol className="guide-steps" aria-label="Progression de la démo">
      {scenario.steps.map((s, i) => {
        const state = progress.finished || i < stepIndex ? 'done' : i === stepIndex ? 'now' : 'todo'
        return (
          <li key={s.title} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="sr-only">
              Étape {i + 1}, {s.title}, {state === 'done' ? 'faite' : state === 'now' ? 'en cours' : 'à venir'}
            </span>
          </li>
        )
      })}
    </ol>
  )

  if (vals.characters.length === 0) {
    return (
      <section className="guide" aria-label="Scénario guidé">
        {header}
        <div className="guide-alert warn">La table de démo est vide. Recommencez la démo pour recréer les personnages et le dragon.</div>
        {resetBlock}
      </section>
    )
  }

  if (progress.finished) {
    const ending = dragon && dragon.pv.current <= 0 ? scenario.endings.victory : scenario.endings.escape
    return (
      <section className="guide" aria-label="Scénario guidé">
        {header}
        {progressBar}
        <div className="guide-end">
          <h3>{ending.title}</h3>
          <p>{ending.text}</p>
          {dragonRow && <PvBar label={`Points de vie de ${dragonRow.name}`} current={dragonRow.pvCurrent} max={dragonRow.pvMax} ratio={dragonRow.pvRatio} statusKey={dragonRow.pvStatusKey} />}
        </div>
        <button type="button" className="secondary-btn" onClick={() => goTo(total - 1)}>
          Revenir à l'étape {total}
        </button>
        {resetBlock}
      </section>
    )
  }

  const previousOutcome = stepIndex > 0 ? progress.outcomes[stepIndex - 1] : null
  const previousStep = stepIndex > 0 ? scenario.steps[stepIndex - 1] : null

  const attack = vals.attack
  const attackPending = !!attack && ['pending-attack-roll', 'pending-dodge'].includes(attack.outcome)
  const attackShown = !!step.attack && !!attack && attack.defender.type === 'npc' && attack.defender.id === dragon?.id

  return (
    <section className="guide" aria-label="Scénario guidé">
      {header}
      {progressBar}

      <div>
        <p className="guide-step-num">Étape {stepIndex + 1}</p>
        <h3 className="guide-step-title">{step.title}</h3>
      </div>

      {previousOutcome && previousStep?.test && (
        <div className={`guide-read ${previousOutcome === 'success' ? 'ok' : 'ko'}`}>
          <span className="guide-tag">Suite de l'étape {stepIndex}, {previousOutcome === 'success' ? "l'équipe a réussi" : "toute l'équipe a échoué"}</span>
          {previousOutcome === 'success' ? previousStep.success : previousStep.failure}
        </div>
      )}

      <div className="guide-read">
        <span className="guide-tag">À lire aux joueurs</span>
        {step.read}
      </div>

      {step.test && (
        <>
          <div className="guide-chips">
            <span className="guide-chip">Test de {step.test.skill}</span>
            <span className="guide-chip">{malusText(step.test.malus)}</span>
            <span className="guide-chip">{present.map((m) => m.name).join(', ')}</span>
          </div>

          {launchError && (
            <div className="guide-alert err" role="alert">
              {launchError}
            </div>
          )}

          {!testActive ? (
            <button type="button" className="primary-btn" onClick={launchTest} disabled={launching}>
              {launching ? (
                <>
                  <span className="guide-spinner" aria-hidden="true" /> Envoi de la demande…
                </>
              ) : launchError ? (
                'Réessayer'
              ) : (
                'Lancer le test'
              )}
            </button>
          ) : (
            <>
              <div className="guide-live-head">
                <strong>{step.test.skill}</strong>
                <span className="guide-live" role="status">
                  En direct, {received.length} jet{received.length > 1 ? 's' : ''} sur {rows.length}
                </span>
              </div>
              <ul className="guide-rolls">
                {rows.map((r) => (
                  <li key={r.name} className={`guide-roll${r.roll ? (r.roll.status === 'success' ? ' ok' : ' ko') : ' wait'}`}>
                    <Avatar src={r.entity.avatar} size="sm" />
                    <div className="guide-roll-who">
                      <span className="guide-roll-name">{r.name}</span>
                      <span className="guide-roll-sub">
                        {r.roll ? `Jet ${r.roll.roll}, cible ${r.roll.target}` : r.played ? 'Joué par le joueur' : 'Compagnon'}
                      </span>
                    </div>
                    <div className="guide-roll-res">
                      {r.roll ? (
                        <>
                          <b>{rollStatus(r.roll)}</b>
                          <span>{degreeLabel(r.roll.degrees, r.roll.status === 'success')}</span>
                        </>
                      ) : (
                        <b>{r.played ? 'En attente du joueur' : 'En attente'}</b>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {companionsError && (
                <div className="guide-alert err" role="alert">
                  {companionsError}
                </div>
              )}
              {companions.length > 0 && (
                <button type="button" className="secondary-btn" onClick={rollCompanions} disabled={companionsBusy || !!companionsError}>
                  {companionsBusy ? 'Jets en cours…' : 'Lancer pour les compagnons'}
                </button>
              )}

              {outcome && (
                <div className={`guide-read ${outcome === 'success' ? 'ok' : 'ko'}`}>
                  <span className="guide-tag">{outcome === 'success' ? "Suite : l'équipe réussit" : "Suite : toute l'équipe échoue"}</span>
                  {outcome === 'success' ? step.success : step.failure}
                </div>
              )}
              {outcome && <p className="guide-rule">L'étape est réussie dès qu'un personnage réussit. Un échec ne bloque jamais la démo.</p>}
              <button type="button" className="guide-link" onClick={launchTest} disabled={launching}>
                Relancer le test
              </button>
            </>
          )}
        </>
      )}

      {step.attack && (
        <>
          <div className="guide-chips">
            <span className="guide-chip">Attaque de {step.attack.attacker}</span>
            <span className="guide-chip">{step.attack.weapon}</span>
            <span className="guide-chip">Esquive possible du dragon</span>
          </div>
          {attackError && (
            <div className="guide-alert err" role="alert">
              {attackError}
              {played && !played.entity?.connected && ` ${played.name} doit avoir rejoint la table depuis la vue joueur.`}
            </div>
          )}
          <button type="button" className="primary-btn" onClick={launchAttack} disabled={attackBusy || attackPending || !dragon}>
            {attackBusy ? (
              <>
                <span className="guide-spinner" aria-hidden="true" /> Envoi de l'attaque…
              </>
            ) : attackShown && !attackPending ? (
              `Relancer l'attaque de ${step.attack.attacker}`
            ) : (
              `Lancer l'attaque de ${step.attack.attacker}`
            )}
          </button>
          {attackShown && (
            <div className="guide-attack" role="status">
              <strong>{vals.attackDirectionText}</strong>
              {attack.outcome === 'pending-attack-roll' ? (
                <span>En attente du jet de {step.attack.attacker} côté joueur…</span>
              ) : attack.outcome === 'pending-dodge' ? (
                <>
                  <span>Touché ({vals.attackRollDegreeText}). Le dragon tente d'esquiver.</span>
                  <button type="button" className="secondary-btn" onClick={vals.rollNpcDodge} disabled={vals.npcDodging}>
                    Lancer l'esquive du dragon
                  </button>
                </>
              ) : (
                <span>{vals.attackOutcomeText}</span>
              )}
            </div>
          )}
          {dragonRow && <PvBar label={`Points de vie de ${dragonRow.name}`} current={dragonRow.pvCurrent} max={dragonRow.pvMax} ratio={dragonRow.pvRatio} statusKey={dragonRow.pvStatusKey} />}
        </>
      )}

      <div className="guide-nav">
        <button type="button" className="secondary-btn" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
          <span className="guide-long">Étape précédente</span>
          <span className="guide-short">Précédente</span>
        </button>
        {isLast ? (
          <button type="button" className="secondary-btn" onClick={() => update({ finished: true })}>
            Terminer la démo
          </button>
        ) : (
          <button type="button" className="secondary-btn" onClick={() => goTo(stepIndex + 1)}>
            <span className="guide-long">Étape suivante</span>
            <span className="guide-short">Suivante</span>
          </button>
        )}
      </div>

      {playerHint}
      {resetBlock}
    </section>
  )
}
