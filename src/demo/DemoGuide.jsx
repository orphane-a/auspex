import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api'
import { degreeLabel } from '../gameLogic'
import { nextMove, advance, castOf, syncProgress, INITIAL_PROGRESS } from '../scenarios/guide.js'
import { resolveTarget } from './coach.js'
import { useDemoPresence } from './useDemoPresence.js'

// Scénario guidé (ticket 97, retour du 22/11) : une popin posée par dessus Auspex,
// sans rien changer à son interface. Elle raconte l'histoire, dit quoi faire et
// montre du doigt le vrai bouton d'Auspex à cliquer. On peut jouer toute la démo
// depuis la seule vue MJ ou la seule vue joueur : le guide joue alors l'autre côté.
// La progression est gardée dans le navigateur, une par vue (rien en base).

const AUTO_DELAY = 900

// Illustration d'une étape. Le rapport largeur/hauteur est réservé par le CSS : la
// popin ne change pas de hauteur quand l'image arrive.
function DemoImage({ image }) {
  if (!image) return null
  return (
    <figure className="demo-figure">
      <img src={image.src} alt={image.alt} width="480" height="360" decoding="async" />
    </figure>
  )
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // stockage bloqué (navigation privée) : la progression reste en mémoire
  }
}

function errorText(err) {
  return err instanceof TypeError ? 'Le serveur de démo ne répond pas. Vérifiez qu’il tourne, puis réessayez.' : err.message
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function runAuto(auto, vals) {
  switch (auto.kind) {
    case 'createRequest':
      return api.createRequest({ skill: auto.skill, malus: auto.malus, concernedCharacterIds: auto.ids })
    case 'roll':
      for (const [i, id] of auto.ids.entries()) {
        if (i > 0) await wait(500)
        await api.rollDice(id)
      }
      return null
    case 'launchAttack':
      return api.launchAttack(auto.payload)
    case 'attackRoll':
      return api.rollAttack(auto.characterId)
    case 'dodge':
      return api.rollDodge(auto.characterId)
    case 'npcDodge':
      return vals.rollNpcDodge()
    default:
      return null
  }
}

// Ticket 99 : les modales défilent dans leur corps, sous un pied fixe. Un bouton peut
// donc être dans l'écran mais caché par le bord de la zone qui défile.
function hiddenInScroller(el, r) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    const box = p.getBoundingClientRect()
    if (r.top < box.top || r.bottom > box.bottom) return true
  }
  return false
}

function sameRect(a, b) {
  return a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

export default function DemoGuide({ vals, scenario, mode, embedded }) {
  const place = embedded ? 'partage' : 'seul'
  const progressKey = `auspex.demo.${scenario.id}.${mode}.${place}`
  const [progress, setProgress] = useState(() => ({ ...INITIAL_PROGRESS, ...load(progressKey, {}) }))
  // Dans l'écran partagé, deux personnes jouent chacune un côté ; dans une fenêtre
  // seule, le guide joue toujours l'autre côté.
  const solo = !embedded
  const [collapsed, setCollapsed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetPhase, setResetPhase] = useState(null) // null | 'confirm' | 'busy'
  const [coach, setCoach] = useState(null) // { rect, hint }
  const [placeTop, setPlaceTop] = useState(false)
  const [squeezed, setSqueezed] = useState(false)
  const [userOpened, setUserOpened] = useState(false)
  const fullHeight = useRef(0)
  const compact = collapsed || (squeezed && !userOpened)

  function toggleCompact() {
    if (compact) {
      setCollapsed(false)
      setUserOpened(true)
    } else {
      setCollapsed(true)
      setUserOpened(false)
    }
  }
  const doneAutos = useRef(new Set())
  const popRef = useRef(null)
  const lastTargetEl = useRef(null)
  const scrollTries = useRef({ count: 0, at: 0 })

  const table = {
    characters: vals.characters,
    npcs: vals.npcs,
    request: vals.request,
    rolls: vals.rolls,
    attack: vals.attack,
    myCharacterId: vals.myCharacter?.id ?? null,
  }
  const move = nextMove({ scenario, progress, mode, solo, table })
  const cast = castOf(scenario, table)
  const total = scenario.steps.length
  const step = scenario.steps[progress.step]

  // La progression retient le code de la table où elle a été faite : `advance` repart
  // de INITIAL_PROGRESS, on y remet donc le code à chaque mise à jour.
  function updateProgress(next) {
    const withCode = { ...next, tableCode: next.tableCode ?? vals.tableCode ?? null }
    setProgress(withCode)
    save(progressKey, withCode)
  }

  // « Recommencer la démo » depuis une autre vue ou un autre appareil : la remise à
  // zéro donne toujours un nouveau code à la table. Toutes les popins repartent alors
  // de la première étape, pas seulement celle où l'on a cliqué.
  useEffect(() => {
    const code = vals.tableCode
    if (!code || progress.tableCode === code) return
    if (progress.tableCode) {
      doneAutos.current.clear()
      setResetPhase(null)
      setError('')
      updateProgress({ ...INITIAL_PROGRESS, tableCode: code })
    } else {
      updateProgress({ ...progress, tableCode: code })
    }
  }, [vals.tableCode, progress.tableCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // À deux, la vue joueur rattrape le MJ s'il est passé à la suite avant elle.
  useEffect(() => {
    if (mode !== 'joueur' || !table.myCharacterId || progress.tableCode !== vals.tableCode) return
    const synced = syncProgress({ scenario, progress, table })
    if (synced !== progress) updateProgress(synced)
  }) // eslint-disable-line react-hooks/exhaustive-deps


  // Côté MJ, les compagnons (et le héros quand on joue seul) sont « connectés » par
  // le guide pour qu'Auspex les compte dans « Toute l'équipe » et accepte l'attaque.
  const presenceIds =
    mode === 'mj' ? [...cast.companions.map((m) => m.entity.id), ...(solo && cast.hero?.entity ? [cast.hero.entity.id] : [])] : []
  useDemoPresence(presenceIds)

  // L'autre côté de la table, joué par le guide, avec un léger délai pour qu'on voie
  // les choses arriver. Chaque action n'est jouée qu'une fois (clé unique).
  const auto = move.auto
  useEffect(() => {
    if (!auto || doneAutos.current.has(auto.key)) return undefined
    const timer = setTimeout(async () => {
      if (doneAutos.current.has(auto.key)) return
      doneAutos.current.add(auto.key)
      try {
        await runAuto(auto, vals)
        setError('')
      } catch (err) {
        doneAutos.current.delete(auto.key)
        setError(errorText(err))
      }
    }, AUTO_DELAY)
    return () => clearTimeout(timer)
  }, [auto?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Repère visuel : suit le bouton d'Auspex à cliquer (il bouge quand une modale
  // s'ouvre ou que la page défile). On ne fait défiler la page que lorsque le
  // bouton visé change et qu'il est hors de l'écran, pour ne jamais faire sauter
  // le défilement sous les doigts.
  const target = resetPhase ? null : move.target
  const targetKey = target ? JSON.stringify(target) : ''
  useEffect(() => {
    setUserOpened(false)
    if (!target) {
      setCoach(null)
      lastTargetEl.current = null
      return undefined
    }
    function tick() {
      const found = resolveTarget(target)
      const el = found?.el
      if (!el) {
        setCoach((c) => (c ? null : c))
        return
      }
      if (el !== lastTargetEl.current) {
        lastTargetEl.current = el
        scrollTries.current = { count: 0, at: 0 }
      }
      const r = el.getBoundingClientRect()
      // Deux essais au plus par bouton, espacés : la page peut encore bouger juste
      // après son affichage et interrompre le premier défilement.
      const tries = scrollTries.current
      const offscreen = r.top < 0 || r.bottom > window.innerHeight || hiddenInScroller(el, r)
      if (offscreen && tries.count < 2 && Date.now() - tries.at > 1200) {
        scrollTries.current = { count: tries.count + 1, at: Date.now() }
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ block: 'center', behavior: tries.count === 0 && !reduced ? 'smooth' : 'auto' })
      }
      const rect = { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) }
      setCoach((c) => (c && c.hint === found.hint && sameRect(c.rect, rect) ? c : { rect, hint: found.hint }))
    }
    tick()
    const id = setInterval(tick, 250)
    window.addEventListener('scroll', tick, true)
    window.addEventListener('resize', tick)
    return () => {
      clearInterval(id)
      window.removeEventListener('scroll', tick, true)
      window.removeEventListener('resize', tick)
    }
  }, [targetKey, resetPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  // La popin se range en haut de l'écran quand elle cacherait le bouton visé ; si
  // elle le cache en haut comme en bas (petit écran, modale ouverte), elle se réduit
  // à sa consigne, du côté opposé au bouton. La hauteur dépliée est mémorisée pour
  // ne pas osciller entre les deux formes.
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    const p = pop.getBoundingClientRect()
    if (!squeezed) fullHeight.current = p.height
    if (!coach) {
      if (squeezed) setSqueezed(false)
      return
    }
    const h = fullHeight.current || p.height
    const r = coach.rect
    const sameColumn = r.left + r.width > p.left && r.left < p.right
    const hiddenAtBottom = sameColumn && r.top + r.height > window.innerHeight - h - 24
    const hiddenAtTop = sameColumn && r.top < h + 24
    const squeeze = hiddenAtBottom && hiddenAtTop
    const top = squeeze ? r.top + r.height / 2 > window.innerHeight / 2 : hiddenAtBottom
    if (squeeze !== squeezed) setSqueezed(squeeze)
    if (top !== placeTop) setPlaceTop(top)
  }, [coach, squeezed]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onContinue() {
    setError('')
    const next = advance({ scenario, progress, table })
    // On clôt le test fini (ou celui qui traîne avant le combat) pour que la vue MJ
    // revienne au tableau de bord. À deux, c'est le MJ qui s'en charge.
    const endsTest = (step.test && progress.phase === 'play') || (step.combat && progress.phase === 'story')
    if (endsTest && vals.request && (mode === 'mj' || solo)) {
      setBusy(true)
      try {
        await api.endTest()
      } catch {
        // sans conséquence : le prochain ordre remplace la demande
      } finally {
        setBusy(false)
      }
    }
    updateProgress(next)
  }

  async function confirmReset() {
    setResetPhase('busy')
    setError('')
    try {
      await vals.resetTable()
      doneAutos.current.clear()
      updateProgress(INITIAL_PROGRESS)
      setResetPhase(null)
    } catch (err) {
      setError(errorText(err))
      setResetPhase('confirm')
    }
  }

  async function join() {
    setBusy(true)
    setError('')
    try {
      await vals.joinTable(vals.tableCode, move.join.id)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const sideLabel = mode === 'mj' ? 'Vous êtes le MJ' : `Vous jouez ${cast.hero?.name ?? 'le héros'}`
  const countLabel = progress.ending ? 'Démo terminée' : `Étape ${progress.step + 1} sur ${total}`

  let body
  if (resetPhase) {
    body = (
      <div className="guide-dialog" role="dialog" aria-labelledby="demo-reset-title">
        <h4 id="demo-reset-title">Recommencer la démo ?</h4>
        <p>Les PV et les jets sont remis à zéro, les personnages et le dragon recréés. La table de Djoko n'est pas touchée.</p>
        <div className="guide-btn-row">
          <button type="button" className="primary-btn" onClick={confirmReset} disabled={resetPhase === 'busy'}>
            {resetPhase === 'busy' ? 'Remise à zéro…' : 'Recommencer'}
          </button>
          <button type="button" className="secondary-btn" onClick={() => setResetPhase(null)} disabled={resetPhase === 'busy'}>
            Annuler
          </button>
        </div>
      </div>
    )
  } else if (move.empty) {
    body = <div className="guide-alert warn">La table de démo est vide. Recommencez la démo pour recréer les personnages et le dragon.</div>
  } else if (move.join !== undefined) {
    body = (
      <>
        <DemoImage image={scenario.team} />
        <div className="guide-read">
          <span className="guide-tag">Bienvenue</span>
          {scenario.title} : une courte aventure pour découvrir Auspex. Vous jouez {cast.hero?.name}, ses compagnons et le MJ sont joués par le guide.
        </div>
        <p className="demo-say">{move.say}</p>
        <button type="button" className="primary-btn" onClick={join} disabled={busy || !move.join}>
          {busy ? 'Connexion…' : `Rejoindre en jouant ${cast.hero?.name}`}
        </button>
      </>
    )
  } else if (move.ending) {
    const dragonPv = cast.dragon?.pv
    body = (
      <div className="guide-end">
        <DemoImage image={move.ending.image} />
        <h3>{move.ending.title}</h3>
        <p>{move.ending.text}</p>
        {dragonPv && (
          <p className="demo-meta">
            PV du dragon : {dragonPv.current} sur {dragonPv.max}
          </p>
        )}
      </div>
    )
  } else if (move.story) {
    body = (
      <>
        <h3 className="guide-step-title">{step.title}</h3>
        <DemoImage image={step.image} />
        <div className="guide-read">
          <span className="guide-tag">{mode === 'mj' ? 'À lire aux joueurs' : 'Le MJ raconte'}</span>
          {step.read}
        </div>
        <button type="button" className="primary-btn" onClick={onContinue} disabled={busy}>
          {step.combat ? 'Au combat !' : 'Continuer'}
        </button>
      </>
    )
  } else {
    body = (
      <>
        <h3 className="guide-step-title">
          {step.title}
          {move.turn && (
            <span className="demo-meta">
              {' '}
              · tour {move.round} sur {move.rounds}
            </span>
          )}
        </h3>
        {move.turn && !move.target && <DemoImage image={move.turn.image} />}
        {move.turn && <p className="demo-story-line">{move.turn.read}</p>}
        {move.rolls?.length > 0 && (
          <ul className="demo-rolls" aria-label="Jets de l'équipe">
            {move.rolls.map(({ member, roll }) => (
              <li key={member.name} className={roll ? (roll.status === 'success' ? 'ok' : 'ko') : 'wait'}>
                <span>{member.name}</span>
                <b>{roll ? `${roll.status === 'success' ? 'Réussite' : 'Échec'}, ${degreeLabel(roll.degrees, roll.status === 'success')}` : 'en attente'}</b>
              </li>
            ))}
          </ul>
        )}
        {move.say && (
          <p className="demo-say" role="status">
            {move.target && <span className="demo-say-tag">À vous</span>}
            {move.say}
          </p>
        )}
        {move.result && (
          <div className={`guide-read ${move.result.ok ? 'ok' : 'ko'}`} role="status">
            <span className="guide-tag">{step.test ? (move.result.ok ? "Suite : l'équipe réussit" : "Suite : toute l'équipe échoue") : 'Résultat'}</span>
            {move.result.text}
          </div>
        )}
        {move.canContinue && (
          <button type="button" className="primary-btn" onClick={onContinue} disabled={busy}>
            {step.test ? (progress.step + 1 < total ? 'Étape suivante' : 'Terminer') : 'Suite du combat'}
          </button>
        )}
      </>
    )
  }

  return (
    <>
      {coach && (
        <div
          className="demo-coach"
          aria-hidden="true"
          style={{ top: coach.rect.top - 6, left: coach.rect.left - 6, width: coach.rect.width + 12, height: coach.rect.height + 12 }}
        >
          <span className={`demo-coach-label${coach.rect.top < 60 ? ' below' : ''}`}>Cliquez ici : {coach.hint}</span>
        </div>
      )}
      <aside ref={popRef} className={`demo-pop${placeTop ? ' top' : ''}${compact ? ' collapsed' : ''}`} aria-label="Scénario guidé">
        <div className="demo-pop-head">
          <div>
            <div className="demo-pop-title">{scenario.title}</div>
            <div className="demo-meta">
              {sideLabel} · {countLabel}
            </div>
          </div>
          <button type="button" className="demo-pop-toggle" aria-expanded={!compact} onClick={toggleCompact}>
            {compact ? 'Ouvrir' : 'Réduire'}
          </button>
        </div>
        {compact ? (
          move.say && <p className="demo-say compact">{move.say}</p>
        ) : (
          <div className="demo-pop-body">
            <ol className="guide-steps" aria-label="Progression de la démo">
              {scenario.steps.map((s, i) => {
                const state = progress.ending || i < progress.step ? 'done' : i === progress.step ? 'now' : 'todo'
                return (
                  <li key={s.title} className={state} aria-current={state === 'now' ? 'step' : undefined}>
                    <span className="sr-only">
                      Étape {i + 1}, {s.title}
                    </span>
                  </li>
                )
              })}
            </ol>
            {body}
            {error && (
              <div className="guide-alert err" role="alert">
                {error}
              </div>
            )}
            <div className="demo-pop-foot">
              {!resetPhase && (
                <button type="button" className="guide-link" onClick={() => setResetPhase('confirm')}>
                  Recommencer la démo
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
