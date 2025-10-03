<script lang="ts">
  import { onMount } from 'svelte'
  import NavLink from '$lib/components/NavLink.svelte'
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { t } from 'svelte-i18n'
  import { isAdmin, canEditFromRole } from '$lib/auth/helpers';

  import type { Role } from '$lib/types/auth'

  export const syncBusy: boolean = false
  export let onSync: (() => void) | undefined = undefined

  let open = false

  $: currentRole = ((page.data.role ?? 'anon') as Role); // cast as rRole
  $: showAdmin = isAdmin(currentRole);
  $: showEditor = !showAdmin && canEditFromRole(page.data.role);
  $: showBoth = showAdmin || showEditor;

  $: items = (
    showAdmin ? [
      { href: '/admin/players', labelKey: 'header.nav.players' },
      { href: '/admin', labelKey: 'header.nav.admin' },
      { href: '/settings', labelKey: 'header.nav.settings' }
    ]
    : showEditor ? [
      { href: '/admin/players', labelKey: 'header.nav.players' }
    ]
    : [
      { href: '/invite', labelKey: 'header.nav.invite' }
    ]
  )

  async function handleLogout() {
    // await signOut()
    await goto('/')  // tillbaka till start
  }

  let scrolled = false

  onMount(() => {
    const onScroll = () => (scrolled = window.scrollY > 4)
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  })
</script>

<!-- <header class="sticky top-0 z-40 bg-white/80 backdrop-blur border-b"> -->
<header class="sticky top-0 z-40 bg-[var(--kk-black)] text-[var(--kk-ivory)]" style="padding-top: env(safe-area-inset-top)">
  
  <div
    class="px-4 flex items-center justify-between"
    class:py-3={scrolled}
    class:py-5.5={!scrolled}>
    <!-- Brand -->
    <a href="/" class="flex items-center text-[var(--kk-ivory)] gap-2 font-semibold text-base tracking-wide" aria-label={$t('brand.title')}>
      <!-- <div class="size-6 rounded-full ring-1 ring-[var(--kk-ivory)]/40 overflow-hidden bg-[var(--kk-black)] text-center" class:opacity-0={scrolled}> -->
      <!-- </div> -->
      <div class="flex items-center gap-3 min-w-0">
        <span class="rounded-full transition-opacity duration-200">⚽</span>
        <h1 class="truncate tracking-wide transition-[letter-spacing,font-weight] duration-200 text-base"
        class:font-semibold={!scrolled}
        class:font-bold={scrolled}>{$t('brand.title')}</h1>        
      </div>

    </a>

    <!-- Desktop nav -->
    <nav class="hidden md:flex items-center gap-1" aria-label={$t('header.a11y.primary_navigation')}>
      {#each items as n}
        <NavLink href={n.href} labelKey={n.labelKey} />
      {/each}
    </nav>

    <div class="hidden md:flex items-center gap-2">
      {#if showBoth}
        <!-- Uses your .btn class from app.css -->
        <button class="btn btn-outline !text-white" aria-label={$t('header.actions.sync')} onclick={() => onSync?.()}>
          {$t('header.actions.sync')}
        </button>
      {/if}
      {#if showAdmin}
        <LanguageSwitcher />
      {/if}

      {#if showBoth}
        <form method="POST" action="/logout">
          <button class="btn btn-danger w-full active:translate-y-[1px]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2
          transition-colors disabled:opacity-50 disabled:pointer-events-none" aria-label={$t('header.actions.sync')}>
            {$t('header.actions.logout')}
          </button>
        </form>
      {/if}

    </div>

    <!-- Mobile menu button -->
    <button class="md:hidden h-8 w-8 grid place-content-center rounded-lg
             ring-1 ring-red-900/45 bg-black/40
             transition duration-150 active:scale-95
             focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-900
             hover:shadow-[0_0_0_3px_rgba(127,29,29,.20)]"
      aria-label={$t('header.a11y.menu_button')}
      onclick={() => (open = !open)}
    >
      <div class="w-4 h-[2px] bg-red-700 mb-1"></div>
      <div class="w-4 h-[2px] bg-red-700 mb-1"></div>
      <div class="w-4 h-[2px] bg-red-700"></div>
    </button>
  </div>

  <!-- Mobile drawer -->
  {#if open}
    <div class="md:hidden">
      <nav class="px-4 py-3 flex flex-col gap-1" aria-label={$t('header.a11y.primary_navigation')}>
        {#each items as n}
          <NavLink href={n.href} labelKey={n.labelKey} />
        {/each}
        <div class="pt-2 flex items-center gap-2">
          {#if showAdmin}
            <button class="btn w-full" aria-label={$t('header.actions.sync')} onclick={() => onSync?.()}>
              {$t('header.actions.sync')}
            </button>
          {/if}
          {#if showBoth}
            <form method="POST" action="/logout">
              <button class="btn btn-danger w-full" aria-label={$t('header.actions.sync')} onclick={handleLogout}>
                {$t('header.actions.logout')}
              </button>
            </form>
          {/if}
          {#if showAdmin}
            <LanguageSwitcher />
          {/if}
        </div>
      </nav>
    </div>
  {/if}
  <div class="h-px bg-[var(--kk-ivory)]/10"></div>
</header>
