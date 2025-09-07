<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { MatchLocal, GoalLocal, LineupLocal, PlayerLocal } from '$lib/types/domain'

  // ------- props (runes)
  type Props = {
    matches: MatchLocal[]
    goals: GoalLocal[]
    lineups: LineupLocal[]
    players: Record<string, PlayerLocal>
  }
  let { matches, goals, lineups, players }: Props = $props()

  // ------- helpers (pure)
  type Score  = { A: number; B: number }
  type Row    = { id: string; name: string; goals: number; assists: number; ga: number; apps: number }
  type Totals = { A: number; B: number; total: number }
  type Summary = { nMatches: number; goalsTotal: number; A: number; B: number; avg: number }

  const nameOf = (id: string) => players[id]?.name ?? id

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

  const summary: Summary = $derived.by(() => {
  const nMatches = matches.length;
  const { A, B, total } = totalsByTeam;
  const avg = nMatches ? total / nMatches : 0;
  return { nMatches, goalsTotal: total, A, B, avg };
})
</script>

<!-- Summary cards -->
<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
  <div class="rounded-lg border p-3">
    <div class="text-xs text-gray-500">{$t('session.statistics.cards.matches')}</div>
    <div class="text-2xl font-semibold">{summary.nMatches}</div>
  </div>
  <div class="rounded-lg border p-3">
    <div class="text-xs text-gray-500">{$t('session.statistics.cards.goals_total')}</div>
    <div class="text-2xl font-semibold">{summary.goalsTotal}</div>
  </div>
  <div class="rounded-lg border p-3">
    <div class="text-xs text-gray-500">{$t('session.statistics.cards.red')}</div>
    <div class="text-2xl font-semibold">{summary.A}</div>
  </div>
  <div class="rounded-lg border p-3">
    <div class="text-xs text-gray-500">{$t('session.statistics.cards.black')}</div>
    <div class="text-2xl font-semibold">{summary.B}</div>
  </div>
  <div class="rounded-lg border p-3">
    <div class="text-xs text-gray-500">{$t('session.statistics.cards.avg_per_match')}</div>
    <div class="text-2xl font-semibold">{summary.avg.toFixed(2)}</div>
  </div>
</div>

<!-- Results -->
<div class="rounded-xl border bg-white p-4 mt-4">
  <h2 class="text-base font-semibold mb-3">{$t('session.statistics.results')}</h2>
  {#if matches.length === 0}
    <div class="text-sm text-gray-600">{$t('session.statistics.empty.matches')}</div>
  {:else}
    <ul class="space-y-2">
      {#each matches as m (m.id)}
        {@const score = matchScores[m.id] ?? { A: 0, B: 0 }}
        <li class="flex items-center justify-between border-b px-3 py-2">
          <div class="text-sm text-gray-600">
            {$t('session.statistics.match_numbered', { values: { num: m.orderNo ?? '–' } })}
          </div>
          <div class="font-semibold">
            {$t('session.statistics.cards.red')} {score.A} — {score.B} {$t('session.statistics.cards.black')}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<!-- Leaderboards -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
  <!-- Top scorers -->
  <div class="rounded-xl border bg-white p-4">
    <h3 class="font-semibold mb-2">{$t('session.statistics.boards.top_scorers')}</h3>
    {#if leaderboard.length === 0}
      <div class="text-sm text-gray-600">{$t('session.statistics.empty.goals')}</div>
    {:else}
      <ol class="space-y-1">
        {#each leaderboard.slice(0, 10) as r (r.id)}
          <li class="flex items-center justify-between border-b px-2 py-1">
            <span class="truncate">{r.name}</span>
            <span class="tabular-nums">{r.goals}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <!-- Top assists -->
  <div class="rounded-xl border bg-white p-4">
    <h3 class="font-semibold mb-2">{$t('session.statistics.boards.top_assists')}</h3>
    {#if topAssists.length === 0}
      <div class="text-sm text-gray-600">{$t('session.statistics.empty.assists')}</div>
    {:else}
      <ol class="space-y-1">
        {#each topAssists.slice(0, 10) as r (r.id)}
          <li class="flex items-center justify-between border-b px-2 py-1">
            <span class="truncate">{r.name}</span>
            <span class="tabular-nums">{r.assists}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <!-- Goal involvements -->
  <div class="rounded-xl border bg-white p-4">
    <h3 class="font-semibold mb-2">{$t('session.statistics.boards.goal_involvements')}</h3>
    {#if topGA.length === 0}
      <div class="text-sm text-gray-600">{$t('session.statistics.empty.data')}</div>
    {:else}
      <ol class="space-y-1">
        {#each topGA.slice(0, 10) as r (r.id)}
          <li class="flex items-center justify-between border-b px-2 py-1">
            <span class="truncate">{r.name}</span>
            <span class="tabular-nums">{r.ga}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</div>

<!-- Appearances -->
<div class="rounded-xl border bg-white p-4 mt-4">
  <h3 class="font-semibold mb-2 border-b">{$t('session.statistics.boards.appearances')}</h3>
  {#if lineups.length === 0}
    <div class="text-sm text-gray-600">{$t('session.statistics.empty.lineups')}</div>
  {:else}
    <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {#each Array.from(appearances.entries()).sort((a, b) => b[1] - a[1]) as [pid, apps] (pid)}
        <li class="flex items-center justify-between border-b px-2 py-1">
          <span class="truncate">{nameOf(pid)}</span>
          <span class="tabular-nums">{apps}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>