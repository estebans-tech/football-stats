<script lang="ts">
  type Row = { id: string; name: string; goals: number; assists: number; ga: number; apps: number }

  type Props = {
    title?: string
    emptyLabel?: string
    leaderboard?: Row[]
    mode?: 'assists' | 'goals' | 'ga'
  }

  let { title = '', emptyLabel = '', leaderboard = [], mode = 'goals' }: Props = $props()

  function getValue(r: Row): number {
    if (mode === 'assists') return r.assists
    if (mode === 'ga') return r.ga
    return r.goals
  }
</script>

<section>
  <div class="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
    <header class="px-4 py-3 border-b border-white/10">
      <span class="text-sm font-semibold text-white">{title}</span>
    </header>

    {#if leaderboard.length === 0}
      <p class="px-4 py-3 text-sm text-white/40">{emptyLabel}</p>
    {:else}
      <ul class="divide-y divide-white/10">
        {#each leaderboard.slice(0, 10) as r, i (r.id)}
          <li class="grid grid-cols-[20px_1fr_auto] items-center gap-3 px-4 py-2.5">
            <span class="text-xs text-white/25">{i + 1}</span>
            <span class="truncate text-sm text-white/85">{r.name}</span>
            <span class="tabular-nums text-sm font-bold {i === 0 ? 'text-red-400' : 'text-white'}">
              {getValue(r)}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

