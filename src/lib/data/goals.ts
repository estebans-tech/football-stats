import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import type { GoalLocal } from '$lib/types/domain'
import { uid } from '$lib/utils/utils'             // your existing uid

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


/** Hämta mål för en halvlek – robust utan compound-index och exkluderar soft deletes. */
export const listGoals = async (matchId: string, half: 1 | 2) => {
    const db = assertDb()
    const rows = await db.goals_local.where('matchId').equals(matchId).toArray()
    const live = rows.filter(r => r.half === half && !r.deletedAtLocal)
    // sortera på updatedAtLocal (äldst→nyast)
    return live.sort((a, b) => (a.updatedAtLocal ?? 0) - (b.updatedAtLocal ?? 0))
  }
  
  export const addGoal = async (g: {
    matchId: string, half: 1|2, team: 'A'|'B',
    scorerId: string, assistId?: string | null, minute?: number | null
  }) => {
    const now = Date.now()
    await assertDb().goals_local.put({
      id: uid(),
      matchId: g.matchId,
      half: g.half,
      team: g.team,
      scorerId: g.scorerId,
      assistId: g.assistId ?? undefined,
      minute: g.minute ?? undefined,
      createdAt: now,
      updatedAtLocal: now,
      deletedAtLocal: undefined
    })
  }
  
  export const updateGoal = async (id: string, patch: Partial<{
    team:'A'|'B', scorerId:string, assistId:string|null, minute:number|null
  }>) => {
    await assertDb().goals_local.update(id, { ...patch, updatedAtLocal: Date.now() })
  }
  
  /** Arkivera (soft delete) – synkas korrekt. */
  export const archiveGoal = async (id: string) => {
    const now = Date.now()
    await assertDb().goals_local.update(id, { deletedAtLocal: now, updatedAtLocal: now })
  }
  
  /** Tidigare hårdborttag → soft delete + sync. Behåll samma funktionsnamn som i UI. */
  export const deleteGoal = async (id: string) => {
    const now = Date.now()
    await assertDb().goals_local.update(id, { deletedAtLocal: now, updatedAtLocal: now })
  }
  
  /** Ångra senaste målet (i halvleken) – gör soft delete istället för table.delete. */
  export const undoLastGoal = async (matchId: string, half: 1 | 2) => {
    const db = assertDb()
    const rows = await listGoals(matchId, half)
    const last = rows[rows.length - 1]
    if (last?.id) {
      const now = Date.now()
      await db.goals_local.update(last.id as string, { deletedAtLocal: now, updatedAtLocal: now })
    }
  }
  
  /** Alla mål i matchen (båda halvlekar), exkluderar soft deletes. */
  export const listGoalsForMatch = async (matchId: string) => {
    const db = assertDb()
    const rows = await db.goals_local.where('matchId').equals(matchId).toArray()
    const live = rows.filter(r => !r.deletedAtLocal)
    return live.sort((a, b) => (a.updatedAtLocal ?? 0) - (b.updatedAtLocal ?? 0))
  }
  
  /** Aggregat – förutsätter att inmatade rader redan filtrerats mot deletedAtLocal. */
  export type MatchTally = {
    byTeam: { A: number, B: number }
    byHalf: { 1: { A: number, B: number }, 2: { A: number, B: number } }
    byPlayer: Array<{ playerId: string, goals: number, assists: number }>
  }
  
  export const buildMatchTally = (rows: GoalLocal[]): MatchTally => {
    const byTeam = { A: 0, B: 0 }
    const byHalf = { 1: { A: 0, B: 0 }, 2: { A: 0, B: 0 } }
    const map = new Map<string, { goals: number, assists: number }>()
  
    for (const g of rows) {
      byTeam[g.team]++
      byHalf[g.half][g.team]++
      map.set(g.scorerId, {
        goals: (map.get(g.scorerId)?.goals ?? 0) + 1,
        assists: map.get(g.scorerId)?.assists ?? 0
      })
      if (g.assistId) {
        const cur = map.get(g.assistId) ?? { goals: 0, assists: 0 }
        cur.assists++
        map.set(g.assistId, cur)
      }
    }
  
    const byPlayer = [...map.entries()]
      .map(([playerId, v]) => ({ playerId, goals: v.goals, assists: v.assists }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
  
    return { byTeam, byHalf, byPlayer }
  }