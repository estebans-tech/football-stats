<script lang="ts">
  import { browser } from '$app/environment'
  import { readable, type Readable } from 'svelte/store'
  import { t } from 'svelte-i18n'
  import Heading from '$lib/components/Heading.svelte'
  import MatchStatistic from '$lib/components/match/MatchStatistic.svelte'

  // Types
  import type { PageLoad, PageData } from './$types'
  import type {
    MatchLocal,
    GoalLocal,
    LineupLocal,
    PlayerLocal,
    MatchData
  } from '$lib/types/domain'

  // live data
  import { observeLocalMatch } from '$lib/data/matches'
  import { observeLocalGoalsForMatch } from '$lib/data/goals'
  import { observeLocalLineupsForMatch } from '$lib/data/lineups'
  import { observeLocalPlayersMap } from '$lib/data/players'

  export const load: PageLoad = ({ params }) => {
    return { id: params.id }; // <-- makes PageData = { id: string }
  }

  // export let data: PageData

  type Props = { data: PageData, isEditor: boolean }
  let { data }: Props = $props()

  let backUrl = $state('/')


  // SSR-safe fallbacks: deklarera alltid stores på top level

  const lineupsStore: Readable<LineupLocal[]> =
    browser ? observeLocalLineupsForMatch(data.id) : readable<LineupLocal[]>([])
  const playersMap: Readable<Record<string, PlayerLocal>> =
    browser ? observeLocalPlayersMap() : readable<Record<string, PlayerLocal>>({})

  // små helpers
  const nameOf = (id: string) => ($playersMap[id]?.nickname) ?? ($playersMap[id]?.name) ?? id

  // 1) Rå-källa från Dexie (alla mål i matchen)
  const allGoals: Readable<GoalLocal[]> = browser
    ? observeLocalGoalsForMatch(data.id)
    : readable<GoalLocal[]>([])

  const currentMatch: Readable<MatchLocal | undefined> = browser
    ? observeLocalMatch(data.id)
    : readable<MatchLocal | undefined>(undefined)

  function isValidGoal(g: GoalLocal): boolean {
    const notDeleted = g.deletedAt == null && g.deletedAtLocal == null
    const required =
      !!g.matchId &&
      (g.half === 1 || g.half === 2) &&
      (g.team === 'A' || g.team === 'B') &&
      !!g.scorerId
    return notDeleted && required
  }

  const match = $derived.by(() => {
    const valid = $allGoals.filter(isValidGoal);
    const matchNo = $currentMatch?.orderNo
    return {
        matchNumber: matchNo,
        total: {
          red: valid.filter(g => g.team === 'A').length,
          black: valid.filter(g => g.team === 'B').length,
          match: valid.length
        },
        scoresByHalf: {
          first: {
            scorersRed: valid.filter(g => g.half === 1 && g.team === 'A').map(g => ({scorer: nameOf(g.scorerId), minute: g.minute})),
            scorersBlack: valid.filter(g => g.half === 1 && g.team === 'B').map(g => ({scorer: nameOf(g.scorerId), minute: g.minute})),
            totalRed: valid.filter(g => g.half === 1 && g.team === 'A').length as number,
            totalBlack: valid.filter(g => g.half === 1 && g.team === 'B').length as number
          },
          second: {
            scorersRed: valid.filter(g => g.half === 2 && g.team === 'A').map(g => ({scorer: nameOf(g.scorerId), minute: g.minute})),
            scorersBlack: valid.filter(g => g.half === 2 && g.team === 'B').map(g => ({scorer: nameOf(g.scorerId), minute: g.minute})),
            totalRed: valid.filter(g => g.half === 2 && g.team === 'A').length,
            totalBlack: valid.filter(g => g.half === 2 && g.team === 'B').length
          }
        },
        lineups: {
          red: $lineupsStore.filter(l => l.team === 'A').map(l => nameOf(l.playerId)) as string[],
          black: $lineupsStore.filter(l => l.team === 'B').map(l => nameOf(l.playerId)) as string[]
        },
        scoreByMinute: valid.map(g => ({...g, scorer: nameOf(g.scorerId), assist: g.assistId ? nameOf(g.assistId) : '' }))
      }
   }) satisfies MatchData


   $effect(() => {
    if (!!$currentMatch?.sessionId) backUrl = `/sessions/${$currentMatch?.sessionId}/stats`
  })
  
</script>

<!-- Header -->
<header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
  <Heading level={1} underline>
    {$t('match_day.match.numbered', { values: { num: match.matchNumber } })}
      {#if !match.matchNumber}<span class="spinner mr-1"></span>{/if}
  </Heading>
  <a href="{backUrl}" class="self-start md:self-auto btn btn-outline text-sm active:scale-95">
    {$t('common.back')}
  </a>
</header>

<MatchStatistic {match} />
