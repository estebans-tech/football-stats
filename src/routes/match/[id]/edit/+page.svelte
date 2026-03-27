<script lang="ts">
  import { browser } from '$app/environment'
  import { writable } from 'svelte/store'
  import { t, locale } from 'svelte-i18n'
  import type { PageData } from './$types'
  import LineupBuilder from '$lib/components/match/LineupBuilder.svelte'
  import GoalsEditor from '$lib/components/match/GoalsEditor.svelte'
  import VoiceCommand from '$lib/components/VoiceCommand.svelte'
  import Heading from '$lib/components/Heading.svelte'
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
    TeamColor
  } from '$lib/types/domain'

  // ---------- props (runes mode)
  type Props = { data: PageData }
  let { data }: Props = $props()

  // ---------- local snapshot writables used by UI helpers
  const match$   = writable<MatchLocal | undefined>(undefined)
  const goals$   = writable<GoalLocal[]>([])
  const lineups$ = writable<LineupLocal[]>([])
  const players$ = writable<Record<string, PlayerLocal>>({})
  const teamMap: Record<TeamColor, TeamAB> = { red: 'A', black: 'B' }
  const speechLang = $derived( $locale?.startsWith('de') ? 'de-DE' : $locale?.startsWith('en') ? 'en-US' : 'sv-SE' )
  // ---------- UI state
  let teamForAdd = $state<TeamAB>('A') // Red by default
  let goalHalf   = $state<Half>(1)     // Half selector only for GOALS

  // ---------- helpers (whole-game lineups; no half)
  const nameOf = (id: string) => ($players$[id]?.name) ?? id

  const teamPlayers = (team: TeamAB) =>
    $lineups$.filter(l => l.team === team && !l.deletedAt).map(l => l.playerId)

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


  // per-team player lists for the parser (name/nickname only)
  const playerDirectoryA = $derived(
    teamPlayers('A').map(id => ({
      id,
      name: nameOf(id),
      nickname: $players$[id]?.nickname ?? null
    }))
  )

  const playerDirectoryB = $derived(
    teamPlayers('B').map(id => ({
      id,
      name: nameOf(id),
      nickname: $players$[id]?.nickname ?? null
    }))
  )

  const playerDirectory = $derived({ A: playerDirectoryA, B: playerDirectoryB })
  // const playerDirectory = $derived(() => {
  //   const list = Object.values($players$ ?? [])
  //     .filter(p => p.active && (p.deletedAt == null))
  //     .map(p => ({ id: p.id, name: p.name, nickname: p.nickname ?? null }))
  //   return { A: list, B: list }   // samma lista till båda lag
  // })
  async function onVoiceCommand(detail: {
    intent: 'team_assign' | 'add_goal',
    payload: any,
    text: string,
    confidence: number,
    candidates?: any[]
  }) {

    if (detail.intent !== 'team_assign') return
    
    console.log('VOICE CMD', detail)
    const team = detail.payload.team
    // 1) resolve playerId (prefer ID from voice, else lookup in current directory for that team)
    let playerId = detail.payload.player.id
    if (!playerId) {
      const spoken = (detail.payload.player.nickname ?? detail.payload.player.name)?.toLowerCase()
      const dir = team === 'A' ? playerDirectory.A : playerDirectory.B
      const hit = dir.find(p =>
        (p.nickname && p.nickname.toLowerCase() === spoken) ||
        p.name.toLowerCase() === spoken
      )
      playerId = hit?.id
    }
    if (!playerId) return  // ingen entydig match → gör inget (ev. visa toast om du vill)

    // 2) skriv via samma algoritm som LineupBuilder (helmatch = WHOLE_GAME_HALF under huven)
    await setTeamForPlayerWholeGame(data.id, playerId, team)
  }
</script>

<section class="mx-auto max-w-4xl w-full space-y-6">
  <header class="flex items-center justify-between">
    <Heading level={1} underline>
      {$t('match_day.match.numbered', {
        values: { num: $match$?.orderNo ?? '?' }
      })}
    </Heading>
    <a href="/" class="self-start md:self-auto btn btn-outline text-sm active:scale-95 mt-auto">
      {$t('common.back')}
    </a>
  </header>
  {#await ready}{:then}

  <VoiceCommand
    {teamMap}
    {playerDirectory}
    pushToTalk={true}
    lang={speechLang}
    onCommand={onVoiceCommand}
    debug
  />
  {speechLang}

    <!-- Team builder (whole game) -->
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
