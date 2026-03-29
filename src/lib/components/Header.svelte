<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte'
  import { t } from 'svelte-i18n'
  import { Menu, Users, RefreshCw, LogOut, Settings, Globe } from 'lucide-svelte'
  import type { Role } from '$lib/types/auth'
  
  type Props = {
    title?: string
    current?: string
    nav?: { href: string; label: string, labelKey?: string }[]
    open?: boolean
    syncBusy?: boolean
    role: Role
    onSync?: () => void | undefined
  }
  
  let { title = '', nav = [], current = '/', open = $bindable(), role = 'anon', onSync, syncBusy = false }: Props = $props()
  
  afterNavigate(() => {
    open = false;
  })
  
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open = false; }
</script>

<svelte:window on:keydown={onKey} />

<header class="sticky top-0 z-40 bg-[#1a1a1a] text-white">
  <div class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl px-4 md:px-6 h-14 flex items-center justify-between">
    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 font-semibold uppercase">
      <span class="inline-grid size-5 place-items-center rounded-full bg-red-900 text-black text-[14px] ring ring-1 ring-black/80">⚽</span>
      <span>{title}</span>
    </a>

    <!-- Desktop actions -->
    <nav class="hidden sm:flex items-center gap-2">
      {#if role === 'anon'}
        <!-- Redeem button for anonymous users -->
        <a 
          href="/invite" 
          class="px-4 py-2 text-sm font-medium rounded-lg border border-white/20 hover:bg-white/10 transition-colors">
          {$t('header.actions.redeem')}
        </a>
      {:else}
        <!-- Icon navigation for authenticated users -->
        <a 
          href="/players" 
          class="inline-flex items-center justify-center size-10 rounded-lg hover:bg-white/10 transition-colors"
          aria-label={$t('header.nav.players')}>
          <Users size={20} />
        </a>

        <button 
          type="button" 
          onclick={() => onSync?.()} 
          class="inline-flex items-center justify-center size-10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          disabled={syncBusy}
          aria-label={$t('header.actions.sync')}>
          <RefreshCw size={20} class={syncBusy ? 'animate-spin' : ''} />
        </button>

        {#if role === 'admin'}
          <a 
            href="/settings" 
            class="inline-flex items-center justify-center size-10 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={$t('header.nav.settings')}>
            <Settings size={20} />
          </a>

          <!-- Language switcher dropdown -->
          <div class="relative">
            <LanguageSwitcher />
          </div>
        {/if}

        <!-- Logout -->
        <form method="POST" action="/logout">
          <button 
            type="submit"
            class="inline-flex items-center justify-center size-10 rounded-lg hover:bg-red-600/20 hover:text-red-400 transition-colors"
            aria-label={$t('header.actions.logout')}>
            <LogOut size={20} />
          </button>
        </form>
      {/if}
    </nav>

    <!-- Mobile toggle -->
    <button
      type="button"
      class="sm:hidden inline-flex items-center justify-center size-10 rounded-lg border border-white/10 hover:bg-white/5 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="Open menu"
      aria-expanded={open}
      onclick={() => (open = !open)}>
      <Menu size={20} />
    </button>
  </div>

  <!-- Mobile drawer -->
  {#if open}
    <div class="sm:hidden border-t border-white/10">
      <nav class="mx-auto w-full max-w-screen-sm px-4 py-3 flex flex-col gap-2">
        {#if role === 'anon'}
          <a 
            href="/redeem" 
            class="px-4 py-3 text-sm font-medium rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-center">
            {$t('header.actions.redeem')}
          </a>
        {:else}
          <a 
            href="/players" 
            class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <Users size={20} />
            <span class="text-sm font-medium">{$t('header.nav.players')}</span>
          </a>

          <button 
            type="button" 
            onclick={() => onSync?.()} 
            class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            disabled={syncBusy}>
            <RefreshCw size={20} class={syncBusy ? 'animate-spin' : ''} />
            <span class="text-sm font-medium">{$t('header.actions.sync')}</span>
          </button>

          {#if role === 'admin'}
            <a 
              href="/settings" 
              class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <Settings size={20} />
              <span class="text-sm font-medium">{$t('header.nav.settings')}</span>
            </a>

            <LanguageSwitcher variant="list" />
          {/if}

          <!-- Logout in mobile -->
          <form method="POST" action="/logout" class="border-t border-white/10 pt-2 mt-2">
            <button 
              type="submit"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600/20 hover:text-red-400 transition-colors">
              <LogOut size={20} />
              <span class="text-sm font-medium">{$t('header.actions.logout')}</span>
            </button>
          </form>
        {/if}
      </nav>
    </div>
  {/if}
</header>
