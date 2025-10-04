<script lang="ts">
  import { t } from 'svelte-i18n'

  // // Types
  import type { MatchData } from '$lib/types/domain'

  type Props = {
    syncBusy?: boolean,
    match: MatchData
  }
  let { match, syncBusy = true }: Props = $props()
</script>

<section class="mx-auto w-full mt-6 space-y-6">
  <!-- Snabböversikt -->
  <div class="grid grid-cols-2 gap-3 md:gap-4">
    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <div class="text-xs uppercase tracking-wide text-black/60 mb-2">{$t('session.statistics.results')}</div>
      {#if match.total.red === undefined || match.total.black === undefined }<span class="spinner mr-1"></span>
      {:else}
      <div class="flex items-baseline gap-2">
        <span class="inline-grid size-2.5 rounded-full bg-red-900"></span>
        <div class="text-3xl font-semibold tabular-nums">{match.total.red}</div>
        <span class="text-black/40">—</span>
        <div class="text-3xl font-semibold tabular-nums">{match.total.black}</div>
        <span class="inline-grid size-2.5 rounded-full bg-black/80"></span>
      </div>
      {/if}
    </div>
  <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
    <div class="text-xs uppercase tracking-wide text-black/60 mb-2">{$t('match_day.match.half_label')}</div>
    <div class="space-y-1">
      {#if match.scoresByHalf.first === undefined }<span class="spinner mr-1"></span>
      {:else}
      <div class="flex items-baseline justify-between">
        <span class="text-sm text-black/70 w-16">{$t('match_day.match.first_label')}</span>
        <div class="flex items-baseline gap-2">
          <span class="inline-grid size-2.5 rounded-full bg-red-900"></span>
          <span class="text-2xl font-semibold tabular-nums">{match.scoresByHalf.first.totalRed}</span>
          <span class="text-black/40">—</span>
          <span class="text-2xl font-semibold tabular-nums">{match.scoresByHalf.first.totalBlack}</span>
          <span class="inline-grid size-2.5 rounded-full bg-black/80"></span>
        </div>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-sm text-black/70 w-16">{$t('match_day.match.second_label')}</span>
        <div class="flex items-baseline gap-2">
          <span class="inline-grid size-2.5 rounded-full bg-red-900"></span>
          <span class="text-2xl font-semibold tabular-nums">{match.scoresByHalf.second.totalRed}</span>
          <span class="text-black/40">—</span>
          <span class="text-2xl font-semibold tabular-nums">{match.scoresByHalf.second.totalBlack}</span>
          <span class="inline-grid size-2.5 rounded-full bg-black/80"></span>
        </div>
      </div>
      {/if}
      </div>
    </div>
  </div>

  <!-- Uppställningar -->
  <section aria-label="Uppställningar" class="grid md:grid-cols-2 gap-4">
    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-grid size-2.5 rounded-full bg-red-900"></span>
        <h2 class="text-base font-semibold">{$t('match_day.match.team.label')} {$t('match_day.match.team.red')}</h2>
      </div>
      {#if match.lineups.red.length === 0}<span class="spinner mr-1"></span>
      {:else}
      <ul class="list-disc pl-5 space-y-2">
        {#each match.lineups.red as red}
          <li class="text-sm">
            <span class="font-medium">{red}</span>
          </li>
        {/each}
      </ul>
      {/if}
    </div>

    <div class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-grid size-2.5 rounded-full bg-black/80"></span>
        <h2 class="text-base font-semibold">{$t('match_day.match.team.label')} {$t('match_day.match.team.black')}</h2>
      </div>
      {#if match.lineups.black.length === 0}<span class="spinner mr-1"></span>
      {:else}
      <ul class="list-disc pl-5 space-y-2">
        {#each match.lineups.black as black}
          <li class="text-sm">
            <span class="font-medium">{black}</span>
          </li>
        {/each}
      </ul>
      {/if}
    </div>
  </section>

  <!-- Mål (tidslinje) -->
  <section aria-label="Mål" class="rounded-2xl bg-white ring-1 ring-black/10 p-4">
    <!-- <div class="max-h-80 overflow-auto [mask-image:linear-gradient(to_bottom,black_80%,transparent)]"></div> -->
      <h2 class="text-base font-semibold mb-3">{$t('match_day.match.goals.title')}</h2>
    <!-- timeline -->
    {#if match.scoreByMinute === undefined}<span class="spinner mr-1"></span>
    {:else}

    <ol class="relative border-l border-black/10 ml-3">
      {#each match.scoreByMinute as g}
        <li class="ml-6 py-2">
          <span
            class="absolute -left-[6px] mt-2 inline-block size-3 rounded-full ring-2 ring-white
                    {g.team === 'A' ? 'bg-red-900' : 'bg-black/80'}"
            aria-hidden="true"
          ></span>

          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-xs rounded-full px-2 py-0.5 bg-black/5 text-black/70">
              {g.half ?? '—'}
            </span>

            {#if g.minute != null}
              <span class="text-xs text-black/50 tabular-nums">{g.minute}’</span>
            {/if}

            <span class="text-sm">
              <span class="font-medium">{g.scorer ?? g.scorerId}</span>
              {#if g.assistId}
                <span class="text-black/60"> (assist {g.assist ?? g.assistId})</span>
              {/if}
            </span>
          </div>
        </li>
      {/each}
    </ol>
    {/if}
  </section>
</section>