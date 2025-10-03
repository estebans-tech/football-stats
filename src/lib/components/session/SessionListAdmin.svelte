<script lang="ts">
    import { t } from 'svelte-i18n'
    import { Lock, Trash2, Minus, ChartNoAxesColumn } from 'lucide-svelte'
    import { observeLocalSessions, softDeleteLocalSession, toggleLocalSessionStatus } from '$lib/data/sessions'
    import {
      observeLocalMatchCounts,
      createLocalMatch,
      createLocalMatches,
      observeLocalMatchesMap,
      deleteMatchLocal
  } from '$lib/data/matches'
    import { toasts as toast } from '$lib/ui/toast/store'
    import { canEdit, isAdmin } from '$lib/auth/client'

    import type { MatchLocal } from '$lib/types/domain'

    const sessions = observeLocalSessions()
    const matchCounts = observeLocalMatchCounts()
    const matchesMap = observeLocalMatchesMap()

    let busyId: string | null = null
    let toggleBusyId: string | null = null
    let addBusyId: string | null = null
    let counts: Record<string, number> = {}
    let removeMatchBusyId: string | null = null
    let bySession: Record<string, import('$lib/types/domain').MatchLocal[]> = {}
    let matchesBySession: Record<string, MatchLocal[]> = {}

    $: counts = $matchCounts
    $: bySession = $matchesMap
    $: matchesBySession = $matchesMap
    $: isEditor = canEdit()
    $: isAdministrator = isAdmin()

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
      addBusyId = sessionId
      try {
        await createLocalMatches(sessionId, 4)
        toast.success($t('session.match.toast.added_four'))
      } catch {
        toast.danger($t('session.match.toast.error'))
      } finally {
        addBusyId = null
      }
    }
    
    async function onRemoveMatch(sessionId: string, matchId: string) {
      const ok = confirm($t('session.match.delete_confirm'))
      if (!ok) return
      removeMatchBusyId = matchId
      try {
        const res = await deleteMatchLocal(sessionId, matchId)
        if (res) toast.warning($t('session.match.toast.removed_one'))
        else toast.info($t('session.match.toast.nothing_to_remove'))
      } catch {
        toast.danger($t('session.match.toast.error'))
      } finally {
        removeMatchBusyId = null
      }
    }
</script>

<div class="mx-auto max-w-2xl w-full">
  {#if $sessions.length === 0}
    <div class="rounded-xl border border-gray-300 p-4 text-sm text-gray-600 bg-white">
      {$t('session.list.empty')}
    </div>
  {:else}
    {#each $sessions as s (s.id)}
    {@const count = counts[s.id] ?? 0}
    {@const matches = matchesBySession[s.id] ?? []}
    <section class="rounded-2xl bg-white ring-1 ring-black/10 relative overflow-hidden mt-3">
      <!-- röd accentkant som på övriga kort -->
      <span class="absolute left-0 top-3 bottom-3 w-1.5 rounded-full {s.status === 'open' ? 'bg-red-900' : 'bg-black/20'}"></span>
      <!-- Header -->
      <header class="px-4 md:px-5 py-3 md:py-4 min-h-[3.25rem] flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <!-- titel + locked-chip -->
        <div class="flex items-center gap-2">
          {#if s.status === 'locked'}
            <span class="inline-flex items-center gap-1 rounded-full border border-black/15 bg-black/[.04] px-2 py-0.5 text-xs text-black/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="shrink-0" aria-hidden="true">
                <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="2" />
                <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
              </svg>
              {$t('session.status.locked')}
            </span>
          {/if}
          <h3 class="text-xl font-semibold tabular-nums">{s.date}</h3>
        </div>

        <!-- Admin-verktyg (utan handlers) -->
        <div class="flex flex-wrap items-center gap-2 md:gap-2.5" role="group" aria-label="Actions">
          {#if s.status === 'open'}
            <button
              type="button"
              class="btn btn-soft btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
              disabled={count > 0 || addBusyId === s.id}
              aria-busy={addBusyId === s.id}
              aria-label="+4"
              onclick={() => addFour(s.id)}
              title={count > 0 ? $t('session.match.hint.add_four_disabled') : ''}
              >
              {#if addBusyId === s.id}<span class="spinner mr-1"></span>{/if}
              +4
            </button>
    
            <button
              type="button"
              class="btn btn-soft btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
              disabled={addBusyId === s.id}
              aria-busy={addBusyId === s.id}
              aria-label="+1"
              onclick={() => addOne(s.id)}>
              {#if addBusyId === s.id}<span class="spinner mr-1"></span>{/if}
              +1
            </button>
          {/if}
    
          <button
            type="button"
            class="btn btn-sm {s.status === 'open' ? 'btn-warning' : 'btn-soft'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
            disabled={toggleBusyId === s.id}
            aria-busy={toggleBusyId === s.id}
            onclick={() => toggleStatus(s.id, s.date)}>
            {#if toggleBusyId === s.id}
              <span class="inline-block h-4 w-4 mr-1 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></span>
            {/if}
            <Lock size={14} class="shrink-0" aria-hidden="true" />
            {s.status !== 'locked' ? $t('session.list.lock') : $t('session.list.unlock')}
          </button>
    
          {#if isAdministrator}
            <button
              type="button"
              class="btn btn-danger btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
              disabled={busyId === s.id}
              aria-busy={busyId === s.id}
              onclick={() => remove(s.id, s.date)}>
              {#if busyId === s.id}
                <span class="inline-block h-4 w-4 mr-1 animate-spin rounded-full border-2 border-white/60 border-t-transparent"></span>
              {/if}
              <Trash2 size={16} class="shrink-0" aria-hidden="true" />
              {$t('session.list.delete')}
            </button>
          {/if}
        </div>
      </header>
      {#if matches.length > 0 && s.status === 'open' && isEditor}
        <ul class="divide-y divide-black/10">
          {#each matches as m (m.id)}
            <li class="px-4 md:px-5 py-3 grid items-center gap-3 grid-cols-[1fr_auto_auto]">
              <span>{$t('match_day.match.numbered', { values: { num: m.orderNo } })}</span>
              <a href={`/matches/${m.id}/edit/`} class="btn btn-success btn-sm">{$t('common.edit')}</a>
              <button
                type="button"
                class="btn btn-danger btn-icon-only"
                aria-label={$t('common.delete')}
                aria-busy={removeMatchBusyId === m.id}
                disabled={removeMatchBusyId === m.id}
                onclick={() => onRemoveMatch(s.id, m.id)}>
                <Minus size={16} aria-hidden="true" />
                <span class="sr-only">-1</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Footer / Stats-länk: förenklad label + preload -->
      <footer class="px-4 md:px-5 py-3">
        <a
          class="inline-flex items-center gap-2 text-black/70 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 rounded-md"
          href={`/sessions/${s.id}/stats`}
          data-sveltekit-preload-data
          aria-label={`${$t('session.common.stats')}: ${s.date ?? s.id}`}
          title={$t('session.common.stats')}>
          <ChartNoAxesColumn size={16} class="shrink-0" aria-hidden="true" />
          {$t('session.common.stats')}
        </a>
      </footer>
    </section>
    {/each}
  {/if}    
</div>
  