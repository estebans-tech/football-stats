import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import { uid } from '$lib/utils/utils'
import type { Half, TeamAB, LineupLocal, DedupeMode } from '$lib/types/domain'

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

export async function setTeamForPlayer(matchId: string, playerId: string, team: TeamAB, half: Half) { 
  const db = assertDb()
  const existing = await db.lineups_local
    .where({ matchId, playerId, team, half })
    .first()
  if (existing?.deletedAtLocal) {
    await db.lineups_local.update(existing.id, { deletedAtLocal: undefined, updatedAtLocal: Date.now() })
    return
  }
  if (!existing) {
    const row: LineupLocal = {
      id: uid(),
      matchId, playerId, team, half,
      updatedAtLocal: Date.now()
    }
    await db.lineups_local.add(row)
  }
}
  
export async function removePlayer(
  matchId: string,
  playerId: string,
  team: TeamAB,
  half: Half
) {
  const db = assertDb()
  const now = Date.now()
  const hasCompound =
    // @ts-ignore: dexie internal shape
    !!db.lineups_local.schema.idxByName?.['[matchId+playerId+team+half]']

  if (hasCompound) {
    return db.lineups_local
      .where('[matchId+playerId+team+half]')
      .equals([matchId, playerId, team, half])
      .modify({ deletedAtLocal: now, updatedAtLocal: now })
  } else {
    const row = await db.lineups_local.where({ matchId, playerId, team, half }).first()
    if (row) await db.lineups_local.update(row.id, { deletedAtLocal: now, updatedAtLocal: now })
  }
}

/** Copy BOTH teams from fromHalf → toHalf (skips duplicates) */
export async function copyHalf(matchId: string, fromHalf: Half, toHalf: Half) {
  const db = assertDb()
  const all = await db.lineups_local.where({ matchId }).toArray()
  const src = all.filter(l => l.half === fromHalf && !l.deletedAtLocal)
  const dstKeys = new Set(all.filter(l => l.half === toHalf && !l.deletedAtLocal)
    .map(l => `${l.team}:${l.playerId}`))

  const now = Date.now()
  const toAdd = src
    .filter(s => !dstKeys.has(`${s.team}:${s.playerId}`))
    .map(s => ({
      id: uid(),
      matchId, playerId: s.playerId,
      team: s.team, half: toHalf,
      updatedAtLocal: now
    } satisfies LineupLocal))
  if (toAdd.length) await db.lineups_local.bulkAdd(toAdd)
}

/** Copy within a half: team A → team B (skips duplicates) */
export async function copyTeam(matchId: string, half: Half, from: TeamAB, to: TeamAB) { 
  if (from === to) return
  const db = assertDb()
  const all = await db.lineups_local.where({ matchId }).toArray()
  const src = all.filter(l => l.half === half && l.team === from && !l.deletedAtLocal)
  const dstIds = new Set(all.filter(l => l.half === half && l.team === to && !l.deletedAtLocal).map(l => l.playerId))

  const now = Date.now()
  const toAdd = src
    .filter(s => !dstIds.has(s.playerId))
    .map(s => ({
      id: uid(),
      matchId, playerId: s.playerId,
      team: to, half,
      updatedAtLocal: now
    } satisfies LineupLocal))
  if (toAdd.length) await db.lineups_local.bulkAdd(toAdd)
}

/** Convenience for UI */
export async function listTeamPlayers(matchId: string, team: TeamAB, half: Half): Promise<string[]> {
  const db = assertDb()
  const rows = await db.lineups_local.where({ matchId, team, half }).toArray()
  return rows.filter(r => !r.deletedAtLocal).map(r => r.playerId)
}

/**
 * Swap A ↔ B for the given half (skips soft-deleted).
 * Optional dedupe ensures at most one lineup per player in that half.
 */
export async function swapTeamsForHalf(
  matchId: string,
  half: Half,
  opts?: { dedupe?: DedupeMode }
) {
  const db = assertDb()
  const now = Date.now()

  await db.transaction('rw', db.lineups_local, async () => {
    // alive rows for this match+half
    let rows = (await db.lineups_local.where({ matchId, half }).toArray())
      .filter(l => !l.deletedAtLocal)

    // --- optional: enforce one-entry-per-player for the half
    if (opts?.dedupe) {
      const byPlayer = new Map<string, LineupLocal[]>()
      for (const r of rows) {
        const arr = byPlayer.get(r.playerId)
        if (arr) arr.push(r)
        else byPlayer.set(r.playerId, [r])
      }

      const toDeleteIds: string[] = []
      for (const list of byPlayer.values()) {
        if (list.length <= 1) continue

        // choose which one to keep
        let keep: LineupLocal
        if (opts.dedupe === 'keep-A') keep = list.find(x => x.team === 'A') ?? list[0]
        else if (opts.dedupe === 'keep-B') keep = list.find(x => x.team === 'B') ?? list[0]
        else {
          // keep most recently updated
          keep = list.reduce((a, b) =>
            (a.updatedAtLocal ?? 0) >= (b.updatedAtLocal ?? 0) ? a : b
          )
        }
        for (const r of list) if (r.id !== keep.id) toDeleteIds.push(r.id)
      }

      if (toDeleteIds.length) {
        // soft-delete duplicates
        await Promise.all(
          toDeleteIds.map(id =>
            db.lineups_local.update(id, {
              deletedAtLocal: now,
              updatedAtLocal: now
            })
          )
        )
        const deleted = new Set(toDeleteIds)
        rows = rows.filter(r => !deleted.has(r.id))
      }
    }

    // --- flip A<->B (stable ids)
    const swapped: LineupLocal[] = rows.map(l => ({
      ...l,
      team: (l.team === 'A' ? 'B' : 'A') as TeamAB,
      updatedAtLocal: now
    }))

    await db.lineups_local.bulkPut(swapped)
  })
}

export async function copyFirstHalfToSecondHalf(matchId: string) {
  return copyHalf(matchId, 1, 2)
}