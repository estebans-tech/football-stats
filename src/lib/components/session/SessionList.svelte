<script lang="ts">
    import { t, locale } from 'svelte-i18n'
    import { getSessionList } from '$lib/db/queries'
    import type { SessionListItem } from '$lib/types/views'

    const INITIAL_COUNT = 3
    let sessions = $state<SessionListItem[]>([])
    let showAll = $state(false)

    const latest = $derived(sessions[0] ?? null)
    const previous = $derived(sessions.slice(1))
    const visible = $derived(showAll ? previous : previous.slice(0, INITIAL_COUNT))
    const hasMore = $derived(!showAll && previous.length > INITIAL_COUNT)

  // Load from Dexie on mount
  async function load() {
    sessions = await getSessionList()
  }

  $effect(() => {
    load()
 })

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString($locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
 </script>
  
  <section>
{#if sessions.length === 0}
  <p class="text-muted-foreground py-8 text-center text-sm">
    {$t('session.list.empty')}
  </p>
{:else}

  <!-- Latest matchday -->
  {#if latest}
    <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-foreground/50">
      {$t('session.list.latest')}
    </p>

    <div class="mb-8 rounded-xl border border-border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <p class="font-semibold capitalize">{formatDate(latest.date)}</p>
          <p class="text-sm text-foreground/50">
            {latest.matchCount} {$t('session.list.matches')} · {latest.totalGoals} {$t('session.list.goals')}
          </p>
        </div>
        <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {$t('session.list.latest_badge')}
        </span>
      </div>

      <div class="mb-3 flex flex-wrap gap-2">
        {#each latest.results as result}
          <span class="rounded-full border border-border px-3 py-1 text-sm font-medium">
            {result.red}–{result.black}
          </span>
        {/each}
      </div>

      <a href="/session/{latest.id}/statistics" class="text-sm font-medium text-red-700 hover:underline">
        {$t('session.list.statistics')} →
      </a>
    </div>
  {/if}

  <!-- Previous matchdays -->
  {#if previous.length > 0}
    <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-foreground/50">
      {$t('session.list.previous')}
    </p>

    <div class="flex flex-col gap-3">
      {#each visible as session (session.id)}
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="mb-3">
            <p class="font-semibold capitalize">{formatDate(session.date)}</p>
            <p class="text-sm text-foreground/50">
              {session.matchCount} {$t('session.list.matches')} · {session.totalGoals} {$t('session.list.goals')}
            </p>
          </div>

          <div class="mb-3 flex flex-wrap gap-2">
            {#each session.results as result}
              <span class="rounded-full border border-border px-3 py-1 text-sm font-medium">
                {result.red}–{result.black}
              </span>
            {/each}
          </div>

          <a href="/session/{session.id}/statistics" class="text-sm font-medium text-red-700 hover:underline">
            {$t('session.list.statistics')} →
          </a>
        </div>
      {/each}
    </div>

    {#if hasMore}
      <button
        onclick={() => showAll = true}
        class="mt-4 w-full py-3 text-sm font-medium text-red-700 hover:underline"
      >
        {$t('session.list.show_more')}
      </button>
    {/if}
  {/if}

{/if}
  </section>
  
