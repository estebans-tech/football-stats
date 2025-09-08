import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, msFromIso, bulkPutIfNewer, toHalf, toTeam, optMs } from './common'
import { getLastSync, setLastSync } from './state'
import type { GoalRow } from '$lib/types/cloud'
import type { GoalLocal} from '$lib/types/domain'

const key = 'sync.goals'

// Helper: build map localMatchId -> cloudMatchId
async function buildRemoteMatchMap(localMatchIds: string[], club_id: string) {
  const db = assertDb()
  const locals = await db.matches_local.where('id').anyOf(localMatchIds).toArray()
  if (!locals.length) return new Map<string, string>()

  const sessionIds = Array.from(new Set(locals.map(m => m.sessionId)))
  const sb = await ensureSession()

  // fetch all cloud matches for those sessions (for this club)
  const { data, error } = await sb
    .from('matches')
    .select('id, session_id, order_no')
    .in('session_id', sessionIds)
    .eq('club_id', club_id)
  if (error) throw error

  const bySessionOrder = new Map<string, string>()
  for (const m of (data ?? [])) {
    bySessionOrder.set(`${m.session_id}|${m.order_no ?? 0}`, m.id)
  }

  const map = new Map<string, string>()
  for (const lm of locals) {
    const k = `${lm.sessionId}|${lm.orderNo ?? 0}`
    const cloudId = bySessionOrder.get(k)
    if (cloudId) map.set(lm.id, cloudId)
  }
  return map
}

export const pushGoals = async () => {
  const db = assertDb()
  const last = await getLastSync(`${key}.push`)

  const changed = await db.goals_local
    .filter((r: any) => (r.updatedAtLocal || 0) > last)
    .toArray()

  if (!changed.length) return { pushed: 0 }

  const sb = await ensureSession();
  const club_id = await readClubId();

  // dedupe (välj en naturlig nyckel – här ex: match+minute+team+scorer+assist)
  const byKey = new Map<string, any>();

  // Build payload — include NOT NULL columns (half!), keep id for ON CONFLICT id
  for (const r of changed) {
    const k = `${r.matchId}|${r.minute ?? 0}|${r.team ?? 'A'}|${r.scorerId ?? ''}|${r.assistId ?? ''}`;
    const row = {
      id: r.id,
      club_id,
      match_id: r.matchId,
      half: r.half ?? 1,
      team: r.team ?? 'A',
      minute: r.minute ?? null,
      scorer_id: r.scorerId ?? null,
      assist_id: r.assistId ?? null,
      created_at: new Date(r.createdAt || r.updatedAtLocal || Date.now()).toISOString(),
      updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
      deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
    };
    const prev = byKey.get(k);
    if (!prev || new Date(row.updated_at).getTime() > new Date(prev.updated_at).getTime()) {
      byKey.set(k, row);
    }
  }
  const rows = [...byKey.values()];
  if (!rows.length) return { pushed: 0 };

  // Ensure referenced matches exist in cloud (avoid 23503)
  // FK-säkerhet: matcherna måste finnas
  const matchIds = Array.from(new Set(rows.map(r => r.match_id)));
  const { data: existing, error: exErr } = await sb.from('matches').select('id').in('id', matchIds);
  if (exErr) throw exErr;
  const ok = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const filtered = rows.filter(r => ok.has(r.match_id));
  if (!filtered.length) { await setLastSync(`${key}.push`, Date.now()); return { pushed: 0 }; }

  // Upsert – enklast mot id (du kan lägga ett partial-unik-index om du vill)
  const { error } = await sb.from('goals').upsert(filtered, { onConflict: 'id' });
  if (error) throw error;

  await setLastSync(`${key}.push`, Date.now())
  return { pushed: filtered.length }
}

export const pullGoals = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const last = await getLastSync(`${key}.pull`)

  const { data, error } = await sb
    .from('goals')
    .select('id, match_id, half, team, minute, scorer_id, assist_id, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .gt('updated_at', new Date(last || 0).toISOString())
    .order('updated_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as GoalRow[]

  const db = assertDb()
  const mapped: GoalLocal[] = rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    half: toHalf(r.half),
    team: toTeam(r.team ?? 'A'),      // change if your cloud uses 'home'/'away' exclusively
    minute: r.minute ?? undefined,
    scorerId: r.scorer_id ?? undefined,
    assistId: r.assist_id ?? undefined,
    createdAt: optMs(r.created_at),
    updatedAtLocal: msFromIso(r.updated_at) || Date.now(),
    deletedAtLocal: optMs(r.deleted_at)
  }))

  await bulkPutIfNewer(db.goals_local, mapped)
  await setLastSync(`${key}.pull`, Date.now())
  return { pulled: mapped.length }
}

export const syncGoals = async () => {
  const pushed = await pushGoals()
  const pulled = await pullGoals()
  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 }
}
