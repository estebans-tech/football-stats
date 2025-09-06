<script lang="ts">
    import { t } from 'svelte-i18n'
    import { observeLocalSessions, softDeleteLocalSession, toggleLocalSessionStatus } from '$lib/data/sessions'
    import { canEdit } from '$lib/auth/auth'
    import { toasts as toast } from '$lib/ui/toast/store'

    const sessions = observeLocalSessions()
    let busyId: string | null = null
    let toggleBusyId: string | null = null

    async function remove(id: string, date: string) {
      const ok = confirm($t('session.delete_confirm'))
      if (!ok) return
      busyId = id
      try {
        await softDeleteLocalSession(id)
        // valfritt: visa en toast med $t('session.deleted_success')
      } catch {
        // valfritt: toast $t('errors.delete_failed') om du har den nyckeln
      } finally {
        busyId = null
      }
    }

    async function toggleStatus(id: string, date: string) {
      toggleBusyId = id
      try {
        const next = await toggleLocalSessionStatus(id)
        if (next === 'locked') {
          toast.success($t('session.toast.locked', { values: {date} }))
        } else {
          toast.success($t('session.toast.unlocked', { values: {date} }))
        }
      } catch (e) {
        toast.danger($t('session.toast.error'))
      } finally {
        toggleBusyId = null
      }
    }
    $: canEditMatch = $canEdit
  </script>
  
  <section class="mx-auto max-w-2xl w-full">
    <h2 class="text-lg font-semibold mb-3">{$t('session.list.title')}</h2>
  
    {#if $sessions.length === 0}
      <div class="rounded-xl border border-gray-300 p-4 text-sm text-gray-600 bg-white">
        {$t('session.list.empty')}
      </div>
    {:else}
      <div class="space-y-2">
          {#each $sessions as s (s.id)}
          <div
          class={`rounded-xl border bg-white px-4 py-3 flex items-center justify-between p-4 mb-6 
                ${(s.status === 'locked' && canEditMatch)
                ? 'border-green-500'
                : 'border-gray-300'
                }`}>
            <div class="flex items-center gap-2">
              <!-- date -->
              <div class="font-medium">{s.date}</div>
              {#if s.status !== 'locked' && canEditMatch}
                <span class="text-xs px-2 py-0.5 rounded-full border">
                  {$t('session.status.locked')}
                </span>
              {/if}
            </div>
  
            <div class="flex items-center gap-2">
                <button
                class="btn {s.status === 'locked' ? 'btn-warning' : 'btn-soft'}"
                disabled={toggleBusyId === s.id}
                on:click={() => toggleStatus(s.id, s.date)}
                aria-busy={toggleBusyId === s.id ? 'true' : 'false'}
              >
                {#if toggleBusyId === s.id}
                  <span class="inline-block h-4 w-4 mr-1 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></span>
                {/if}
                🔒 <span class="hidden sm:block ">{s.status === 'locked' ? $t('session.list.lock') : $t('session.list.unlock')}</span>
              </button>
  
              <button
                class="btn btn-danger"
                disabled={busyId === s.id}
                on:click={() => remove(s.id, s.date)}
              >
                {#if busyId === s.id}
                  <span class="inline-block h-4 w-4 mr-1 animate-spin rounded-full border-2 border-white/60 border-t-transparent"></span>
                {/if}
                🗑 <span class="hidden sm:block ">{$t('session.list.delete')}</span>
              </button>
            </div>
        </div>
        {/each}
    </div>
    {/if}
  </section>
  