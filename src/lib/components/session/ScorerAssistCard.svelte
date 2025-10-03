<script lang="ts">
type Row    = { id: string; name: string; goals: number; assists: number; ga: number; apps: number }

type Props = {
  title?: string
  emptyLabel?: string
  leaderboard?: Row[]
  mode?: 'assists' | 'goals' | 'ga'
}
  
let { title = '', emptyLabel ='', leaderboard = [], mode = 'goals' }: Props = $props()
</script>

<section class="scorer-assist-card">
  <div class="rounded-2xl bg-white ring-1 ring-black/10 overflow-hidden">
    <header class="px-4 py-3 font-semibold flex items-center justify-between">
      <span>{title}</span>
    </header>

    {#if leaderboard.length === 0}
      <div class="px-4 py-3 text-sm text-gray-600">{emptyLabel}</div>
    {:else}
    <ul class="divide-y divide-black/10">
      {#each leaderboard.slice(0, 10) as r (r.id)}
        <li class="px-4 py-2.5 grid items-center grid-cols-[1fr_auto] gap-3">
          <span class="truncate">{r.name }</span>
          <span class="tabular-nums font-medium text-black/80 justify-self-end">
            {#if mode === 'goals'}
              {r.goals}
            {:else if mode === 'assists'}
              {r.assists}
            {:else}
              {r.ga}
            {/if}
          </span>
        </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
