<script lang="ts">
  import { onMount } from 'svelte'
  // import Header from '$lib/components/HeaderLegacy.svelte'
  import Header from '$lib/components/Header.svelte'
  import ToastHost from '$lib/ui/toast/ToastHost.svelte'
  import { toasts as toast } from '$lib/ui/toast/store'
  import { syncPlayers } from '$lib/sync/players' 
  import { profile } from '$lib/auth/store'
  import { writeProfileToLS } from '$lib/auth/profileStorage' 
  import { syncGames } from '$lib/sync/games'
  import { t } from 'svelte-i18n'
  import { page } from '$app/state'

  import type { Snippet } from 'svelte'
  // Styles
  import '../app.css'

  const { data, children } = $props<{
    data: { role: 'anon' | 'viewer' | 'editor' | 'admin' }
    children: Snippet
  }>()
  const current = $derived(page.url.pathname)
  type NavItem = { href: string; labelKey: string; label?: string }
  const baseNav: NavItem[]  = [{ href: '/',        labelKey: 'Home' }]
  const nonAuthNav: NavItem[]  = [{ href: '/invite',  labelKey: 'header.nav.invite' }]
  const editorNav: NavItem[]= [{ href: '/players', labelKey: 'header.nav.players' }]
  const adminNav: NavItem[] = [{ href: '/settings',labelKey: 'header.nav.settings' }]

  const nav = $derived([
    ...baseNav,
    ...(data.role !== 'anon' ? [] : nonAuthNav),
    ...(data.role === 'editor' || data.role === 'admin' ? editorNav : []),
    ...(data.role === 'admin' ? adminNav : [])
  ].map(i => ({ ...i, label: $t ? $t(i.labelKey) : i.labelKey })))

  let syncing = $state(false)
  let menuOpen = $state(false)

  async function handleSync() {
    if (syncing) return
    syncing = true

    try {
      toast.info($t('sync.players.start'))
      const { pushed, pulled } = await syncPlayers()
      toast.success($t('sync.players.done', { values: { pushed, pulled } }))
      toast.info($t('sync.games.start'))
      const games = await syncGames()
      toast.success($t('sync.games.done', { values: games }))
    } catch (e) {
      toast.danger($t('sync.error'))
    } finally {
      syncing = false
    }
  }

  onMount(() => {
    const unsub = profile.subscribe((p) => writeProfileToLS(p ?? null));
    return () => unsub();
  })
</script>

<Header {nav} title={$t('brand.title')} role={data.role} {current} onSync={() => {handleSync()}} syncBusy={syncing} bind:open={menuOpen} />

<main class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl px-4 md:px-6">
   {@render children()}
</main>

<footer></footer>
<ToastHost />
