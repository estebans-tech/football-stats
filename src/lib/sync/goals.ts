import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, msFromIso, bulkPutIfNewer, toHalf, toTeam, optMs } from './common'
import { getLastSync, setLastSync } from './state'
import type { GoalRow } from '$lib/types/cloud'
import type { GoalLocal} from '$lib/types/domain'


// type SupabaseGoalRow = {
//   id: string;
//   match_id: string;
//   half: number;
//   team: string;
//   scorer_id: string;
//   assist_id: string | null;
//   minute: number | null;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;
// }

const key = 'sync.goals'

export const pushGoals = async () => {
  const db = assertDb()
  const last = await getLastSync(`${key}.push`)
  const changed = await db.goals_local.filter((r: any) => (r.updatedAtLocal || 0) > last).toArray()
  if (!changed.length) return { pushed: 0 }

  const sb = await ensureSession()
  const club_id = await readClubId()
  const rows = changed.map((r: any) => ({
    id: r.id,
    club_id,
    match_id: r.matchId,
    half: Number(r.half),
    team: r.team,
    scorer_id: r.scorerId,
    assist_id: r.assistId || null,
    minute: r.minute || null,
    created_at: new Date(r.createdAt || r.updatedAtLocal || Date.now()).toISOString(),
    updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
    deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
  }))

  const { error } = await sb.from('goals').upsert(rows, { onConflict: 'id' })
  if (error) throw error

  await setLastSync(`${key}.push`, Date.now())
  return { pushed: rows.length }
}

export const pullGoals = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const last = await getLastSync('sync.goals.pull')
  const { data, error } = await sb
    .from('goals')
    .select('id, match_id, half, team, scorer_id, assist_id, minute, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .gt('updated_at', new Date(last || 0).toISOString())  // ✅ incremental
    .order('updated_at', { ascending: true })
  if (error) throw error

  const db = assertDb()

  const rows = (data ?? []) as GoalRow[] 
  const mapped: GoalLocal[] = rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    half: toHalf(r.half),                 // ✅ 1|2
    team: toTeam(r.team ?? 'home'),       // ✅ 'home'|'away'
    scorerId: r.scorer_id,
    assistId: r.assist_id ?? undefined,   // ✅ optional
    minute: r.minute ?? undefined,        // ✅ optional
    createdAt: optMs(r.created_at),
    updatedAtLocal: msFromIso(r.updated_at) || Date.now(),
    deletedAtLocal: optMs(r.deleted_at)
  }))

  await bulkPutIfNewer(db.goals_local, mapped)
  await setLastSync('sync.goals.pull', Date.now())
  return { pulled: mapped.length }
}

export const syncGoals = async () => {
  const a = await pushGoals()
  const b = await pullGoals()
  return { pushed: a.pushed, pulled: b.pulled }
}
