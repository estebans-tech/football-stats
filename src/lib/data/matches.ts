import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import { uid } from '$lib/utils/utils'
import type { MatchLocal, SessionLocal } from '$lib/types/domain'


// Guard: throw if session is missing or locked
async function ensureUnlocked(sessionId: string) {
  const db = assertDb()
  const s = (await db.sessions_local.get(sessionId)) as SessionLocal | undefined
  if (!s || s.deletedAt) throw new Error('SESSION_NOT_FOUND')
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
    .filter((m: MatchLocal) => m.deletedAt === null && m.dirty === false)
    .sortBy('orderNo')
    
  const last = list[list.length - 1]

  return (last?.orderNo ?? 0) + 1
}

export async function createLocalMatch(sessionId: string): Promise<MatchLocal> {
  await ensureUnlocked(sessionId)  // guard

  const db = assertDb()
  const orderNo = await nextOrderNo(sessionId)
  const now = Date.now()

  const match: MatchLocal = {
    id: uid(),
    sessionId,
    orderNo,
    createdAt: now,
    deletedAt: null,
    updatedAt: now,
    updatedAtLocal: now,
    dirty: true
  }

  await db.matches_local.add(match)
  return match
}

export async function createLocalMatches(sessionId: string, count: number): Promise<MatchLocal[]> {
  await ensureUnlocked(sessionId)  // guard

  if (count <= 0) return []
  const db = assertDb()
  const start = await nextOrderNo(sessionId)
  const now = Date.now()
  const items = Array.from({ length: count }, (_, i) => ({
    id: uid(),
    sessionId,
    orderNo: start + i,
    createdAt: now,
    deletedAt: null,
    updatedAt: now,
    updatedAtLocal: now,
    dirty: true
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
          if (m.deletedAt) continue
          acc[m.sessionId] = (acc[m.sessionId] ?? 0) + 1
        }
        set(acc)
      },
      error: () => set({})
    })
    return () => sub.unsubscribe()
  })
}

export async function softDeleteLastLocalMatchLegacy(sessionId: string): Promise<MatchLocal | null> {
  await ensureUnlocked(sessionId)  // guard

  const db = assertDb()
  const arr = await db.matches_local
    .where('sessionId').equals(sessionId)
    .filter((m: MatchLocal) => !m.deletedAt && m.dirty !== true)
    .sortBy('orderNo') // Collection.sortBy is valid; we aren't using orderBy here
  const last = arr[arr.length - 1]
  if (!last) return null

  
  const now = Date.now()
  await db.matches_local.update(last.id, { deletedAt: now, updatedAtLocal: now, dirty: true })
  return { ...last, deletedAt: now, updatedAtLocal: now, dirty: true }
}

// Soft-delete the most recently added (highest orderNo) non-deleted match for a session
export async function softDeleteLastLocalMatch(sessionId: string): Promise<MatchLocal | null> {
  await ensureUnlocked(sessionId)  // guard
  const db = assertDb()
  const now = Date.now()
  
  const arr = await db.matches_local
    .where('sessionId').equals(sessionId)
    .filter((m: MatchLocal) =>  m.deletedAt == null)
    .sortBy('orderNo')

    const last = arr[arr.length - 1]
    if (!last) return null

    await db.matches_local.update(last.id, { deletedAt: now, updatedAtLocal: now, dirty: true })
    return { ...last, deletedAt: now, updatedAtLocal: now, dirty: true }
}

export async function deleteLocalMatchLegacy(sessionId: string) {
  await ensureUnlocked(sessionId)  // guard
  const db = assertDb()
  const now = Date.now()
  
  const arr = await db.matches_local
    .where('sessionId').equals(sessionId)
    // .filter((m: MatchLocal) => !m.deletedAt && m.dirty !== true)
    .sortBy('orderNo') // Collection.sortBy is valid; we aren't using orderBy here

    const last = arr[arr.length - 1]
    if (!last) return null

    await db.matches_local.update(last.id, { deletedAt: now, updatedAtLocal: now, dirty: true })
    return { ...last, deletedAt: now, updatedAtLocal: now, dirty: true }
}
/** Live map: sessionId -> matches[] (sorted by orderNo, non-deleted) */
export function observeLocalMatchesMap() {
  const db = assertDb()
  return readable<Record<string, MatchLocal[]>>({}, (set) => {
    const sub = liveQuery(async () => {
      // Table.orderBy is fine here; we’re not on a Collection
      const rows = await db.matches_local.orderBy('orderNo').toArray()
      const map: Record<string, MatchLocal[]> = {}

      for (const match of rows) {
        if (match.deletedAt) continue

        ;(map[match.sessionId] ||= []).push(match)
      }

      return map
    }).subscribe({
      next: (map) => set(map),
      error: () => set({})
    })

    return () => sub.unsubscribe()
  })
}

export function observeLocalMatch(id: string) {
  const db = assertDb()
  return readable<MatchLocal | undefined>(undefined, (set) => {
    const sub = liveQuery(() => db.matches_local.get(id))
      .subscribe({ next: set, error: () => set(undefined) })
    return () => sub.unsubscribe()
  })
}

export async function migrateTeamsToAB() {
  const db = assertDb()
  await db.transaction('rw', db.lineups_local, db.goals_local, async () => {
    await db.lineups_local.where('team').equals('red' as any).modify({ team: 'A' })
    await db.lineups_local.where('team').equals('black' as any).modify({ team: 'B' })
    await db.lineups_local.where('team').equals('home' as any).modify({ team: 'A' })
    await db.lineups_local.where('team').equals('away' as any).modify({ team: 'B' })
    await db.goals_local.where('team').equals('red' as any).modify({ team: 'A' })
    await db.goals_local.where('team').equals('black' as any).modify({ team: 'B' })
    await db.goals_local.where('team').equals('home' as any).modify({ team: 'A' })
    await db.goals_local.where('team').equals('away' as any).modify({ team: 'B' })
  })
}
