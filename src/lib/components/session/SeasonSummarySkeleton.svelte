<script lang="ts">
  // No props needed - purely presentational loading state
</script>
<section class="w-full bg-white/5 px-4 py-12">
  <div class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl">
    <!-- "SEASON 2026" label skeleton -->
    <div class="mb-1 h-3 w-24 bg-white/10 rounded animate-pulse"></div>
    
    <!-- Large number + label -->
    <div class="flex items-baseline gap-3 mb-2">
      <div class="h-14 w-20 bg-white/10 rounded animate-pulse"></div>
      <div class="h-3 w-16 bg-white/10 rounded animate-pulse"></div>
    </div>
    
    <!-- Red divider line -->
    <div class="my-2 h-px w-8 bg-[#8B1A1A]"></div>
    
    <!-- Three columns with dividers -->
    <div class="mt-6 flex gap-6">
      <!-- Column 1: Matches -->
      <div class="space-y-1">
        <div class="h-6 w-12 bg-white/10 rounded animate-pulse"></div>
        <div class="h-2 w-16 bg-white/10 rounded animate-pulse"></div>
      </div>
      
      <!-- Divider -->
      <div class="w-px bg-red-400/30"></div>
      
      <!-- Column 2: Players -->
      <div class="space-y-1">
        <div class="h-6 w-12 bg-white/10 rounded animate-pulse"></div>
        <div class="h-2 w-16 bg-white/10 rounded animate-pulse"></div>
      </div>
      
      <!-- Divider -->
      <div class="w-px bg-red-400/30"></div>
      
      <!-- Column 3: Top Scorer -->
      <div class="space-y-1">
        <div class="h-6 w-20 bg-white/10 rounded animate-pulse"></div>
        <div class="h-2 w-24 bg-white/10 rounded animate-pulse"></div>
      </div>
    </div>
  </div>
</section>
<style>
  /* Light mode support - ready for future implementation */
  :global(.light-mode) section[class*="bg-white/5"] {
    /* Will be styled when light mode is implemented */
  }
</style>

