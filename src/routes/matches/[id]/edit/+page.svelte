<script lang="ts">
  import { browser } from '$app/environment'
  import { writable } from 'svelte/store'
  import { t } from 'svelte-i18n'
  import type { PageData } from './$types'

  import { db } from '$lib/db/dexie'

  import { observeLocalMatch } from '$lib/data/matches'
  import {
    observeLocalLineupsForMatch,
    setTeamForPlayer,
    removePlayer,
    swapTeamsForMatch,     // ✅ whole-match swap
  } from '$lib/data/lineups'
  import {
    observeLocalGoalsForMatch,
    addGoalQuick,
    updateGoal,
    deleteGoal
  } from '$lib/data/goals'
  import { observeLocalActivePlayersMap } from '$lib/data/players'

  import type {
    MatchLocal,
    GoalLocal,
    LineupLocal,
    PlayerLocal,
    Half,
    TeamAB
  } from '$lib/types/domain'

  // ---------- props (runes mode)
  type Props = { data: PageData }
  let { data }: Props = $props()

  // ---------- local snapshot writables used by UI helpers
  const match$   = writable<MatchLocal | undefined>(undefined)
  const goals$   = writable<GoalLocal[]>([])
  const lineups$ = writable<LineupLocal[]>([])
  const players$ = writable<Record<string, PlayerLocal>>({})

  // ---------- UI state
  let teamForAdd = $state<TeamAB>('A') // Red by default
  let goalHalf   = $state<Half>(1)     // Half selector only for GOALS

  // ---------- helpers (whole-game lineups; no half)
  const nameOf = (id: string) => ($players$[id]?.name) ?? id

  const teamPlayers = (team: TeamAB) =>
    $lineups$.filter(l => l.team === team && !l.deletedAtLocal).map(l => l.playerId)

  const availablePlayers = (team: TeamAB) => {
    const used = new Set(teamPlayers(team))
    return Object.values($players$).filter(p => !used.has(p.id))
  }

  function lineupFor(goal: GoalLocal) {
    // scorer/assist options come from whole-game lineup for that team
    return teamPlayers(goal.team).map(id => ({ id, name: nameOf(id) }))
  }

  // ---------- actions (lineup ops always write with half=1 under the hood)
  async function addToTeam(pid: string) {
    const id = data.id
    await setTeamForPlayer(id, pid, teamForAdd, 1)
  }

  async function removeFromTeam(pid: string, team: TeamAB) {
    const id = data.id
    await removePlayer(id, pid, team, 1)
  }

  async function swapTeams() {
    const id = data.id
    await swapTeamsForMatch(id) // flips A↔B for the entire lineup
  }

  // Goals keep their own half
  async function quickAdd(team: TeamAB) {
    const id = data.id
    const pool = teamPlayers(team)
    const scorer = pool[0] ?? null
    await addGoalQuick({ matchId: id, team, half: goalHalf, scorerId: scorer })
  }

  // ---------- 1) Seed a snapshot so first render has data
  const ready: Promise<void> = browser
    ? (async () => {
        const id = data.id
        const [m, g, l, p] = await Promise.all([
          db.matches_local.get(id),
          db.goals_local.where('matchId').equals(id).toArray(),
          db.lineups_local.where('matchId').equals(id).toArray(),
          db.players_local.toArray()
        ])
        match$.set(m)
        goals$.set(g)
        lineups$.set(l)
        players$.set(Object.fromEntries(p.map(x => [x.id, x])))
      })()
    : Promise.resolve()

  // ---------- 2) Keep snapshot in sync with live queries
  $effect(() => {
    if (!browser) return
    const id = data.id

    const u1 = observeLocalMatch(id).subscribe(match$.set)
    const u2 = observeLocalGoalsForMatch(id).subscribe(goals$.set)
    const u3 = observeLocalLineupsForMatch(id).subscribe(lineups$.set)
    const u4 = observeLocalActivePlayersMap().subscribe(players$.set)

    return () => { u1(); u2(); u3(); u4() }
  })
</script>

<section class="mx-auto max-w-4xl w-full space-y-6">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">
      {$t('match_day.match.numbered', {
        values: { num: $match$?.orderNo ?? '?' }
      })}
    </h1>
    <a href="/" class="text-sm underline hover:no-underline">{$t('common.back')}</a>
  </header>

  {#await ready}{:then}
  <!-- Team builder (whole game) -->
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

  <!-- Goals -->
  <div class="rounded-xl border bg-white p-4 space-y-3">
    <div class="flex gap-2 items-center">
      <h2 class="text-base font-semibold">{$t('match_day.match.goals.title')}</h2>
      <div class="flex items-center gap-2 ml-4">
        <span class="text-sm">{$t('match_day.match.half_label')}</span>
        <label class="flex items-center gap-1"><input type="radio" value={1} bind:group={goalHalf}/> H1</label>
        <label class="flex items-center gap-1"><input type="radio" value={2} bind:group={goalHalf}/> H2</label>
      </div>
      <div class="flex gap-2 ml-auto">
        <button class="btn btn-danger" onclick={() => quickAdd('A')}>+ {$t('match_day.match.team.red')}</button>
        <button class="btn" style="background:#000;color:#fff" onclick={() => quickAdd('B')}>+ {$t('match_day.match.team.black')}</button>
      </div>
    </div>

    {#if $goals$.length === 0}
      <div class="text-sm text-gray-600">{$t('match_day.match.goals.empty')}</div>
    {:else}
      <ul class="space-y-2">
        {#each $goals$ as g (g.id)}
          <li class="rounded border px-2 py-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded border">
                {g.team === 'A' ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
                · {$t('match_day.match.half', { values: { n: g.half } })}
              </span>

              <!-- scorer -->
              <select
                class="rounded border px-2 py-1"
                onchange={(e) => updateGoal(g.id, { scorerId: (e.currentTarget as HTMLSelectElement).value || undefined })}
              >
                {#each lineupFor(g) as p (p.id)}
                  <option value={p.id} selected={p.id === g.scorerId}>{p.name}</option>
                {/each}
              </select>

              <!-- assist -->
              <select
                class="rounded border px-2 py-1"
                onchange={(e) => updateGoal(g.id, { assistId: (e.currentTarget as HTMLSelectElement).value || undefined })}
              >
                <option value="">{ $t('common.none') }</option>
                {#each lineupFor(g) as p (p.id)}
                  <option value={p.id} selected={p.id === g.assistId}>{p.name}</option>
                {/each}
              </select>

              <!-- minute -->
              <input
                class="rounded border px-2 py-1 w-20"
                type="number" min="0" max="200"
                value={g.minute ?? ''}
                onchange={(e) => updateGoal(g.id, { minute: Number((e.currentTarget as HTMLInputElement).value) || undefined })}
              />

              <button class="ml-auto btn btn-danger" onclick={() => deleteGoal(g.id)}>{$t('common.delete')}</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {/await}
</section>
