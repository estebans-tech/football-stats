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

type MatchUpsertRow = {
  __local_id?: string;                // <-- in-memory only (strip before send)
  session_id: string;
  order_no: number;
  club_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function dedupeByPair<T extends { session_id: string; order_no: number; updated_at: string }>(rows: T[]) {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = `${r.session_id}#${r.order_no}`;
    const prev = m.get(k);
    if (!prev || +new Date(r.updated_at) > +new Date(prev.updated_at)) m.set(k, r);
  }
  return [...m.values()];
}

/**
 * Re-key a local match to a new id and move its FKs (lineups/goals).
 * Safe to call even if another row with targetId already exists.
 */
async function rekeyLocalMatch(oldId: string, targetId: string) {
  const db = assertDb()
  if (oldId === targetId) return

  await db.transaction('rw',
    db.matches_local, db.lineups_local, db.goals_local,
    async () => {
      // If a match with the target id is not present locally, create it from the old one.
      const existingTarget = await db.matches_local.get(targetId)
      const src = await db.matches_local.get(oldId)
      if (!src) return

      if (!existingTarget) {
        await db.matches_local.put({ ...src, id: targetId })
      }

      // Move foreign keys
      await db.lineups_local.where('matchId').equals(oldId).modify({ matchId: targetId })
      await db.goals_local.where('matchId').equals(oldId).modify({ matchId: targetId })

      // Drop the old record
      await db.matches_local.delete(oldId)
    }
  )
}

/**
 * One-time local tidy: if we already have duplicate matches for the same
 * (sessionId, orderNo), keep the one with the *newest* updatedAtLocal and
 * re-key the other to that id.
 */
async function mergeLocalDuplicates() {
  const db = assertDb()
  const all = await db.matches_local.toArray()
  const byKey = new Map<string, { id: string; updatedAtLocal?: number }>()
  for (const m of all) {
    const key = `${m.sessionId}:${m.orderNo}`
    const prev = byKey.get(key)
    if (!prev) { byKey.set(key, { id: m.id, updatedAtLocal: m.updatedAtLocal }); continue }
    // decide which to keep
    const keep = (prev.updatedAtLocal ?? 0) >= (m.updatedAtLocal ?? 0) ? prev.id : m.id
    const drop = keep === prev.id ? m.id : prev.id
    await rekeyLocalMatch(drop, keep)
    byKey.set(key, { id: keep, updatedAtLocal: Math.max(prev.updatedAtLocal ?? 0, m.updatedAtLocal ?? 0) })
  }
}

/**
 * Push matches and reconcile local ids with server ids chosen by the
 * (session_id, order_no) unique constraint.
 */
export const pushMatches = async () => {
  const db = assertDb();
  const last = await getLastSync(`${key}.push`);

  // What changed locally?
  const changed = await db.matches_local
    .filter((r: any) => (r.updatedAtLocal || 0) > last)
    .toArray();

  if (!changed.length) return { pushed: 0 };

  const sb = await ensureSession();
  const club_id = await readClubId();

  // Fetch all cloud matches for the affected sessions to detect
  // canonical rows (same session_id+order_no but different id)
  const sessionIds = Array.from(new Set(changed.map((m: any) => m.sessionId)));
  const { data: cloudRows, error: cloudErr } = await sb
    .from('matches')
    .select('id,session_id,order_no')
    .in('session_id', sessionIds);

  if (cloudErr) throw cloudErr;

  const cloudByKey = new Map<string, { id: string }>();
  for (const r of cloudRows ?? []) {
    cloudByKey.set(`${r.session_id}:${r.order_no}`, { id: r.id });
  }

  // Build:
  //  - rowsSafe: rows we can upsert by id without breaking unique(session_id,order_no)
  //  - rewrite: map localId -> canonicalCloudId for duplicates we must not insert
  const rowsSafe: any[] = [];
  const rewrite = new Map<string, string>();

  for (const r of changed) {
    const k = `${r.sessionId}:${r.orderNo ?? null}`;
    const cloud = cloudByKey.get(k);

    if (!cloud) {
      // No cloud row uses this (session, order), safe to upsert by id
      rowsSafe.push({
        id: r.id,
        club_id,
        session_id: r.sessionId,
        order_no: r.orderNo ?? null,
        created_at: new Date(r.createdAt || r.updatedAtLocal || Date.now()).toISOString(),
        updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
        deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
      });
    } else if (cloud.id === r.id) {
      // Same id already exists in cloud → safe to upsert by id (idempotent)
      rowsSafe.push({
        id: r.id,
        club_id,
        session_id: r.sessionId,
        order_no: r.orderNo ?? null,
        created_at: new Date(r.createdAt || r.updatedAtLocal || Date.now()).toISOString(),
        updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
        deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
      });
    } else {
      // Cloud already has a different id for the same (session,order)
      // → DO NOT insert. Remember to rewrite children to cloud.id.
      rewrite.set(r.id, cloud.id);
    }
  }

  // If we must rewrite children, do it atomically in Dexie
  if (rewrite.size) {
    await db.transaction('rw', db.goals_local, db.lineups_local, db.matches_local, async () => {
      for (const [localId, cloudId] of rewrite) {
        await db.goals_local.where('matchId').equals(localId).modify({ matchId: cloudId });
        await db.lineups_local.where('matchId').equals(localId).modify({ matchId: cloudId });
        // Hide the local duplicate (optional: keep for history)
        await db.matches_local.where('id').equals(localId).modify({ deletedAtLocal: Date.now() });
      }
    });
  }

  // Upsert only the safe rows; conflict by id
  if (rowsSafe.length) {
    const { error } = await sb.from('matches').upsert(rowsSafe, { onConflict: 'id' });
    if (error) throw error;
  }

  await setLastSync(`${key}.push`, Date.now());
  return { pushed: rowsSafe.length };
}


/**
 * Collapse local duplicates per (sessionId, orderNo).
 * Keeps the most recently updated; marks the rest deleted locally.
 * This is safe and makes the UI stop showing duplicates immediately.
 */
async function squashLocalMatchDuplicates(): Promise<number> {
  const db = assertDb();
  const all = await db.matches_local
    .filter((m: any) => !m.deletedAtLocal)
    .toArray();

  const groups = new Map<string, any[]>();
  for (const m of all) {
    const k = `${m.sessionId}#${m.orderNo}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(m);
  }

  let squashed = 0;
  const now = Date.now();
  for (const [, arr] of groups) {
    if (arr.length <= 1) continue;
    // newest first
    arr.sort((a, b) => (b.updatedAtLocal || 0) - (a.updatedAtLocal || 0));
    const keep = arr[0];
    for (const loser of arr.slice(1)) {
      await db.matches_local.update(loser.id, {
        deletedAtLocal: now,
        updatedAtLocal: now,
      });
      squashed++;
    }
  }
  return squashed;
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
  const pushed = await pushMatches();    // canonicalises (session_id, order_no), may rewrite locals
  const pulled = await pullMatches();    // brings back canonical ids/rows
  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 };
}
