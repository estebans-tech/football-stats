<script lang="ts">
    import { t, locale } from 'svelte-i18n'
    import { BarChart2 } from 'lucide-svelte'
    import Card from '$lib/components/Card.svelte'
    import Button from '$lib/components/Button.svelte'
    import Link from '$lib/components/Link.svelte'
    import SessionListSkeleton from '$lib/components/session/SessionListSkeleton.svelte'
    import SessionListEmpty from './SessionListEmpty.svelte'
    import { formatDate} from '$lib/utils/utils'
    import { getSessionList } from '$lib/db/queries'
    import type { SessionListItem } from '$lib/types/views'

    const INITIAL_COUNT = 3
    let sessions = $state<SessionListItem[]>([])
    let showAll = $state(false)
    let loading = $state(true)

    const latest = $derived(sessions[0] ?? null)
    const previous = $derived(sessions.slice(1))
    const visible = $derived(showAll ? previous : previous.slice(0, INITIAL_COUNT - 1))
    const hasMore = $derived(!showAll && previous.length > INITIAL_COUNT)
    const fmt = $derived((iso: string) => formatDate(iso, $locale))

    // Load from Dexie on mount
    async function load() {
      loading = true
      sessions = await getSessionList()
      loading = false 
    }

    $effect(() => {
      load()
     })
</script>

<section class="py-6">
  {#if loading}
    <SessionListSkeleton />
  {:else if sessions.length === 0}
    <SessionListEmpty /> 
 {:else}

  <!-- Latest matchday -->
  {#if latest}
    <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">
      {$t('session.list.latest')}
    </h3>

    <Card class="mb-6 bg-white/10">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-white">
          <p class="font-semibold capitalize">{fmt(latest.date)}</p>
          <p class="text-sm text-white/50">
            {latest.matchCount} {$t('session.list.matches')} · {latest.totalGoals} {$t('session.list.goals')}
          </p>
        </div>
        <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {$t('session.list.latest_badge')}
        </span>
      </div>

      <div class="mb-3 flex flex-wrap gap-2 text-white">
        {#each latest.results as result}
          <span class="rounded-full border border-white/50 px-3 py-1 text-sm font-medium">
            {result.red}–{result.black}
          </span>
        {/each}
      </div>

      <footer class="flex justify-center">
        <Link variant="ghost" intent="neutral" href="/session/{latest.id}/statistics">
          <BarChart2 size={16} aria-hidden="true" /> {$t('session.list.statistics')}
        </Link>
      </footer>

   </Card>
  {/if}

  <!-- Previous matchdays -->
  {#if previous.length > 0}
    <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">
      {$t('session.list.previous')}
    </h3>

    <div class="flex flex-col gap-6">
      {#each visible as session (session.id)}
        <Card class="bg-white/10">
          <div class="mb-3 text-white">
            <p class="font-semibold capitalize">{fmt(session.date)}</p>
            <p class="text-sm text-white/50">
              {session.matchCount} {$t('session.list.matches')} · {session.totalGoals} {$t('session.list.goals')}
            </p>
          </div>

          <div class="mb-3 flex flex-wrap gap-2 text-white">
            {#each session.results as result}
              <span class="rounded-full border border-white/50 px-3 py-1 text-sm font-medium">
                {result.red}–{result.black}
              </span>
            {/each}
          </div>

          <!-- Footer -->
          <footer class="flex justify-center">
            <Link variant="ghost" intent="neutral" href="/session/{session.id}/statistics">
              <BarChart2 size={16} aria-hidden="true" /> {$t('session.list.statistics')}
            </Link>
          </footer>

        </Card>
      {/each}
    </div>
  {/if}

  {#if hasMore}
    <footer class="text-center py-3">
      <Button variant="ghost" intent="neutral" onclick={() => showAll = true}>
        {$t('session.list.show_more')}
      </Button>
    </footer>
   {/if}

  {/if}
  </section>
  
