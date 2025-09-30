<script lang="ts">
  import { browser } from '$app/environment'
  import { writable } from 'svelte/store'
  import { t } from 'svelte-i18n'
  import type { PageData } from './$types'
   import LineupBuilder from '$lib/components/match/LineupBuilder.svelte'
   import GoalsEditor from '$lib/components/match/GoalsEditor.svelte'
  import { db } from '$lib/db/dexie'

  import { observeLocalMatch } from '$lib/data/matches'
  import { observeLocalLineupsForMatch } from '$lib/data/lineups'
  import { observeLocalGoalsForMatch } from '$lib/data/goals'
  import { observeLocalActivePlayersMap } from '$lib/data/players'

  import type {
    MatchLocal,
    GoalLocal,
    LineupLocal,
    PlayerLocal,
    Half,
    TeamAB
  } from '$lib/types/domain'

  // ---------- props (runes mode)
  type Props = { data: PageData }
  let { data }: Props = $props()

  // ---------- local snapshot writables used by UI helpers
  const match$   = writable<MatchLocal | undefined>(undefined)
  const goals$   = writable<GoalLocal[]>([])
  const lineups$ = writable<LineupLocal[]>([])
  const players$ = writable<Record<string, PlayerLocal>>({})

  // ---------- UI state
  let teamForAdd = $state<TeamAB>('A') // Red by default
  let goalHalf   = $state<Half>(1)     // Half selector only for GOALS

  // ---------- helpers (whole-game lineups; no half)
  const nameOf = (id: string) => ($players$[id]?.name) ?? id

  const teamPlayers = (team: TeamAB) =>
    $lineups$.filter(l => l.team === team && !l.deletedAtLocal).map(l => l.playerId)

  function lineupFor(goal: GoalLocal) {
    // scorer/assist options come from whole-game lineup for that team
    return teamPlayers(goal.team).map(id => ({ id, name: nameOf(id) }))
  }

  // ---------- actions (lineup ops always write with half=1 under the hood)

  // ---------- 1) Seed a snapshot so first render has data
  const ready: Promise<void> = browser
    ? (async () => {
        const id = data.id
        const [m, g, l, p] = await Promise.all([
          db.matches_local.get(id),
          db.goals_local.where('matchId').equals(id).toArray(),
          db.lineups_local.where('matchId').equals(id).toArray(),
          db.players_local.toArray()
        ])
        match$.set(m)
        goals$.set(g)
        lineups$.set(l)
        players$.set(Object.fromEntries(p.map(x => [x.id, x])))
      })()
    : Promise.resolve()

  // ---------- 2) Keep snapshot in sync with live queries
  $effect(() => {
    if (!browser) return
    const id = data.id

    const u1 = observeLocalMatch(id).subscribe(match$.set)
    const u2 = observeLocalGoalsForMatch(id).subscribe(goals$.set)
    const u3 = observeLocalLineupsForMatch(id).subscribe(lineups$.set)
    const u4 = observeLocalActivePlayersMap().subscribe(players$.set)

    return () => { u1(); u2(); u3(); u4() }
  })
</script>

<section class="mx-auto max-w-4xl w-full space-y-6">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">
      {$t('match_day.match.numbered', {
        values: { num: $match$?.orderNo ?? '?' }
      })}
    </h1>
    <a href="/" class="text-sm underline hover:no-underline">{$t('common.back')}</a>
  </header>

  {#await ready}{:then}
    <!-- Team builder (whole game) -->
    <!-- NEW: lineup UI lives in the component -->
    <LineupBuilder matchId={data.id} {players$} {lineups$} />

    <GoalsEditor
      matchId={data.id}
      half={goalHalf}
      goals={goals$}
      lineups={lineups$}
      lineupFor={lineupFor}
    />
  {/await}
</section>
