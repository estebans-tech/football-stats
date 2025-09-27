import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId, msFromIso, bulkPutIfNewer, optMs } from './common'

import { getLastSync, setLastSync } from './state'
import type { MatchRow, CloudMatch, CloudSession } from '$lib/types/cloud'
import type { MatchLocal, ULID } from '$lib/types/domain'
import { toMs, isoDate as toIso } from '$lib/utils/utils'
import { number } from 'svelte-i18n'

// interface SupabaseMatchRow {
//   id: string;
//   session_id: string;
//   order_no: number;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;
// }

const syncKey = 'sync.matches'

// type MatchUpsertRow = {
//   __local_id?: string;                // <-- in-memory only (strip before send)
//   session_id: string;
//   order_no: number;
//   club_id: string;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;
// };

// function dedupeByPair<T extends { session_id: string; order_no: number; updated_at: string }>(rows: T[]) {
//   const m = new Map<string, T>();
//   for (const r of rows) {
//     const k = `${r.session_id}#${r.order_no}`;
//     const prev = m.get(k);
//     if (!prev || +new Date(r.updated_at) > +new Date(prev.updated_at)) m.set(k, r);
//   }
//   return [...m.values()];
// }

/**
 * Re-key a local match to a new id and move its FKs (lineups/goals).
 * Safe to call even if another row with targetId already exists.
 */
// async function rekeyLocalMatch(oldId: string, targetId: string) {
//   const db = assertDb()
//   if (oldId === targetId) return

//   await db.transaction('rw',
//     db.matches_local, db.lineups_local, db.goals_local,
//     async () => {
//       // If a match with the target id is not present locally, create it from the old one.
//       const existingTarget = await db.matches_local.get(targetId)
//       const src = await db.matches_local.get(oldId)
//       if (!src) return

//       if (!existingTarget) {
//         await db.matches_local.put({ ...src, id: targetId })
//       }

//       // Move foreign keys
//       await db.lineups_local.where('matchId').equals(oldId).modify({ matchId: targetId })
//       await db.goals_local.where('matchId').equals(oldId).modify({ matchId: targetId })

//       // Drop the old record
//       await db.matches_local.delete(oldId)
//     }
//   )
// }

/**
 * One-time local tidy: if we already have duplicate matches for the same
 * (sessionId, orderNo), keep the one with the *newest* updatedAtLocal and
 * re-key the other to that id.
 */
// async function mergeLocalDuplicates() {
//   const db = assertDb()
//   const all = await db.matches_local.toArray()
//   const byKey = new Map<string, { id: string; updatedAtLocal?: number }>()
//   for (const m of all) {
//     const key = `${m.sessionId}:${m.orderNo}`
//     const prev = byKey.get(key)
//     if (!prev) { byKey.set(key, { id: m.id, updatedAtLocal: m.updatedAtLocal }); continue }
//     // decide which to keep
//     const keep = (prev.updatedAtLocal ?? 0) >= (m.updatedAtLocal ?? 0) ? prev.id : m.id
//     const drop = keep === prev.id ? m.id : prev.id
//     await rekeyLocalMatch(drop, keep)
//     byKey.set(key, { id: keep, updatedAtLocal: Math.max(prev.updatedAtLocal ?? 0, m.updatedAtLocal ?? 0) })
//   }
// }

async function repairLocalMatchWithoutCreatedAt() {
  const db = assertDb();
  const toRepair = await db.matches_local
  .filter(r => !r.createdAt)
  .toArray()

  console.log('?matchesToRepair=', toRepair)
  const mapped = toRepair.map((r: MatchLocal) => {
    return {
      id: r.id as string,
      orderNo: r.orderNo,
      // cloud-mirroring
      createdAt: r.createdAt ?? r.updatedAtLocal,
      deletedAt: r.deletedAt ?? null,
      updatedAt: r.createdAt ?? r.updatedAtLocal,
      updatedAtLocal: r.updatedAtLocal ?? null,
      // local metadata (inte satta av pull)
      // push-status
      dirty: true
    }
  }) as MatchLocal[]

  // snabbare och enklare än transaction+loop
  await db.matches_local.bulkPut(mapped)
}


async function repairLocalMatchWithLocalDeletedAt() {
  const db = assertDb();
  const toRepair = await db.matches_local
  .filter(r => r.deletedAtLocal === null || r.deletedAtLocal !== undefined)
  .toArray()

  console.log('?matchesToRepair=', toRepair)
  const mapped = toRepair.map((r: MatchLocal) => {
    return {
      ...r,
      deletedAtLocal: undefined,
    }
  }) as MatchLocal[]

  // snabbare och enklare än transaction+loop
  await db.matches_local.bulkPut(mapped)
}
type RenumPlanItem = {
  id: ULID
  from: number | null        // nuvarande orderNo (kan vara ogiltigt/null)
  to: number                 // nytt orderNo (1..N)
}
type RenumPlan = RenumPlanItem[]
type MatchOrderChange = { id: ULID; from: number | null; to: number }
type MatchOrderChanges = MatchOrderChange[]

const now = () => Date.now()
const matchLocalIsActive = (m: MatchLocal) => m.deletedAt == null
const hasValidOrderNo = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1

// Hjälpkomparatorer som tål null/undefined
const numberAsc = (a?: number | null, b?: number | null) =>
  (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY)

const numberDesc = (a?: number | null, b?: number | null) =>
  (b ?? Number.NEGATIVE_INFINITY) - (a ?? Number.NEGATIVE_INFINITY)

// const strAsc = (a?: string, b?: string) => (a ?? '').localeCompare(b ?? '')

/**
 * Bygger en renummeringsplan (utan att skriva något).
 * Regler:
 *  - Bara aktiva (deletedAt == null)
 *  - Giltiga orderNo (>=1 heltal) sorteras: orderNo ASC,
 *    tie-break: updatedAtLocal DESC → updatedAt DESC → createdAt ASC → id ASC
 *  - Ogiltiga orderNo läggs sist: updatedAtLocal DESC → updatedAt DESC → createdAt ASC → id ASC
 *  - Tilldela 1..N och skapa plan för rader där orderNo !== expected
 */
export async function buildRenumPlanForSession(sessionId: ULID): Promise<RenumPlan> {

  const db = assertDb()
  const rows = (await db.matches_local.where('sessionId').equals(sessionId).toArray())
    .filter(matchLocalIsActive)

  if (rows.length === 0) return []

  const valid = rows.filter(r => hasValidOrderNo(r.orderNo))
  const invalid = rows.filter(r => !hasValidOrderNo(r.orderNo))

  // Sortering enligt reglerna
  valid.sort((a, b) =>
    (a.orderNo! - b.orderNo!) ||
    numberDesc(a.updatedAtLocal, b.updatedAtLocal) ||
    numberDesc(a.updatedAt,       b.updatedAt) ||
    numberAsc(a.createdAt,        b.createdAt)
  )

  invalid.sort((a, b) =>
    numberDesc(a.updatedAtLocal, b.updatedAtLocal) ||
    numberDesc(a.updatedAt,       b.updatedAt) ||
    numberAsc(a.createdAt,        b.createdAt)
  )

  const ordered = valid.concat(invalid)

  // Bygg plan 1..N
  const plan: RenumPlan = []
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]
    const expected = i + 1
    const current = hasValidOrderNo(row.orderNo) ? row.orderNo! : null
    if (current !== expected) {
      plan.push({ id: row.id, from: current, to: expected })
    }
  }

  return plan
}

/**
 * Uppdaterar lokala orderNo för EN session enligt givna ändringar.
 * - Hoppar över rader som saknas, redan har rätt orderNo eller är soft-deletade.
 * - Bump: updatedAtLocal, säkerställ: dirty=true.
 */
export async function applySessionMatchOrder(
  sessionId: ULID,
  changes: MatchOrderChanges
): Promise<{ updated: number; skipped: number; total: number }> {
  if (!changes.length) return { updated: 0, skipped: 0, total: 0 }

  const db = assertDb()
  let updated = 0
  let skipped = 0

  await db.transaction('rw', db.matches_local, async () => {
    for (const { id, to } of changes) {
      const row = await db.matches_local.get(id) as MatchLocal | undefined
      if (!row) { skipped++; continue }
      if (row.deletedAt != null) { skipped++; continue }        // blev soft-deletad under tiden
      if (row.sessionId !== sessionId) { skipped++; continue }  // defensivt
      if (row.orderNo === to) { skipped++; continue }           // redan rätt

      const ts = now()
      const ok = await db.matches_local.update(id, {
        orderNo: to,
        updatedAtLocal: ts,
        dirty: true
      })
      ok ? updated++ : skipped++
    }
  })

  return { updated, skipped, total: changes.length }
}

type ApplyResult = { updated: number; skipped: number; total: number }

/**
 * Använder applySessionMatchOrder per sessionId.
 * Körs sekventiellt (en transaktion per session).
 */
export async function applySessionMatchOrders(
  changesBySession: Map<ULID, MatchOrderChanges>
): Promise<Map<ULID, ApplyResult>> {
  const results = new Map<ULID, ApplyResult>()
  for (const [sessionId, changes] of changesBySession) {
    const res = await applySessionMatchOrder(sessionId, changes)
    results.set(sessionId, res)
  }
  return results
}

/** (Valfritt) summera alla resultat */
export function summarizeApplyResults(
  results: Map<ULID, ApplyResult>
): ApplyResult {
  let updated = 0, skipped = 0, total = 0
  for (const r of results.values()) {
    updated += r.updated; skipped += r.skipped; total += r.total
  }
  return { updated, skipped, total }
}

/**
 * Push matches and reconcile local ids with server ids chosen by the
 * (session_id, order_no) unique constraint.
 */
export const pushMatchesLegacy = async () => {
  const db = assertDb();
  const lastSync = await getLastSync(`${syncKey}.push`);

  // 1) Plocka lokala ändringar som kan påverka ordningen (aktiva, ej soft-deleted)
  const changedForRevision = await db.matches_local
    .filter((m: MatchLocal) => m.dirty === true && m.deletedAt == null) // == matches both null & undefined
    .toArray()
    
  // 2) Sessionerna vi ska revidera
  const unique = <T extends string | number>(toRevise: T[]) => Array.from(new Set(toRevise));
  const sessionIds = unique(changedForRevision.map(match => match.sessionId))

  // 3) Bygg renum-plan per sessionId
  const plansBySession = new Map<ULID, RenumPlan>()

  for (const sid of sessionIds) {
    const plan = await buildRenumPlanForSession(sid)

    if (plan.length) plansBySession.set(sid, plan)
    console.log('plan length', plan.length, plan)
  }
console.log('plan length', changedForRevision)

  
  // const changed = await db.matches_local
  //   .filter((r: MatchLocal) => (r.dirty === true && r.updatedAtLocal || 0) > lastSync)
  //   .toArray()
  //   await repairLocalMatchWithLocalDeletedAt()
  //   await repairLocalMatchWithoutCreatedAt()

  //   console.log('?changed=', changed)
  // if (!changed.length) return { pushed: 0 };

  // const sb = await ensureSession();
  // const club_id = await readClubId();

  // 2) Hämta molnets rader för de berörda sessionerna
  // const sessionIds = Array.from(new Set(changed.map((m: MatchLocal) => m.sessionId)))

  // const { data: cloudRows, error: cloudErr } = await sb
  //   .from('matches')
  //   .select('id, session_id, order_no, updated_at, deleted_at, created_at')
  //   .in('session_id', sessionIds);

  // if (cloudErr) throw cloudErr;

  // Key = "session:order"  ->  { id, updated_at, deleted_at }
  // const cloudByKey = new Map<
  //   string,
  //   { id: string; updated_at: string | null; deleted_at: string | null }
  // >();

  // for (const r of cloudRows ?? []) {
  //   cloudByKey.set(`${r.session_id}:${r.order_no}`, {
  //     id: r.id,
  //     updated_at: r.updated_at ?? null,
  //     deleted_at: r.deleted_at ?? null
  //   });
  // }

  // 3) Bygg säkra upserts + ev. omskrivnings-karta
  // const rowsSafe: any[] = [];
  // const rewrite = new Map<string, string>(); // localId -> canonical cloudId

  // for (const r of changed) {
  //   const k = `${r.sessionId}:${r.orderNo ?? null}`;
  //   const cloud = cloudByKey.get(k);

  //   if (!cloud) {
  //     // Inget moln-row använder (session,order) -> säkert att upserta med vår id
  //     rowsSafe.push({
  //       id: r.id,
  //       club_id,
  //       session_id: r.sessionId,
  //       order_no: r.orderNo ?? null,
  //       created_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
  //       updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
  //       deleted_at: r.deletedAt && r.dirty === true ? new Date(r.deletedAt).toISOString() : null
  //     });
  //     continue;
  //   }

  //   if (cloud.id === r.id) {
  //     // Samma id finns redan i molnet -> idempotent upsert
  //     rowsSafe.push({
  //       id: r.id,
  //       club_id,
  //       session_id: r.sessionId,
  //       order_no: r.orderNo ?? null,
  //       created_at: r.createdAt || r.updatedAtLocal,
  //       updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
  //       deleted_at: r.deletedAt && r.dirty === true ? new Date(r.deletedAt).toISOString() : null
  //     });
  //     continue;
  //   }

  //   // Annat id i molnet för samma (session,order) -> skriv inte in en dubblett
  //   // utan peka om barn till cloud.id
  //   rewrite.set(r.id, cloud.id);

  //   const localMs = r.updatedAtLocal || 0;
  //   const remoteMs = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;

  //   // Om den lokala är nyare: skriv uppdateringen på det kanoniska moln-id:t
  //   if (localMs > remoteMs) {
  //     rowsSafe.push({
  //       id: cloud.id,
  //       club_id,
  //       session_id: r.sessionId,
  //       order_no: r.orderNo ?? null,
  //       // skicka inte created_at vid update
  //       updated_at: new Date(localMs || Date.now()).toISOString(),
  //       deleted_at: r.deletedAtLocal
  //         ? new Date(r.deletedAtLocal).toISOString()
  //         : (cloud.deleted_at ?? null)
  //     });
  //   }
  // }

  // 4) Peka om barn (goals/lineups) och markera lokalt dubblett-match som raderad
  // if (rewrite.size) {
  //   await db.transaction('rw', db.goals_local, db.lineups_local, db.matches_local, async () => {
  //     for (const [localId, cloudId] of rewrite) {
  //       await db.goals_local.where('matchId').equals(localId).modify({ matchId: cloudId });
  //       await db.lineups_local.where('matchId').equals(localId).modify({ matchId: cloudId });
  //       await db.matches_local.where('id').equals(localId).modify({ deletedAtLocal: Date.now() });
  //     }
  //   });
  // }

  // 5) Upserta enbart säkra rader, konflikt på id
  // if (rowsSafe.length) {
  //   const { error } = await sb.from('matches').upsert(rowsSafe, { onConflict: 'id' });
  //   if (error) throw error;
  // }

  // await setLastSync(`${key}.push`, Date.now());
  // return { pushed: rowsSafe.length };
  return { pushed: 0 }
};

export async function pushMatches(): Promise<{
  pushed: number
  failed?: number
  skipped?: number
  errors?: Array<{ id: string | '*batch*'; code?: string; message: string }>
}> {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  // --- 0) (small) Revision before push: fixa ev. dubbletter/hål i de sessioner som ändrats lokalt (aktiva, ej soft-deleted)
  const changedForRevision = await db.matches_local
    .filter((m: MatchLocal) => m.dirty === true && m.deletedAt == null)
    .toArray()

  const sessionIds = Array.from(new Set(changedForRevision.map(m => m.sessionId)))
    for (const sid of sessionIds) {
      const plan = await buildRenumPlanForSession(sid) // du har redan denna
      if (plan.length) {
        await applySessionMatchOrder(sid, plan)        // och denna
      }
    }

  // --- 1) Plocka ALLA dirty för push (aktiva + soft-deleted)
  const dirtyRows = await db.matches_local
    .filter((m: MatchLocal) => m.dirty === true)
    .toArray()

    if (dirtyRows.length === 0) {
    return { pushed: 0 }
    // return { pushed: 0, failed: 0 }
  }

  // --- 2) Preflight: blockera aktiva utan giltigt orderNo (soft-deleted får passera oavsett)
  const blocked: MatchLocal[] = []
  const toPush: MatchLocal[] = []
  for (const r of dirtyRows) {
    if (r.deletedAt == null && !hasValidOrderNo(r.orderNo)) {
      blocked.push(r)   // låt ligga kvar som dirty tills UI/logic fixar orderNo
    } else {
      toPush.push(r)
    }
  }


  if (toPush.length === 0) {
    return { pushed: 0 }
    // return { pushed: 0, failed: blocked.length, skipped: 0 }
  }

  // --- 3) Mappa payload mot cloud
  type UpRow = {
    id: string
    club_id: string
    session_id: string
    order_no: number | null
    deleted_at: string | null
  }
  const payload: UpRow[] = toPush.map(r => ({
    id: r.id,
    club_id,
    session_id: r.sessionId,
    order_no: r.deletedAt == null ? (r.orderNo as number) : r.orderNo ?? null, // bör vara giltig efter revision
    deleted_at: r.deletedAt ? toIso(r.deletedAt) : toIso(),
  }))

  // --- 4) Skicka i batchar, upsert + select för att få updated_at/created_at tillbaka
  const BATCH = 200
  let pushed = 0
  const errors: Array<{ id: string | '*batch*'; code?: string; message: string }> = []

  for (let i = 0; i < payload.length; i += BATCH) {
    const chunk = payload.slice(i, i + BATCH)
    const { data, error } = await sb
      .from('matches')
      .upsert(chunk, { onConflict: 'id' })
      .select('id, created_at, updated_at, deleted_at')

    if (error) {
      errors.push({ id: '*batch*', code: (error as any).code, message: error.message })
      continue // lämna dessa kvar som dirty
    }

    // Indexera svaret på id
    const byId = new Map<string, { id: string; created_at: string | null; updated_at: string; deleted_at: string | null }>()
    for (const row of (data ?? [])) byId.set(row.id, row)

    // Uppdatera lokalt i en transaktion
    await db.transaction('rw', db.matches_local, async () => {
      for (const u of chunk) {
        const srv = byId.get(u.id)
        if (!srv) {
          // borde inte hända vid ok svar; lämna som dirty
          errors.push({ id: u.id, message: 'Row missing in server response' })
          continue
        }
        const cur = await db.matches_local.get(u.id) as MatchLocal | undefined
        if (!cur) continue

        await db.matches_local.update(u.id, {
          dirty: false,
          // spegla serverklockor
          updatedAt: toMs(srv.updated_at),
          createdAt: cur.createdAt ?? toMs(srv.created_at),
          // deletedAt: låt stå som den redan är (ska motsvara srv.deleted_at)
          // updatedAtLocal: kan lämnas som är eller sättas null; funktionellt kvittar när dirty=false
        })
        pushed++
      }
    })
  }

  const failed = toPush.length - pushed
  const skipped = blocked.length


  return { pushed }
  // return { pushed, failed, skipped: skipped || undefined, errors: errors.length ? errors : undefined }
}

/**
 * Collapse local duplicates per (sessionId, orderNo).
 * Keeps the most recently updated; marks the rest deleted locally.
 * This is safe and makes the UI stop showing duplicates immediately.
 */
// async function squashLocalMatchDuplicates(): Promise<number> {
//   const db = assertDb();
//   const all = await db.matches_local
//     .filter((m: any) => !m.deletedAtLocal)
//     .toArray();

//   const groups = new Map<string, any[]>();
//   for (const m of all) {
//     const k = `${m.sessionId}#${m.orderNo}`;
//     (groups.get(k) ?? groups.set(k, []).get(k)!).push(m);
//   }

//   let squashed = 0;
//   const now = Date.now();
//   for (const [, arr] of groups) {
//     if (arr.length <= 1) continue;
//     // newest first
//     arr.sort((a, b) => (b.updatedAtLocal || 0) - (a.updatedAtLocal || 0));
//     const keep = arr[0];
//     for (const loser of arr.slice(1)) {
//       await db.matches_local.update(loser.id, {
//         deletedAtLocal: now,
//         updatedAtLocal: now,
//       });
//       squashed++;
//     }
//   }
//   return squashed;
// }

export const pullMatches = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()

  const last = await getLastSync(`${syncKey}.pull`);

  const { data, error } = await sb
    .from('matches')
    .select('id, session_id, order_no, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .gt('updated_at', new Date(last || 0).toISOString())
    .order('updated_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as MatchRow[]

  const db = assertDb()
  const mapped = rows.map((r: MatchRow) => {
    // robust timeparser: ISO/string/Date -> ms epoch | null
    const createdAt = toMs(r.created_at)
    const updatedAt = toMs(r.updated_at)
    const deletedAt = toMs(r.deleted_at)

    return {
      id: r.id as string,
      orderNo: r.order_no as number,
      sessionId: r.session_id as string,
      createdAt,
      deletedAt,
      updatedAt,
      // local metadata (unknown from pull)
      updatedAtLocal: null,
      dirty: false
    }
  }) as MatchLocal[]

  await db.matches_local.bulkPut(mapped)
  await setLastSync(`${syncKey}.pull`, Date.now())

  return { pulled: mapped.length }
}

export const syncMatches = async () => {
  const pushed = await pushMatches();    // canonicalises (session_id, order_no), may rewrite locals
  const pulled = await pullMatches();    // brings back canonical ids/rows
  return { pushed: pushed?.pushed ?? 0, pulled: pulled?.pulled ?? 0 };
}
