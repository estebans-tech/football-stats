<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from 'svelte-i18n'
  import type { Writable } from 'svelte/store'
  import type { PlayerLocal, LineupLocal, TeamAB, Half, ULID } from '$lib/types/domain'
  import { addLineup, deleteLineup, updateLineup, sanitizeLocalLineupsForMatch } from '$lib/data/lineups'

  type Props = {
    matchId: string
    players$: Writable<Record<string, PlayerLocal>>
    lineups$: Writable<LineupLocal[]>
    half?: Half
  }
  let { matchId, players$, lineups$, half = 1 }: Props = $props()

  const busyByPlayer = new Map<ULID, boolean>()
  let collapsed = $state(false)
  // Sorted roster
  const roster = $derived.by(() => {
    const all = Object.values($players$ ?? {})
    const assigned = new Set(Object.keys(membershipById)) // show inactive if already placed
      return all
        .filter(p => ((p.active && !p.deletedAt) || assigned.has(p.id)))
        .sort((a, b) => a.name.localeCompare(b.name))
  })

  // playerId -> team ('A' | 'B') för aktuell halvlek; undefined = bänk
  const membershipById = $derived.by((): Record<string, TeamAB | undefined> => {
      const m: Record<string, TeamAB | undefined> = {}
      for (const lineup of ($lineups$ ?? [])) {
        if (lineup.deletedAt == null && lineup.op !== 'delete' && lineup.half === half){
          m[lineup.playerId] = lineup.team
        }
      }

      return m
  })

  // counts per team for the selected half
  const totalRedPlayers = $derived.by(() =>
    Object.values(membershipById).filter((t) => t === 'A').length
  )
  const totalBlackPlayers = $derived.by(() =>
    Object.values(membershipById).filter((t) => t === 'B').length
  )
  // sum of both
  const totalPlayers = $derived(totalRedPlayers + totalBlackPlayers)
  const isInactive = (pid: string) => !$players$?.[pid]?.active
  const isBenched  = (pid: string) => membershipById[pid] === undefined
  const canAssign  = (pid: string, team: TeamAB) => membershipById[pid] !== team && !isInactive(pid)  
  // --- actions
  // remove a player's assignment for a given half+team (hard/soft handled by deleteLineup)
  async function removeTeamPlayer(matchId: ULID, playerId: ULID, team: TeamAB, half: Half) {
    const rows = ($lineups$ ?? []).filter(l =>
    l.matchId === matchId &&
    l.playerId === playerId &&
    l.half === half &&
    l.team === team &&
    l.deletedAt == null &&
    l.op !== 'delete'
  )
 
  if (!rows.length) return
    await Promise.allSettled(rows.map(r => deleteLineup(r.id)))
  }

  async function setTeamForPlayer(matchId: ULID, playerId: ULID, team: TeamAB, half: Half) {
    const existing = ($lineups$ ?? []).filter(l =>
      l.matchId === matchId &&
      l.playerId === playerId &&
      l.half === half &&
      l.deletedAt == null &&
      l.op !== 'delete'
    )

    if (existing.length === 0) {
      await addLineup({ matchId, half, team, playerId })
      return
    }

    const [head, ...rest] = existing.sort((a, b) => (b.updatedAtLocal ?? 0) - (a.updatedAtLocal ?? 0))

    if (head.team !== team) {
      await updateLineup(head.id, { team })
    }

    if (rest.length) {
      await Promise.allSettled(rest.map(r => deleteLineup(r.id)))
    }
  }

  async function assign(pid: string, team: TeamAB) {
    await setTeamForPlayer(matchId, pid, team, half)
  }

  async function toBench(pid: ULID) {
    await Promise.allSettled([
      removeTeamPlayer(matchId, pid, 'A', half),
      removeTeamPlayer(matchId, pid, 'B', half)
    ])
  }

  function guard(fn: () => Promise<void>, pid: ULID) {
    if (busyByPlayer.get(pid)) return
    busyByPlayer.set(pid, true)
    fn().finally(() => busyByPlayer.set(pid, false))
  }

  // --- UI helpers
  function rowClass(pid: string) {
    const team = membershipById[pid]
    return [
      'flex flex-1',
      team === 'A' ? 'justify-start text-white border-red-700' : '',
      team === 'B' ? 'justify-end text-white border-neutral-900' : '',
      !team ? 'justify-center bg-white text-black border-gray-300' : ''
    ].join(' ')
  }
  function pillClass(pid: string) {
    const team = membershipById[pid]
    return [
      'text-center rounded border px-3 py-2 transition-colors',
      team === 'A' ? 'basis-1/2 bg-red-800 text-white border-red-700' : '',
      team === 'B' ? 'basis-1/2 bg-neutral-900 text-white border-neutral-900' : '',
      !team ? 'basis-full bg-white text-black border-gray-300' : ''
    ].join(' ')
  }

  // ---- Button style helpers (Tailwind)
  const redBtnClass = (disabled: boolean) =>
  [
    'btn btn-sm',
    disabled
      // ghost på färgad rad – vit kant + svag bakgrund + ring
      ? 'btn-danger bg-red-800 text-white/80 border border-white/30 ring-1 ring-white/40 cursor-default'
      // solid röd – funkar även på svart/vit rad
      : 'btn-danger bg-red-800 hover:bg-red-700 text-white border border-white/10 shadow-xs',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
  ].join(' ')

  const blackBtnClass = (disabled: boolean) =>
  [
    'btn btn-sm',
    disabled
      ? '!bg-gray-400 text-white border border-white/30 ring-1 ring-white/40 cursor-default'
      : '!bg-black hover:bg-gray-800 !text-white border border-white/10 shadow-xs cursor',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
  ].join(' ')

  const benchBtnClass =
    'btn btn-sm' +
    'btn-outline bg-white text-black border border-gray-300 hover:bg-gray-50 shadow-xs ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40'

  $effect(() => {
    if (totalRedPlayers + totalBlackPlayers === roster.length) collapsed = true
  })
  </script>
  
  <section class="rounded-xl bg-white ring-1 ring-black/10 p-4 py-3 space-y-4">
      <!-- Sticky tools row -->
  <header class="sticky top-14 z-10 -mx-4 px-4 py-2 bg-white/85 supports-[backdrop-filter]:bg-white/60 backdrop-blur flex items-center gap-3 border-b border-black/5">
    <h2 class="text-base font-semibold">{$t('match_day.match.lineups.title')}</h2>
  </header>
  <div class="{collapsed ? 'max-h-40 pb-5 overflow-scroll [mask-image:linear-gradient(to_bottom,black_90%,transparent)]' : ''}">
    <ul class="space-y-2 pr-1">    
      {#each roster as p (p.id)}
        <!-- <li class={rowClass(p.id)}> -->
        <li class="flex items-center justify-between gap-x-3">
          <div class={rowClass(p.id)}>
            <div class={pillClass(p.id)}>
              <span class="truncate">{p.nickname ?? p.name}</span>
              {#if isInactive(p.id)}
                <span class="mt-1 inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded
                            border border-white/30 text-white/90">
                  Inactive
                </span>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-1 sm:gap-2">
            <!-- RED + (disabled om redan röd) -->
            <button
            type="button"
            class={redBtnClass(!canAssign(p.id, 'A'))}
            title={$t('common.add')}
            aria-label={$t('common.add')}
            disabled={!canAssign(p.id, 'A')}
            onclick={() => assign(p.id, 'A')}
            >＋</button>

            <!-- BLACK + (disabled om redan svart) -->
            <button
            type="button"
            class={blackBtnClass(!canAssign(p.id, 'B'))}
            title={$t('common.add')}
            aria-label={$t('common.add')}
            disabled={!canAssign(p.id, 'B')}
            onclick={() => assign(p.id, 'B')}
          >＋</button>

            <!-- BENCHED − (visas bara om spelaren är i röd/svart) -->
            <!-- {#if !isBenched(p.id)} -->
            <button
              type="button"
              class={benchBtnClass}
              title={$t('common.remove')}
              aria-label={$t('common.remove')}
              onclick={() => toBench(p.id)}
            >−</button>
            <!-- {/if} -->
          </div>
        </li>
      {/each}
    </ul>
  </div>

    <div class="mt-3 flex items-center justify-end gap-4 text-sm">
      <span>{$t('match_day.match.team.red')}: {totalRedPlayers}</span>
      <span>{$t('match_day.match.team.black')}: {totalBlackPlayers}</span>
      <span class="opacity-70">Total: {totalPlayers}</span>
    </div>

    <!-- Toggle under lineups -->
    <div class="mt-1 flex justify-center">
      <button class="btn btn-sm btn-soft" onclick={() => (collapsed = !collapsed)}>
        {collapsed ? $t('common.expand') : $t('common.collapse')}
      </button>
    </div>
  </section>
  