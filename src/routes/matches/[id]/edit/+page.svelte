<script lang="ts">
  import type { PageData } from './$types'
  import { browser } from '$app/environment'
  import { readable, type Readable } from 'svelte/store'
  import { t } from 'svelte-i18n'

  // Live-data (lokalt)
  import { observeLocalMatch } from '$lib/data/matches'
  import { observeLocalGoalsForMatch } from '$lib/data/goals'
  import { observeLocalLineupsForMatch } from '$lib/data/lineups'
  import { observeLocalPlayersMap } from '$lib/data/players'

  // Writes (lokalt) – anpassa om dina helpers har annan signatur
  import { setTeamForPlayer, removePlayer } from '$lib/data/lineups'
  import { addGoal, deleteGoal, updateGoal } from '$lib/data/goals'

  import type { MatchLocal, GoalLocal, LineupLocal, PlayerLocal } from '$lib/types/domain'

  export let data: PageData
  const matchId = data.id

  // SSR-säkra stores (typer behövs för TS)
  const matchStore: Readable<MatchLocal | undefined> =
    browser ? observeLocalMatch(matchId) : readable<MatchLocal | undefined>(undefined)

  const lineupsStore: Readable<LineupLocal[]> =
    browser ? observeLocalLineupsForMatch(matchId) : readable<LineupLocal[]>([])

  const goalsStore: Readable<GoalLocal[]> =
    browser ? observeLocalGoalsForMatch(matchId) : readable<GoalLocal[]>([])

  const playersMap: Readable<Record<string, PlayerLocal>> =
    browser ? observeLocalPlayersMap() : readable<Record<string, PlayerLocal>>({})

  // UI-state
  let team: 'home' | 'away' = 'home'
  let half: 1 | 2 = 1
  let scorerId: string | null = null
  let assistId: string | null = null
  let minute: number | '' = ''

  // Helpers
  const nameOf = (id: string) => ($playersMap[id]?.name) ?? id
  const teamPlayers = (which: 'A'|'B', h: 1|2) =>
    $lineupsStore.filter(l => l.team === which && l.half === h).map(l => l.playerId)

  const availablePlayers = (which: 'A'|'B', h: 1|2) => {
    const used = new Set(teamPlayers(which, h))
    return Object.values($playersMap).filter(p => !used.has(p.id))
  }

  async function onAddToTeam(pid: string) {
    try {
      await setTeamForPlayer(matchId, pid, team, half)
    } catch (e) {
      console.error(e)
    }
  }

  async function onRemoveFromTeam(pid: string, which: 'A'|'B', h: 1|2) {
    try {
      await removePlayer(matchId, pid, which, h)  // justera om din helper tar annan signatur
    } catch (e) {
      console.error(e)
    }
  }

  async function onAddGoal() {
    if (!scorerId) return
    try {
      await addGoal({
        matchId,
        team,
        half,
        scorerId,
        assistId: assistId || undefined,
        minute: typeof minute === 'number' ? minute : undefined
      })
      // reset form
      scorerId = null
      assistId = null
      minute = ''
    } catch (e) {
      console.error(e)
    }
  }

  async function onDeleteGoal(id: string) {
    try { await deleteGoal(id) } catch (e) { console.error(e) }
  }

  async function onToggleHalf(g: GoalLocal) {
    const next: 1 | 2 = g.half === 1 ? 2 : 1
    try { await updateGoal(g.id, { half: next }) } catch (e) { console.error(e) }
  }
</script>

<section class="mx-auto max-w-4xl w-full space-y-6">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">
      {$t('match_day.match.numbered', { values: { num: $matchStore?.orderNo ?? '?' } })}
    </h1>
    <a href={`/matches/${matchId}`} class="text-sm underline hover:no-underline">
      {$t('common.back')}
    </a>
  </header>

  <!-- Lineups -->
  <div class="rounded-xl border bg-white p-4">
    <div class="flex items-center gap-3 mb-3">
      <label class="text-sm">{$t('match_day.match.team.home')}</label>
      <input type="radio" name="team" value="home" bind:group={team} />
      <label class="text-sm ml-4">{$t('match_day.match.team.away')}</label>
      <input type="radio" name="team" value="away" bind:group={team} />
      <span class="ml-6 text-sm">{$t('match_day.match.half', { values: { n: half } })}</span>
      <button type="button" class="btn btn-secondary ml-2" on:click={() => half = half === 1 ? 2 : 1}>
        {$t('common.toggle')}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Available players -->
      <div>
        <div class="font-medium mb-2">{$t('match_day.match.lineups.available')}</div>
        <ul class="space-y-1 max-h-72 overflow-auto pr-1">
          {#each availablePlayers(team, half) as p (p.id)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(p.id)}</span>
              <button class="btn btn-primary" on:click={() => onAddToTeam(p.id)}>
                {$t('common.add')}
              </button>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Home -->
      <div>
        <div class="font-medium mb-2">{$t('match_day.match.team.home')} · {$t('match_day.match.half', { values: { n: 1 } })}</div>
        <ul class="space-y-1">
          {#each teamPlayers('A', 1) as pid (pid)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(pid)}</span>
              <button class="btn btn-danger" on:click={() => onRemoveFromTeam(pid, 'A', 1)}>
                {$t('common.remove')}
              </button>
            </li>
          {/each}
        </ul>

        <div class="font-medium mt-4 mb-2">{$t('match_day.match.team.home')} · {$t('match_day.match.half', { values: { n: 2 } })}</div>
        <ul class="space-y-1">
          {#each teamPlayers('A', 2) as pid (pid)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(pid)}</span>
              <button class="btn btn-danger" on:click={() => onRemoveFromTeam(pid, 'A', 2)}>
                {$t('common.remove')}
              </button>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Away -->
      <div>
        <div class="font-medium mb-2">{$t('match_day.match.team.away')} · {$t('match_day.match.half', { values: { n: 1 } })}</div>
        <ul class="space-y-1">
          {#each teamPlayers('B', 1) as pid (pid)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(pid)}</span>
              <button class="btn btn-danger" on:click={() => onRemoveFromTeam(pid, 'B', 1)}>
                {$t('common.remove')}
              </button>
            </li>
          {/each}
        </ul>

        <div class="font-medium mt-4 mb-2">{$t('match_day.match.team.away')} · {$t('match_day.match.half', { values: { n: 2 } })}</div>
        <ul class="space-y-1">
          {#each teamPlayers('B', 2) as pid (pid)}
            <li class="flex items-center justify-between rounded border px-2 py-1">
              <span>{nameOf(pid)}</span>
              <button class="btn btn-danger" on:click={() => onRemoveFromTeam(pid, 'B', 2)}>
                {$t('common.remove')}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </div>

  <!-- Goals -->
  <div class="rounded-xl border bg-white p-4">
    <h2 class="text-base font-semibold mb-3">{$t('match_day.match.goals.title')}</h2>

    <div class="flex flex-wrap items-end gap-3 mb-4">
      <div>
        <label class="block text-xs mb-1">{$t('match_day.match.team.label')}</label>
        <select class="rounded border px-2 py-1" bind:value={team}>
          <option value="home">{$t('match_day.match.team.home')}</option>
          <option value="away">{$t('match_day.match.team.away')}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1">{$t('match_day.match.half_label')}</label>
        <select class="rounded border px-2 py-1" bind:value={half}>
          <option value={1}>H1</option>
          <option value={2}>H2</option>
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1">{$t('match_day.match.goals.scorer')}</label>
        <select class="rounded border px-2 py-1" bind:value={scorerId}>
          <option value={null} disabled>{$t('match_day.match.select_player')}</option>
          {#each teamPlayers(team, half) as pid (pid)}
            <option value={pid}>{nameOf(pid)}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1">{$t('match_day.match.goals.assist')}</label>
        <select class="rounded border px-2 py-1" bind:value={assistId}>
          <option value={null}>{$t('common.none')}</option>
          {#each teamPlayers(team, half) as pid (pid)}
            <option value={pid}>{nameOf(pid)}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-xs mb-1">{$t('match_day.match.goals.minute')}</label>
        <input class="rounded border px-2 py-1 w-20" type="number" min="0" max="200" bind:value={minute} />
      </div>
      <button class="btn btn-primary" on:click={onAddGoal} disabled={!scorerId}>
        {$t('common.add')}
      </button>
    </div>

    {#if $goalsStore.length === 0}
      <div class="text-sm text-gray-600">{$t('match_day.match.goals.empty')}</div>
    {:else}
      <ul class="space-y-1">
        {#each $goalsStore as g (g.id)}
          <li class="flex items-center justify-between rounded border px-2 py-1">
            <div class="text-sm">
              {#if g.team === 'A'} 🟦 {:else} 🟥 {/if}
              {#if g.minute}{g.minute}' · {/if}
              {nameOf(g.scorerId)}
              {#if g.assistId} <span class="text-gray-600">({$t('match_day.match.goals.assist')}: {nameOf(g.assistId)})</span>{/if}
              <span class="text-xs text-gray-500 ml-2">({$t('match_day.match.half', { values: { n: g.half } })})</span>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-secondary" on:click={() => onToggleHalf(g)}>H↔︎</button>
              <button class="btn btn-danger" on:click={() => onDeleteGoal(g.id)}>{$t('common.delete')}</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
