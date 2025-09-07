<script lang="ts">
  import Header from '$lib/components/Header.svelte'
  import ToastHost from '$lib/ui/toast/ToastHost.svelte'
  import { toasts as toast } from '$lib/ui/toast/store'
  import { syncPlayers } from '$lib/sync/players' 
  import { syncGames } from '$lib/sync/games'
  import { t } from 'svelte-i18n'

  import '../app.css'

  let syncing = false

  async function handleSync() {
    if (syncing) return
    syncing = true
    try {
      toast.info($t('sync.players.start'))
      const { pushed, pulled } = await syncPlayers()
      toast.info($t('sync.games.start'))
      const g = await syncGames()
      toast.success($t('sync.games.done', { values: g }))
      toast.success($t('sync.players.done', { values: { pushed, pulled } }))
    } catch (e) {
      console.error(e)
      toast.danger($t('sync.error'))
    } finally {
      syncing = false
    }
  }
</script>


<Header onSync={handleSync} syncBusy={syncing} />

<main class="max-w-3xl mx-auto px-4 py-6">
  <ToastHost />
  <slot />
</main>
