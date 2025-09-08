import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, toHalf, toTeam, msFromIso, optMs, bulkPutIfNewer } from './common'
import { getLastSync, setLastSync } from './state'
// import { queueGames } from '$lib/sync/auto'

import type { LineupRow } from '$lib/types/cloud'
import type { LineupLocal } from '$lib/types/domain'


const key = 'sync.lineups'

export const pushLineups = async () => {
  const db = assertDb();
  const last = await getLastSync(`${key}.push`);

  const changed = await db.lineups_local
    .filter((r: any) => (r.updatedAtLocal || 0) > last)
    .toArray();

  if (!changed.length) return { pushed: 0 };

  const sb = await ensureSession();
  const club_id = await readClubId();

  // local -> cloud mapping for team
  const toCloudTeam = (t?: string) => (t === 'B' ? 'away' : 'home'); // default 'A'->home

  // 1) dedupe i batch på (matchId, playerId, half)
  const byKey = new Map<string, any>();
  for (const r of changed) {
    const k = `${r.matchId}|${r.playerId}|${r.half ?? 1}`;

    const row = {
      id: r.id,                     // behåll id => NOT NULL ok
      club_id,
      match_id: r.matchId,
      player_id: r.playerId,
      half: r.half ?? 1,
      team: r.team ?? 'A',          // eller mappa till 'home'/'away' om ditt schema kräver det
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

  // Defensive: only push lineups whose match exists in cloud
  // 2) FK-säkerhet: skicka inte upp rader vars match inte finns i molnet
  const matchIds = Array.from(new Set(rows.map(r => r.match_id)));
  const { data: existing, error: exErr } = await sb.from('matches').select('id').in('id', matchIds);
  if (exErr) throw exErr;
  const ok = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const filtered = rows.filter(r => ok.has(r.match_id));
  if (!filtered.length) { await setLastSync(`${key}.push`, Date.now()); return { pushed: 0 }; }

  // 3) upsert mot partial unique-index (match_id,player_id,half)
  const { error } = await sb
    .from('lineups')
    .upsert(filtered, { onConflict: 'match_id,player_id,half' });
  if (error) throw error;

  await setLastSync(`${key}.push`, Date.now());
  return { pushed: filtered.length };
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
  const pushed = await pushLineups();    // uses the “repoint to canonical match_id” logic
  const pulled = await pullLineups();
  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 };
}
