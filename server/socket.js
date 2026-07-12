// Sockets only carry presence (who's actually connected right now) and the live
// `state:update` push. Every state-changing action goes through the REST API in
// routes.js, which calls `broadcast()` after mutating the database.
export function attachPresence(io, { getSnapshot }) {
  const socketToCharacter = new Map()
  const connectedByCharacter = new Map()

  function isConnected(characterId) {
    return (connectedByCharacter.get(String(characterId))?.size || 0) > 0
  }

  function broadcast() {
    io.emit('state:update', getSnapshot(isConnected))
  }

  io.on('connection', (socket) => {
    socket.emit('state:update', getSnapshot(isConnected))

    socket.on('presence:join', (characterId) => {
      const id = String(characterId)
      socketToCharacter.set(socket.id, id)
      if (!connectedByCharacter.has(id)) connectedByCharacter.set(id, new Set())
      connectedByCharacter.get(id).add(socket.id)
      broadcast()
    })

    socket.on('disconnect', () => {
      const id = socketToCharacter.get(socket.id)
      socketToCharacter.delete(socket.id)
      if (id != null) {
        connectedByCharacter.get(id)?.delete(socket.id)
        broadcast()
      }
    })
  })

  return { broadcast, isConnected }
}
