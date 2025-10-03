<script lang="ts">
import type { MatchLocal } from '$lib/types/domain'
// TODO: Flytta
type Score  = { A: number; B: number }

type Props = {
  title?: string
  textLabels: { empty: string; teamA: string; teamB: string; match: string }
  matches?: MatchLocal[]
  scores: Record<string, Score> 
}
  
let { title = '', textLabels = { empty: '', teamA: '', teamB: '', match: '' }, matches = [], scores }: Props = $props()
</script>

<!-- kort -->
<section class="match-result-card">
  <div class="rounded-2xl bg-white ring-1 ring-black/10 overflow-hidden">
    <header class="px-4 py-3 font-semibold flex items-center justify-between">
      <span>{title}</span>
    </header>
    {#if matches.length === 0}
      <div class="px-4 py-3 text-sm text-gray-600">{textLabels.empty}</div>
    {:else}
    <ul class="divide-y divide-black/10">
      {#each matches as m (m.id)}
      {@const score = scores[m.id] ?? { A: 0, B: 0 }}
      <li>
        <a href={`/matches/${m.id}`}
     class="block -mx-1 px-1 rounded-[14px]
            hover:bg-black/[.02] active:scale-[.995]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900/40 transition">
       <div class="px-4 py-2.5 md:py-3 grid items-center gap-x-3 md:gap-x-4
           grid-cols-[auto_auto_20px_auto_1fr] md:grid-cols-[120px_auto_32px_auto_1fr]focus-visible:outline-none">

        <!-- Match label -->
          <span class="text-black/60 md:text-md">{textLabels.match} {m.orderNo}</span>

        <!-- Red: dot + text -->
        <span class="inline-flex items-center gap-2">
          <span aria-hidden="true" class="size-2.5 rounded-full bg-red-900"></span>
          <span class="text-red-900">
            {textLabels.teamA} <span class="font-semibold tabular-nums" class:text-black={score.A > score.B}>{score.A}</span>
          </span>
        </span>

        <!-- dash (pixel-säker) -->
        <span aria-hidden="true" class="justify-self-center w-full h-[2px] bg-black/25 rounded"></span>

        <!-- Black: score + text -->
        <span class="inline-flex items-center gap-2">
          <span class="font-semibold tabular-nums" class:text-black={score.B > score.A}>{score.B}</span>
          <span class="text-black">{textLabels.teamB}</span>
        </span>
      </div>
    </a>
    </li>
      {/each}
    </ul>
    {/if}
  </div>
</section>
<!-- kort -->
