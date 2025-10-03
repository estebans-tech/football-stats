<script lang="ts">
  import { t } from 'svelte-i18n'
  import { browser } from '$app/environment'
  import { readable, type Readable } from 'svelte/store'
  import { canEdit } from '$lib/auth/client'
  import Heading from '$lib/components/Heading.svelte'

  // Types
  import type { PageLoad, PageData } from './$types'
  import type {
    MatchLocal,
    GoalLocal,
    LineupLocal,
    PlayerLocal
  } from '$lib/types/domain'

  // live data
  import { observeLocalMatch, migrateTeamsToAB } from '$lib/data/matches'
  import { observeLocalGoalsForMatch } from '$lib/data/goals'
  import { observeLocalLineupsForMatch } from '$lib/data/lineups'
  import { observeLocalActivePlayersMap } from '$lib/data/players'
	import { onMount } from 'svelte'

  export const load: PageLoad = ({ params }) => {
    return { id: params.id }; // <-- makes PageData = { id: string }
  }

  export let data: PageData

  $: isEditor = canEdit()

  // SSR-safe fallbacks: deklarera alltid stores på top level
  const matchStore: Readable<MatchLocal | undefined> =
    browser ? observeLocalMatch(data.id) : readable<MatchLocal | undefined>(undefined)

  const goalsStore: Readable<GoalLocal[]> =
    browser ? observeLocalGoalsForMatch(data.id) : readable<GoalLocal[]>([])

  const lineupsStore: Readable<LineupLocal[]> =
    browser ? observeLocalLineupsForMatch(data.id) : readable<LineupLocal[]>([])
  const playersMap: Readable<Record<string, PlayerLocal>> =
    browser ? observeLocalActivePlayersMap() : readable<Record<string, PlayerLocal>>({})

  // små helpers
  const nameOf = (id: string) => ($playersMap[id]?.name) ?? id

  onMount(() => migrateTeamsToAB())

</script>

<section class="mx-auto max-w-3xl w-full space-y-4">
  {#if !$matchStore}
    <div class="rounded-xl border bg-white p-6 text-gray-600">{$t('common.loading')}</div>
  {:else if !$matchStore}
    <!-- denna gren nås inte; kvar för tydlighet -->
  {:else if $matchStore === undefined}
    <div class="rounded-xl border bg-white p-6 text-red-600">{$t('common.not_found')}</div>
  {:else}
    <header class="flex items-center justify-between">
      <Heading level={1} underline>
        {$t('match_day.match.numbered', { values: { num: $matchStore.orderNo } })}
      </Heading>
      <a href="/" class="self-start md:self-auto btn btn-outline text-sm active:scale-95">
        {$t('common.back')}
      </a>
    </header>

    <!-- Lineups -->
    <div class="rounded-xl border bg-white p-4">
      <h2 class="text-base font-semibold mb-3">{$t('match_day.match.lineups.title')}</h2>
      {#if $lineupsStore.length === 0}
        <div class="text-sm text-gray-600">{$t('match_day.match.lineups.empty')}</div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div class="text-sm font-medium mb-1">{$t('match_day.match.team.red')}</div>
            <ul class="list-disc ml-5 space-y-1">
              {#each $lineupsStore.filter(l => l.team === 'A') as l (l.id)}
                <li>{nameOf(l.playerId)} <span class="text-xs text-gray-500">({$t('match_day.match.half', { values: { n: l.half } })})</span></li>
              {/each}
            </ul>
          </div>
          <div>
            <div class="text-sm font-medium mb-1">{$t('match_day.match.team.black')}</div>
            <ul class="list-disc ml-5 space-y-1">
              {#each $lineupsStore.filter(l => l.team === 'B') as l (l.id)}
                <li>{nameOf(l.playerId)} <span class="text-xs text-gray-500">({$t('match_day.match.half', { values: { n: l.half } })})</span></li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}
    </div>

    <!-- Goals -->
    <div class="rounded-xl border bg-white p-4">
      <h2 class="text-base font-semibold mb-3">{$t('match_day.match.goals.title')}</h2>
      {#if $goalsStore.length === 0}
        <div class="text-sm text-gray-600">{$t('match_day.match.goals.empty')}</div>
      {:else}
        <ul class="space-y-1">
          {#each $goalsStore as g (g.id)}
            <li class="flex items-center justify-between">
              <span class="text-sm">
                {#if g.team === 'A'} 🟦 {:else} 🟥 {/if}
                {#if g.minute}{g.minute}' · {/if}
                {nameOf(g.scorerId)}
                {#if g.assistId} <span class="text-gray-600">({$t('match_day.match.goals.assist', { values: { name: nameOf(g.assistId) } })})</span>{/if}
                <span class="text-xs text-gray-500 ml-2">({$t('match_day.match.half', { values: { n: g.half } })})</span>
              </span>
              {#if isEditor}
                <a class="text-xs underline hover:no-underline" href={`/matches/${data.id}/edit#goal-${g.id}`}>{$t('common.edit')}</a>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* valfritt småfix */
</style>
