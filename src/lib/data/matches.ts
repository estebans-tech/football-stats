import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import { uid } from '$lib/utils/utils'             // your existing uid
import type { MatchLocal, SessionLocal } from '$lib/types/domain'

function now() { return Date.now() }

// Guard: throw if session is missing or locked
async function ensureUnlocked(sessionId: string) {
  const db = assertDb()
  const s = (await db.sessions_local.get(sessionId)) as SessionLocal | undefined
  if (!s || s.deletedAtLocal) throw new Error('SESSION_NOT_FOUND')
  if (s.status === 'locked') throw new Error('SESSION_LOCKED')
}

// Live count per sessionId
export function observeLocalMatchCount(sessionId: string) {
  const db = assertDb()
  return readable<number>(0, (set) => {
    const sub = liveQuery(() =>
      db.matches_local
        .where('sessionId')
        .equals(sessionId)
        .filter((m: MatchLocal) => !m.deletedAtLocal)
        .count()
    ).subscribe({ next: set, error: () => set(0) })
    return () => sub.unsubscribe()
  })
}

// Compute the next orderNo for a session (ignores soft-deleted)
async function nextOrderNo(sessionId: string) {
  const db = assertDb()
  const list = await db.matches_local
    .where('sessionId')
    .equals(sessionId)
    .filter((m: MatchLocal) => !m.deletedAtLocal)
    .sortBy('orderNo')                        // ✅ on Collection
  const last = list[list.length - 1]
  return (last?.orderNo ?? 0) + 1
}

export async function createLocalMatch(sessionId: string): Promise<MatchLocal> {
  await ensureUnlocked(sessionId)  // ⬅️ guard

  const db = assertDb()
  const orderNo = await nextOrderNo(sessionId)
  const match: MatchLocal = {
    id: uid(),
    sessionId,
    orderNo,
    updatedAtLocal: Date.now()
    }

  await db.matches_local.add(match)
  return match
}

export async function createLocalMatches(sessionId: string, count: number): Promise<MatchLocal[]> {
  await ensureUnlocked(sessionId)  // ⬅️ guard

  if (count <= 0) return []
  const db = assertDb()
  const start = await nextOrderNo(sessionId)
  const now = Date.now()
  const items = Array.from({ length: count }, (_, i) => ({
    id: uid(),
    sessionId,
    orderNo: start + i,
    updatedAtLocal: now
  }))
  await db.matches_local.bulkAdd(items)
  return items
}

export function observeLocalMatchCounts() {
  const db = assertDb()
  return readable<Record<string, number>>({}, (set) => {
    const sub = liveQuery(() => db.matches_local.toArray()).subscribe({
      next: (rows: MatchLocal[]) => {
        const acc: Record<string, number> = {}
        for (const m of rows) {
          if (m.deletedAtLocal) continue
          acc[m.sessionId] = (acc[m.sessionId] ?? 0) + 1
        }
        set(acc)
      },
      error: () => set({})
    })
    return () => sub.unsubscribe()
  })
}

// Soft-delete the most recently added (highest orderNo) non-deleted match for a session
export async function softDeleteLastLocalMatch(sessionId: string): Promise<MatchLocal | null> {
  await ensureUnlocked(sessionId)  // ⬅️ guard

  const db = assertDb()
  const arr = await db.matches_local
    .where('sessionId').equals(sessionId)
    .filter((m: MatchLocal) => !m.deletedAtLocal)
    .sortBy('orderNo') // Collection.sortBy is valid; we aren't using orderBy here
  const last = arr[arr.length - 1]
  if (!last) return null

  const now = Date.now()
  await db.matches_local.update(last.id, { deletedAtLocal: now, updatedAtLocal: now })
  return { ...last, deletedAtLocal: now, updatedAtLocal: now }
}