import { getSupabase } from '$lib/supabase/client'
import type { Table } from 'dexie'

// ISO -> ms (0 om null/ogiltig)
export const msFromIso = (s?: string | null) => (s ? new Date(s).getTime() || 0 : 0)

// optional ms (undefined om saknas)
export const optMs = (s?: string | null): number | undefined =>
  s ? (new Date(s).getTime() || undefined) : undefined

// Strict to 1|2
export type Half = 1 | 2
export const toHalf = (h?: number | null): Half => (h === 2 ? 2 : 1)

// Strict to 'home'|'away' om din domän har detta
export type TeamSide = 'A' | 'B'
export const toTeam = (s?: string | null): TeamSide => (s === 'A' ? 'B' : 'A')

export const ensureSession = async () => {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase saknas')
  let { data: { session } } = await sb.auth.getSession()
  if (!session) {
    const { error } = await sb.auth.signInAnonymously()
    if (error) throw error
  }
  return sb
}

export const readClubId = async (): Promise<string> => {
  try {
    const p = JSON.parse(localStorage.getItem('fs.profile') || 'null')
    if (p?.club_id) return p.club_id
  } catch {}
  const sb = await ensureSession()
  const { data: u } = await sb.auth.getUser()
  const uid = u?.user?.id
  if (!uid) throw new Error('Ingen uid i sessionen')
  const { data, error } = await sb.from('profiles').select('club_id').eq('user_id', uid).maybeSingle()
  if (error) throw error
  if (!data?.club_id) throw new Error('club_id saknas')
  return data.club_id
}

export async function bulkPutIfNewer<T extends { id: string; updatedAtLocal?: number }>(
  table: Table<T, string>,
  rows: T[]
) {
  await table.db.transaction('rw', table, async () => {
    for (const r of rows) {
      const existing = await table.get(r.id)
      const localTs = existing?.updatedAtLocal ?? 0
      const incomingTs = r.updatedAtLocal ?? 0
      if (!existing || incomingTs >= localTs) {
        await table.put(r)
      }
    }
  })
}