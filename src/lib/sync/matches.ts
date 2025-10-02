import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, msFromIso, bulkPutIfNewer, optMs } from './common'

import { getLastSync, setLastSync, getPullCheckpoint, updatePullCheckpoint } from '$lib/sync/state'
import type { MatchRow, CloudMatch, CloudSession } from '$lib/types/cloud'
import type { MatchLocal, ULID } from '$lib/types/domain'
import { toMs, isoDate as toIso } from '$lib/utils/utils'
import { number } from 'svelte-i18n'

const syncPrefix = 'sync.matches'

// TODO(undo): Implement restoreMatchLocal(matchId)
// - If row exists and op === 'delete': set { dirty: false, op: null }
// - If it was hard-deleted (op === 'create' case), you can't undo without keeping a trash buffer
// - Bump updatedAtLocal when clearing or re-editing after undo

// TODO(order-slot): If your DB is missing the partial UNIQUE index on (session_id, order_no) WHERE deleted_at IS NULL,
// set { deleted_at: nowIso, order_no: null } to free the slot.
// With the partial index in place, { deleted_at: nowIso } is enough.


// --- Help functions - Pull matches ---
// Fetch all cloud matches updated strictly after `lastIso` for a given club.
// - Uses incremental checkpointing on `updated_at` (server clock, ISO string).
// - Returns rows ordered ascending by `updated_at` to preserve a stable apply order.
// - Does NOT transform field names; caller maps snake_case → camelCase.
// - Safe to call with `lastIso = null` (interpreted as "from epoch").
//
// Dependencies:
// - `CloudMatch` type
// - Supabase client type (generic `any` here to avoid import noise)
//
export async function fetchCloudMatchesSince(
  sb: any,                      // SupabaseClient
  clubId?: ULID| null,          // ULID
  lastIso?: string | null       // ISO timestamp or null
): Promise<CloudMatch[]> {
  // Base query: limit to club and order by updated_at ASC for deterministic application
  let query = sb
    .from('matches')
    .select('id,club_id,session_id,order_no,created_at,updated_at,deleted_at')

    if (clubId) query = query.eq('club_id', clubId)
    if (lastIso) query = query.gt('updated_at', lastIso)

    const { data, error } = await query.order('updated_at', { ascending: true, nullsFirst: false })
    if (error) throw error
  
    return (data ?? []) as CloudMatch[]
}

// Preload a set of local matches by id into a Map for O(1) lookups during apply.
// - Accepts an array of ULIDs (may contain duplicates; they are de-duplicated).
// - Uses Dexie.bulkGet for efficient batched reads.
// - Returns Map<id, MatchLocal> for fast access in the pull loop.
//
// Dependencies:
// - LocalDB with table `matches_local`
// - ULID, MatchLocal types
//
export async function preloadLocalMatches(
  db: any,
  ids: ULID[]
): Promise<Map<ULID, MatchLocal>> {
  if (!ids.length) return new Map()

  // Deduplicate ids to keep the query lean
  const uniqueIds = Array.from(new Set(ids))

  const rows = await db.matches_local
    .where('id')
    .anyOf(uniqueIds)
    .toArray()

  const byId = new Map<ULID, MatchLocal>()
  for (const row of rows) byId.set(row.id, row)

  return byId
}

// Apply one cloud match row to local storage, respecting dirty-protection
// Rules:
// - If server row has deleted_at → hard-delete locally
// - If local row is missing → insert a clean mirror (dirty=false, op=null, updatedAtLocal=0)
// - If local row exists and dirty=false → update domain fields + server mirrors (preserve updatedAtLocal)
// - If local row exists and dirty=true → do nothing
//
// Assumptions:
// - Called inside an existing Dexie transaction
// - `db` exposes `matches_local` table
// - `toMs` converts ISO|string|Date|null → number|null
export async function applyCloudMatchToLocal(
  db: any,
  row: CloudMatch,
  existing?: MatchLocal
) {
  const createdAt = toMs(row.created_at)
  const updatedAt = toMs(row.updated_at)
  const deletedAt = toMs(row.deleted_at)

  // Server soft-deleted → hard-delete locally
  if (deletedAt) {
    await db.matches_local.delete(row.id)
    return
  }

  // Patch with domain fields + server mirrors (no local metadata)
  const patch: Pick<
    MatchLocal,
    'clubId' | 'sessionId' | 'orderNo' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > = {
    clubId: row.club_id as ULID,
    sessionId: row.session_id as ULID,
    orderNo: row.order_no as number,
    createdAt,
    updatedAt,
    deletedAt: null
  }

  if (!existing) {
    // Insert clean local mirror
    const doc: MatchLocal = {
      id: row.id as ULID,
      ...patch,
      updatedAtLocal: 0,
      dirty: false,
      op: null
    }
    await db.matches_local.put(doc)
    return
  }

  // Existing row present
  if (!existing.dirty) {
    // Safe to update domain + server mirrors
    await db.matches_local.update(row.id, patch)
    return
  }

  // existing.dirty === true → keep local changes (no-op)
}

// --- Help functions - Push matches ---
// Mapper: local → cloud payload (no server mirrors)
type MatchUpsertPayload = {
  id: ULID
  club_id: ULID
  session_id: ULID
  order_no: number
  // add more domain fields here if you have them (snake_case)
}

export const toCloudMatch = (match: MatchLocal, club_id: ULID): MatchUpsertPayload => ({
  id: match.id,
  club_id,
  session_id: match.sessionId,
  order_no: match.orderNo
})

// Load dirty local matches and return newest-first for deterministic pushes
export async function getDirtyMatches(db: any): Promise<MatchLocal[]> {
  const matches: MatchLocal[] = await db.matches_local
    .where('op')
    .anyOf('create', 'update', 'delete')
    .sortBy('updatedAtLocal')   // asc
  matches.reverse()             // newest first
  return matches
}

// Partition dirty rows by operation (create | update | delete)
export function partitionMatchesByOp(matches: MatchLocal[]) {
  const creates: MatchLocal[] = []
  const updates: MatchLocal[] = []
  const deletes: MatchLocal[] = []

  for (const match of matches) {
    if (match.op === 'create') creates.push(match)
    else if (match.op === 'update') updates.push(match)
    else if (match.op === 'delete') deletes.push(match)
  }

  return { creates, updates, deletes }
}

// Create matches in the cloud (no server mirrors in payload)
// - Returns acks: [{ id, created_at, updated_at }]
// TODO: Handle 23505 (UNIQUE on session_id, order_no) with pull → local renum → retry
export async function pushMatchCreates(
  sb: any,
  club_id: ULID,
  matches: MatchLocal[]
): Promise<Array<{ id: ULID, created_at: string, updated_at: string }>> {
  if (!matches.length) return []

  const payload = matches.map(match => toCloudMatch(match, club_id))

  const { data, error } = await sb
    .from('matches')
    .upsert(payload, { onConflict: 'id' })
    .select('id, created_at, updated_at')

  if (error) throw error
  return data as Array<{ id: ULID, created_at: string, updated_at: string }>
}

// Update matches in the cloud (no server mirrors in payload)
// - Uses upsert on primary key (id) to apply updates
// - Returns acks: [{ id, created_at, updated_at }]
// TODO: Handle 23505 (UNIQUE on session_id, order_no) with pull → local renum → retry
export async function pushMatchUpdates(
  sb: any,
  club_id: ULID,
  matches: MatchLocal[]
): Promise<Array<{ id: ULID, created_at: string, updated_at: string }>> {
  if (!matches.length) return []

  const payload = matches.map(m => toCloudMatch(m, club_id))

  const { data, error } = await sb
    .from('matches')
    .upsert(payload, { onConflict: 'id' })
    .select('id, created_at, updated_at')

  if (error) throw error
  return data as Array<{ id: ULID, created_at: string, updated_at: string }>
}

// Soft-delete matches in the cloud by setting deleted_at = now()
// - Returns deleted ids: ULID[]
export async function pushMatchSoftDeletes(
  sb: any,
  club_id: ULID,
  matches: MatchLocal[]
): Promise<ULID[]> {
  if (!matches.length) return []

  const ids = matches.map(m => m.id)
  const nowIso = new Date().toISOString()

  const { data, error } = await sb
    .from('matches')
    .update({ deleted_at: nowIso })
    .in('id', ids)
    .eq('club_id', club_id)
    .select('id')

  if (error) throw error
  return (data ?? []).map((r: CloudMatch) => r.id as ULID)
}

// Acknowledge cloud upserts: write server stamps locally and clear dirty/op
// - acks: [{ id, created_at, updated_at }]
export async function acknowledgeMatchUpserts(
  db: any,
  acks: Array<{ id: ULID, created_at: string, updated_at: string }>
) {
  if (!acks?.length) return

  await db.transaction('rw', db.matches_local, async () => {
    for (const a of acks) {
      await db.matches_local.update(a.id, {
        createdAt: toMs(a.created_at),
        updatedAt: toMs(a.updated_at),
        dirty: false,
        op: null
      })
    }
  })
}

// Acknowledge cloud soft-deletes: hard-delete locally by primary key
export async function acknowledgeMatchDeletes(
  db: any,
  ids: ULID[]
) {
  if (!ids?.length) return

  await db.transaction('rw', db.matches_local, async () => {
    await db.matches_local.bulkDelete(ids)
  })
}

// Ensure local uniqueness of (sessionId, orderNo) before pushing
// - For each sessionId present in the batch, renumber orderNo to 1..N deterministically
// - Stable sort: orderNo ASC, then updatedAtLocal ASC, then id ASC
// - Any row whose orderNo changes becomes dirty with op='update' (unless already 'create')
export async function normalizeLocalMatchOrders(db: any, matches: MatchLocal[]) {
  if (!matches.length) return

  // group by sessionId
  const bySession = new Map<ULID, MatchLocal[]>()
  for (const m of matches) {
    const list = bySession.get(m.sessionId) ?? []
    list.push(m)
    bySession.set(m.sessionId, list)
  }

  await db.transaction('rw', db.matches_local, async () => {
    for (const [sessionId, list] of bySession) {
      // fetch ALL local matches for this session to renumber against full set
      const all = await db.matches_local
        .where('sessionId').equals(sessionId)
        .toArray()

      // sort deterministically
      all.sort((a: MatchLocal, b: MatchLocal) => {
        if ((a.orderNo ?? 0) !== (b.orderNo ?? 0)) return (a.orderNo ?? 0) - (b.orderNo ?? 0)
        if (a.updatedAtLocal !== b.updatedAtLocal) return a.updatedAtLocal - b.updatedAtLocal
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })

      // assign 1..N and persist changes
      let next = 1
      for (const row of all) {
        if (row.orderNo !== next) {
          const mods: Partial<MatchLocal> = {
            orderNo: next,
            dirty: true,
            op: row.op === 'create' ? 'create' : 'update',
            updatedAtLocal: Date.now()
          }
          await db.matches_local.update(row.id, mods)
        }
        next++
      }
    }
  })
}

export async function pushMatches() {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  // 1) always refresh first to avoid stale conflicts
  await pullMatches()

  // make sure local (sessionId, orderNo) is unique across each session
  // pass all matches so function can read full sets per session
  // 2) ensure local (sessionId, orderNo) uniqueness across full sets
  const allForCheck = await db.matches_local.toArray()
  await normalizeLocalMatchOrders(db, allForCheck)

  // 3) proceed as before…
  const dirty = await getDirtyMatches(db)
  if (!dirty.length) return { pushed: 0, created: 0, updated: 0, deleted: 0 }

  const { creates, updates, deletes } = partitionMatchesByOp(dirty)

  let pushed = 0
  let created = 0
  let updated = 0
  let deleted = 0

  if (creates.length) {
    const acks = await pushMatchCreates(sb, club_id, creates)
    await acknowledgeMatchUpserts(db, acks)
    pushed += acks.length
    created += acks.length
  }

  if (updates.length) {
    const acks = await pushMatchUpdates(sb, club_id, updates)
    await acknowledgeMatchUpserts(db, acks)
    pushed += acks.length
    updated += acks.length
  }

  if (deletes.length) {
    const ids = await pushMatchSoftDeletes(sb, club_id, deletes)
    await acknowledgeMatchDeletes(db, ids)
    pushed += ids.length
    deleted += ids.length
  }

  return { pushed }
}

export const pullMatches = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  const { lastMs, lastIso } = await getPullCheckpoint(`${syncPrefix}.pull`)
  const cloudRows = await fetchCloudMatchesSince(sb, club_id, lastIso) // → CloudMatch[]

  let maxUpdatedAtMs = lastMs

  await db.transaction('rw', db.matches_local, async () => {
    const localById = await preloadLocalMatches(db, cloudRows.map(r => r.id)) // Map<ULID, MatchLocal>

    for (const row of cloudRows) {
      const updatedAtMs = toMs(row.updated_at)
      if (updatedAtMs == null) continue
      if (updatedAtMs > maxUpdatedAtMs) maxUpdatedAtMs = updatedAtMs

      await applyCloudMatchToLocal(db, row, localById.get(row.id))
    }
  })

  await updatePullCheckpoint(`${syncPrefix}.pull`, maxUpdatedAtMs)
  return { pulled: cloudRows.length }
}

export const syncMatches = async () => {
  const pushed = await pushMatches();    // canonicalises (session_id, order_no), may rewrite locals
  const pulled = await pullMatches();    // brings back canonical ids/rows

  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 };
}
