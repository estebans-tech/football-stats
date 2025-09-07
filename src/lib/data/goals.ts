import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import type { GoalLocal } from '$lib/types/domain'

export function observeLocalGoalsForMatch(matchId: string) {
    const db = assertDb()
    return readable<GoalLocal[]>([], (set) => {
      const sub = liveQuery(async () => {
        const rows = await db.goals_local
          .where('matchId').equals(matchId)
          .filter(g => !g.deletedAtLocal)
          .sortBy('minute')
        return rows
      }).subscribe({ next: set, error: () => set([]) })
      return () => sub.unsubscribe()
    })
  }