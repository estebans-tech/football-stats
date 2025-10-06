<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { toasts } from '$lib/ui/toast/store';
  
    // 1) Ny version finns → visa toast + fråga om uppdatering
    function onUpdateAvailable() {
      const msg = 'Ny version finns. Uppdatera nu?';
      toasts.info(msg, 6000);          // din store: (message, timeout?)
  
      // enkel “action” via confirm (eftersom toasten saknar knappar)
      if (confirm(msg)) {
        // satt i hooks.client.ts
        (window as any).$pwaUpdate?.();
      }
    }
  
    // 2) Offline redo → informativ toast
    function onOfflineReady() {
      toasts.success('Appen är redo att användas offline', 4000);
    }
  
    onMount(() => {
      window.addEventListener('pwa:update-available', onUpdateAvailable);
      window.addEventListener('pwa:offline-ready', onOfflineReady);
    });
  
    onDestroy(() => {
      window.removeEventListener('pwa:update-available', onUpdateAvailable);
      window.removeEventListener('pwa:offline-ready', onOfflineReady);
    });
  </script>