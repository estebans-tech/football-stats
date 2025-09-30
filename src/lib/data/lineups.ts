import { readable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import { uid } from '$lib/utils/utils'
import type { Half, TeamAB, LineupLocal, DedupeMode, ULID } from '$lib/types/domain'

export function observeLocalLineupsForMatch(matchId: string) {
  const db = assertDb()

  const source$ = liveQuery(async () => {
    const rows = await db.lineups_local
      .where('matchId')
      .equals(matchId)
      .toArray()

    const visible = rows.filter(r => r.deletedAt == null && r.op !== 'delete')

    // dedupe by id (defensive)
    const byId = new Map<ULID, LineupLocal>()
    for (const r of visible) byId.set(r.id, r)

    // stable sort: half → team → updatedAtLocal
    const list = [...byId.values()].sort((a, b) => {
      if (a.half !== b.half) return a.half - b.half
      if (a.team !== b.team) return a.team < b.team ? -1 : 1
      return (a.updatedAtLocal ?? 0) - (b.updatedAtLocal ?? 0)
    })

    return list
  })

  // wrap as a Svelte readable store so subscribe(...) returns an unsubscribe function
  return readable<LineupLocal[]>([], set => {
    const sub = source$.subscribe({
      next: set,
      error: err => console.error('observeLocalLineupsForMatch error', err)
    })
    return () => sub.unsubscribe()
  })
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

export async function addLineup(input: {
  matchId: ULID
  half: Half
  team: TeamAB
  playerId: ULID
  id?: ULID
}) {
  const db = assertDb()

  const row: LineupLocal = {
    id: input.id ?? uid(),
    matchId: input.matchId,
    half: input.half,
    team: input.team,
    playerId: input.playerId,

    // server mirrors (unknown before first sync)
    createdAt: null,
    updatedAt: null,
    deletedAt: null,

    // local state (hook will overwrite updatedAtLocal to now)
    updatedAtLocal: 0,
    dirty: true,
    op: 'create'
  }

  await db.lineups_local.add(row)
}

export async function updateLineup(
  id: ULID,
  patch: Partial<Pick<LineupLocal, 'matchId' | 'half' | 'team' | 'playerId'>>
) {
  const db = assertDb()
  await db.lineups_local.update(id, patch)
}

export async function deleteLineup(id: string) {
  const db = assertDb()

  const row = await db.lineups_local.get(id);
  if (!row) return;
  if (row.op === 'create') {
    // ej pushad ännu → hårdradera direkt
    await db.lineups_local.delete(id);
  } else {
    await db.lineups_local.update(id, {
      deletedAt: null,          // låt molnet styra soft delete
      dirty: true,
      op: 'delete',
      updatedAtLocal: Date.now()
    });
  }
}

// Remove soft-deleted mirrors, dedupe by (matchId, playerId, half), and normalize push-state
export async function sanitizeLocalLineupsForMatch(matchId: ULID, half: Half) {
  const db = assertDb()

  let removedSoftDeleted = 0
  let removedDuplicates = 0
  let normalizedOps = 0

  await db.transaction('rw', db.lineups_local, async () => {
    const rows = await db.lineups_local
      .where('matchId')
      .equals(matchId)
      .and(r => r.half === half)
      .toArray()

    // 1) drop rows that are soft-deleted in cloud
    const alive = []
    for (const r of rows) {
      if (r.deletedAt != null) {
        await db.lineups_local.delete(r.id)
        removedSoftDeleted++
      } else {
        alive.push(r)
      }
    }

    // 2) dedupe per playerId (keep the most recent)
    const byPlayer = new Map<ULID, LineupLocal[]>()
    for (const r of alive) {
      const arr = byPlayer.get(r.playerId) ?? []
      arr.push(r)
      byPlayer.set(r.playerId, arr)
    }

    const now = Date.now()
    for (const [, list] of byPlayer) {
      if (list.length <= 1) {
        const a = list[0]
        if (a && a.dirty && !a.op) {
          await db.lineups_local.update(a.id, { op: 'update', updatedAtLocal: now })
          normalizedOps++
        }
        continue
      }

      // keep the one with highest updatedAtLocal, prefer non-delete
      list.sort((a, b) => {
        const au = a.updatedAtLocal ?? 0
        const bu = b.updatedAtLocal ?? 0
        if (bu !== au) return bu - au
        const aw = a.op === 'delete' ? 1 : 0
        const bw = b.op === 'delete' ? 1 : 0
        return aw - bw
      })

      const [keep, ...dupes] = list
      for (const d of dupes) {
        await db.lineups_local.delete(d.id)
        removedDuplicates++
      }

      if (keep.dirty && !keep.op) {
        await db.lineups_local.update(keep.id, { op: 'update', updatedAtLocal: now })
        normalizedOps++
      }
    }
  })

  return { removedSoftDeleted, removedDuplicates, normalizedOps }
}

export async function auditLocalLineupsForMatch(matchId: ULID, half: Half) {
  const db = assertDb()

  const rows = await db.lineups_local
    .where('matchId')
    .equals(matchId)
    .and(r => r.half === half)
    .toArray()

  const softDeleted = rows.filter(r => r.deletedAt != null).length

  // duplicates per (playerId) within this match+half
  const byPlayer = new Map<ULID, LineupLocal[]>()
  for (const r of rows.filter(r => r.deletedAt == null)) {
    const arr = byPlayer.get(r.playerId) ?? []
    arr.push(r)
    byPlayer.set(r.playerId, arr)
  }

  let duplicateGroups = 0
  let duplicateRows = 0
  for (const [, list] of byPlayer) {
    if (list.length > 1) {
      duplicateGroups++
      duplicateRows += list.length - 1
    }
  }

  const needsOpNormalize = rows.filter(r => r.dirty && !r.op).length

  return {
    total: rows.length,
    alive: rows.length - softDeleted,
    softDeleted,
    duplicateGroups,      // players with >1 row in this half
    duplicateRows,        // extra rows beyond 1
    needsOpNormalize
  }
}

// normalize rows that are dirty but missing op (set op='update')
// does NOT delete or change team/half/playerId
export async function normalizeLocalLineupsOpsForMatch(matchId: ULID, half: Half) {
  const db = assertDb()
  let normalized = 0

  await db.transaction('rw', db.lineups_local, async () => {
    const rows = await db.lineups_local
      .where('matchId')
      .equals(matchId)
      .and(r => r.half === half && r.deletedAt == null && r.dirty && !r.op)
      .toArray()

    const now = Date.now()
    for (const r of rows) {
      await db.lineups_local.update(r.id, { op: 'update', updatedAtLocal: now })
      normalized++
    }
  })

  return { normalized }
}