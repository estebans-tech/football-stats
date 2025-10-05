<script lang="ts">
  import { t } from 'svelte-i18n'

  // // Types
  import type { MatchData } from '$lib/types/domain'

  // Exakta nycklar för halvlek
  const halves = ['first', 'second'] as const
  type HalfKey = typeof halves[number]

  type Props = {
    syncBusy?: boolean,
    match: MatchData
  }
  let { match, syncBusy = true }: Props = $props()
</script>

<section class="mx-auto w-full mt-6 space-y-6">
  <!-- Snabböversikt -->
  <div class="grid grid-cols-2 gap-3 md:gap-4">
    <!-- Result -->
    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <h2 class="text-xs uppercase tracking-wide text-black/60 mb-2">{$t('session.statistics.results')}</h2>

      {#if match?.total?.red == null || match?.total?.black == null}<span class="spinner" aria-label="Loading"></span>
      {:else}
        <dl class="space-y-2 tabular-nums">
          <div class="flex items-baseline gap-2">
            <dt class="sr-only">{$t('session.statistics.results')}</dt>

            <span class="inline-grid size-2.5 rounded-full bg-red-900" aria-hidden="true"></span>
            <dd class="text-2xl font-semibold">{match.total.red}</dd>

            <span class="text-black/40">—</span>

            <dd class="text-2xl font-semibold">{match.total.black}</dd>
            <span class="inline-grid size-2.5 rounded-full bg-black/80" aria-hidden="true"></span>
          </div>
        </dl>
      {/if}
    </div>

    <!-- Period -->
    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <h2 class="text-xs uppercase tracking-wide text-black/60 mb-2">{$t('match_day.match.half_label')}</h2>

      {#if !match?.scoresByHalf}<span class="spinner" aria-label="Loading"></span>
      {:else}
        <dl class="space-y-4 tabular-nums">
          {#each (['first', 'second']) as half (half)}
            <div class="flex items-baseline justify-between">
              <dt class="text-sm text-black/70 w-12">
                {half === 'first'
                  ? $t('match_day.match.first_label')
                  : $t('match_day.match.second_label')}
              </dt>
              <dd class="flex items-baseline gap-2">
                <span class="inline-grid size-2.5 rounded-full bg-red-900" aria-hidden="true"></span>
                <span class="text-2xl font-semibold">{match.scoresByHalf?.[half as HalfKey]?.totalRed ?? 0}</span>
                <span class="text-black/40">—</span>
                <span class="text-2xl font-semibold">{match.scoresByHalf?.[half as HalfKey]?.totalBlack ?? 0}</span>
                <span class="inline-grid size-2.5 rounded-full bg-black/80" aria-hidden="true"></span>
              </dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>
  </div>

  <!-- Uppställningar -->
  <section aria-label="{$t('match.lineups.title')}" class="grid md:grid-cols-2 gap-4">
    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-grid size-2.5 rounded-full bg-red-900" aria-hidden="true"></span>
        <h2 class="text-base font-semibold uppercase">
          {$t('match_day.match.team.label')} {$t('match_day.match.team.red')}
          <span class="ml-1 text-black/40 font-normal">({match.lineups.red.length})</span>
        </h2>
      </div>
      {#if match.lineups.red.length === 0}<span class="spinner mr-1" aria-label="Loading"></span>
      {:else}
      <ul class="list-disc pl-5 space-y-1.5  marker:text-black/80">
        {#each match.lineups.red as player}
          <li class="text-sm leading-6">
            <span class="font-medium">{player}</span>
          </li>
        {/each}
      </ul>
      {/if}
    </div>

    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-grid size-2.5 rounded-full bg-black/80" aria-hidden="true"></span>
        <h2 class="text-base font-semibold uppercase">
          {$t('match_day.match.team.label')} {$t('match_day.match.team.black')}
          <span class="ml-1 text-black/40 font-normal">({match.lineups.black.length})</span>
        </h2>
      </div>
      {#if match.lineups.black.length === 0}<span class="spinner mr-1" aria-label="Loading"></span>
      {:else}
      <ul class="list-disc pl-5 space-y-1.5 marker:text-red-900">
        {#each match.lineups.black as player}
          <li class="text-sm leading-6">
            <span class="font-medium">{player}</span>
          </li>
        {/each}
      </ul>
      {/if}
    </div>
  </section>

  <!-- Mål (tidslinje) -->
  <section aria-label="{$t('match.goals.title')}" class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
    <h2 class="text-base font-semibold uppercase mb-3">{$t('match_day.match.goals.title')}</h2>
  
    {#if match.scoreByMinute.length === 0}
      <span class="spinner mr-1" aria-label="Loading"></span>
    {:else}
      <div class="max-h-80 overflow-auto [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
        <ol class="relative ml-3 border-l border-black/10">
          {#each match.scoreByMinute as g}
            <li
              class="relative ml-6 py-2"
              aria-label={`${g.scorer ?? g.scorerId} ${g.assistId ? '(assist ' + (g.assist ?? g.assistId) + ')' : ''} – ${g.half ?? ''} ${g.minute ?? ''}’`}
            >
              <!-- färgprick på tidslinjen -->
              <span
                class="absolute -left-[6px] top-3 inline-block size-3 rounded-full ring-2 ring-white
                       {g.team === 'A' ? 'bg-red-900' : 'bg-black/80'}"
                aria-hidden="true"
              ></span>
  
              <!-- radinnehåll -->
              <div class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
                <!-- vänster: halv/minut -->
                <div class="flex items-center gap-2">
                  <span class="text-[11px] leading-5 rounded-full px-2 bg-black/5 text-black/70">
                    {g.half ?? '—'}
                  </span>
                  {#if g.minute != null}
                    <span class="text-[11px] text-black/50 tabular-nums">{g.minute}’</span>
                  {/if}
                </div>
              
                <!-- mitten: spelare + ev. assist -->
                <div class="min-w-0 text-base">
                  <span class="font-medium truncate">{g.scorer ?? g.scorerId}</span>
                  {#if g.assistId}
                    <span class="text-black/60"> (assist {g.assist ?? g.assistId})</span>
                  {/if}
                </div>
              
                <!-- höger: lag-badge -->
                <span
                  class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full align-middle
                         {g.team === 'A' ? 'bg-rose-50 text-rose-900 ring-1 ring-rose-900/10' : 'bg-black/5 text-black/80 ring-1 ring-black/10'}">
                  <span class="inline-block size-1.5 rounded-full {g.team === 'A' ? 'bg-red-900' : 'bg-black/80'}"></span>
                  {g.team === 'A' ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
                </span>
              </div>
            </li>
          {/each}
        </ol>
      </div>
    {/if}
  </section>
</section>