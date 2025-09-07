import { getSupabase } from '$lib/supabase/client'
import { assertDb } from '$lib/db/dexie'
import { getLastSync, setLastSync } from './state'
import { refreshProfile } from '$lib/auth/auth'

const tableKey = 'sync.players'

const ensureSession = async () => {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase saknas')
  let { data: { session } } = await sb.auth.getSession()
  if (!session) {
    const { error } = await sb.auth.signInAnonymously()
    if (error) throw error
  }
  return sb
}

const readClubId = async (): Promise<string> => {
  // 1) Prova cache
  try {
    const p = JSON.parse(localStorage.getItem('fs.profile') || 'null')
    if (p?.club_id) return p.club_id as string
  } catch {}

  // 2) Hämta exakt din rad i profiles
  const sb = await ensureSession()
  const { data: u } = await sb.auth.getUser()
  const uid = u?.user?.id
  if (!uid) throw new Error('Ingen uid i sessionen')

  const { data, error } = await sb
    .from('profiles')
    .select('club_id')
    .eq('user_id', uid)           // <— viktigt
    .maybeSingle()

  if (error) throw error
  if (!data?.club_id) throw new Error('club_id saknas i profilsrad')
  return data.club_id as string
}
  

export const pushPlayers = async () => {
  const sb = await ensureSession()
  await refreshProfile()
  const db = assertDb()

  const last = await getLastSync('sync.players.push')
  const toPush = await db.players_local
    .filter((r: any) => (r.updatedAtLocal || 0) > last)
    .toArray()

  const club_id = await readClubId()
  console.log('[sync] push: candidates', toPush.length, { club_id, last })

  if (toPush.length === 0) return { pushed: 0 }

  const rows = toPush.map((r: any) => ({
    id: r.id,
    club_id,
    name: r.name ?? '',
    nickname: r.nickname ?? null,
    active: r.active ?? true,
    created_at: new Date(r.createdAt || Date.now()).toISOString(),
    updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
    deleted_at: r.deletedAtLocal ? new Date(r.deletedAtLocal).toISOString() : null
  }))

  console.log('[sync] push → upsert', rows.length, rows.slice(0, 2))
  const { error } = await sb.from('players').upsert(rows, { onConflict: 'id' })
  if (error) throw error

  await setLastSync('sync.players.push', Date.now())
  return { pushed: rows.length }
}

export const pullPlayers = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()
  console.log('[sync] pull for club', club_id)

  const { data, error } = await sb
    .from('players')
    .select('id, name, nickname, active, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .order('updated_at', { ascending: true })
  if (error) throw error

  const rows = data || []
  console.log('[sync] pull ←', rows.length)

  const db = assertDb()
  const mapped = rows.map((r: {
    id: string;
    name: string | null;
    nickname: string | null;
    active: boolean | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }) => ({
    id: r.id,
    name: r.name ?? '',
    nickname: r.nickname ?? null,
    active: !!r.active,
    createdAt: new Date(r.created_at as any).getTime() || Date.now(),
    updatedAtLocal: new Date(r.updated_at as any).getTime() || Date.now(),
    deletedAtLocal: r.deleted_at ? new Date(r.deleted_at as any).getTime() : null
  }))

  // snabbare och enklare än transaction+loop
  await db.players_local.bulkPut(mapped)

  await setLastSync('sync.players.pull', Date.now())
  return { pulled: rows.length }
}

export const syncPlayers = async () => {
  const resPush = await pushPlayers()
  const resPull = await pullPlayers()
  return { pushed: resPush.pushed, pulled: resPull.pulled }
}
