<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte'
  import { t } from 'svelte-i18n'
  import { Menu } from 'lucide-svelte' // valfritt, byt ikon om du vill
  import type { Role } from '$lib/types/auth'

  type Props = {
    title?: string
    current?: string
    nav?: { href: string; label: string, labelKey?: string }[]
    open?: boolean
    syncBusy?: boolean
    role: Role
    onSync?: () => void  | undefined
  }

  let { title = '', nav = [], current = '/', open = $bindable(), role = 'anon', onSync, syncBusy = false }: Props = $props()

  afterNavigate(() => {
    open = false;
  })
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open = false; }
</script>

<svelte:window on:keydown={onKey} />
<header class="sticky top-0 z-40 bg-black text-white">
  <div class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl px-4 md:px-6 h-14 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 font-semibold">
      <span class="inline-grid size-5 place-items-center rounded-full bg-white text-black text-[14px] ring ring-1 ring-black/80">⚽</span>
      <span>{title}</span>
    </a>

    <!-- Desktop-nav -->
    <nav class="hidden sm:flex items-center gap-1 whitespace-nowrap">
      {#each nav as item}
        <a
          href={item.href}
          class="px-3 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10
                 {current === item.href ? 'font-semibold bg-white/10' : ''}">
          {item.label}
        </a>
      {/each}

      {#if role === 'admin' || role === 'editor'}
        <button type="button" class="btn btn-utility btn-block btn-sm hover:!bg-red-600/20 hover:!text-white/90" aria-label={$t('header.actions.sync')} onclick={() => onSync?.()}>
          {#if syncBusy}<span class="spinner mr-1"></span>{/if}{$t('header.actions.sync')}
        </button>
      {/if}

      {#if role === 'admin'}
        <LanguageSwitcher />
      {/if}

      {#if role !== 'anon'}
        <form method="POST" action="/logout">
          <button class="btn btn-danger btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2" aria-label={$t('header.actions.sync')}>
            {$t('header.actions.logout')}
          </button>
        </form>
      {/if}
    </nav>

    <!-- Mobile toggle -->
    <button
      type="button"
      class="md:hidden inline-flex items-center justify-center size-10 rounded-lg border border-white/10 hover:bg-white/5 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="Open menu"
      aria-expanded={open}
      onclick={() => (open = !open)}>
      <Menu size={20} />
    </button>
  </div>

  <!-- Mobile drawer -->
  {#if open}
    <div class="md:hidden border-t border-white/10">
      <nav class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl px-4 md:px-6 py-2 flex flex-col gap-1">
        {#each nav as item}
          <a
            href={item.href}
            class="px-3 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10
                   {current === item.href ? 'font-semibold bg-white/10' : ''}">
            {item.label}
          </a>
        {/each}

        {#if role === 'admin' || role === 'editor'}
          <button type="button" class="btn btn-utility btn-block btn-sm  hover:!bg-red-600/20 hover:!text-white/90" aria-label={$t('header.actions.sync')} onclick={() => onSync?.()}>
            {#if syncBusy}<span class="spinner mr-1"></span>{/if}{$t('header.actions.sync')}
          </button>
        {/if}

        {#if role === 'admin'}
          <LanguageSwitcher />
        {/if}

        {#if role !== 'anon'}
        <form method="POST" action="/logout" class="mt-2">
          <button class="my-1 btn btn-danger btn-block btn-sm" aria-label={$t('header.actions.sync')}>
            {$t('header.actions.logout')}
          </button>
        </form>
        {/if}
      </nav>
    </div>
  {/if}
</header>