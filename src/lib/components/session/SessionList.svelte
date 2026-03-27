<script lang="ts">
    import { t, locale } from 'svelte-i18n'
    import Card from '$lib/components/Card.svelte'
    import { formatDate} from '$lib/utils/utils'
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

    const fmt = $derived((iso: string) => formatDate(iso, $locale))
</script>
  
  <section>
  {#if sessions.length === 0}
    <p class="text-muted-foreground py-8 text-center text-sm">
      {$t('session.list.empty')}
    </p>
  {:else}

  <!-- Latest matchday -->
  {#if latest}
    <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">
      {$t('session.list.latest')}
    </h3>

    <Card class="mb-8">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-white">
          <p class="font-semibold capitalize">{fmt(latest.date)}</p>
          <p class="text-sm text-foreground/50">
            {latest.matchCount} {$t('session.list.matches')} · {latest.totalGoals} {$t('session.list.goals')}
          </p>
        </div>
        <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {$t('session.list.latest_badge')}
        </span>
      </div>

      <div class="mb-3 flex flex-wrap gap-2 text-white">
        {#each latest.results as result}
          <span class="rounded-full border border-border px-3 py-1 text-sm font-medium">
            {result.red}–{result.black}
          </span>
        {/each}
      </div>

      <a href="/session/{latest.id}/statistics" class="text-sm font-medium text-red-700 hover:underline">
        {$t('session.list.statistics')} →
      </a>
    </Card>
  {/if}

    <!-- Previous matchdays -->
    {#if previous.length > 0}
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">
        {$t('session.list.previous')}
      </h3>

      <div class="flex flex-col gap-3">
        {#each visible as session (session.id)}
          <Card>
            <div class="mb-3 text-white">
              <p class="font-semibold capitalize">{fmt(session.date)}</p>
              <p class="text-sm text-foreground/50">
                {session.matchCount} {$t('session.list.matches')} · {session.totalGoals} {$t('session.list.goals')}
              </p>
            </div>

            <div class="mb-3 flex flex-wrap gap-2 text-white">
              {#each session.results as result}
                <span class="rounded-full border border-border px-3 py-1 text-sm font-medium">
                  {result.red}–{result.black}
                </span>
              {/each}
            </div>

            <a href="/session/{session.id}/statistics" class="text-sm font-medium text-red-700 hover:underline">
              {$t('session.list.statistics')} →
            </a>
          </Card>
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
  
