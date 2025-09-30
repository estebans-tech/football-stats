import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, toHalf, toTeam, msFromIso, optMs, bulkPutIfNewer } from './common'
import { getLastSync, setLastSync, getPullCheckpoint, updatePullCheckpoint } from '$lib/sync/state'
import { toMs } from '$lib/utils/utils'

import type { LineupRow, CloudLineup } from '$lib/types/cloud'
import type { LineupLocal, ULID, Half, TeamAB } from '$lib/types/domain'

const syncPrefix = 'sync.lineups'

// --- Help functions - Pull Lineups ---
export async function fetchCloudLineupsSince(
  sb: any,
  club_id: ULID,
  lastIso: string | null
): Promise<CloudLineup[]> {
  const pageSize = 1000
  const rows: CloudLineup[] = []

  let from = 0
  let to = pageSize - 1

  for (;;) {
    let q = sb
      .from('lineups')
      .select('id, club_id, match_id, half, team, player_id, created_at, updated_at, deleted_at')
      .eq('club_id', club_id)
      .order('updated_at', { ascending: true })

    if (lastIso) q = q.gt('updated_at', lastIso)

    const { data, error } = await q.range(from, to)
    if (error) throw new Error(`fetchCloudLineupsSince failed: ${error.message}`)

    if (!data || data.length === 0) break

    rows.push(...(data as CloudLineup[]))

    if (data.length < pageSize) break

    from += pageSize
    to += pageSize
  }

  return rows
}

// Preload existing local lineups by id for fast lookup during pull
export async function preloadLocalLineups(
  db: any,
  ids: ULID[]
): Promise<Map<ULID, LineupLocal>> {
  if (!ids.length) return new Map()

  const rows = await db.lineups_local
    .where('id')
    .anyOf(ids)
    .toArray()

  const map = new Map<ULID, LineupLocal>()
  for (const row of rows) map.set(row.id, row)
  return map
}

export async function applyCloudLineupToLocal(
  db: any,                       // TODO: type db
  row: CloudLineup,
  local: LineupLocal | undefined
) {
  // hard delete locally if cloud is soft-deleted
  if (row.deleted_at) {
    await db.lineups_local.delete(row.id)
    return
  }

  // map cloud → local shape
  const createdAt = toMs(row.created_at)
  const updatedAt = toMs(row.updated_at)

  const mapped = {
    id: row.id,
    matchId: row.match_id,
    half: row.half as Half,
    team: row.team as TeamAB,
    playerId: row.player_id,

    // server mirrors
    createdAt,
    updatedAt,
    deletedAt: null
  } as Partial<LineupLocal> & { id: ULID }

  if (!local) {
    // create clean mirror
    await db.lineups_local.add({
      ...mapped,
      updatedAtLocal: 0,
      dirty: false,
      op: null
    } as LineupLocal)
    return
  }

  if (!local.dirty) {
    // update domain + mirrors when local is clean
    await db.lineups_local.update(row.id, mapped)
    return
  }
  // local is dirty → keep local changes
}

// --- Help functions - Push Lineups ---
async function getDirtyLineups(db: any) {
  const dirty = await db.lineups_local
    .filter((lineup: LineupLocal) => lineup.dirty && lineup.op != null)
    .toArray()

  const creates = dirty.filter((lineup: LineupLocal) => lineup.op === 'create')
  const updates = dirty.filter((lineup: LineupLocal) => lineup.op === 'update')
  const deletes = dirty.filter((lineup: LineupLocal) => lineup.op === 'delete')

  return { creates, updates, deletes }
}

function mapLocalLineupToCloud(lineup: LineupLocal, club_id: ULID): Partial<CloudLineup> {
  return {
    id: lineup.id,
    club_id,
    match_id: lineup.matchId,
    team: lineup.team as TeamAB,
    player_id: lineup.playerId,
    half: lineup.half as Half,
    // created_at / updated_at / deleted_at are set by server
  }
}

// upsert create+update and return rows with server mirrors
async function upsertCloudLineups(
  sb: any,
  rows: Partial<CloudLineup>[]
): Promise<CloudLineup[]> {
  if (!rows.length) return []

  const { data, error } = await sb
    .from('lineups')
    // conflict target = DB-uniknyckeln
    .upsert(rows, { onConflict: 'match_id,player_id,half', ignoreDuplicates: false })
    .select('id, club_id, match_id, team, player_id, half, created_at, updated_at, deleted_at')

  if (error) throw new Error(`upsertCloudLineups failed: ${error.message}`)

  return (data ?? []) as CloudLineup[]
}

// soft delete by setting deleted_at = now() for a set of ids
async function softDeleteCloudLineups(
  sb: any,
  club_id: ULID,
  ids: ULID[]
): Promise<string[]> {
  if (!ids.length) return []

  const { data, error } = await sb
    .from('lineups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('club_id', club_id)
    .in('id', ids)
    .select('id')

  if (error) throw new Error(`softDeleteCloudLineups failed: ${error.message}`)
  return (data ?? []).map((r: CloudLineup) => r.id as ULID)
}

function dedupeLineupUpserts(rows: LineupLocal[]): LineupLocal[] {
  const map = new Map<string, LineupLocal>()
  for (const row of rows) {
    const key = `${row.matchId}|${row.playerId}|${row.half}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, row)
      continue
    }
    // prefer the most recent, eller uppgradera create→update
    const prevTs = prev.updatedAtLocal ?? 0
    const curTs = row.updatedAtLocal ?? 0
    const chooseCurrent =
      curTs > prevTs || (prev.op === 'create' && row.op === 'update')
    if (chooseCurrent) map.set(key, row)
  }
  return [...map.values()]
}

export const pushLineups = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  // load dirty rows partitioned by op (no dirty index)
  const { creates, updates, deletes } = await getDirtyLineups(db)

  // nothing to push
  if (!creates.length && !updates.length && !deletes.length)
    return { pushed: 0, created: 0, updated: 0, deleted: 0 }

  // create + update via upsert
  const upsertsLocal = dedupeLineupUpserts([...creates, ...updates])
  let upsertAck = [] as CloudLineup[]

  if (upsertsLocal.length) {
    const payload = upsertsLocal.map(lineup => mapLocalLineupToCloud(lineup, club_id))

    upsertAck = await upsertCloudLineups(sb, payload) // returns CloudLineup[]
  }

  // delete via soft delete (set deleted_at=now())
  let deleteAckIds = [] as string[]
  if (deletes.length) {
    const ids = deletes.map((l: CloudLineup) => l.id)
    deleteAckIds = await softDeleteCloudLineups(sb, club_id, ids)
  }

  // write back ACKs inside one tx
  await db.transaction('rw', db.lineups_local, async () => {
    // ack for upserts: update mirrors and clear dirty/op
    for (const row of upsertAck) {
      const createdAt = toMs(row.created_at)
      const updatedAt = toMs(row.updated_at)
      const deletedAt = toMs(row.deleted_at)

      await db.lineups_local.update(row.id, {
        createdAt,
        updatedAt,
        deletedAt,
        dirty: false,
        op: null
      })
    }

    // ack for deletes: hard delete locally
    if (deleteAckIds.length) {
      await db.lineups_local.bulkDelete(deleteAckIds)
    }
  })

  return { pushed: upsertsLocal.length + deletes.length }
}

export const pullLineups = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  // incremental fetch window
  const { lastMs, lastIso } = await getPullCheckpoint(`${syncPrefix}.pull`)
  const cloudRows: CloudLineup[] = await fetchCloudLineupsSince(sb, club_id, lastIso)

  let maxUpdatedAtMs = lastMs

  await db.transaction('rw', db.lineups_local, async () => {
    // preload local rows by id for fast lookup
    const localById = await preloadLocalLineups(db, cloudRows.map(r => r.id)) // Map<ULID, LineupLocal>

    for (const row of cloudRows) {
      const updatedAtMs = toMs(row.updated_at)
      if (updatedAtMs == null) continue
      if (updatedAtMs > maxUpdatedAtMs) maxUpdatedAtMs = updatedAtMs

      await applyCloudLineupToLocal(db, row, localById.get(row.id))
    }
  })

  await updatePullCheckpoint(`${syncPrefix}.pull`, maxUpdatedAtMs)
  return { pulled: cloudRows.length }
}

export const syncLineups = async () => {
  const pushed = await pushLineups()    // uses the “repoint to canonical match_id” logic
  const pulled = await pullLineups()
  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 }
}
