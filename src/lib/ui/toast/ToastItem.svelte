<script lang="ts">
    import type { Toast } from './types'
    import { toasts } from './store'
    import { onMount, onDestroy } from 'svelte'
    import { t } from 'svelte-i18n'
  
    export let toast!: Toast
  
    let timer: ReturnType<typeof setTimeout> | null = null
    let remaining = toast.timeout
    let startedAt = 0
  
    function start() {
      if (remaining <= 0) return
      startedAt = Date.now()
      timer = setTimeout(() => toasts.dismiss(toast.id), remaining)
    }
    function pause() {
      if (!timer) return
      clearTimeout(timer)
      timer = null
      remaining -= Date.now() - startedAt
    }
    function resume() {
      if (timer || remaining <= 0) return
      start()
    }
  
    onMount(start)
    onDestroy(() => { if (timer) clearTimeout(timer) })
  
    $: role = toast.variant === 'danger' ? 'alert' : 'status'
  </script>
  
  <div
    role={role}
    aria-live="polite"
    on:mouseenter={pause}
    on:mouseleave={resume}
    class="rounded-xl border bg-white shadow p-3 pl-3 pr-2 min-w-[240px] max-w-[360px]
           flex items-start gap-2"
  >
    <div class="mt-0.5 text-lg">
      {#if toast.variant === 'success'} ✅
      {:else if toast.variant === 'warning'} ⚠️
      {:else if toast.variant === 'danger'} ⛔️
      {:else} ℹ️
      {/if}
    </div>
  
    <div class="text-sm leading-snug flex-1">{toast.message}</div>
  
    <button
      class="btn btn-ghost btn-sm -m-1"
      aria-label={$t('a11y.close')}
      on:click={() => toasts.dismiss(toast.id)}
    >
      ✕
    </button>
  </div>
  