<script lang="ts">
import type { AppearanceRow } from '$lib/types/domain'

type Props = {
  title?: string
  emptyLabel?: string
  appearances?: AppearanceRow[]
}
  
let { title = '', emptyLabel ='', appearances = [] }: Props = $props()
</script>

<section class="scorer-assist-card">
  <div class="rounded-2xl bg-white ring-1 ring-black/10 overflow-hidden">
    <header class="px-4 py-3 font-semibold flex items-center justify-between">
      <span>{title}</span>
    </header>

    {#if appearances?.length === 0 }
      <div class="px-4 py-3 text-sm text-gray-600">{emptyLabel}</div>
    {:else}
    <ol class="divide-y divide-black/10">
      {#each appearances.sort((a, b) => b.appearances - a.appearances) as row (row.id)}
        <li class="px-4 py-3 flex items-center">
          <span class="text-black/80">{row.player.nickname }</span>
          <span class="ml-auto font-medium tabular-nums">
            {row.appearances}
          </span>
        </li>
        {/each}
    </ol>
    {/if}
  </div>
</section>
