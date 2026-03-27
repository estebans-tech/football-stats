import { assertDb } from '$lib/db/dexie'
import type { SeasonSummaryData, SessionListItem, MatchResult } from '$lib/types/views'

export async function getSeasonSummary(): Promise<SeasonSummaryData> {
  const db = assertDb()

  // Find the latest year that has session data
  const latestSession = await db.sessions_local
    .filter(s => !s.deletedAt && !!s.date)
    .toArray()

  if (!latestSession.length) {
    return { totalGoals: 0, matchCount: 0, playerCount: 0, topScorer: null }
  }

  const latestYear = latestSession
    .map(s => parseInt(s.date.slice(0, 4)))
    .reduce((max, y) => (y > max ? y : max), 0)

  const prefix = String(latestYear)

  const sessions = latestSession.filter(s => s.date.startsWith(prefix))
  const sessionIds = new Set(sessions.map(s => s.id))

  const matches = await db.matches_local
    .filter(m => !m.deletedAt && sessionIds.has(m.sessionId))
    .toArray()

  const matchIds = new Set(matches.map(m => m.id))

  const goals = await db.goals_local
    .filter(g => !g.deletedAt && matchIds.has(g.matchId))
    .toArray()

  // Unique players who have appeared in a lineup this season
  const lineups = await db.lineups_local
    .filter(l => !l.deletedAt && matchIds.has(l.matchId))
    .toArray()

  const playerCount = new Set(lineups.map(l => l.playerId)).size

  const tally = new Map<string, number>()
  for (const g of goals) {
    tally.set(g.scorerId, (tally.get(g.scorerId) ?? 0) + 1)
  }

  let topScorer: string | null = null
  if (tally.size > 0) {
    const [topId] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
    const player = await db.players_local.get(topId)
    topScorer = player ? (player.nickname ?? player.name) : null
  }

  return {
    totalGoals: goals.length,
    matchCount: matches.length,
    playerCount,
    topScorer,
    year: latestYear
  }
}

export async function getSessionList(): Promise<SessionListItem[]> {
  const db = assertDb()

  const sessions = await db.sessions_local
    .filter(s => !s.deletedAt)
    .toArray()

  // Sort descending by date
  sessions.sort((a, b) => b.date.localeCompare(a.date))

  const sessionIds = sessions.map(s => s.id)

  const allMatches = await db.matches_local
    .filter(m => !m.deletedAt && sessionIds.includes(m.sessionId))
    .toArray()

  const matchIds = allMatches.map(m => m.id)

  const allGoals = await db.goals_local
    .filter(g => !g.deletedAt && matchIds.includes(g.matchId))
    .toArray()

  // Group matches and goals per session
  return sessions.map(session => {
    const matches = allMatches
      .filter(m => m.sessionId === session.id)
      .sort((a, b) => a.orderNo - b.orderNo)

    const results: MatchResult[] = matches.map(match => {
      const goals = allGoals.filter(g => g.matchId === match.id)
      return {
        matchId: match.id,
        orderNo: match.orderNo,
        red:   goals.filter(g => g.team === 'A').length,
        black: goals.filter(g => g.team === 'B').length
      }
    })

    const totalGoals = results.reduce((sum, r) => sum + r.red + r.black, 0)

    return {
      id: session.id,
      date: session.date,
      matchCount: matches.length,
      totalGoals,
      results
    }
  })
}

