import { useEffect } from 'react'
import { io } from 'socket.io-client'

// Démo côté MJ (ticket 97, retour du 22/11) : les compagnons, et le héros quand on
// joue seul, n'ont pas de fenêtre joueur. Pour qu'Auspex les voie « connectés »
// (« Toute l'équipe », attaque d'Aldric), le guide ouvre pour chacun une connexion
// socket qui envoie le même `presence:join` qu'une vraie vue joueur. Rien ne change
// côté serveur ; les connexions se ferment quand on quitte la démo.
export function useDemoPresence(characterIds) {
  const key = [...characterIds].sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (!key) return undefined
    const sockets = key.split(',').map((id) => {
      const socket = io({ path: '/socket.io', forceNew: true })
      socket.on('connect', () => socket.emit('presence:join', Number(id)))
      return socket
    })
    return () => sockets.forEach((s) => s.disconnect())
  }, [key])
}
