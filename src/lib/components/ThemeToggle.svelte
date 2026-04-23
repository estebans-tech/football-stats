<script lang="ts">
  import { Sun, Moon } from 'lucide-svelte'
  import { theme } from '$lib/theme/store'

  const currentTheme = $derived($theme)
  const isLight = $derived(currentTheme === 'light')
</script>

<button
  onclick={() => theme.toggle()}
  class="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
         {isLight 
           ? 'border border-gray-200 text-gray-900 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-400' 
           : 'border border-white/15 bg-transparent text-white hover:bg-white/10 active:bg-white/15 focus-visible:ring-white/40'}"
  aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
  title={isLight ? 'Dark mode' : 'Light mode'}
>
  {#if isLight}
    <Moon size={20} />
  {:else}
    <Sun size={20} />
  {/if}
</button>

