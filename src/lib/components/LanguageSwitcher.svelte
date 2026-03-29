<script lang="ts">
  import { t, locale } from 'svelte-i18n'
  import { Globe } from 'lucide-svelte'
  import { SUPPORTED_LOCALES, type LocaleCode } from '$lib/i18n/types'
  
  type Props = {
    variant?: 'icon' | 'list' // ← Ny prop
  }
  
  let { variant = 'icon' }: Props = $props()
  
  let open = $state(false)
  const current = $derived(($locale as any) ?? 'sv') as LocaleCode
  
  const languages = $derived(
    SUPPORTED_LOCALES.map(code => ({
      code,
      label: $t(`lang.${code}`)
    }))
  )
  
  let dropdownEl: HTMLDivElement
  const handleClickOutside = (e: MouseEvent) => {
    if (open && dropdownEl && !dropdownEl.contains(e.target as Node)) {
      open = false
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if variant === 'icon'}
  <!-- Desktop: Icon + dropdown -->
  <div class="relative" bind:this={dropdownEl}>
    <button
      type="button"
      class="inline-flex items-center justify-center size-10 rounded-lg hover:bg-white/10 transition-colors"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={$t('header.nav.language')}
      onclick={() => (open = !open)}>
      <Globe size={20} />
    </button>
    
    {#if open}
      <div
        class="absolute right-0 mt-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg py-1"
        role="listbox"
        aria-label={$t('header.nav.language')}>
        {#each languages as lang}
          <a
            href="/lang/{lang.code}"
            class="w-full block px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors {current === lang.code ? 'font-semibold bg-white/5' : ''}">
            {lang.label}
          </a>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <!-- Mobile: List with text labels -->
  <div class="border-t border-white/10 pt-2 mt-2">
    <p class="px-4 py-2 text-xs text-white/50 uppercase tracking-wide">{$t('header.nav.language')}</p>
    {#each languages as lang}
      <a
        href="/lang/{lang.code}"
        class="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors {current === lang.code ? 'font-semibold bg-white/5' : ''}">
        <Globe size={20} />
        <span class="text-sm">{lang.label}</span>
      </a>
    {/each}
  </div>
{/if}

