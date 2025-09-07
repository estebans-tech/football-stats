<script lang="ts">
  import NavLink from '$lib/components/NavLink.svelte'
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte'
  import { page } from '$app/stores'
  import { t } from 'svelte-i18n'
  import { isAdmin, canEdit, signOut } from '$lib/auth/auth'
  import { goto } from '$app/navigation'

  // Svelte 5: use callback prop instead of createEventDispatcher
  export let onSync: (() => void) | undefined = undefined
  export const syncBusy: boolean = false

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
  $: showLogout = $isAdmin || $canEdit

  async function handleLogout() {
    await signOut()
    await goto('/')  // tillbaka till start
  }
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
        <button class="btn btn-outline" aria-label={$t('header.actions.sync')} on:click={() => onSync?.()}>
          {$t('header.actions.sync')}
        </button>
      {/if}
      {#if showLogout}
        <button class="btn btn-danger w-full active:translate-y-[1px]
         focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2
         transition-colors disabled:opacity-50 disabled:pointer-events-none" aria-label={$t('header.actions.sync')} on:click={handleLogout}>
          {$t('header.actions.logout')}
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
            {#if showLogout}
              <button class="btn btn-danger w-full" aria-label={$t('header.actions.sync')} on:click={handleLogout}>
                {$t('header.actions.logout')}
              </button>
            {/if}    
          <LanguageSwitcher />
        </div>
      </nav>
    </div>
  {/if}
</header>
