import { getSupabase } from '$lib/supabase/client'
import { assertDb } from '$lib/db/dexie'
import { getLastSync, setLastSync } from '$lib/sync/state'
import { readProfileFromLS } from '$lib/auth/profileStorage'
import { toMs } from '$lib/utils/utils'

// Types
import type { PlayerLocal } from '$lib/types/domain';
import type { CloudPlayer } from '$lib/types/cloud';

const tableKey = 'sync.players'

const ensureSession = async () => {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase saknas')

  const { data: { user }, error } = await sb.auth.getUser()
  if (error) throw new Error(`Ensure session failed: ${error.message}`) // <-- viktigt
  if (!user) throw new Error('Inte inloggad')

    return sb
}

const readClubId = async (): Promise<string> => {
  // 1) Prova cache
  try {
    const p = readProfileFromLS()
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
  const club_id = await readClubId()

  const db = assertDb()

  const last = await getLastSync('sync.players.push')
  const toPush = await db.players_local
    .filter(r => r.dirty === true && (r.updatedAtLocal || 0) > last)
    .toArray()

  if (toPush.length === 0) return { pushed: 0 }

  const rows = toPush.map((r: any) => ({
    id: r.id,
    club_id,
    name: r.name ?? '',
    nickname: r.nickname ?? null,
    active: r.active ?? true,
    created_at: new Date(r.createdAt || Date.now()).toISOString(),
    updated_at: new Date(r.updatedAtLocal || Date.now()).toISOString(),
    deleted_at: r.deletedAt ? new Date(r.deletedAt).toISOString() : null
  }))

  const { error } = await sb.from('players').upsert(rows, { onConflict: 'id' })
  if (error) throw error

  await setLastSync('sync.players.push', Date.now())
  return { pushed: rows.length }
}

export const pullPlayers = async () => {
  const sb = await ensureSession()
  const club_id = await readClubId()

  const { data, error } = await sb
    .from('players')
    .select('id, name, nickname, active, created_at, updated_at, deleted_at')
    .eq('club_id', club_id)
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = data || []

  // robust tidsparser: ISO/string/Date -> ms epoch | null
  const db = assertDb()
  const mapped = rows.map((r: CloudPlayer) => {
    const createdAt = toMs(r.created_at)
    const updatedAt = toMs(r.updated_at)
    const deletedAt = toMs(r.deleted_at)

    return {
      id: r.id as string,
      name: (r.name ?? '') as string,
      nickname: (r.nickname ?? null) as string | null,
      active: !!r.active,
      // cloud-mirroring
      createdAt,
      deletedAt,
      updatedAt,
      // local metadata (inte satta av pull)
      createdAtLocal: null,
      // push-status
      dirty: false
    }
  }) as PlayerLocal[]

  // snabbare och enklare än transaction+loop
  await db.players_local.bulkPut(mapped)

  await setLastSync('sync.players.pull', Date.now())
  return { pulled: rows.length }
}

export const syncPlayers = async () => {
  const resPush = await pushPlayers()
  const resPull = await pullPlayers()
  // return { pushed: 0, pulled: resPull.pulled }
  return { pushed: resPush.pushed, pulled: resPull.pulled }
}
