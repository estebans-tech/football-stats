import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import type { LineupLocal } from '$lib/types/domain'

export function observeLocalLineupsForMatch(matchId: string) {
  const db = assertDb()
  return readable<LineupLocal[]>([], (set) => {
    const sub = liveQuery(async () => {
      const rows = await db.lineups_local
        .where('matchId').equals(matchId)
        .filter(l => !l.deletedAtLocal)
        .toArray()
      // sortera ex. half->team->playerId för stabil rendering
      rows.sort((a,b) => (a.half - b.half) || (a.team > b.team ? 1 : -1) || (a.playerId > b.playerId ? 1 : -1))
      return rows
    }).subscribe({ next: set, error: () => set([]) })
    return () => sub.unsubscribe()
  })
}