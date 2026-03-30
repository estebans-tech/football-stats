<script lang="ts">
  import { t } from 'svelte-i18n'
  import { Calendar } from 'lucide-svelte'
</script>

<div class="flex flex-col items-center justify-center py-16 px-4">
  <div class="rounded-full bg-white/5 p-6 mb-4">
    <Calendar size={48} class="text-white/30" aria-hidden="true" />
  </div>
  
  <h3 class="text-lg font-semibold text-white mb-2">
    {$t('session.list.empty_title')}
  </h3>
  
  <p class="text-sm text-white/50 text-center max-w-sm">
    {$t('session.list.empty_description')}
  </p>
</div>
<style>
  /* Light mode support - ready for future implementation */
  :global(.light-mode) div[class*="bg-white/5"] {
    background-color: rgb(243 244 246); /* gray-100 */
  }
  
  :global(.light-mode) h3 {
    color: rgb(17 24 39); /* gray-900 */
  }
  
  :global(.light-mode) p[class*="text-white/50"] {
    color: rgb(107 114 128); /* gray-500 */
  }
</style>
