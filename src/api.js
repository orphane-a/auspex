import { io } from 'socket.io-client'

async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: options?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

export const api = {
  getTable: () => request('/table'),
  resetTable: () => request('/table/reset', { method: 'POST' }),
  endTest: () => request('/table/end-test', { method: 'POST' }),
  createRequest: (body) => request('/table/request', { method: 'POST', body: JSON.stringify(body) }),
  rollDice: (characterId) => request('/table/roll', { method: 'POST', body: JSON.stringify({ characterId }) }),
  joinTable: (code, characterId) => request('/table/join', { method: 'POST', body: JSON.stringify({ code, characterId }) }),
  uploadCharacter: (formData) => request('/characters', { method: 'POST', body: formData }),
  deleteCharacter: (id) => request(`/characters/${id}`, { method: 'DELETE' }),
  updateSkillScore: (characterId, skillName, score) =>
    request(`/characters/${characterId}/skills/${encodeURIComponent(skillName)}`, {
      method: 'PATCH',
      body: JSON.stringify({ score }),
    }),
  updatePv: (characterId, current) => request(`/characters/${characterId}/pv`, { method: 'PATCH', body: JSON.stringify({ current }) }),
  updateArmor: (characterId, armor) => request(`/characters/${characterId}/armor`, { method: 'PATCH', body: JSON.stringify({ armor }) }),
  updatePvBase: (characterId, value) => request(`/characters/${characterId}/pv-base`, { method: 'PATCH', body: JSON.stringify({ value }) }),
  addPvBonus: (characterId, label, amount) =>
    request(`/characters/${characterId}/pv-bonuses`, { method: 'POST', body: JSON.stringify({ label, amount }) }),
  removePvBonus: (characterId, index) => request(`/characters/${characterId}/pv-bonuses/${index}`, { method: 'DELETE' }),
  updateDodgeBonus: (characterId, value) =>
    request(`/characters/${characterId}/dodge-bonus`, { method: 'PATCH', body: JSON.stringify({ value }) }),
  uploadNpc: (formData) => request('/npcs', { method: 'POST', body: formData }),
  deleteNpc: (id) => request(`/npcs/${id}`, { method: 'DELETE' }),
  launchAttack: ({ npcId, weaponName, fireMode, targetCharacterId }) =>
    request('/table/attack', { method: 'POST', body: JSON.stringify({ npcId, weaponName, fireMode, targetCharacterId }) }),
  rollDodge: (characterId) => request('/table/attack/dodge', { method: 'POST', body: JSON.stringify({ characterId }) }),
}

let socket = null
export function getSocket() {
  if (!socket) socket = io({ path: '/socket.io' })
  return socket
}
