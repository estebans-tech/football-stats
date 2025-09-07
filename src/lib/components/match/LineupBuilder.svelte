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
  
    // local UI state
    let teamForAdd = $state<TeamAB>('A')
  
    // helpers (whole-game, no half)
    const nameOf = (id: string) => ($players$[id]?.name) ?? id
  
    const teamPlayers = (team: TeamAB) =>
      $lineups$.filter(l => l.team === team && !l.deletedAtLocal).map(l => l.playerId)
  
    const availablePlayers = (team: TeamAB) => {
      const used = new Set(teamPlayers(team))
      return Object.values($players$).filter(p => !used.has(p.id))
    }
  
    // actions (lineup writes use half=1 internally)
    async function addToTeam(pid: string) {
      await setTeamForPlayer(matchId, pid, teamForAdd, 1)
    }
    async function removeFromTeam(pid: string, team: TeamAB) {
      await removePlayer(matchId, pid, team, 1)
    }
    async function swapTeams() {
      await swapTeamsForMatch(matchId)
    }
  </script>
  
  <div class="rounded-xl border bg-white p-4 space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="text-sm">{$t('match_day.match.team.label')}</span>
        <label class="flex items-center gap-1"><input type="radio" value="A" bind:group={teamForAdd}/> {$t('match_day.match.team.red')}</label>
        <label class="flex items-center gap-1"><input type="radio" value="B" bind:group={teamForAdd}/> {$t('match_day.match.team.black')}</label>
      </div>
      <div class="ml-auto flex flex-wrap gap-2">
        <button class="btn" onclick={swapTeams}>
          {$t('match_day.match.actions.swap_teams')}
        </button>
      </div>
    </div>
  
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Available -->
      <div>
        <div class="font-medium mb-2">{$t('match_day.match.lineups.available')}</div>
        <ul class="space-y-1 max-h-72 overflow-auto pr-1">
          {#each availablePlayers(teamForAdd) as p (p.id)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{p.name}</span>
              <button class="btn btn-primary" onclick={() => addToTeam(p.id)}>{$t('common.add')}</button>
            </li>
          {/each}
        </ul>
      </div>
  
      <!-- Red -->
      <div>
        <div class="font-medium mb-2">{$t('match_day.match.team.red')}</div>
        <ul class="space-y-1">
          {#each teamPlayers('A') as pid (pid)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(pid)}</span>
              <button class="btn btn-danger" onclick={() => removeFromTeam(pid, 'A')}>{$t('common.remove')}</button>
            </li>
          {/each}
        </ul>
      </div>
  
      <!-- Black -->
      <div>
        <div class="font-medium mb-2">{$t('match_day.match.team.black')}</div>
        <ul class="space-y-1">
          {#each teamPlayers('B') as pid (pid)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(pid)}</span>
              <button class="btn btn-danger" onclick={() => removeFromTeam(pid, 'B')}>{$t('common.remove')}</button>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
  