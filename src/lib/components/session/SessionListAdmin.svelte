<script lang="ts">
  import { t, locale } from 'svelte-i18n'
  import { Lock, Trash2, Minus, BarChart2 } from 'lucide-svelte'
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
  import { formatDate } from '$lib/utils/utils'
  import Card from '$lib/components/Card.svelte'

  const sessions    = observeLocalSessions()
  const matchCounts = observeLocalMatchCounts()
  const matchesMap  = observeLocalMatchesMap()

  // Reactive store values via $derived
  const counts          = $derived($matchCounts)
  const matchesBySession = $derived($matchesMap)
  const isEditor        = $derived(canEdit())
  const isAdministrator = $derived(isAdmin())
  const fmt             = $derived((iso: string) => formatDate(iso, $locale))

  let busyId            = $state<string | null>(null)
  let toggleBusyId      = $state<string | null>(null)
  let addBusyId         = $state<string | null>(null)
  let removeMatchBusyId = $state<string | null>(null)

  async function remove(id: string, date: string) {
    if (!confirm($t('session.delete_confirm'))) return
    busyId = id
    try {
      await softDeleteLocalSession(id)
    } finally {
      busyId = null
    }
  }

  async function toggleStatus(id: string, date: string) {
    toggleBusyId = id
    try {
      const next = await toggleLocalSessionStatus(id)
      if (next === 'locked') {
        toast.success($t('session.toast.locked', { values: { date } }))
      } else {
        toast.success($t('session.toast.unlocked', { values: { date } }))
      }
    } catch {
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
    if (!confirm($t('session.match.delete_confirm'))) return
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

<div class="w-full space-y-3">
  {#if $sessions.length === 0}
    <p class="py-8 text-center text-sm text-white/40">{$t('session.list.empty')}</p>
  {:else}
    {#each $sessions as s (s.id)}
      {@const count = counts[s.id] ?? 0}
      {@const matches = matchesBySession[s.id] ?? []}

      <Card>
        <!-- Header -->
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-2">
            <span class="h-4 w-1.5 rounded-full {s.status === 'open' ? 'bg-red-700' : 'bg-white/20'}"></span>
            <h3 class="text-base font-semibold text-white">{fmt(s.date)}</h3>
            {#if s.status === 'locked'}
              <span class="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">
                <Lock size={11} />
                {$t('session.status.locked')}
              </span>
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-2">
            {#if s.status === 'open'}
              <button
                type="button"
                class="btn btn-soft btn-sm"
                disabled={count > 0 || addBusyId === s.id}
                aria-busy={addBusyId === s.id}
                onclick={() => addFour(s.id)}
                title={count > 0 ? $t('session.match.hint.add_four_disabled') : ''}
              >
                {#if addBusyId === s.id}<span class="spinner mr-1"></span>{/if}
                +4
              </button>

              <button
                type="button"
                class="btn btn-soft btn-sm"
                disabled={addBusyId === s.id}
                aria-busy={addBusyId === s.id}
                onclick={() => addOne(s.id)}
              >
                {#if addBusyId === s.id}<span class="spinner mr-1"></span>{/if}
                +1
              </button>
            {/if}

            <button
              type="button"
              class="btn btn-sm {s.status === 'open' ? 'btn-warning' : 'btn-soft'}"
              disabled={toggleBusyId === s.id}
              aria-busy={toggleBusyId === s.id}
              onclick={() => toggleStatus(s.id, s.date)}
            >
              {#if toggleBusyId === s.id}
                <span class="spinner mr-1"></span>
              {/if}
              <Lock size={14} aria-hidden="true" />
              {s.status !== 'locked' ? $t('session.list.lock') : $t('session.list.unlock')}
            </button>

            {#if isAdministrator}
              <button
                type="button"
                class="btn btn-danger btn-sm"
                disabled={busyId === s.id}
                aria-busy={busyId === s.id}
                onclick={() => remove(s.id, s.date)}
              >
                {#if busyId === s.id}<span class="spinner mr-1"></span>{/if}
                <Trash2 size={16} aria-hidden="true" />
                {$t('session.list.delete')}
              </button>
            {/if}
          </div>
        </div>

        <!-- Match list -->
        {#if matches.length > 0 && s.status === 'open' && isEditor}
          <ul class="mt-3 divide-y divide-white/8 border-t border-white/8">
            {#each matches as m (m.id)}
              <li class="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5">
                <span class="text-sm text-white/70">
                  {$t('match_day.match.numbered', { values: { num: m.orderNo } })}
                </span>
                <a href="/match/{m.id}/edit" class="btn btn-success btn-sm">
                  {$t('common.edit')}
                </a>
                <button
                  type="button"
                  class="btn btn-danger btn-icon-only"
                  aria-label={$t('common.delete')}
                  aria-busy={removeMatchBusyId === m.id}
                  disabled={removeMatchBusyId === m.id}
                  onclick={() => onRemoveMatch(s.id, m.id)}
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <!-- Footer -->
        <div class="mt-3 border-t border-white/8 pt-3">
         <a 
            href="/session/{s.id}/statistics"
            data-sveltekit-preload-data
            class="inline-flex items-center gap-2 text-sm text-red-400 hover:underline"
            aria-label="{$t('session.common.stats')}: {s.date}"
          >
            <BarChart2 size={16} aria-hidden="true" />
            {$t('session.common.stats')}
          </a>
        </div>
      </Card>
    {/each}
  {/if}
</div>

