<script lang="ts">
    import { t } from 'svelte-i18n'
    import SessionStatsButton from '$lib/components/session/SessionStatsButton.svelte'
    import { observeLocalSessions } from '$lib/data/sessions'
    import {
      observeLocalMatchCounts,
      observeLocalMatchesMap
  } from '$lib/data/matches'

    import type { MatchLocal } from '$lib/types/domain'

    const sessions = observeLocalSessions()
    const matchCounts = observeLocalMatchCounts()
    const matchesMap = observeLocalMatchesMap()

    let counts: Record<string, number> = {}
    let bySession: Record<string, import('$lib/types/domain').MatchLocal[]> = {}
    let matchesBySession: Record<string, MatchLocal[]> = {}

    $: counts = $matchCounts
    $: bySession = $matchesMap
    $: matchesBySession = $matchesMap
  </script>
  
  <section>
    {#if $sessions.length === 0}
    <div class="rounded-xl border border-gray-300 p-4 text-sm text-gray-600 bg-white">
      {$t('session.list.empty')}
    </div>
    {:else}
    <div class="space-y-3">
      <ul class="mx-auto max-w-screen-sm">
        {#each $sessions as s (s.id)}
        <li class="-mx-2">
          <SessionStatsButton
            title={s.date}
            caption={$t('session.list.ctaOpen')}
            url={`/sessions/${s.id}/stats`} />
        </li>
        {/each}
      </ul>
    </div>
    {/if}
  </section>
  