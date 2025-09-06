<script lang="ts">
    import { toasts } from './store'
    import ToastItem from './ToastItem.svelte'
  </script>
  
  <div class="pointer-events-none fixed inset-0 z-[100] flex flex-col items-end p-4 gap-2">
    {#each $toasts as toast (toast.id)}
      <div
        class="pointer-events-auto
               {toast.variant === 'success' ? 'border-emerald-200' : ''}
               {toast.variant === 'warning' ? 'border-amber-200' : ''}
               {toast.variant === 'danger'  ? 'border-red-200'    : ''}
               {toast.variant === 'info'    ? 'border-blue-200'   : ''}"
      >
        <ToastItem {toast} />
      </div>
    {/each}
  </div>
  