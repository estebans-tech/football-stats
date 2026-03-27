<script lang="ts">
  // Props reflect season summary data
  const {
    season,
    totalGoals,
    matchCount,
    playerCount,
    topScorer,
  } = $props<{
    season: string
    totalGoals: number
    matchCount: number
    playerCount: number
    topScorer: string
  }>()
</script>

<section class="w-full bg-[#8B1A1A] px-4 py-8">
  <div class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl">

    <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-red-300/70">
      {season}
    </p>

    <div class="mb-1 flex items-baseline gap-3">
      <span class="text-6xl font-black text-white">{totalGoals}</span>
      <span class="text-sm text-red-200/80">mål totalt</span>
    </div>

    <div class="mt-1 h-px w-8 bg-red-400/60"></div>

    <div class="mt-5 flex gap-6">

      <div>
        <p class="text-xl font-bold text-white">{matchCount}</p>
        <p class="text-[11px] uppercase tracking-wider text-red-300/70">Matcher</p>
      </div>

      <div class="w-px bg-red-400/30"></div>

      <div>
        <p class="text-xl font-bold text-white">{playerCount}</p>
        <p class="text-[11px] uppercase tracking-wider text-red-300/70">Spelare</p>
      </div>

      <div class="w-px bg-red-400/30"></div>

      <div>
        <p class="text-xl font-bold text-white">{topScorer}</p>
        <p class="text-[11px] uppercase tracking-wider text-red-300/70">Toppskytt</p>
      </div>

    </div>
  </div>
</section>
