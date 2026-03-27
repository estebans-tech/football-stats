<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { SeasonSummaryData } from '$lib/types/views'

  const { data } = $props<{ data: SeasonSummaryData }>()
</script>

<section class="w-full bg-[#8B1A1A] px-4 py-8">
  <div class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl">

    <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-red-300/70">
      {$t('season_summary.label', { values: { year: data.year } })}
    </p>

    <div class="flex items-baseline gap-3">
      <span class="text-6xl font-black text-white">{data.totalGoals}</span>
      <span class="text-sm text-red-200/80">{$t('season_summary.goals_total')}</span>
    </div>

    <div class="mt-2 h-px w-8 bg-red-400/60"></div>

    <div class="mt-5 flex gap-6">

      <div>
        <p class="text-xl font-bold text-white">{data.matchCount}</p>
        <p class="text-[11px] uppercase tracking-wider text-red-300/70">
          {$t('season_summary.matches')}
        </p>
      </div>

      <div class="w-px bg-red-400/30"></div>

      <div>
        <p class="text-xl font-bold text-white">{data.playerCount}</p>
        <p class="text-[11px] uppercase tracking-wider text-red-300/70">
          {$t('season_summary.players')}
        </p>
      </div>

      {#if data.topScorer}
        <div class="w-px bg-red-400/30"></div>

        <div>
          <p class="text-xl font-bold text-white">{data.topScorer}</p>
          <p class="text-[11px] uppercase tracking-wider text-red-300/70">
            {$t('season_summary.top_scorer')}
          </p>
        </div>
      {/if}

    </div>
  </div>
</section>
