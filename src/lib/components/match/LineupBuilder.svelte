<script lang="ts">
    import { t } from 'svelte-i18n'
    import type { Writable } from 'svelte/store'
    import type { TeamAB, PlayerLocal, LineupLocal } from '$lib/types/domain'
    import { setTeamForPlayer, removePlayer, swapTeamsForMatch } from '$lib/data/lineups'
  
    type Props = {
      matchId: string
      players$: Writable<Record<string, PlayerLocal>>
      lineups$: Writable<LineupLocal[]>
    }
    let { matchId, players$, lineups$ }: Props = $props()
  
    // Selected target team (used when clicking "Add" in the right column)
    let teamForAdd = $state<TeamAB>('A')
  
    // -------- helpers (whole-game; canonical half = 1)
    const nameOf = (id: string) => ($players$[id]?.name) ?? id
  
    // IDs of players in a given team (only half=1, skip soft-deleted)
    const teamPlayers = (team: TeamAB) =>
      $lineups$.filter(l => l.half === 1 && l.team === team && !l.deletedAtLocal).map(l => l.playerId)
  
    // Fast membership sets for “already on a team?” checks
    const usedA = $derived(
      new Set(
        $lineups$
          .filter(l => l.half === 1 && l.team === 'A' && !l.deletedAtLocal)
          .map(l => l.playerId)
      )
    )
    const usedB = $derived(
      new Set(
        $lineups$
          .filter(l => l.half === 1 && l.team === 'B' && !l.deletedAtLocal)
          .map(l => l.playerId)
      )
    )
  
    // Full roster (active players), sorted by name
    const allPlayers = $derived(
      Object.values($players$).sort((a, b) => a.name.localeCompare(b.name))
    )
  
    // -------- actions (lineup writes always use half = 1)
    async function addToSelected(pid: string) {
      await setTeamForPlayer(matchId, pid, teamForAdd, 1)
    }
    async function removeFrom(team: TeamAB, pid: string) {
      await removePlayer(matchId, pid, team, 1)
    }
    async function swapTeams() {
      await swapTeamsForMatch(matchId)
    }
  
    function selectTeam(team: TeamAB) { teamForAdd = team }
  
    const colClass = (team: TeamAB) =>
      `rounded-xl border p-3 ${teamForAdd === team ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`
  </script>
  
  <div class="rounded-xl border bg-white p-4 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-700">{$t('match_day.match.team.label')}</div>
      <button class="text-base font-semibold hover:underline" onclick={swapTeams}>
        {$t('match_day.match.actions.swap_teams')}
      </button>
    </div>
  
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Red -->
        <section class={colClass('A')}>
            <h3 class="mb-2">
            <button
                type="button"
                class="font-semibold bg-transparent p-0 m-0 border-0 cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                aria-pressed={teamForAdd === 'A'}
                onclick={() => selectTeam('A')}
            >
                {$t('match_day.match.team.red')}
            </button>
            </h3>
        
            <ul class="space-y-1">
            {#each teamPlayers('A') as pid (pid)}
                <li class="flex items-center justify-between rounded border px-2 py-1">
                <span>{nameOf(pid)}</span>
                <button
                    class="btn btn-danger p-0 w-9 h-9 flex items-center justify-center"
                    title={$t('common.remove')}
                    aria-label={$t('common.remove')}
                    onclick={() => removeFrom('A', pid)}
                    >
                    <span aria-hidden="true">−</span>
                </button>
                </li>
            {/each}
            </ul>
        </section>
  
        <!-- Black -->
        <section class={colClass('B')}>
            <h3 class="mb-2">
            <button
                type="button"
                class="font-semibold bg-transparent p-0 m-0 border-0 cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                aria-pressed={teamForAdd === 'B'}
                onclick={() => selectTeam('B')}
            >
                {$t('match_day.match.team.black')}
            </button>
            </h3>
        
            <ul class="space-y-1">
            {#each teamPlayers('B') as pid (pid)}
                <li class="flex items-center justify-between rounded border px-2 py-1">
                <span>{nameOf(pid)}</span>
                <button
                    class="btn btn-danger p-0 w-9 h-9 flex items-center justify-center"
                    title={$t('common.remove')}
                    aria-label={$t('common.remove')}
                    onclick={() => removeFrom('B', pid)}
                    >
                    <span aria-hidden="true">−</span>
                </button>
                </li>
            {/each}
            </ul>
        </section>
  
      <!-- All players (full roster; Add disabled if already assigned) -->
      <section class="rounded-xl border p-3">
        <h3 class="mb-2 font-semibold">{$t('match_day.match.lineups.available')}</h3>
        <ul class="space-y-1 max-h-72 overflow-auto pr-1">
          {#each allPlayers as p (p.id)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{p.name}</span>
              <div class="flex items-center gap-2">
                {#if usedA.has(p.id) || usedB.has(p.id)}
                  <span class="text-xs px-2 py-0.5 rounded border">
                    {usedA.has(p.id) ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
                  </span>
                {/if}
                <button
                    class="btn btn-primary p-0 w-9 h-9 flex items-center justify-center disabled:opacity-50"
                    title={$t('common.add')}
                    aria-label={$t('common.add')}
                    disabled={usedA.has(p.id) || usedB.has(p.id)}
                    onclick={() => addToSelected(p.id)}
                    >
                    <span aria-hidden="true">＋</span>
                </button>
              </div>
            </li>
          {/each}
        </ul>
        <p class="mt-2 text-xs text-gray-500">
          {$t('match_day.match.select_player')}
        </p>
      </section>
    </div>
  </div>
  