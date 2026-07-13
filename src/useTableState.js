import { useEffect, useRef, useState } from 'react'
import { api, getSocket } from './api'
import {
  MALUS_OPTIONS,
  characteristicTendencies,
  groupSkillsByCharacteristic,
  statusMeta,
  pvStatus,
  HIT_LOCATIONS,
  attackOutcomeLabel,
  attackRollDegreeLabel,
} from './gameLogic'

const MY_CHARACTER_KEY = 'auspex.myCharacterId'

export function useTableState() {
  const [snapshot, setSnapshot] = useState(null)
  const [myCharacterId, setMyCharacterId] = useState(() => {
    const raw = localStorage.getItem(MY_CHARACTER_KEY)
    return raw ? Number(raw) : null
  })

  const [showLaunch, setShowLaunch] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState('')
  const [malus, setMalus] = useState(null)
  const [whoMode, setWhoMode] = useState('all')
  const [chosen, setChosen] = useState({})
  const [rolling, setRolling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const [damageNotice, setDamageNotice] = useState(null)
  const seenDamageIdRef = useRef(undefined)

  const [attackAttackerNotice, setAttackAttackerNotice] = useState(null)
  const seenAttackerNoticeIdRef = useRef(undefined)

  const [showAttack, setShowAttack] = useState(false)
  const [attackerType, setAttackerType] = useState(null)
  const [attackerId, setAttackerId] = useState(null)
  const [defenderType, setDefenderType] = useState(null)
  const [defenderId, setDefenderId] = useState(null)
  const [attackWeaponName, setAttackWeaponName] = useState(null)
  const [attackFireMode, setAttackFireMode] = useState(null)
  const [attackDismissed, setAttackDismissed] = useState(false)
  const [dodging, setDodging] = useState(false)
  const [npcDodging, setNpcDodging] = useState(false)
  const [rollingAttack, setRollingAttack] = useState(false)
  const [attackError, setAttackError] = useState('')

  const socketRef = useRef(null)
  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    function onUpdate(data) {
      setSnapshot(data)
    }
    function onConnect() {
      if (myCharacterId) socket.emit('presence:join', myCharacterId)
    }
    socket.on('state:update', onUpdate)
    socket.on('connect', onConnect)
    if (socket.connected) onConnect()

    return () => {
      socket.off('state:update', onUpdate)
      socket.off('connect', onConnect)
    }
  }, [myCharacterId])

  const request = snapshot?.request ?? null
  const rolls = snapshot?.rolls ?? {}
  const attack = snapshot?.attack ?? null
  const characters = snapshot?.characters ?? []
  const npcs = snapshot?.npcs ?? []
  const availableSkills = snapshot?.availableSkills ?? []
  const code = snapshot?.code ?? ''
  const myCharacter = characters.find((c) => c.id === myCharacterId) || null

  useEffect(() => {
    setDismissed(false)
  }, [request?.id])

  // Each new attack sequence (V2 §10) gets its own dismiss flag, mirroring the
  // skill-test `dismissed` above — local-only so the MJ dismissing their card
  // doesn't hide the result screen the targeted player still needs to see.
  useEffect(() => {
    setAttackDismissed(false)
  }, [attack?.id])

  // Transient "you took damage" banner (V2 §6) — skips the very first snapshot so a
  // leftover lastDamage from earlier in the session doesn't pop up on load, then
  // fires once per new damage event targeted at this player's own character.
  useEffect(() => {
    const ld = snapshot?.lastDamage
    if (seenDamageIdRef.current === undefined) {
      seenDamageIdRef.current = ld?.id ?? null
      return
    }
    if (!ld || ld.id === seenDamageIdRef.current || ld.characterId !== myCharacterId) return
    seenDamageIdRef.current = ld.id
    setDamageNotice(ld)
    const timer = setTimeout(() => setDamageNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [snapshot, myCharacterId])

  // A table reset wipes every character server-side — if this browser was mid-session
  // as a player, its saved character no longer exists once a fresh snapshot arrives.
  useEffect(() => {
    if (myCharacterId && snapshot && !myCharacter) {
      localStorage.removeItem(MY_CHARACTER_KEY)
      setMyCharacterId(null)
    }
  }, [myCharacterId, snapshot, myCharacter])

  async function joinTable(codeInput, characterId) {
    await api.joinTable(codeInput, characterId)
    localStorage.setItem(MY_CHARACTER_KEY, String(characterId))
    setMyCharacterId(characterId)
    socketRef.current?.emit('presence:join', characterId)
  }

  async function uploadCharacter(name, cls, file) {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('cls', cls)
    formData.append('file', file)
    await api.uploadCharacter(formData)
  }

  async function deleteCharacter(id) {
    await api.deleteCharacter(id)
  }

  async function uploadNpc(name, file) {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('file', file)
    await api.uploadNpc(formData)
  }

  async function deleteNpc(id) {
    await api.deleteNpc(id)
  }

  async function updateSkillScore(characterId, skillName, score) {
    await api.updateSkillScore(characterId, skillName, score)
  }

  async function updatePvBase(characterId, value) {
    await api.updatePvBase(characterId, value)
  }

  async function updatePvCurrent(characterId, value) {
    await api.updatePv(characterId, value)
  }

  async function updateArmorLocation(characterId, locationKey, value) {
    await api.updateArmor(characterId, { [locationKey]: value })
  }

  async function addPvBonus(characterId, label, amount) {
    await api.addPvBonus(characterId, label, amount)
  }

  async function removePvBonus(characterId, index) {
    await api.removePvBonus(characterId, index)
  }

  async function updateDodgeBonus(characterId, value) {
    await api.updateDodgeBonus(characterId, value)
  }

  async function updateNpcDodgeBonus(npcId, value) {
    await api.updateNpcDodgeBonus(npcId, value)
  }

  // First available mode for a weapon, in mêlée / coup-par-coup / semi / auto
  // priority — an initial default only, never remembered between attacks (V2 §11).
  function defaultFireMode(weapon) {
    if (!weapon) return null
    if (weapon.mode.melee) return 'melee'
    if (weapon.mode.single) return 'single'
    if (weapon.mode.semiCapacity != null) return 'semi'
    if (weapon.mode.autoCapacity != null) return 'auto'
    return null
  }

  function entityOfType(type, id) {
    if (id == null) return null
    return type === 'npc' ? npcs.find((n) => n.id === id) : characters.find((c) => c.id === id)
  }

  // Séquence d'attaque (V3 §5/§6) : le MJ choisit librement l'attaquant et la cible
  // parmi les PNJ et les personnages, dans n'importe quelle combinaison — le bouton
  // n'est plus rattaché à une ligne personnage, donc plus de préremplissage à partir
  // d'un characterId.
  function openAttack() {
    const firstNpc = npcs[0] || null
    const firstCharacter = characters[0] || null
    const attackerEntity = firstNpc || firstCharacter
    const attackerEntityType = firstNpc ? 'npc' : firstCharacter ? 'character' : null
    setAttackerType(attackerEntityType)
    setAttackerId(attackerEntity?.id ?? null)

    // Repli par défaut : un joueur connecté différent de l'attaquant si possible,
    // sinon un PNJ différent de l'attaquant — juste un point de départ pratique,
    // le MJ reste libre de tout changer dans la modale.
    const connectedOther = characters.find((c) => c.connected && !(attackerEntityType === 'character' && c.id === attackerEntity?.id))
    const npcOther = npcs.find((n) => !(attackerEntityType === 'npc' && n.id === attackerEntity?.id))
    const defenderEntity = connectedOther || npcOther || null
    const defenderEntityType = connectedOther ? 'character' : npcOther ? 'npc' : null
    setDefenderType(defenderEntityType)
    setDefenderId(defenderEntity?.id ?? null)

    const firstWeapon = attackerEntity?.weapons[0] || null
    setAttackWeaponName(firstWeapon?.name ?? null)
    setAttackFireMode(defaultFireMode(firstWeapon))
    setAttackError('')
    setShowAttack(true)
  }
  function closeAttack() {
    setShowAttack(false)
  }
  function selectAttacker(type, id) {
    setAttackerType(type)
    setAttackerId(id)
    const entity = entityOfType(type, id)
    const firstWeapon = entity?.weapons[0] || null
    setAttackWeaponName(firstWeapon?.name ?? null)
    setAttackFireMode(defaultFireMode(firstWeapon))
  }
  function selectDefender(type, id) {
    setDefenderType(type)
    setDefenderId(id)
  }
  function selectAttackWeapon(weaponName) {
    setAttackWeaponName(weaponName)
    const entity = entityOfType(attackerType, attackerId)
    const weapon = entity?.weapons.find((w) => w.name === weaponName) || null
    setAttackFireMode(defaultFireMode(weapon))
  }
  async function launchAttack() {
    if (attackerType == null || attackerId == null || defenderType == null || defenderId == null || !attackWeaponName || !attackFireMode) return
    setAttackError('')
    try {
      await api.launchAttack({ attackerType, attackerId, defenderType, defenderId, weaponName: attackWeaponName, fireMode: attackFireMode })
      setShowAttack(false)
    } catch (err) {
      setAttackError(err.message)
    }
  }
  function dismissAttack() {
    setAttackDismissed(true)
  }
  // Filet de sécurité MJ : débloque la séquence si elle reste coincée en attente
  // (jet d'attaque ou d'esquive), sans passer par une réinitialisation complète de
  // la table qui viderait aussi les personnages.
  async function cancelAttack() {
    await api.cancelAttack()
  }
  async function rollDodge() {
    if (!myCharacterId || dodging) return
    setDodging(true)
    try {
      await api.rollDodge(myCharacterId)
      // Same readability pause as rollDice — the server resolves instantly.
      await new Promise((resolve) => setTimeout(resolve, 900))
    } finally {
      setDodging(false)
    }
  }
  // MJ lance l'esquive à la place d'un PNJ visé (V3 §3/§5) — pas de client PNJ à
  // distance pour cliquer son propre "LANCER".
  async function rollNpcDodge() {
    if (npcDodging) return
    setNpcDodging(true)
    try {
      await api.rollNpcDodge()
      await new Promise((resolve) => setTimeout(resolve, 900))
    } finally {
      setNpcDodging(false)
    }
  }
  // Le personnage attaquant lance lui-même son jet d'attaque (V3 §5 v2) —
  // symétrique de rollDodge côté défenseur.
  async function rollAttack() {
    if (!myCharacterId || rollingAttack) return
    setRollingAttack(true)
    try {
      await api.rollAttack(myCharacterId)
      await new Promise((resolve) => setTimeout(resolve, 900))
    } finally {
      setRollingAttack(false)
    }
  }

  async function resetTable() {
    await api.resetTable()
    localStorage.removeItem(MY_CHARACTER_KEY)
    setMyCharacterId(null)
  }

  function openLaunch() {
    setShowLaunch(true)
    setSelectedSkill(availableSkills[0]?.name || '')
    setMalus(null)
    setWhoMode('all')
    setChosen({})
  }
  function closeLaunch() {
    setShowLaunch(false)
  }
  function togglePlayer(id) {
    setChosen((c) => ({ ...c, [id]: !c[id] }))
  }

  function concernedCharacterIds() {
    const connectedIds = characters.filter((c) => c.connected).map((c) => c.id)
    if (whoMode === 'all') return connectedIds
    return connectedIds.filter((id) => chosen[id])
  }

  async function sendRequest() {
    const concerned = concernedCharacterIds()
    if (!selectedSkill || concerned.length === 0) return
    await api.createRequest({ skill: selectedSkill, malus, concernedCharacterIds: concerned })
    setShowLaunch(false)
    setRolling(false)
  }

  async function startNewTest() {
    await api.endTest()
    setRolling(false)
  }

  function dismissResult() {
    setDismissed(true)
  }

  async function rollDice() {
    if (!myCharacterId || rolling || rolls[myCharacterId]) return
    setRolling(true)
    try {
      await api.rollDice(myCharacterId)
      // The server resolves the roll instantly; a short pause keeps the dice-spin
      // animation readable instead of flashing the result immediately.
      await new Promise((resolve) => setTimeout(resolve, 900))
    } finally {
      setRolling(false)
    }
  }

  const concernedCharacters = request
    ? characters.filter((c) => request.concernedCharacterIds.includes(c.id))
    : characters.filter((c) => c.connected)
  const meConcerned = !!request && myCharacterId != null && request.concernedCharacterIds.includes(myCharacterId)
  const myRoll = myCharacterId != null ? rolls[myCharacterId] : null
  const myRolled = !!myRoll
  const rollsList = concernedCharacters.map((c) => ({ id: c.id, name: c.name, cls: c.cls, avatar: c.avatar, ...statusMeta(rolls[c.id]) }))
  const received = concernedCharacters.filter((c) => rolls[c.id]).length
  const myMeta = statusMeta(myRoll)
  const teammates = concernedCharacters
    .filter((c) => c.id !== myCharacterId)
    .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, ...statusMeta(rolls[c.id]) }))

  const roster = characters.map((c) => {
    const status = pvStatus(c.pv)
    return {
      id: c.id,
      name: c.name,
      cls: c.cls,
      avatar: c.avatar,
      connected: c.connected,
      dot: c.connected ? '#5ffca8' : 'rgba(214,228,218,.3)',
      statusText: c.connected ? 'Connecté' : 'Pas encore rejoint',
      statusCol: c.connected ? '#5ffca8' : 'rgba(214,228,218,.4)',
      op: c.connected ? '1' : '.55',
      pvCurrent: c.pv.current,
      pvMax: c.pv.max,
      pvRatio: c.pv.max > 0 ? Math.max(0, Math.min(1, c.pv.current / c.pv.max)) : 0,
      pvStatusLabel: status.label,
      pvStatusKey: status.key,
      isDown: c.pv.current <= 0,
    }
  })

  // Barre de PV pour les PNJ dans la vue MJ (V3 §6) — même modèle pv que les
  // personnages, jamais branché à l'affichage jusqu'ici faute d'usage (V2 §11).
  const npcRoster = npcs.map((n) => {
    const status = pvStatus(n.pv)
    return {
      id: n.id,
      name: n.name,
      pvCurrent: n.pv.current,
      pvMax: n.pv.max,
      pvRatio: n.pv.max > 0 ? Math.max(0, Math.min(1, n.pv.current / n.pv.max)) : 0,
      pvStatusLabel: status.label,
      pvStatusKey: status.key,
      isDown: n.pv.current <= 0,
    }
  })

  const myPvStatus = myCharacter ? pvStatus(myCharacter.pv) : null
  const myPvRatio = myCharacter && myCharacter.pv.max > 0 ? Math.max(0, Math.min(1, myCharacter.pv.current / myCharacter.pv.max)) : 0
  const myArmorList = myCharacter ? HIT_LOCATIONS.map((l) => ({ key: l.key, label: l.label, value: myCharacter.armor[l.key] || 0 })) : []
  const damageNoticeText = damageNotice
    ? `Vous encaissez ${damageNotice.rawDamage} dégâts${damageNotice.armor > 0 ? ` (${Math.min(damageNotice.armor, damageNotice.rawDamage)} absorbés)` : ''}`
    : ''
  const attackAttackerNoticeText = attackAttackerNotice?.text ?? ''

  const attackAttackerEntity = attack ? entityOfType(attack.attacker.type, attack.attacker.id) : null
  const attackDefenderEntity = attack ? entityOfType(attack.defender.type, attack.defender.id) : null
  const attackOutcomeText = attackOutcomeLabel(attack)
  const attackRollDegreeText = attackRollDegreeLabel(attack)
  const meIsAttackTarget = !!attack && myCharacterId != null && attack.defender.type === 'character' && attack.defender.id === myCharacterId
  const meIsAttacker = !!attack && myCharacterId != null && attack.attacker.type === 'character' && attack.attacker.id === myCharacterId
  // "Resolved" veut dire un des trois états terminaux — pas juste "différent de
  // pending-dodge" (bug V3 §5 v2 : avec pending-attack-roll comme état intermédiaire
  // supplémentaire, cette ancienne condition marquait à tort la cible comme
  // "résolue" avant même que l'attaquant ait lancé son dé).
  const attackIsTerminal = attack && ['miss', 'dodged', 'hit'].includes(attack.outcome)
  const attackPendingForMe = meIsAttackTarget && attack.outcome === 'pending-dodge'
  const attackResolvedForMe = meIsAttackTarget && attackIsTerminal && !attackDismissed
  const attackPendingForNpcDefender = !!attack && attack.outcome === 'pending-dodge' && attack.defender.type === 'npc'
  // Le personnage attaquant lance lui-même son jet (V3 §5 v2) — symétrique de
  // attackPendingForMe côté défenseur, pas d'écran de résultat dédié une fois le
  // jet fait : la séquence continue sans plus rien demander à l'attaquant.
  const attackPendingForMeAsAttacker = meIsAttacker && attack.outcome === 'pending-attack-roll'
  // L'attaquant a touché mais n'a plus rien à faire : la cible teste son esquive
  // (elle-même ou le MJ pour un PNJ) — sans ça, l'attaquant restait sans nouvelle
  // entre son propre jet et la notification finale (améliore le wording, retour MJ).
  const attackWaitingForDodgeAsAttacker = meIsAttacker && attack.outcome === 'pending-dodge'
  const attackWaitingOnAttacker = !!attack && attack.outcome === 'pending-attack-roll'
  const showAttackCard = !!attack && (attack.outcome === 'pending-attack-roll' || attack.outcome === 'pending-dodge' || !attackDismissed)
  // Même encart que la vue MJ ("Garde Impérial attaque Djoko"), repris sur tous les
  // écrans joueur liés à l'attaque pour que le sens du combat soit toujours clair,
  // même quand ce n'est pas au joueur d'agir.
  const attackDirectionText = attack ? `${attackAttackerEntity?.name ?? '?'} attaque ${attackDefenderEntity?.name ?? '?'}` : ''

  // Notification passive du résultat pour l'attaquant (V3 §7, confirmé utile à
  // l'usage) : contrairement au défenseur (déjà notifié via son propre écran de
  // résultat), l'attaquant n'a plus rien à faire une fois son jet lancé et n'aurait
  // sinon jamais su si sa cible a esquivé ou encaissé des dégâts. Transitoire comme
  // le bandeau de dégâts encaissés, plutôt qu'un écran dédié : l'attaquant a déjà
  // quitté la séquence à ce stade.
  useEffect(() => {
    if (seenAttackerNoticeIdRef.current === undefined) {
      seenAttackerNoticeIdRef.current = meIsAttacker && attackIsTerminal ? attack.id : null
      return
    }
    if (!meIsAttacker || !attackIsTerminal || attack.id === seenAttackerNoticeIdRef.current) return
    seenAttackerNoticeIdRef.current = attack.id
    // Même encart "X attaque Y" que la vue MJ (retour MJ), pour rester cohérent avec
    // les autres écrans joueur de la séquence plutôt qu'une phrase différente ici.
    setAttackAttackerNotice({ id: attack.id, text: `${attackDirectionText} — ${attackOutcomeText}` })
    const timer = setTimeout(() => setAttackAttackerNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [attack, meIsAttacker, attackIsTerminal, attackOutcomeText, attackDirectionText])

  function buildSkillGroupsWithChips(items) {
    return groupSkillsByCharacteristic(items).map((group) => ({
      characteristic: group.characteristic,
      characteristicName: group.characteristicName,
      chips: group.items.map((skill) => ({ name: skill.name, isActive: skill.name === selectedSkill, select: () => setSelectedSkill(skill.name) })),
    }))
  }
  const skillGroups = buildSkillGroupsWithChips(availableSkills)
  // Same picker, one tab per player — useful once characters' grids diverge and
  // the MJ wants "what can *this* player actually attempt" rather than the union.
  const skillGroupsByCharacter = characters.map((c) => ({ id: c.id, name: c.name, groups: buildSkillGroupsWithChips(c.skills) }))
  const mySkillGroups = myCharacter
    ? groupSkillsByCharacteristic(myCharacter.skills).map((group) => ({
        characteristic: group.characteristic,
        characteristicName: group.characteristicName,
        skills: group.items.map((skill) => skill.name),
      }))
    : []
  const malusOpts = MALUS_OPTIONS.map((m) => ({ label: m, isActive: m === malus, set: () => setMalus(malus === m ? null : m) }))
  const connectedCharacters = characters.filter((c) => c.connected)
  const selectable = connectedCharacters.map((c) => ({ id: c.id, name: c.name, isChosen: !!chosen[c.id], toggle: () => togglePlayer(c.id) }))

  // Modale d'attaque (V3 §3/§6) : listes complètes PNJ + Joueurs, pour l'attaquant
  // comme pour la cible — un attaquant peut être un joueur non connecté (§6) ; côté
  // cible, le serveur bloque lui-même un Joueur non connecté (message affiché via
  // attackError), donc pas de filtre ici non plus.
  function buildSideOptions(type, currentType, currentId, onSelect) {
    const items = type === 'npc' ? npcs : characters
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      connected: type === 'character' ? item.connected : true,
      isActive: currentType === type && currentId === item.id,
      select: () => onSelect(type, item.id),
    }))
  }
  const attackerNpcOptions = buildSideOptions('npc', attackerType, attackerId, selectAttacker)
  const attackerCharacterOptions = buildSideOptions('character', attackerType, attackerId, selectAttacker)
  const defenderNpcOptions = buildSideOptions('npc', defenderType, defenderId, selectDefender)
  const defenderCharacterOptions = buildSideOptions('character', defenderType, defenderId, selectDefender)

  const attackerEntity = entityOfType(attackerType, attackerId)
  const weaponOptions = (attackerEntity?.weapons || []).map((w) => ({
    name: w.name,
    isActive: w.name === attackWeaponName,
    select: () => selectAttackWeapon(w.name),
  }))
  const attackWeapon = attackerEntity?.weapons.find((w) => w.name === attackWeaponName) || null
  const fireModeOptions = [
    { key: 'melee', label: 'Corps à corps', available: !!attackWeapon?.mode.melee },
    { key: 'single', label: 'Coup par coup', available: !!attackWeapon?.mode.single },
    { key: 'semi', label: 'Semi-auto', available: attackWeapon?.mode.semiCapacity != null },
    { key: 'auto', label: 'Auto', available: attackWeapon?.mode.autoCapacity != null },
  ]
    .filter((m) => m.available)
    .map((m) => ({ key: m.key, label: m.label, isActive: m.key === attackFireMode, select: () => setAttackFireMode(m.key) }))
  const defenderCharacterDisconnected = defenderType === 'character' && defenderId != null && !characters.find((c) => c.id === defenderId)?.connected
  // Un personnage attaquant doit désormais rester connecté (V3 §5 v2) : lui seul
  // peut cliquer son propre jet, contrairement au PNJ dont le jet reste automatique.
  const attackerCharacterDisconnected = attackerType === 'character' && attackerId != null && !characters.find((c) => c.id === attackerId)?.connected
  // Un combattant contre lui-même n'a pas de sens (aucune règle ne le résout) —
  // bloqué au même endroit que les autres cas invalides plutôt que côté serveur
  // uniquement, pour ne pas laisser le bouton "Lancer l'attaque" cliquable.
  const attackerIsDefender = attackerType != null && attackerId != null && attackerType === defenderType && attackerId === defenderId
  const attackLaunchDisabled =
    attackerId == null ||
    defenderId == null ||
    weaponOptions.length === 0 ||
    fireModeOptions.length === 0 ||
    defenderCharacterDisconnected ||
    attackerCharacterDisconnected ||
    attackerIsDefender

  return {
    loading: !snapshot,
    code,
    tableCode: code,
    characters,
    availableSkills,
    myCharacter,
    me: myCharacter ? { name: myCharacter.name, cls: myCharacter.cls, avatar: myCharacter.avatar } : null,
    roster,
    connectedCount: connectedCharacters.length,
    totalCount: characters.length,
    mjDashboard: !request,
    mjResults: !!request,
    showLaunch,
    skillGroups,
    skillGroupsByCharacter,
    malusOpts,
    whoMode,
    setWhoAll: () => setWhoMode('all'),
    setWhoSome: () => setWhoMode('some'),
    selectable,
    reqSkill: request ? request.skill : '',
    reqMalus: request ? request.malus : '',
    rollsList,
    receivedText: `${received} / ${concernedCharacters.length} jets reçus`,
    mySkillGroups,
    characteristicTendencies: myCharacter ? characteristicTendencies(myCharacter.skills) : [],
    pScreenMain:
      (!request || !meConcerned || dismissed) &&
      !attackPendingForMe &&
      !attackResolvedForMe &&
      !attackPendingForMeAsAttacker &&
      !attackWaitingForDodgeAsAttacker,
    pScreenRequest:
      meConcerned &&
      !myRolled &&
      !dismissed &&
      !attackPendingForMe &&
      !attackResolvedForMe &&
      !attackPendingForMeAsAttacker &&
      !attackWaitingForDodgeAsAttacker,
    pScreenResult:
      meConcerned &&
      myRolled &&
      !dismissed &&
      !attackPendingForMe &&
      !attackResolvedForMe &&
      !attackPendingForMeAsAttacker &&
      !attackWaitingForDodgeAsAttacker,
    showRollBtn: meConcerned && !myRolled && !rolling,
    rolling,
    myLabel: myMeta.label,
    myDegree: myMeta.degreeText,
    myBorder: myMeta.borderCol,
    myBg: myMeta.bgCol,
    myText: myMeta.textCol,
    teammates,
    openLaunch,
    closeLaunch,
    sendRequest,
    rollDice,
    startNewTest,
    dismissResult,
    joinTable,
    uploadCharacter,
    deleteCharacter,
    updateSkillScore,
    resetTable,
    updatePvBase,
    updatePvCurrent,
    updateArmorLocation,
    addPvBonus,
    removePvBonus,
    updateDodgeBonus,
    myPvStatus,
    myPvRatio,
    myArmorList,
    isMeDown: !!myCharacter && myCharacter.pv.current <= 0,
    damageNoticeText,
    attackAttackerNoticeText,
    npcs,
    npcRoster,
    uploadNpc,
    deleteNpc,
    updateNpcDodgeBonus,
    showAttack,
    openAttack,
    closeAttack,
    attackerNpcOptions,
    attackerCharacterOptions,
    defenderNpcOptions,
    defenderCharacterOptions,
    weaponOptions,
    fireModeOptions,
    attackError,
    attackLaunchDisabled,
    defenderCharacterDisconnected,
    attackerCharacterDisconnected,
    attackerIsDefender,
    launchAttack,
    attack,
    attackAttackerEntity,
    attackDefenderEntity,
    attackOutcomeText,
    attackRollDegreeText,
    showAttackCard,
    dismissAttack,
    cancelAttack,
    attackPendingForMe,
    attackResolvedForMe,
    attackPendingForNpcDefender,
    attackPendingForMeAsAttacker,
    attackWaitingForDodgeAsAttacker,
    attackWaitingOnAttacker,
    attackDirectionText,
    dodging,
    rollDodge,
    npcDodging,
    rollNpcDodge,
    rollingAttack,
    rollAttack,
  }
}
