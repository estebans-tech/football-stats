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