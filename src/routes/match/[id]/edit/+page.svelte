<script lang="ts">
  import { browser } from '$app/environment'
  import { t, locale } from 'svelte-i18n'
  import type { PageData } from './$types'
  import LineupBuilder from '$lib/components/match/LineupBuilder.svelte'
  import GoalsEditor from '$lib/components/match/GoalsEditor.svelte'
  import Heading from '$lib/components/Heading.svelte'
  import Link from '$lib/components/Link.svelte'
  import CopyTeamButton from '$lib/components/match/CopyTeamButton.svelte'
  import { db } from '$lib/db/dexie'

  import { observeLocalMatch } from '$lib/data/matches'
  import { observeLocalLineupsForMatch, setTeamForPlayerWholeGame } from '$lib/data/lineups'
  import { observeLocalGoalsForMatch } from '$lib/data/goals'
  import { observeLocalActivePlayersMap } from '$lib/data/players'

  import type {
    MatchLocal,
    GoalLocal,
    LineupLocal,
    PlayerLocal,
    Half,
    TeamAB,
  } from '$lib/types/domain'

  // Props (runes mode)
  type Props = { data: PageData }
  let { data }: Props = $props()

  // Reactive state (migrated from writable stores)
  let match = $state<MatchLocal | undefined>(undefined)
  let goals = $state<GoalLocal[]>([])
  let lineups = $state<LineupLocal[]>([])
  let players = $state<Record<string, PlayerLocal>>({})
  
  const teamMap: Record<TeamColor, TeamAB> = { red: 'A', black: 'B' }
  
  // UI state
  let teamForAdd = $state<TeamAB>('A') // Red by default
  let goalHalf   = $state<Half>(1)     // Half selector only for GOALS

  // Helpers (whole-game lineups; no half)
  const nameOf = (id: string) => (players[id]?.name) ?? id

  const teamPlayers = (team: TeamAB) =>
    lineups.filter(l => l.team === team && !l.deletedAtLocal).map(l => l.playerId)

  function lineupFor(goal: GoalLocal) {
    // scorer/assist options come from whole-game lineup for that team
    return teamPlayers(goal.team).map(id => ({ id, name: nameOf(id) }))
  }

  // Seed initial snapshot so first render has data
  const ready: Promise<void> = browser
    ? (async () => {
        const id = data.id
        const [m, g, l, p] = await Promise.all([
          db.matches_local.get(id),
          db.goals_local.where('matchId').equals(id).toArray(),
          db.lineups_local.where('matchId').equals(id).toArray(),
          db.players_local.toArray()
        ])
        match = m
        goals = g
        lineups = l
        players = Object.fromEntries(p.map(x => [x.id, x]))
      })()
    : Promise.resolve()

  // Keep state in sync with live queries
  $effect(() => {
    if (!browser) return
    const id = data.id

    const u1 = observeLocalMatch(id).subscribe(m => match = m)
    const u2 = observeLocalGoalsForMatch(id).subscribe(g => goals = g)
    const u3 = observeLocalLineupsForMatch(id).subscribe(l => lineups = l)
    const u4 = observeLocalActivePlayersMap().subscribe(p => players = p)

    return () => { u1(); u2(); u3(); u4() }
  })
</script>

<section class="mx-auto w-full max-w-screen-sm px-4 md:max-w-2xl md:px-6 lg:max-w-3xl space-y-6">
  <header class="flex items-center justify-between">
    <Heading level={1} underline className="text-white">
      {$t('match_day.match.numbered', {
        values: { num: match?.orderNo ?? '?' }
      })}
    </Heading>
  <div class="flex gap-2">
    <Link variant="utility" href="/">
      {$t('common.back')}
    </Link>
  </div>
  </header>

  {#await ready}{:then}
    <GoalsEditor
      matchId={data.id}
      half={goalHalf}
      {goals}
      {lineups}
      lineupFor={lineupFor}
    />
   
    <CopyTeamButton {match} {lineups} />
    <!-- Team builder (whole game) -->
    <LineupBuilder matchId={data.id} {players} {lineups} />

  {/await}
</section>

