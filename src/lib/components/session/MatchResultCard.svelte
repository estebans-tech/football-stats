<script lang="ts">
  import type { MatchLocal } from '$lib/types/domain'

  type Score = { A: number; B: number }

  type Props = {
    title?: string
    textLabels: { empty: string; teamA: string; teamB: string; match: string }
    matches?: MatchLocal[]
    scores: Record<string, Score>
  }

  let {
    title = '',
    textLabels = { empty: '', teamA: '', teamB: '', match: '' },
    matches = [],
    scores
  }: Props = $props()
</script>

<section>
  {#if title}
    <p class="mb-2 text-[10px] uppercase tracking-widest text-white/35">{title}</p>
  {/if}

  <div class="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
    {#if matches.length === 0}
      <p class="px-4 py-3 text-sm text-white/40">{textLabels.empty}</p>
    {:else}
      <ul class="divide-y divide-white/10">
        {#each matches as m (m.id)}
          {@const score = scores[m.id] ?? { A: 0, B: 0 }}
          {@const redWins = score.A > score.B}
          {@const blackWins = score.B > score.A}
          <li>
            <a
              href="/match/{m.id}"
              class="flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:scale-[.998] transition"
            >
              <span class="w-14 shrink-0 text-xs text-white/35">
                {textLabels.match} {m.orderNo}
              </span>

              <div class="flex flex-1 items-center gap-2">
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2 shrink-0 rounded-full bg-red-700"></span>
                  <span class="tabular-nums text-[15px] font-bold {redWins ? 'text-red-400' : 'text-white/70'}">
                    {score.A}
                  </span>
                </span>

                <span class="text-sm text-white/25">—</span>

                <span class="inline-flex items-center gap-1.5">
                  <span class="tabular-nums text-[15px] font-bold {blackWins ? 'text-white' : 'text-white/70'}">
                    {score.B}
                  </span>
                  <span class="size-2 shrink-0 rounded-full bg-white/35"></span>
                </span>
              </div>

              <span class="text-sm text-white/20">›</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

