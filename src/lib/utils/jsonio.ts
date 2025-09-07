import { assertDb } from '$lib/db/dexie'
import type {
  PlayerLocal, SessionLocal, MatchLocal, LineupLocal, GoalLocal
} from '$lib/types'

export type Dump = {
  version: number
  exportedAt: string
  tables: {
    players_local: PlayerLocal[]
    sessions_local: SessionLocal[]
    matches_local: MatchLocal[]
    lineups_local: LineupLocal[]
    goals_local: GoalLocal[]
  }
}

export const exportDump = async (): Promise<Dump> => {
  const db = assertDb()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      players_local: await db.players_local.toArray(),
      sessions_local: await db.sessions_local.toArray(),
      matches_local: await db.matches_local.toArray(),
      lineups_local: await db.lineups_local.toArray(),
      goals_local: await db.goals_local.toArray()
    }
  }
}

export const downloadJSON = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const importDump = async (
  dump: Dump,
  mode: 'merge' | 'replace' = 'merge'
) => {
  const db = assertDb()

  if (mode === 'replace') {
    await db.transaction('rw', [
      db.players_local, db.sessions_local, db.matches_local, db.lineups_local, db.goals_local
    ], async () => {
        await db.players_local.clear()
        await db.sessions_local.clear()
        await db.matches_local.clear()
        await db.lineups_local.clear()
        await db.goals_local.clear()
        await db.players_local.bulkPut(dump.tables.players_local)
        await db.sessions_local.bulkPut(dump.tables.sessions_local)
        await db.matches_local.bulkPut(dump.tables.matches_local)
        await db.lineups_local.bulkPut(dump.tables.lineups_local)
        await db.goals_local.bulkPut(dump.tables.goals_local)
      }
    )
  } else {
    // merge/upsert
    await db.transaction('rw', [
      db.players_local, db.sessions_local, db.matches_local, db.lineups_local, db.goals_local
    ], async () => {
        await db.players_local.bulkPut(dump.tables.players_local)
        await db.sessions_local.bulkPut(dump.tables.sessions_local)
        await db.matches_local.bulkPut(dump.tables.matches_local)
        await db.lineups_local.bulkPut(dump.tables.lineups_local)
        await db.goals_local.bulkPut(dump.tables.goals_local)
      }
    )
  }

  return {
    counts: {
      players: await db.players_local.count(),
      sessions: await db.sessions_local.count(),
      matches: await db.matches_local.count(),
      lineups: await db.lineups_local.count(),
      goals: await db.goals_local.count()
    }
  }
}
