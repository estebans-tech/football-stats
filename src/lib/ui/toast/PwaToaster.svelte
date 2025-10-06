<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { t } from 'svelte-i18n';
  import { toasts } from '$lib/ui/toast/store';

  function onUpdateAvailable() {
    const msg = $t('pwa.update_available') ?? 'New version available. Update now?';
    toasts.info(msg, 6000);
    if (typeof window !== 'undefined' && confirm(msg)) {
      (window as any).$pwaUpdate?.();
    }
  }

  function onOfflineReady() {
    const msg = $t('pwa.offline_ready') ?? 'App is ready to work offline';
    toasts.success(msg, 4000);
  }

  // Kör endast i browsern
  if (browser) {
    onMount(() => {
      window.addEventListener('pwa:update-available', onUpdateAvailable);
      window.addEventListener('pwa:offline-ready', onOfflineReady);
    })

    onDestroy(() => {
      window.removeEventListener('pwa:update-available', onUpdateAvailable);
      window.removeEventListener('pwa:offline-ready', onOfflineReady);
    })
  }
  </script>