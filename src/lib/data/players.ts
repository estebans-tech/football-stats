import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import type { PlayerLocal } from '$lib/types/domain'

const isActive = (p: PlayerLocal) =>
  (p.active !== false) && !p.archivedAtLocal && !p.deletedAtLocal

export function observeLocalActivePlayersMap() {
  const db = assertDb()
  return readable<Record<string, PlayerLocal>>({}, (set) => {
    const sub = liveQuery(() => db.players_local.toArray()).subscribe({
      next: (rows) => {
        const map: Record<string, PlayerLocal> = {}
        for (const p of rows) if (isActive(p)) map[p.id] = p
        set(map)
      },
      error: () => set({})
    })
    return () => sub.unsubscribe()
  })
}