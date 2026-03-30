<script lang="ts">
  // Loading skeleton for SessionList
</script>
<section class="py-6">
  <!-- Latest matchday skeleton -->
  <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">
    <div class="h-3 w-32 bg-white/10 rounded animate-pulse"></div>
  </h3>

  <div class="mb-6 p-4 rounded-lg bg-white/10">
    <div class="mb-3 flex items-center justify-between">
      <div class="space-y-2 flex-1">
        <div class="h-4 w-40 bg-white/15 rounded animate-pulse"></div>
        <div class="h-3 w-32 bg-white/10 rounded animate-pulse"></div>
      </div>
      <div class="h-6 w-16 bg-red-100/20 rounded-full animate-pulse"></div>
    </div>

    <div class="mb-3 flex gap-2">
      <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
      <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
      <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
      <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
    </div>

    <div class="flex justify-center">
      <div class="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
    </div>
  </div>

  <!-- Previous matchdays skeleton -->
  <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">
    <div class="h-3 w-40 bg-white/10 rounded animate-pulse"></div>
  </h3>

  <div class="flex flex-col gap-6">
    {#each [1, 2, 3] as _}
      <div class="p-4 rounded-lg bg-white/10">
        <div class="mb-3 space-y-2">
          <div class="h-4 w-40 bg-white/15 rounded animate-pulse"></div>
          <div class="h-3 w-32 bg-white/10 rounded animate-pulse"></div>
        </div>

        <div class="mb-3 flex gap-2">
          <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
          <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
          <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
          <div class="h-8 w-16 bg-white/10 rounded-full animate-pulse"></div>
        </div>

        <div class="flex justify-center">
          <div class="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
        </div>
      </div>
    {/each}
  </div>
</section>

