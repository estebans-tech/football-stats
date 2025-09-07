import { assertDb } from '$lib/db/dexie'
import { ensureSession, readClubId } from './common'
import { getLastSync, setLastSync } from './state'
// import type { CloudSession} from '$lib/types/cloud'
import type { SessionLocal} from '$lib/types/domain'


type SupabaseSessionRow = {
  id: string;
  date: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function dedupeByDate(rows: SessionLocal[]) {
  const m = new Map<string, SessionLocal>()
  for (const r of rows) {
    const prev = m.get(r.date)
    if (!prev || r.updatedAtLocal > prev.updatedAtLocal) m.set(r.date, r)
  }
  return [...m.values()]
}

const key = 'sync.sessions'

export async function pushSessions() {
  const sb = await ensureSession()
  const club_id = await readClubId()
  const db = assertDb()

  const locals = await db.sessions_local.toArray()
  const rows = dedupeByDate(locals)                 // ✅ ta bort dubletter i payload

  if (rows.length === 0) return { pushed: 0 }

  const payload = rows.map(s => ({
    id: s.id,                                       // vi kör fortfarande on_conflict=id
    club_id,
    date: s.date,
    status: s.status,
    updated_at: new Date(s.updatedAtLocal).toISOString(),
    deleted_at: s.deletedAtLocal
      ? new Date(s.deletedAtLocal).toISOString()
      : null
  }))

  const { error } = await sb
    .from('sessions')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: false })

  if (error) throw error
  return { pushed: payload.length }
}

export const pullSessions = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()

  const { data, error } = await sb
    .from('sessions')
    .select('id, date, status, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .order('updated_at', { ascending: true })
  if (error) throw error

  const db = assertDb()

  const mapped = (data || []).map((r: SupabaseSessionRow) => ({
    id: r.id,
    date: r.date,
    status: r.status || 'open',
    createdAt: new Date(r.created_at).getTime() || Date.now(),
    updatedAtLocal: new Date(r.updated_at as any).getTime() || Date.now(),
    deletedAtLocal: r.deleted_at ? new Date(r.deleted_at as any).getTime() : null
  }))
  await db.sessions_local.bulkPut(mapped)

  await setLastSync(`${key}.pull`, Date.now())
  return { pulled: mapped.length }
}

export const syncSessions = async () => {
  const a = await pushSessions()
  const b = await pullSessions()
  return { pushed: a?.pushed, pulled: b.pulled }
}
