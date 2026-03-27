<script lang="ts">
  import type { AppearanceRow } from '$lib/types/domain'

  type Props = {
    title?: string
    emptyLabel?: string
    appearances?: AppearanceRow[]
  }

  let { title = '', emptyLabel = '', appearances = [] }: Props = $props()

  const sorted = $derived(
    [...(appearances ?? [])].sort((a, b) => b.appearances - a.appearances)
  )

  const max = $derived(sorted[0]?.appearances ?? 1)
</script>

<section>
  <div class="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
    <header class="px-4 py-3 border-b border-white/10">
      <span class="text-sm font-semibold text-white">{title}</span>
    </header>

    {#if sorted.length === 0}
      <p class="px-4 py-3 text-sm text-white/40">{emptyLabel}</p>
    {:else}
      <ol class="divide-y divide-white/10">
        {#each sorted as row (row.id)}
          <li class="flex items-center gap-3 px-4 py-3">
            <span class="flex-1 text-sm text-white/85">
              {row.player.nickname ?? row.player.name}
            </span>
            <div class="w-20 h-[3px] rounded-full bg-white/10">
              <div
                class="h-[3px] rounded-full bg-red-700"
                style="width: {Math.round((row.appearances / max) * 100)}%"
              ></div>
            </div>
            <span class="w-4 text-right tabular-nums text-xs text-white/50">
              {row.appearances}
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</section>

