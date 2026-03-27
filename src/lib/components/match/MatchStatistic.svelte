<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { MatchData } from '$lib/types/domain'

  const halves = ['first', 'second'] as const
  type HalfKey = typeof halves[number]

  type Props = {
    syncBusy?: boolean
    match: MatchData
  }
  let { match, syncBusy = true }: Props = $props()
</script>

<section class="mx-auto w-full mt-6 space-y-4">

  <!-- Resultat + halvlek -->
  <div class="grid grid-cols-2 gap-3">

    <div class="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 class="mb-3 text-[10px] uppercase tracking-widest text-white/35">
        {$t('session.statistics.results')}
      </h2>
      {#if match?.total?.red == null || match?.total?.black == null}
        <span class="spinner" aria-label="Loading"></span>
      {:else}
        <div class="flex items-baseline gap-2">
          <span class="size-2 rounded-full bg-red-700 shrink-0"></span>
          <span class="text-3xl font-bold tabular-nums {match.total.red > match.total.black ? 'text-red-400' : 'text-white/70'}">
            {match.total.red}
          </span>
          <span class="text-white/25">—</span>
          <span class="text-3xl font-bold tabular-nums {match.total.black > match.total.red ? 'text-white' : 'text-white/70'}">
            {match.total.black}
          </span>
          <span class="size-2 rounded-full bg-white/35 shrink-0"></span>
        </div>
      {/if}
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 class="mb-3 text-[10px] uppercase tracking-widest text-white/35">
        {$t('match_day.match.half_label')}
      </h2>
      {#if !match?.scoresByHalf}
        <span class="spinner" aria-label="Loading"></span>
      {:else}
        <div class="space-y-3">
          {#each halves as half}
            {@const s = match.scoresByHalf[half as HalfKey]}
            <div class="flex items-center justify-between">
              <span class="text-xs text-white/50 w-10">
                {half === 'first' ? $t('match_day.match.first_label') : $t('match_day.match.second_label')}
              </span>
              <div class="flex items-baseline gap-2">
                <span class="size-2 rounded-full bg-red-700 shrink-0"></span>
                <span class="text-xl font-bold tabular-nums {s.totalRed > s.totalBlack ? 'text-red-400' : 'text-white/70'}">
                  {s.totalRed ?? 0}
                </span>
                <span class="text-white/25 text-sm">—</span>
                <span class="text-xl font-bold tabular-nums {s.totalBlack > s.totalRed ? 'text-white' : 'text-white/70'}">
                  {s.totalBlack ?? 0}
                </span>
                <span class="size-2 rounded-full bg-white/35 shrink-0"></span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Uppställningar -->
  <div class="grid grid-cols-2 gap-3">
    <div class="rounded-xl border border-white/10 bg-white/5 p-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="size-2 rounded-full bg-red-700 shrink-0"></span>
        <h2 class="text-xs font-semibold uppercase tracking-wide text-white">
          {$t('match_day.match.team.red')}
          <span class="ml-1 text-white/30 font-normal">({match.lineups.red.length})</span>
        </h2>
      </div>
      {#if match.lineups.red.length === 0}
        <span class="spinner" aria-label="Loading"></span>
      {:else}
        <ul class="space-y-1.5">
          {#each match.lineups.red as player}
            <li class="text-sm text-white/80">{player}</li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="size-2 rounded-full bg-white/35 shrink-0"></span>
        <h2 class="text-xs font-semibold uppercase tracking-wide text-white">
          {$t('match_day.match.team.black')}
          <span class="ml-1 text-white/30 font-normal">({match.lineups.black.length})</span>
        </h2>
      </div>
      {#if match.lineups.black.length === 0}
        <span class="spinner" aria-label="Loading"></span>
      {:else}
        <ul class="space-y-1.5">
          {#each match.lineups.black as player}
            <li class="text-sm text-white/80">{player}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <!-- Mål tidslinje -->
  <div class="rounded-xl border border-white/10 bg-white/5 p-4">
    <h2 class="mb-4 text-[10px] uppercase tracking-widest text-white/35">
      {$t('match_day.match.goals.title')}
    </h2>

    {#if match.scoreByMinute.length === 0}
      <p class="text-sm text-white/40">{$t('match_day.match.goals.empty')}</p>
    {:else}
      <ol class="relative ml-3 border-l border-white/10">
        {#each match.scoreByMinute as g}
          <li class="relative ml-6 py-2.5">
            <span
              class="absolute -left-[25px] top-3 size-3 rounded-full ring-2 ring-[#1a1212]
                     {g.team === 'A' ? 'bg-red-700' : 'bg-white/35'}"
            ></span>

            <div class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2">
              <div class="flex items-center gap-2">
                <span class="text-[11px] rounded-full px-2 bg-white/8 text-white/50">
                  {g.half ?? '—'}
                </span>
                {#if g.minute != null}
                  <span class="text-[11px] text-white/35 tabular-nums">{g.minute}'</span>
                {/if}
              </div>

              <div class="min-w-0 text-sm">
                <span class="font-medium text-white/90 truncate">{g.scorer ?? g.scorerId}</span>
                {#if g.assistId}
                  <span class="text-white/40"> (assist {g.assist ?? g.assistId})</span>
                {/if}
              </div>

              <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                           {g.team === 'A' ? 'bg-red-900/40 text-red-300' : 'bg-white/8 text-white/60'}">
                <span class="size-1.5 rounded-full {g.team === 'A' ? 'bg-red-500' : 'bg-white/40'}"></span>
                {g.team === 'A' ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
              </span>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</section>

