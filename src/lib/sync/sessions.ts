import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId } from '$lib/sync/common'
import { getLastSync, setLastSync } from './state'
// import type { CloudSession} from '$lib/types/cloud'
import type { SessionLocal} from '$lib/types/domain'
import type { CloudSession } from '$lib/types/cloud'
import { toMs } from '$lib/utils/utils'

const syncPrefix = 'sync.sessions'
type CloudAck = { id: string; created_at: string; updated_at: string }
// --- Help functions ---
async function getPullCheckpoint(key: string) {
  const lastMs: number = (await getLastSync(key)) ?? 0;
  const lastIso: string =
    lastMs > 0 ? new Date(lastMs).toISOString() : '1970-01-01T00:00:00.000Z';
  return { lastMs, lastIso }
}

async function updatePullCheckpoint(key: string, maxMs: number) {
  if (maxMs > 0) await setLastSync(key, maxMs)
}

async function preloadLocalSessions(
  db: any,
  ids: string[]
): Promise<Map<string, SessionLocal>> {
  if (!ids.length) return new Map()
  const rows = await db.sessions_local.bulkGet(ids)
  const map = new Map<string, SessionLocal>()

  rows.forEach((r: SessionLocal | undefined, i: number) => {
    if (r) map.set(ids[i], r)
  })

  return map
}

async function fetchCloudSessionsSince(
  sb: any,
  club_id: string,
  sinceIso: string
): Promise<CloudSession[]> {
  const { data, error } = await sb
    .from('sessions')
    .select('id, date, status, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .gt('updated_at', sinceIso)
    .order('updated_at', { ascending: true })

  if (error) throw error;
  return (data ?? []) as CloudSession[]
}

function toLocalPatchFromCloud(r: CloudSession) {
  // Endast domän + serverspegel (ms); ingen lokal metadata
  return {
    id: r.id,
    date: r.date,
    status: r.status,
    createdAt: toMs(r.created_at),
    updatedAt: toMs(r.updated_at),
  } as Pick<SessionLocal, 'id' | 'date' | 'status' | 'createdAt' | 'updatedAt'>
}

function shouldOverwriteLocal(local: SessionLocal, serverUpdatedAtMs: number) {
  if (local.dirty) return false // skydda lokala ändringar
  const localServerStamp = local.updatedAt ?? 0
  return serverUpdatedAtMs > localServerStamp
}

async function applyCloudRowToLocal(
  db: any,
  r: CloudSession,
  local: SessionLocal | undefined
) {
  // Sessions har ingen soft delete → servern raderad = hård delete lokalt
  if (r.deleted_at) {
    await db.sessions_local.delete(r.id)
    return
  }

  const patch = toLocalPatchFromCloud(r)
  const serverUpdatedAtMs = patch.updatedAt ?? 0

  if (!local) {
    // Ny lokalt: initiera metadata, men skriv inte över i efterhand
    await db.sessions_local.add({
      ...patch,
      updatedAtLocal: 0,
      dirty: false,
      op: null,
    } as SessionLocal)
    return
  }

  if (!shouldOverwriteLocal(local, serverUpdatedAtMs)) {
    // antingen dirty lokalt eller servern är inte nyare → gör inget
    return
  }

  // Uppdatera endast domän + serverspegel, rör inte lokal metadata
  await db.sessions_local.update(r.id, patch)
}

async function getDirtySessions(db: any): Promise<SessionLocal[]> {
  return db.sessions_local.filter((r: SessionLocal) => r.dirty).toArray();
}

function partitionByOp(rows: SessionLocal[]) {
  const creates = rows.filter(r => r.op === 'create');
  const updates = rows.filter(r => r.op === 'update');
  const deletes = rows.filter(r => r.op === 'delete');
  return { creates, updates, deletes };
}

function buildUpsertPayload(rows: SessionLocal[], club_id: string) {
  return rows.map(r => ({
    id: r.id,
    club_id,
    date: r.date,
    status: r.status,
  }));
}

async function pushCreates(sb: any, club_id: string, rows: SessionLocal[]): Promise<CloudAck[]> {
  const payload = buildUpsertPayload(rows, club_id);
  const { data, error } = await sb
    .from('sessions')
    .upsert(payload, { onConflict: 'id' })
    .select('id, created_at, updated_at');
  if (error) throw error;
  return (data ?? []) as CloudAck[];
}

async function pushUpdates(sb: any, club_id: string, rows: SessionLocal[]): Promise<CloudAck[]> {
  const payload = buildUpsertPayload(rows, club_id);
  const { data, error } = await sb
    .from('sessions')
    .upsert(payload, { onConflict: 'id' })
    .select('id, created_at, updated_at')

  if (error) throw error
  return (data ?? []) as CloudAck[]
}

async function pushDeletes(sb: any, club_id: string, rows: SessionLocal[]): Promise<string[]> {
  const ids = rows.map(r => r.id)
  const { error } = await sb.from('sessions').delete().eq('club_id', club_id).in('id', ids)

  if (error) throw error
  return ids
}

async function pushSoftDeletes(
  sb: any,
  club_id: string,
  rows: SessionLocal[]
): Promise<string[]> {
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const nowIso = new Date().toISOString();

  // Soft delete: sätt deleted_at (och låt trigger bumpa updated_at)
  const { data, error } = await sb
    .from('sessions')
    .update({ deleted_at: nowIso })
    .eq('club_id', club_id)
    .in('id', ids)
    .select('id, updated_at, deleted_at'); // krävs för att få tillbaka rader

  if (error) throw error;

  // Returnera bara de som faktiskt uppdaterades i DB
  return (data ?? []).map((r: CloudSession) => r.id as string);
}

async function acknowledgeUpserts(db: any, acks: CloudAck[]) {
  if (!acks.length) return
  await db.transaction('rw', db.sessions_local, async () => {
    for (const a of acks) {
      await db.sessions_local.update(a.id, {
        createdAt: toMs(a.created_at)!, // servern garanterar värden
        updatedAt: toMs(a.updated_at)!,
        dirty: false,
        op: null,
        // updatedAtLocal lämnas orörd (reflekterar senaste lokala edit)
      } as Partial<SessionLocal>)
    }
  })
}

async function acknowledgeDeletes(db: any, ids: string[]) {
  if (!ids.length) return
  await db.sessions_local.bulkDelete(ids)
}

// --- Public API ---
export async function pushSessions() {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()


  const dirty = await getDirtySessions(db);
  if (!dirty.length) return { pushed: 0, created: 0, updated: 0, deleted: 0 };

  const { creates, updates, deletes } = partitionByOp(dirty);

  let pushed = 0;

  // CREATE
  if (creates.length) {
    const acks = await pushCreates(sb, club_id, creates);
    await acknowledgeUpserts(db, acks);
    pushed += acks.length;
  }

  // UPDATE
  if (updates.length) {
    const acks = await pushUpdates(sb, club_id, updates);
    await acknowledgeUpserts(db, acks);
    pushed += acks.length;
  }

  // DELETE (mjuk delete i molnet)
  if (deletes.length) {
    const deletedIds = await pushSoftDeletes(sb, club_id, deletes);
    console.log('?deletedAfterPush=', deletedIds, '?from=', deletes)
    await acknowledgeDeletes(db, deletedIds);
    pushed += deletedIds.length;
  }

  return { pushed }
}

export const pullSessions = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  const { lastMs, lastIso } = await getPullCheckpoint(`${syncPrefix}.pull`)
  const cloudRows = await fetchCloudSessionsSince(sb, club_id, lastIso)

  let maxUpdatedAtMs = lastMs

  await db.transaction('rw', db.sessions_local, async () => {
    const localById = await preloadLocalSessions(db, cloudRows.map(r => r.id))

    for (const row of cloudRows) {
      const updatedAtMs = toMs(row.updated_at)
      if (updatedAtMs == null) continue // defensivt: borde aldrig hända då updated_at är NOT NULL i DB
      if (updatedAtMs > maxUpdatedAtMs) maxUpdatedAtMs = updatedAtMs

      await applyCloudRowToLocal(db, row, localById.get(row.id))
    }
  })

  // await setLastSync(`${syncPrefix}.pull`, Date.now())
  await updatePullCheckpoint(`${syncPrefix}.pull`, maxUpdatedAtMs)
  // return { pulled: mapped.length ?? 0 }
  return { pulled: cloudRows.length }
}

export const syncSessions = async () => {
  const pushed = await pushSessions()
  const pulled = await pullSessions()

  return { pushed: pushed.pushed, pulled: pulled.pulled }
}
