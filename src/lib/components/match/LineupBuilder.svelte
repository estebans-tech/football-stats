<script lang="ts">
    import { t } from 'svelte-i18n'
    import type { Writable } from 'svelte/store'
    import type { PlayerLocal, LineupLocal, TeamAB } from '$lib/types/domain'
    import { setTeamForPlayer, removePlayer } from '$lib/data/lineups'
  
    type Props = {
      matchId: string
      players$: Writable<Record<string, PlayerLocal>>
      lineups$: Writable<LineupLocal[]>
      half?: 1 | 2
    }
    let { matchId, players$, lineups$, half = 1 }: Props = $props()
  
    // Sorterad trupp
    const roster = $derived.by(() => {
        const all = Object.values($players$ ?? {})
        const assigned = new Set(Object.keys(membershipById)) // visa inaktiva om de redan är placerade
        return all
            .filter(p => ((p.active && !p.deletedAtLocal) || assigned.has(p.id)))
            .sort((a, b) => a.name.localeCompare(b.name))
    })
  
    // playerId -> team ('A' | 'B') för aktuell halvlek; undefined = bänk
    const membershipById = $derived.by((): Record<string, TeamAB | undefined> => {
        const m: Record<string, TeamAB | undefined> = {}
        for (const l of ($lineups$ ?? [])) {
            if (!l.deletedAtLocal && l.half === half) m[l.playerId] = l.team
        }
        return m
    })
 
    // counts per team for the selected half
    const totalRedPlayers   = $derived.by(() =>
    Object.values(membershipById).filter((t) => t === 'A').length
    )
    const totalBlackPlayers = $derived.by(() =>
    Object.values(membershipById).filter((t) => t === 'B').length
    )
    // sum of both
    const totalPlayers = $derived(totalRedPlayers + totalBlackPlayers)
    const isInactive = (pid: string) => !$players$?.[pid]?.active
    const isBenched  = (pid: string) => membershipById[pid] === undefined
    const canAssign  = (pid: string, team: TeamAB) =>

    membershipById[pid] !== team && !isInactive(pid)  
    // --- actions
    async function assign(pid: string, team: TeamAB) {
        if (membershipById[pid] === team) return
        // 1) rensa eventuella dubbletter
        await Promise.allSettled([
            removePlayer(matchId, pid, 'A', half),
            removePlayer(matchId, pid, 'B', half),
        ])
        // 2) lägg i önskat lag
        await setTeamForPlayer(matchId, pid, team, half)
        }

        async function toBench(pid: string) {
        // bänk = ta bort ALLA placeringar (A & B) för halvleken
        await Promise.allSettled([
            removePlayer(matchId, pid, 'A', half),
            removePlayer(matchId, pid, 'B', half),
        ])
    }

    // --- UI helpers
    function rowClass(pid: string) {
      const team = membershipById[pid]
      return [
        'flex items-center justify-between rounded border px-3 py-2 transition-colors',
        team === 'A' ? 'bg-red-800 text-white border-red-700' : '',
        team === 'B' ? 'bg-neutral-900 text-white border-neutral-900' : '',
        !team ? 'bg-white text-black border-gray-300' : ''
      ].join(' ')
    }

    // ---- Button style helpers (Tailwind)
  const redBtnClass = (disabled: boolean) =>
    [
      'w-10 h-9 rounded-lg inline-flex items-center justify-center text-base',
      disabled
        // ghost på färgad rad – vit kant + svag bakgrund + ring
        ? 'bg-red-800 text-white/80 border border-white/30 ring-1 ring-white/40 cursor-default'
        // solid röd – funkar även på svart/vit rad
        : 'bg-red-800 hover:bg-red-700 text-white border border-white/10 shadow-xs',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
    ].join(' ')

  const blackBtnClass = (disabled: boolean) =>
    [
      'w-10 h-9 rounded-lg inline-flex items-center justify-center text-base',
      disabled
        ? 'bg-white/5 text-white/80 border border-white/30 ring-1 ring-white/40 cursor-default'
        : 'bg-neutral-900 hover:bg-black text-white border border-white/30 shadow-xs',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
    ].join(' ')

  const benchBtnClass =
    'w-10 h-9 rounded-lg inline-flex items-center justify-center text-base ' +
    'bg-white text-black border border-gray-300 hover:bg-gray-50 shadow-xs ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40'
  
  </script>
  
  <section class="rounded-xl border bg-white p-4">
    <h3 class="mb-3 font-semibold">{$t('match_day.match.lineups.available')}</h3>
  
    <ul class="space-y-2 max-h-[520px] overflow-auto pr-1">
      {#each roster as p (p.id)}
        <li class={rowClass(p.id)}>
            <span class="truncate">{p.name}</span>
            {#if isInactive(p.id)}
              <span class="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded
                           border border-white/30 bg-white/15 text-white/90">
                Inactive
              </span>
            {/if}  
          <div class="flex items-center gap-2">
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
  
    <div class="mt-3 flex items-center justify-end gap-4 text-sm">
        <span>{$t('match_day.match.team.red')}: {totalRedPlayers}</span>
        <span>{$t('match_day.match.team.black')}: {totalBlackPlayers}</span>
        <span class="opacity-70">Total: {totalPlayers}</span>
      </div>
    <!-- <p class="mt-2 text-xs text-gray-500">
      {$t('match_day.match.select_player')}
    </p> -->
  </section>
  