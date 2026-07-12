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

  const [showAttack, setShowAttack] = useState(false)
  const [attackTargetId, setAttackTargetId] = useState(null)
  const [attackNpcId, setAttackNpcId] = useState(null)
  const [attackWeaponName, setAttackWeaponName] = useState(null)
  const [attackFireMode, setAttackFireMode] = useState(null)
  const [attackDismissed, setAttackDismissed] = useState(false)
  const [dodging, setDodging] = useState(false)
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

  // First available mode for a weapon, in coup-par-coup / semi / auto priority —
  // an initial default only, never remembered between attacks (V2 §11).
  function defaultFireMode(weapon) {
    if (!weapon) return null
    if (weapon.mode.single) return 'single'
    if (weapon.mode.semiCapacity != null) return 'semi'
    if (weapon.mode.autoCapacity != null) return 'auto'
    return null
  }

  // Séquence d'attaque/esquive (V2 §10 v2) — le MJ choisit le PNJ et l'arme parmi
  // les fiches PNJ uploadées, au lieu d'un score ennemi libre.
  function openAttack(characterId) {
    const connectedIds = characters.filter((c) => c.connected).map((c) => c.id)
    setAttackTargetId(characterId != null && connectedIds.includes(characterId) ? characterId : connectedIds[0] ?? null)
    const firstNpc = npcs[0] || null
    const firstWeapon = firstNpc?.weapons[0] || null
    setAttackNpcId(firstNpc?.id ?? null)
    setAttackWeaponName(firstWeapon?.name ?? null)
    setAttackFireMode(defaultFireMode(firstWeapon))
    setAttackError('')
    setShowAttack(true)
  }
  function closeAttack() {
    setShowAttack(false)
  }
  function selectAttackNpc(npcId) {
    setAttackNpcId(npcId)
    const npc = npcs.find((n) => n.id === npcId)
    const firstWeapon = npc?.weapons[0] || null
    setAttackWeaponName(firstWeapon?.name ?? null)
    setAttackFireMode(defaultFireMode(firstWeapon))
  }
  function selectAttackWeapon(weaponName) {
    setAttackWeaponName(weaponName)
    const npc = npcs.find((n) => n.id === attackNpcId)
    const weapon = npc?.weapons.find((w) => w.name === weaponName) || null
    setAttackFireMode(defaultFireMode(weapon))
  }
  async function launchAttack() {
    if (attackTargetId == null || attackNpcId == null || !attackWeaponName || !attackFireMode) return
    setAttackError('')
    try {
      await api.launchAttack({ npcId: attackNpcId, weaponName: attackWeaponName, fireMode: attackFireMode, targetCharacterId: attackTargetId })
      setShowAttack(false)
    } catch (err) {
      setAttackError(err.message)
    }
  }
  function dismissAttack() {
    setAttackDismissed(true)
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
      dot: c.connected ? '#8fbf87' : 'rgba(230,224,212,.3)',
      statusText: c.connected ? 'Connecté' : 'Pas encore rejoint',
      statusCol: c.connected ? '#8fbf87' : 'rgba(230,224,212,.4)',
      op: c.connected ? '1' : '.55',
      pvCurrent: c.pv.current,
      pvMax: c.pv.max,
      pvRatio: c.pv.max > 0 ? Math.max(0, Math.min(1, c.pv.current / c.pv.max)) : 0,
      pvStatusLabel: status.label,
      pvStatusKey: status.key,
      isDown: c.pv.current <= 0,
    }
  })

  const myPvStatus = myCharacter ? pvStatus(myCharacter.pv) : null
  const myPvRatio = myCharacter && myCharacter.pv.max > 0 ? Math.max(0, Math.min(1, myCharacter.pv.current / myCharacter.pv.max)) : 0
  const myArmorList = myCharacter ? HIT_LOCATIONS.map((l) => ({ key: l.key, label: l.label, value: myCharacter.armor[l.key] || 0 })) : []
  const damageNoticeText = damageNotice
    ? `Vous encaissez ${damageNotice.rawDamage} dégâts${damageNotice.armor > 0 ? ` (${Math.min(damageNotice.armor, damageNotice.rawDamage)} absorbés)` : ''}`
    : ''

  const attackTargetCharacter = attack ? characters.find((c) => c.id === attack.targetCharacterId) || null : null
  const attackOutcomeText = attackOutcomeLabel(attack)
  const meIsAttackTarget = !!attack && myCharacterId != null && attack.targetCharacterId === myCharacterId
  const attackPendingForMe = meIsAttackTarget && attack.outcome === 'pending-dodge'
  const attackResolvedForMe = meIsAttackTarget && attack.outcome !== 'pending-dodge' && !attackDismissed
  const showAttackCard = !!attack && (attack.outcome === 'pending-dodge' || !attackDismissed)

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
  // Cible restreinte aux personnages connectés (V2 §10/§11) — pas de mode de
  // secours pour un joueur absent.
  const attackTargetOptions = connectedCharacters.map((c) => ({ id: c.id, name: c.name, isActive: c.id === attackTargetId, select: () => setAttackTargetId(c.id) }))
  const npcOptions = npcs.map((n) => ({ id: n.id, name: n.name, isActive: n.id === attackNpcId, select: () => selectAttackNpc(n.id) }))
  const attackNpc = npcs.find((n) => n.id === attackNpcId) || null
  const weaponOptions = (attackNpc?.weapons || []).map((w) => ({
    name: w.name,
    isActive: w.name === attackWeaponName,
    select: () => selectAttackWeapon(w.name),
  }))
  const attackWeapon = attackNpc?.weapons.find((w) => w.name === attackWeaponName) || null
  const fireModeOptions = [
    { key: 'single', label: 'Coup par coup', available: !!attackWeapon?.mode.single },
    { key: 'semi', label: 'Semi-auto', available: attackWeapon?.mode.semiCapacity != null },
    { key: 'auto', label: 'Auto', available: attackWeapon?.mode.autoCapacity != null },
  ]
    .filter((m) => m.available)
    .map((m) => ({ key: m.key, label: m.label, isActive: m.key === attackFireMode, select: () => setAttackFireMode(m.key) }))

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
    pScreenMain: (!request || !meConcerned || dismissed) && !attackPendingForMe && !attackResolvedForMe,
    pScreenRequest: meConcerned && !myRolled && !dismissed && !attackPendingForMe && !attackResolvedForMe,
    pScreenResult: meConcerned && myRolled && !dismissed && !attackPendingForMe && !attackResolvedForMe,
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
    npcs,
    uploadNpc,
    deleteNpc,
    showAttack,
    openAttack,
    closeAttack,
    attackTargetOptions,
    npcOptions,
    weaponOptions,
    fireModeOptions,
    attackError,
    launchAttack,
    attack,
    attackTargetCharacter,
    attackOutcomeText,
    showAttackCard,
    dismissAttack,
    attackPendingForMe,
    attackResolvedForMe,
    dodging,
    rollDodge,
  }
}
