import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, msFromIso, bulkPutIfNewer, optMs } from './common'

import { getLastSync, setLastSync } from './state'
import type { MatchRow } from '$lib/types/cloud'
import type { MatchLocal } from '$lib/types/domain'

// interface SupabaseMatchRow {
//   id: string;
//   session_id: string;
//   order_no: number;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;
// }

const key = 'sync.matches'

export const pushMatches = async () => {
  const db = assertDb()
  const last = await getLastSync(`${key}.push`)
  const changed = await db.matches_local.filter((r: any) => (r.updatedAtLocal || 0) > last).toArray()
  if (!changed.length) return { pushed: 0 }

  const sb = await ensureSession()
  const club_id = await readClubId()
  const rows = changed.map((r: any) => ({
    id: r.id,
    club_id,
    session_id: r.sessionId,
    order_no: r.orderNo,
    created_at: new Date(r.createdAt || r.updatedAtLocal || Date.now()).toISOString(),
    updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
    deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
  }))

  const { error } = await sb.from('matches').upsert(rows, { onConflict: 'id' })
  if (error) throw error

  await setLastSync(`${key}.push`, Date.now())
  return { pushed: rows.length }
}

export const pullMatches = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const last = await getLastSync('sync.matches.pull')

  const { data, error } = await sb
    .from('matches')
    .select('id, session_id, order_no, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .gt('updated_at', new Date(last || 0).toISOString())
    .order('updated_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as MatchRow[]

  const db = assertDb()
  const mapped: MatchLocal[] = rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    orderNo: r.order_no,
    createdAt: optMs(r.created_at),               // ✅ optional
    updatedAtLocal: msFromIso(r.updated_at) || Date.now(),
    deletedAtLocal: optMs(r.deleted_at)           // ✅ optional
  }))

  await bulkPutIfNewer(db.matches_local, mapped)
  await setLastSync('sync.matches.pull', Date.now())
  return { pulled: mapped.length }
}

export const syncMatches = async () => {
  const a = await pushMatches()
  const b = await pullMatches()
  return { pushed: a.pushed, pulled: b.pulled }
}
