import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import { uid } from '$lib/utils/utils'
import type { TeamAB, Half, GoalLocal, ULID } from '$lib/types/domain'

export function observeLocalGoalsForMatch(matchId: ULID) {
  const db = assertDb()
  return readable<GoalLocal[]>([], set => {
    const sub = liveQuery(async () => {
      const rows = await db.goals_local.where('matchId').equals(matchId).toArray()

      // hide cloud-deleted and locally marked-for-delete
      const visible = rows.filter(g => g.deletedAt == null && g.op !== 'delete')

      // de-dupe by id (just in case of double emission or race)
      const seen = new Set<ULID>()
      const uniq: GoalLocal[] = []
      for (const g of visible) {
        if (!seen.has(g.id)) {
          seen.add(g.id)
          uniq.push(g)
        }
      }

      // stable sort: half → minute(nulls last) → updatedAtLocal
      uniq.sort((a, b) => {
        const byHalf = (a.half as number) - (b.half as number)
        if (byHalf) return byHalf
        const am = a.minute == null ? Number.POSITIVE_INFINITY : a.minute!
        const bm = b.minute == null ? Number.POSITIVE_INFINITY : b.minute!
        if (am !== bm) return am - bm
        return a.updatedAtLocal - b.updatedAtLocal
      })

      return uniq
    }).subscribe({ next: set, error: () => set([]) })

    return () => sub.unsubscribe()
  })
}



/** Hämta mål för en halvlek – robust utan compound-index och exkluderar soft deletes. */
// export const listGoals = async (matchId: string, half: 1 | 2) => {
//     const db = assertDb()
//     const rows = await db.goals_local.where('matchId').equals(matchId).toArray()
//     const live = rows.filter(r => r.half === half && !r.deletedAtLocal)
//     // sortera på updatedAtLocal (äldst→nyast)
//     return live.sort((a, b) => (a.updatedAtLocal ?? 0) - (b.updatedAtLocal ?? 0))
// }


/** Arkivera (soft delete) – synkas korrekt. */
// export const archiveGoal = async (id: string) => {
//   const now = Date.now()
//   await assertDb().goals_local.update(id, { deletedAtLocal: now, updatedAtLocal: now })
// 

  export const addGoal = async (g: {
    matchId: ULID
    half: 1 | 2
    team: TeamAB
    scorerId: ULID
    assistId?: ULID | null
    minute?: number | null
  }) => {
    const db = assertDb()
    const id = uid()
    const now = Date.now()
  
    // create a new local row marked as dirty create
    await db.goals_local.add({
      id,
      matchId: g.matchId,
      half: g.half,
      team: g.team,
      scorerId: g.scorerId,
      assistId: g.assistId ?? null,
      minute: g.minute ?? null,
  
      // server mirrors are set only on ACK
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
  
      // offline state
      updatedAtLocal: now,
      dirty: true,
      op: 'create'
    } as GoalLocal)
  
    return id
  }
  
  export const updateGoal = async (id: ULID, patch: Partial<GoalLocal>) => {
    const db = assertDb()
    const row = await db.goals_local.get(id)
    if (!row) return
  
    // only consider domain fields for dirtying
    const domainKeys = ['matchId', 'half', 'team', 'scorerId', 'assistId', 'minute'] as const
  
    const mods: Partial<GoalLocal> = {}
    let domainChanged = false
  
    for (const k of domainKeys) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) {
        domainChanged = true
        if (k === 'assistId' || k === 'minute') {
          // normalize undefined → null for nullable fields
          mods[k] = (patch[k] === undefined ? null : patch[k]) as any
        } else {
          mods[k] = patch[k] as any
        }
      }
    }
  
    if (!domainChanged) {
      // mirrors or meta-only updates are ignored here
      return
    }
  
    mods.updatedAtLocal = Date.now()
    mods.dirty = true
    if (row.op !== 'create') mods.op = 'update'
  
    await db.goals_local.update(id, mods)
  }
    
  export const deleteGoal = async (id: ULID) => {
    const db = assertDb()
    const row = await db.goals_local.get(id)
    if (!row) return
  
    // if the row was never pushed, remove it locally
    if (row.op === 'create') {
      await db.goals_local.delete(id)
      return
    }
  
    // otherwise mark for soft delete on server
    await db.goals_local.update(id, {
      dirty: true,
      op: 'delete',
      updatedAtLocal: Date.now()
      // do not touch createdAt/updatedAt/deletedAt mirrors here
    })
  }
  /** Ångra senaste målet (i halvleken) – gör soft delete istället för table.delete. */
  // export const undoLastGoal = async (matchId: string, half: 1 | 2) => {
  //   const db = assertDb()
  //   const rows = await listGoals(matchId, half)
  //   const last = rows[rows.length - 1]
  //   if (last?.id) {
  //     const now = Date.now()
  //     await db.goals_local.update(last.id as string, { deletedAtLocal: now, updatedAtLocal: now })
  //   }
  // }
  
  /** Alla mål i matchen (båda halvlekar), exkluderar soft deletes. */
  // export const listGoalsForMatch = async (matchId: string) => {
  //   const db = assertDb()
  //   const rows = await db.goals_local.where('matchId').equals(matchId).toArray()
  //   const live = rows.filter(r => !r.deletedAtLocal)
  //   return live.sort((a, b) => (a.updatedAtLocal ?? 0) - (b.updatedAtLocal ?? 0))
  // }
  
  /** Aggregat – förutsätter att inmatade rader redan filtrerats mot deletedAtLocal. */
  // export type MatchTally = {
  //   byTeam: { A: number, B: number }
  //   byHalf: { 1: { A: number, B: number }, 2: { A: number, B: number } }
  //   byPlayer: Array<{ playerId: string, goals: number, assists: number }>
  // }
  
  // export const buildMatchTally = (rows: GoalLocal[]): MatchTally => {
  //   const byTeam = { A: 0, B: 0 }
  //   const byHalf = { 1: { A: 0, B: 0 }, 2: { A: 0, B: 0 } }
  //   const map = new Map<string, { goals: number, assists: number }>()
  
  //   for (const g of rows) {
  //     byTeam[g.team]++
  //     byHalf[g.half][g.team]++
  //     map.set(g.scorerId, {
  //       goals: (map.get(g.scorerId)?.goals ?? 0) + 1,
  //       assists: map.get(g.scorerId)?.assists ?? 0
  //     })
  //     if (g.assistId) {
  //       const cur = map.get(g.assistId) ?? { goals: 0, assists: 0 }
  //       cur.assists++
  //       map.set(g.assistId, cur)
  //     }
  //   }
  
  //   const byPlayer = [...map.entries()]
  //     .map(([playerId, v]) => ({ playerId, goals: v.goals, assists: v.assists }))
  //     .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
  
  //   return { byTeam, byHalf, byPlayer }
  // }

  export async function addGoalQuick(opts: {
    matchId: ULID
    team: TeamAB
    half: Half
    scorerId?: ULID
    assistId?: ULID | null
    minute?: number | null
  }) {
    if (!opts.scorerId) throw new Error('scorerId is required')
  
    const db = assertDb()
    const now = Date.now()
  
    const row: GoalLocal = {
      id: uid(),
      matchId: opts.matchId,
      team: opts.team,
      half: opts.half,
      scorerId: opts.scorerId,
      assistId: opts.assistId ?? null,
      minute: opts.minute ?? null,
  
      // server mirrors
      createdAt: null,
      updatedAt: null,
      deletedAt: null,  
  
      // offline lifecycle
      updatedAtLocal: now,
      dirty: true,
      op: 'create'  
    }
  
    await db.goals_local.add(row)
    return row
  }