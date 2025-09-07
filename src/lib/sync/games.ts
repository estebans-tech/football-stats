import { syncSessions } from './sessions'
import { syncMatches } from './matches'
import { syncLineups } from './lineups'
import { syncGoals } from './goals'

export const syncGames = async () => {
  const s = await syncSessions()
  const m = await syncMatches()
  const l = await syncLineups()
  const g = await syncGoals()
  return {
    pushed: (s.pushed || 0) + (m.pushed || 0) + (l.pushed || 0) + (g.pushed || 0),
    pulled: (s.pulled || 0) + (m.pulled || 0) + (l.pulled || 0) + (g.pulled || 0)
  }
}
