<script lang="ts">
    import NavLink from './NavLink.svelte'
    import LanguageSwitcher from './LanguageSwitcher.svelte'
    import { page } from '$app/stores'
    import { t } from 'svelte-i18n'
  
    let open = false
    // Close mobile drawer on route changes
    $: $page.url, (open = false)
  
    const nav = [
      { href: '/sessions', labelKey: 'header.nav.sessions' },
      { href: '/reports', labelKey: 'header.nav.reports' },
      { href: '/settings', labelKey: 'header.nav.settings' }
    ] as const
  </script>
  
  <header class="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
    <div class="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
      <!-- Brand -->
      <a href="/" class="flex items-center gap-2 font-semibold" aria-label={$t('brand.title')}>
        <span class="text-xl">⚽</span>
        <span>{$t('brand.title')}</span>
      </a>
  
      <!-- Desktop nav -->
      <nav class="hidden md:flex items-center gap-1">
        {#each nav as n}
          <NavLink href={n.href} labelKey={n.labelKey} />
        {/each}
      </nav>
  
      <div class="hidden md:flex items-center gap-2">
        <LanguageSwitcher />
      </div>
  
      <!-- Mobile menu button -->
      <button
        class="md:hidden p-2 rounded-xl border"
        aria-label={$t('header.a11y.menu_button')}
        on:click={() => (open = !open)}
      >
        <div class="w-5 h-[2px] bg-black mb-1"></div>
        <div class="w-5 h-[2px] bg-black mb-1"></div>
        <div class="w-5 h-[2px] bg-black"></div>
      </button>
    </div>
  
    <!-- Mobile drawer -->
    {#if open}
      <div class="md:hidden border-t">
        <nav class="px-4 py-3 flex flex-col gap-1" aria-label={$t('header.a11y.primary_navigation')}>
          {#each nav as n}
            <NavLink href={n.href} labelKey={n.labelKey} />
          {/each}
          <div class="pt-2">
            <LanguageSwitcher />
          </div>
        </nav>
      </div>
    {/if}
  </header>