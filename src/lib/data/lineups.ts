import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import type { LineupLocal } from '$lib/types/domain'

export type Team = 'A' | 'B'
export type Half = 1 | 2

export function observeLocalLineupsForMatch(matchId: string) {
  const db = assertDb()
  return readable<LineupLocal[]>([], (set) => {
    const sub = liveQuery(async () => {
      const rows = await db.lineups_local
        .where('matchId').equals(matchId)
        .filter(l => !l.deletedAtLocal)
        .toArray()
      // sortera ex. half->team->playerId för stabil rendering
      rows.sort((a,b) => (a.half - b.half) || (a.team > b.team ? 1 : -1) || (a.playerId > b.playerId ? 1 : -1))
      return rows
    }).subscribe({ next: set, error: () => set([]) })
    return () => sub.unsubscribe()
  })
}

export const setTeamForPlayer = async (
    matchId: string, half: Half, playerId: string, team: Team
  ) => {
    const db = assertDb()
    const now = Date.now()
  
    // 1) Ta bort spelaren från andra laget i samma halvlek om hen råkar ligga där
    const otherTeam: Team = team === 'A' ? 'B' : 'A'
    const others = await db.lineups_local
      .where('matchId').equals(matchId)
      .filter(r => r.half === half && r.playerId === playerId && r.team === otherTeam && !r.deletedAtLocal)
      .toArray()
    for (const raw of others) {
      const norm = await normalizeLineupId(raw)
      await db.lineups_local.update(norm.id, { deletedAtLocal: now, updatedAtLocal: now })
    }
  
    // 2) Upsert i target-laget
    const existing = await findLineupRow(matchId, half, playerId)
    const norm = existing ? await normalizeLineupId(existing) : null
    const id = norm?.id || lineupId(matchId, half, playerId)
  
    await db.lineups_local.put({
      id,
      matchId, half, team, playerId,
      createdAt: norm?.createdAt ?? now,
      updatedAtLocal: now,
      deletedAtLocal: null
    })
  }
  
  export const removePlayer = async (
    matchId: string, half: Half, playerId: string, team?: Team
  ) => {
    const db = assertDb()
    const now = Date.now()
  
    const rows = await db.lineups_local.where('matchId').equals(matchId).toArray()
    const live = rows.filter(r =>
      r.half === half &&
      r.playerId === playerId &&
      !r.deletedAtLocal &&
      (team ? r.team === team : true)
    )
  
    for (const row of live) {
      const norm = await normalizeLineupId(row)
      await db.lineups_local.update(norm.id, { deletedAtLocal: now, updatedAtLocal: now })
    }
  
}
  