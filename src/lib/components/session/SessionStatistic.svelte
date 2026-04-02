<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { MatchLocal, GoalLocal, LineupLocal, PlayerLocal, AppearanceRow } from '$lib/types/domain'
  import MetricTile from '$lib/components/session/MetricTile.svelte'
  import ScorerAssistCard from '$lib/components/session/ScorerAssistCard.svelte'
  import PointsCard from '$lib/components/session/PointsCard.svelte'
  import MatchResultCard from '$lib/components/session/MatchResultCard.svelte'
  import AppearancesCard from '$lib/components/session/AppearancesCard.svelte'
 
  // ------- props (runes)
  type Props = {
    matches: MatchLocal[]
    goals: GoalLocal[]
    lineups: LineupLocal[]
    players: Record<string, PlayerLocal>
    appearance: AppearanceRow[]
  }
  let { matches, goals, lineups, players, appearance }: Props = $props()
 
  // ------- helpers (pure)
  type Score  = { A: number; B: number }
  type Row    = { id: string; name: string; goals: number; assists: number; ga: number; apps: number }
  type Totals = { A: number; B: number; total: number }
  type Summary = { nMatches: number; goalsTotal: number; A: number; B: number; avg: number }
 
  const nameOf = (id: string) => players[id]?.nickname ?? players[id]?.name ?? id
 
  function computeMatchScores(goals: GoalLocal[]): Record<string, Score> {
    const out: Record<string, Score> = {}
    for (const g of goals) {
      const s = out[g.matchId] ?? (out[g.matchId] = { A: 0, B: 0 })
      if (g.team === 'A') s.A++
      else if (g.team === 'B') s.B++
    }
    return out
  }
 
  function computeTotals(goals: GoalLocal[]): Totals {
    let A = 0, B = 0
    for (const g of goals) {
      if (g.team === 'A') A++
      else if (g.team === 'B') B++
    }
    return { A, B, total: A + B }
  }
 
  function computeAppearances(lineups: LineupLocal[]): Map<string, number> {
    const seen = new Map<string, Set<string>>() // pid -> set(matchId)
    for (const l of lineups) {
      if (l.half !== 1 || l.deletedAtLocal) continue
      if (!seen.has(l.playerId)) seen.set(l.playerId, new Set())
      seen.get(l.playerId)!.add(l.matchId)
    }
    const res = new Map<string, number>()
    for (const [pid, set] of seen) res.set(pid, set.size)
    return res
  }
 
  function buildLeaderboard(goals: GoalLocal[], apps: Map<string, number>): Row[] {
    const m = new Map<string, Row>()
    for (const g of goals) {
      if (g.scorerId) {
        const r = m.get(g.scorerId) ?? { id: g.scorerId, name: nameOf(g.scorerId), goals: 0, assists: 0, ga: 0, apps: 0 }
        r.goals++; r.ga = r.goals + r.assists; m.set(g.scorerId, r)
      }
      if (g.assistId) {
        const r = m.get(g.assistId) ?? { id: g.assistId, name: nameOf(g.assistId), goals: 0, assists: 0, ga: 0, apps: 0 }
        r.assists++; r.ga = r.goals + r.assists; m.set(g.assistId, r)
      }
    }
    for (const r of m.values()) r.apps = apps.get(r.id) ?? 0
    return Array.from(m.values()).sort(
      (a, b) => b.goals - a.goals || b.ga - a.ga || a.name.localeCompare(b.name)
    )
  }
 
  function computePoints(lineups: LineupLocal[], scores: Record<string, Score>): Array<{ id: string; name: string; points: number }> {
    const pointsMap = new Map<string, number>()
    
    // Group lineups by match and player (only count half=1 to avoid duplicates)
    const playerMatches = new Map<string, Set<{ matchId: string; team: 'A' | 'B' }>>()
    
    for (const l of lineups) {
      if (l.half !== 1 || l.deletedAtLocal) continue
      
      if (!playerMatches.has(l.playerId)) {
        playerMatches.set(l.playerId, new Set())
      }
      playerMatches.get(l.playerId)!.add({ matchId: l.matchId, team: l.team })
    }
    
    // Calculate points for each player
    for (const [playerId, matches] of playerMatches) {
      let totalPoints = 0
      
      for (const { matchId, team } of matches) {
        const score = scores[matchId]
        if (!score) continue
        
        const playerScore = team === 'A' ? score.A : score.B
        const opponentScore = team === 'A' ? score.B : score.A
        
        if (playerScore > opponentScore) {
          totalPoints += 3 // Win
        } else if (playerScore === opponentScore) {
          totalPoints += 1 // Draw
        }
        // Loss = 0 points (no need to add)
      }
      
      pointsMap.set(playerId, totalPoints)
    }
    
    // Convert to array and sort by points (desc), then alphabetically
    return Array.from(pointsMap.entries())
      .map(([id, points]) => ({ id, name: nameOf(id), points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  }
 
  // ------- derived values (typed on the variable, not on the callback)
  const matchScores: Record<string, Score> = $derived(computeMatchScores(goals))
  const totalsByTeam: Totals               = $derived(computeTotals(goals))
  const appearances: Map<string, number>   = $derived(computeAppearances(lineups))
  const leaderboard: Row[]                 = $derived(buildLeaderboard(goals, appearances))
 
  const topAssists: Row[] = $derived(
    [...leaderboard].sort((a, b) =>
      b.assists - a.assists || b.ga - a.ga || a.name.localeCompare(b.name)
    )
  )
 
  const topGA: Row[] = $derived(
    [...leaderboard].sort((a, b) =>
      b.ga - a.ga || b.goals - a.goals || a.name.localeCompare(b.name)
    )
  )
 
  const topPoints = $derived(computePoints(lineups, matchScores))
 
  const summary: Summary = $derived.by(() => {
  const nMatches = matches.length;
  const { A, B, total } = totalsByTeam;
  const avg = nMatches ? total / nMatches : 0;
  return { nMatches, goalsTotal: total, A, B, avg };
})
</script>
<!-- Summary cards -->
<div class="my-6 mx-auto max-w-screen-sm grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
  <MetricTile value={String(summary.nMatches)}   label={$t('session.statistics.cards.matches')} />
  <MetricTile value={String(summary.goalsTotal)} label={$t('session.statistics.cards.goals_total')} />
  <MetricTile value={String(summary.A)}          label={$t('session.statistics.cards.goals_red')}   variant="red" />
  <MetricTile value={String(summary.B)}          label={$t('session.statistics.cards.goals_black')} variant="muted" />
</div>

<!-- Results -->
<MatchResultCard
  title={$t('session.statistics.results')}
  textLabels={ { empty: $t('session.statistics.empty.matches'), teamA: $t('session.statistics.cards.red'), teamB: $t('session.statistics.cards.black'), match: $t('session.statistics.match')}}
  matches={matches}
  scores={matchScores}
/>

<!-- Leaderboards -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
  <!-- Top scorers -->
  <ScorerAssistCard title={$t('session.statistics.boards.top_scorers')} leaderboard={leaderboard} emptyLabel={$t('session.statistics.empty.goals')} />

  <!-- Top assists -->
  <ScorerAssistCard title={$t('session.statistics.boards.top_assists')} leaderboard={topAssists} emptyLabel={$t('session.statistics.empty.assists')} mode="assists" />

 <!-- Top points -->
  <PointsCard title={$t('session.statistics.boards.top_points')} leaderboard={topPoints} emptyLabel={$t('session.statistics.empty.data')} />
 
  <!-- Goal involvements - Hidden for now -->
  <!-- <ScorerAssistCard title={$t('session.statistics.boards.goal_involvements')} leaderboard={topGA}  emptyLabel={$t('session.statistics.empty.data')} mode="ga" /> -->
</div>
<!-- Appearances -->
<AppearancesCard title={$t('session.statistics.boards.appearances')} appearances={appearance} emptyLabel={$t('session.statistics.empty.lineups')} />

