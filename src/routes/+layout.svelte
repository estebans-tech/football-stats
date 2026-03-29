<script lang="ts">
  import { onMount } from 'svelte'
  import Header from '$lib/components/Header.svelte'
  import ToastHost from '$lib/ui/toast/ToastHost.svelte'
  import PwaToaster from '$lib/ui/toast/PwaToaster.svelte'
  import { toasts as toast } from '$lib/ui/toast/store'
  import { syncPlayers } from '$lib/sync/players' 
  import { profile } from '$lib/auth/store'
  import { writeProfileToLS } from '$lib/auth/profileStorage' 
  import { syncGames } from '$lib/sync/games'
  import { t } from 'svelte-i18n'

  import type { Snippet } from 'svelte'
  // Styles
  import '../app.css'

  const { data, children } = $props<{
    data: { role: 'anon' | 'viewer' | 'editor' | 'admin' }
    children: Snippet
  }>()

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

<Header title={$t('brand.title')} role={data.role} onSync={() => {handleSync()}} syncBusy={syncing} bind:open={menuOpen} />

<main class="w-full py-3">
   {@render children()}
</main>

<footer class="h-24"></footer>
<ToastHost />
<PwaToaster />

