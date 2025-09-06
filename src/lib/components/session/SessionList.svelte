<script lang="ts">
    import { t } from 'svelte-i18n'
    import { observeLocalSessions, softDeleteLocalSession, toggleLocalSessionStatus } from '$lib/data/sessions'
    import {
      observeLocalMatchCounts,
      createLocalMatch,
      createLocalMatches,
      softDeleteLastLocalMatch
  } from '$lib/data/matches'
    import { canEdit } from '$lib/auth/auth'
    import { toasts as toast } from '$lib/ui/toast/store'

    const sessions = observeLocalSessions()
    const matchCounts = observeLocalMatchCounts()

    let busyId: string | null = null
    let toggleBusyId: string | null = null
    let addBusyId: string | null = null
    let addBusy = false
    let counts: Record<string, number> = {}
    let removeOneBusyId: string | null = null

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

    async function addOne(sessionId: string) {
      addBusyId = sessionId
      try {
        await createLocalMatch(sessionId)
        toast.success($t('session.match.toast.added_one'))
      } catch {
        toast.danger($t('session.match.toast.error'))
      } finally {
        addBusyId = null
      }
    }

    async function addFour(sessionId: string) {
    addBusy = true
      try {
        await createLocalMatches(sessionId, 4)
        toast.success($t('session.match.toast.added_four'))
      } catch {
        toast.danger($t('session.match.toast.error'))
      } finally {
        addBusy = false
      }
    }
    
    async function removeOne(sessionId: string) {
      removeOneBusyId = sessionId
      try {
        const res = await softDeleteLastLocalMatch(sessionId)
        if (res) toast.warning($t('session.match.toast.removed_one'))
        else toast.info($t('session.match.toast.nothing_to_remove'))
      } catch {
        toast.danger($t('session.match.toast.error'))
      } finally {
        removeOneBusyId = null
      }
    }

    $: canEditMatch = $canEdit
    $: counts = $matchCounts
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
          <!-- per-row match count store -->
          {@const count = counts[s.id] ?? 0}
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
              <!-- add 4: only when there are NO matches yet -->
              <button
                class="btn btn-primary"
                disabled={count > 0 || addBusyId === s.id}
                aria-busy={addBusyId === s.id ? 'true' : 'false'}
                on:click={() => addFour(s.id)}
                title={count > 0 ? $t('sesssion.match.hint.add_four_disabled') : ''}
                >
                {#if addBusyId === s.id}
                  <span class="spinner mr-1"></span>
                {/if}
                +4
              </button>
                <!-- add 1: always enabled -->
                <button
                  class="btn btn-primary"
                  disabled={addBusyId === s.id}
                  aria-busy={addBusyId === s.id ? 'true' : 'false'}
                  on:click={() => addOne(s.id)}
                  >
                  {#if addBusyId === s.id}
                    <span class="spinner mr-1"></span>
                  {/if}
                  +1
                </button>
                <!-- -1 (delete last match) -->
                <button
                  class="btn btn-danger"
                  disabled={count === 0 || removeOneBusyId === s.id}
                  aria-busy={removeOneBusyId === s.id ? 'true' : 'false'}
                  on:click={() => removeOne(s.id)}
                  title={count === 0 ? $t('session.match.hint.remove_one_disabled') : ''}
                >
                  {#if removeOneBusyId === s.id}<span class="spinner mr-1"></span>{/if}
                  −1
                </button>
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
  