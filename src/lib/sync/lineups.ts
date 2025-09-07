import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, toHalf, toTeam, msFromIso, optMs, bulkPutIfNewer } from './common'
import { getLastSync, setLastSync } from './state'
// import { queueGames } from '$lib/sync/auto'

import type { LineupRow } from '$lib/types/cloud'
import type { LineupLocal } from '$lib/types/domain'


// interface SupabaseLineupRow {
//   id: string;
//   match_id: string;
//   half: number;
//   team: string;
//   player_id: string;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;
// }

const key = 'sync.lineups'

export const pushLineups = async () => {
  const db = assertDb()
  const last = await getLastSync(`${key}.push`)
  const changed = await db.lineups_local.filter((r: any) => (r.updatedAtLocal || 0) > last).toArray()
  if (!changed.length) return { pushed: 0 }

  const sb = await ensureSession()
  const club_id = await readClubId()
  const rows = changed.map((r: any) => ({
    id: r.id,
    club_id,
    match_id: r.matchId,
    half: Number(r.half),
    team: r.team,
    player_id: r.playerId,
    created_at: new Date(r.createdAt || r.updatedAtLocal || Date.now()).toISOString(),
    updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
    deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
  }))

  const { error } = await sb.from('lineups').upsert(rows, { onConflict: 'id' })
  if (error) throw error

  await setLastSync(`${key}.push`, Date.now())
  return { pushed: rows.length }
}

export const pullLineups = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const last = await getLastSync('sync.lineups.pull')

  const { data, error } = await sb
    .from('lineups')
    .select('id, match_id, half, team, player_id, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .gt('updated_at', new Date(last || 0).toISOString())
    .order('updated_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as LineupRow[]

  const db = assertDb()
  const mapped: LineupLocal[] = rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    half: toHalf(r.half),                 // ✅ 1|2
    team: toTeam(r.team ?? 'A'),       // ✅ 'home'|'away' (justera/ta bort om din domän har string)
    playerId: r.player_id,
    createdAt: optMs(r.created_at),       // ✅ optional
    updatedAtLocal: msFromIso(r.updated_at) || Date.now(),
    deletedAtLocal: optMs(r.deleted_at)   // ✅ optional (ingen null)
  }))

  await bulkPutIfNewer(db.lineups_local, mapped)
  await setLastSync('sync.lineups.pull', Date.now())
  return { pulled: mapped.length }
}

export const syncLineups = async () => {
  const a = await pushLineups()
  const b = await pullLineups()
  return { pushed: a.pushed, pulled: b.pulled }
}
