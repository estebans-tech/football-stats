import { assertDb } from '$lib/db/dexie'
import { uid, isoDate, isValidYMD } from '$lib/utils/utils'
// import { queueGames } from '$lib/sync/auto'
import type { SessionLocal, MatchLocal, SessionStatus } from '$lib/types/domain'

export const getSessionByDate = async (date = isoDate()) => {
  const db = assertDb()
  return await db.sessions_local.where('date').equals(date).first()
}

export const createSession = async (date = isoDate()) => {
  const db = assertDb()
  const now = Date.now()
  const existing = await getSessionByDate(date)

  if (existing) return existing
  const session = { id: uid(), date, status: 'open' as const, createdAt: now, updatedAtLocal: now } as SessionLocal
  await db.sessions_local.add(session)
  return session
}

export const createSessionIfMissing = async (date: string) => {
  const existing = await getSessionByDate(date)
  if (existing) return existing
  
  const now = Date.now()
  const row = { id: uid(), date, status: 'open' as const, createdAt: now, updatedAtLocal: now, deletedAtLocal: undefined }
  const db = assertDb()
  await db.sessions_local.put(row)

  // queueGames()

  return row
}

// If you already have a create function, export an alias to keep the component import stable.
export async function createLocalSession(input: { date: string; status?: SessionStatus }): Promise<SessionLocal> {
  // 1. Check valid date
  if (!isValidYMD(input.date)) {
    throw new Error('INVALID_DATE')
  }

  // 2. Check valiid status
  const status: SessionStatus = input.status ?? 'open'
  if (status !== 'open' && status !== 'locked') {
    throw new Error('INVALID_STATUS')
  }

  const db = assertDb()

  // 3. Check exists
  const existing = await db.sessions_local.where('date').equals(input.date).first()
  if (existing && !existing.deletedAtLocal) {
    throw new Error('DUPLICATE_DATE')
  }

  const session: SessionLocal = {
    id: uid(),
    date: input.date,                 // yyyy-mm-dd from form
    status: input.status ?? 'open',
    updatedAtLocal: Date.now()
    // deletedAtLocal: undefined
  }

  await db.sessions_local.add(session)

  return session
}

// export const listRecentSessions = async (limit = 5) => {
//   const db = assertDb()
//   const all = await db.sessions_local.toArray()
//   return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, limit)
// }

// export const listMatches = async (sessionId: string) => {
//   const db = assertDb()
//   return await db.matches_local.where('sessionId').equals(sessionId).sortBy('orderNo')
// }

// export const addMatch = async (sessionId: string, notes?: string | null) => {
//   const db = assertDb()
//   const matches = await listMatches(sessionId)
//   const nextOrder = (matches[matches.length - 1]?.orderNo ?? 0) + 1
//   const now = Date.now()
//   const match = {
//     id: uid(),
//     sessionId,
//     orderNo: nextOrder,
//     notes: notes ?? null,
//     createdAt: now,
//     updatedAtLocal: now,
//     deletedAtLocal: null,
//   } as MatchLocal
//   await db.matches_local.add(match)
//   return match
// }

// export const createThreeMatchesIfNone = async (sessionId: string) => {
//   const db = assertDb()
//   const existing = await listMatches(sessionId)
//   if (existing.length > 0) return existing
//   const now = Date.now()
//   await db.matches_local.bulkAdd([
//     { id: uid(), sessionId, orderNo: 1, createdAt: now, updatedAtLocal: now, deletedAtLocal: null },
//     { id: uid(), sessionId, orderNo: 2, createdAt: now, updatedAtLocal: now, deletedAtLocal: null },
//     { id: uid(), sessionId, orderNo: 3, createdAt: now, updatedAtLocal: now, deletedAtLocal: null },
//     { id: uid(), sessionId, orderNo: 4, createdAt: now, updatedAtLocal: now, deletedAtLocal: null }
//   ])
//   return await listMatches(sessionId)
// }

// export const setSessionStatus = async (id: string, status: 'open'|'locked') => {
//   const db = assertDb()
//   await db.sessions_local.update(id, {
//     status,
//     updatedAtLocal: Date.now(),
//     deletedAtLocal: null
//   })

//   queueGames()
// }

// export const deleteSessionLocal = async (sessionId: string) => {
//   const db = assertDb()
//   const mids = await db.matches_local.where('sessionId').equals(sessionId).primaryKeys()
//   console.log('mid:', mids, sessionId)
//   await db.transaction('rw', db.matches_local, db.lineups_local, db.goals_local, db.sessions_local, async () => {
//     for (const mid of mids) {
//       await db.lineups_local.where('matchId').equals(String(mid)).delete()
//       await db.goals_local.where('matchId').equals(String(mid)).delete()
//     }
//     await db.matches_local.where('sessionId').equals(sessionId).delete()
//     await db.sessions_local.delete(sessionId)
//   })

//   queueGames()
// }

// export const getMatch = async (matchId: string) => {
//     const db = assertDb()
//     return await db.matches_local.get(matchId)
// }

// export const getSessionById = async (id: string) => {
//   const db = assertDb()
//   return db.sessions_local.get(id)
// }

// export const openSession = async (date: string) => {
//   // skapa om saknas, returnera { id, date, status: 'open' }
// }

// export const deleteSessionAndMatches = async (sessionId: string) => {
//   // Hämta matcher som hör till sessionen
//   const matches = await listMatches(sessionId)
//   const db = assertDb()

//   // 1. Radera matcher lokalt
//   for (const m of matches) {
//     await db.matches_local.delete(m.id)
//     // Radera eventuellt även goals och lineups om ni har lokalt
//     await db.goals_local.where('matchId').equals(m.id).delete()
//     await db.lineups_local.where('matchId').equals(m.id).delete()
//   }

//   // 2. Radera sessionen lokalt
//   await db.sessions_local.delete(sessionId)

//   queueGames()
// }