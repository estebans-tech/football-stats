<script lang="ts">
  // Comments in English
  import NavLink from './NavLink.svelte'
  import LanguageSwitcher from './LanguageSwitcher.svelte'
  import { page } from '$app/stores'
  import { t } from 'svelte-i18n'
  import { isAdmin, canEdit, profile } from '$lib/auth/auth' 

  // Svelte 5: use callback prop instead of createEventDispatcher
  export let onSync: (() => void) | undefined = undefined
  let open = false
  $: $page.url, (open = false)

  $: items = (
    $isAdmin ? [
      { href: '/admin', labelKey: 'header.nav.admin' },
      { href: '/settings', labelKey: 'header.nav.settings' }
    ]
    : $canEdit ? [
      { href: '/backup', labelKey: 'header.nav.backup' }
    ]
    : [
      { href: '/invite', labelKey: 'header.nav.invite' }
    ]
  )

  $: showSyncButton = $isAdmin || $canEdit
</script>

<header class="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
  <div class="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
    <!-- Brand -->
    <a href="/" class="flex items-center gap-2 font-semibold" aria-label={$t('brand.title')}>
      <span class="text-xl">⚽</span>
      <span>{$t('brand.title')}</span>
    </a>

    <!-- Desktop nav -->
    <nav class="hidden md:flex items-center gap-1" aria-label={$t('header.a11y.primary_navigation')}>
      {#each items as n}
        <NavLink href={n.href} labelKey={n.labelKey} />
      {/each}
    </nav>

    <div class="hidden md:flex items-center gap-2">
      {#if showSyncButton}
        <!-- Uses your .btn class from app.css -->
        <button class="btn" aria-label={$t('header.actions.sync')} on:click={() => onSync?.()}>
          {$t('header.actions.sync')}
        </button>
      {/if}
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
        {#each items as n}
          <NavLink href={n.href} labelKey={n.labelKey} />
        {/each}
        <div class="pt-2 flex items-center gap-2">
          {#if showSyncButton}
            <button class="btn w-full" aria-label={$t('header.actions.sync')} on:click={() => onSync?.()}>
              {$t('header.actions.sync')}
            </button>
            {/if}
            <button class="btn w-full" aria-label={$t('header.actions.sync')} on:click={() => onSync?.()}>
              {$t('header.actions.sync')}
            </button>
          <LanguageSwitcher />
        </div>
      </nav>
    </div>
  {/if}
</header>
