<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte'
  import ToastHost from '$lib/ui/toast/ToastHost.svelte'
  import { toasts as toast } from '$lib/ui/toast/store'
  import { syncPlayers } from '$lib/sync/players' 
  import { profile } from '$lib/auth/store'
  import { writeProfileToLS } from '$lib/auth/profileStorage' 
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

<Header onSync={handleSync} syncBusy={syncing} />

<main class="mx-auto w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl px-4 md:px-6">
  <slot />
</main>

<footer></footer>
<ToastHost />
