/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

// En enda registrering + events
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa:update-available'))
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pwa:offline-ready'))
  }
});

// gör enkel åtkomst från UI
(window as any).$pwaUpdate = updateSW;

export {};