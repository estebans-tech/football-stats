import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, msFromIso, bulkPutIfNewer, toHalf, toTeam, optMs } from '$lib/sync/common'
import { getPullCheckpoint, updatePullCheckpoint } from '$lib/sync/state'
import { toMs } from '$lib/utils/utils'

import type { CloudGoal } from '$lib/types/cloud'
import type { GoalLocal, ULID, Half, TeamAB } from '$lib/types/domain'

const syncPrefix = 'sync.goals'

// --- Help functions - Pull Goals ---
// incremental fetch of CloudGoal rows since lastIso (inclusive-exclusive on server)
// includes soft-deleted rows so the client can hard-delete locally when needed
export async function fetchCloudGoalsSince(
  sb: any,
  club_id: ULID,
  lastIso: string | null
): Promise<CloudGoal[]> {
  const pageSize = 1000
  const rows: CloudGoal[] = []

  let from = 0
  let to = pageSize - 1

  for (;;) {
    let q = sb
      .from('goals')
      .select('id, club_id, match_id, half, team, scorer_id, assist_id, minute, created_at, updated_at, deleted_at')
      .eq('club_id', club_id)
      .order('updated_at', { ascending: true })

    if (lastIso) q = q.gt('updated_at', lastIso)

    const { data, error } = await q.range(from, to)
    if (error) throw new Error(`fetchCloudGoalsSince failed: ${error.message}`)

    if (!data || data.length === 0) break

    rows.push(...(data as CloudGoal[]))

    if (data.length < pageSize) break

    from += pageSize
    to += pageSize
  }

  return rows
}

// Preload existing local goals by id for fast lookup during pull
export async function preloadLocalGoals(
  db: any,
  ids: ULID[]
): Promise<Map<ULID, GoalLocal>> {
  if (!ids.length) return new Map()

  const rows = await db.goals_local
    .where('id')
    .anyOf(ids)
    .toArray()

  const map = new Map<ULID, GoalLocal>()
  for (const row of rows) map.set(row.id, row)
  return map
}

// apply one CloudGoal row to local store following the offline rules
// - cloud deleted_at → hard-delete locally
// - not found locally → insert clean mirror (dirty=false, op=null, updatedAtLocal=0)
// - found & local.dirty=false → update domain + mirrors
// - found & local.dirty=true → leave as is
export async function applyCloudGoalToLocal(
  db: any,                     // TODO: type db
  row: CloudGoal,
  local: GoalLocal | undefined
) {
  // hard delete locally if cloud is soft-deleted
  if (row.deleted_at) {
    await db.goals_local.delete(row.id)
    return
  }

  // map cloud → local shape
  const mapped = {
    id: row.id,
    matchId: row.match_id,
    half: row.half as Half,
    team: row.team as TeamAB,
    scorerId: row.scorer_id,
    assistId: row.assist_id ?? null,
    minute: row.minute ?? null,

    // server mirrors
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    deletedAt: row.deleted_at ?? null
  } as Partial<GoalLocal> & { id: ULID }

  if (!local) {
    // create clean mirror
    await db.goals_local.add({
      ...mapped,
      updatedAtLocal: 0,
      dirty: false,
      op: null
    } as GoalLocal)
    return
  }

  if (!local.dirty) {
    // update domain + mirrors when local is clean
    await db.goals_local.update(row.id, mapped)
    return
  }
  // local is dirty → keep local changes
}


// --- Help functions - Push Goals ---
// load dirty goals and partition by op
async function getDirtyGoals(db: any) {
  const dirty = await db.goals_local
    .filter((g: GoalLocal) => g.dirty && g.op != null)
    .toArray()

  const creates = dirty.filter((g: GoalLocal) => g.op === 'create')
  const updates = dirty.filter((g: GoalLocal) => g.op === 'update')
  const deletes = dirty.filter((g: GoalLocal) => g.op === 'delete')
  return { creates, updates, deletes }
}

// map local → cloud payload for upsert
function mapLocalGoalToCloud(g: GoalLocal, club_id: ULID): Partial<CloudGoal> {
  return {
    id: g.id,
    club_id,
    match_id: g.matchId,
    half: g.half as 1 | 2,
    team: g.team as 'A' | 'B',
    scorer_id: g.scorerId,
    assist_id: g.assistId ?? null,
    minute: g.minute ?? null
    // created_at / updated_at / deleted_at are set by server
  }
}

// upsert create+update and return rows with server mirrors
async function upsertCloudGoals(
  sb: any,
  rows: Partial<CloudGoal>[]
): Promise<CloudGoal[]> {
  if (!rows.length) return []

  const { data, error } = await sb
    .from('goals')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
    .select('id, club_id, match_id, half, team, scorer_id, assist_id, minute, created_at, updated_at, deleted_at')

  if (error) throw new Error(`upsertCloudGoals failed: ${error.message}`)
  return (data ?? []) as CloudGoal[]
}

// soft delete by setting deleted_at = now() for a set of ids
async function softDeleteCloudGoals(
  sb: any,
  club_id: ULID,
  ids: ULID[]
): Promise<string[]> {
  if (!ids.length) return []

  const { data, error } = await sb
    .from('goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('club_id', club_id)
    .in('id', ids)
    .select('id')

  if (error) throw new Error(`softDeleteCloudGoals failed: ${error.message}`)
  return (data ?? []).map((r: CloudGoal) => r.id as ULID)
}

// Push local dirty goals to cloud and write back ACK mirrors
export const pushGoals = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  // load dirty rows partitioned by op (no dirty index)
  const { creates, updates, deletes } = await getDirtyGoals(db)

  // nothing to push
  if (!creates.length && !updates.length && !deletes.length)
    return { pushed: 0, created: 0, updated: 0, deleted: 0 }

  // create + update via upsert
  const upserts = [...creates, ...updates]
  let upsertAck = [] as CloudGoal[]

  if (upserts.length) {
    const payload = upserts.map(g => mapLocalGoalToCloud(g, club_id))
    upsertAck = await upsertCloudGoals(sb, payload) // returns CloudGoal[]
  }

  // delete via soft delete (set deleted_at=now())
  let deleteAckIds = [] as string[]
  if (deletes.length) {
    const ids = deletes.map((g: CloudGoal) => g.id)
    deleteAckIds = await softDeleteCloudGoals(sb, club_id, ids)
  }

  // write back ACKs inside one tx
  await db.transaction('rw', db.goals_local, async () => {
    // ack for upserts: update mirrors and clear dirty/op
    for (const row of upsertAck) {
      await db.goals_local.update(row.id, {
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
        deletedAt: row.deleted_at ?? null,
        dirty: false,
        op: null
      })
    }

    // ack for deletes: hard delete locally
    if (deleteAckIds.length) {
      await db.goals_local.bulkDelete(deleteAckIds)
    }
  })

  return { pushed: upserts.length + deletes.length }
}

export const pullGoals = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  // incremental fetch window
  const { lastMs, lastIso } = await getPullCheckpoint(`${syncPrefix}.pull`)
  const cloudRows: CloudGoal[] = await fetchCloudGoalsSince(sb, club_id, lastIso) // → CloudGoal[]

  let maxUpdatedAtMs = lastMs

  await db.transaction('rw', db.goals_local, async () => {
    // preload local rows by id for fast lookup
    const localById = await preloadLocalGoals(db, cloudRows.map(r => r.id)) // Map<ULID, GoalLocal>

    for (const row of cloudRows) {
      const updatedAtMs = toMs(row.updated_at)
      if (updatedAtMs == null) continue
      if (updatedAtMs > maxUpdatedAtMs) maxUpdatedAtMs = updatedAtMs

      await applyCloudGoalToLocal(db, row, localById.get(row.id))
    }
  })

  await updatePullCheckpoint(`${syncPrefix}.pull`, maxUpdatedAtMs)
  return { pulled: cloudRows.length }
}

export const syncGoals = async () => {
  const pushed = await pushGoals()
  const pulled = await pullGoals()
  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 }
}
