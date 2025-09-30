<script lang="ts">
  import { t } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { derived, type Readable } from 'svelte/store'
  import type { GoalLocal, Half, TeamAB, ULID, LineupLocal } from '$lib/types/domain'
  import { addGoalQuick, updateGoal, deleteGoal } from '$lib/data/goals'

  let adding = false

  type Props = {
    matchId: ULID
    half?: 1 | 2
    goals: Readable<GoalLocal[]>
    lineups: Readable<LineupLocal[]>
    lineupFor: (g: GoalLocal) => Array<{ id: ULID, name: string }>
  }

  let { matchId, half = 1, goals, lineups, lineupFor }: Props = $props()

  // keep only visible goals and de-duplicate by id
  const goalsUniq: Readable<GoalLocal[]> = derived(goals, $g => {
    const visible = $g.filter(g => g.deletedAt == null && g.op !== 'delete')
    const seen = new Set<ULID>()
    const out: GoalLocal[] = []
    for (const g of visible) {
      if (!seen.has(g.id)) {
        seen.add(g.id)
        out.push(g)            // ← move inside the if
      }
    }
    return out
  })

  function lineupOptions(g: GoalLocal) {
    const m = new Map<ULID, { id: ULID, name: string }>()
    for (const p of lineupFor(g)) if (!m.has(p.id)) m.set(p.id, p)
    return Array.from(m.values())
  }

  // optional: log duplicates to quickly spot the source
  $effect(() => {
    for (const g of $goalsUniq) {
    const ids = lineupFor(g).map(p => p.id)
    if (ids.length && new Set(ids).size !== ids.length) {
      console.warn('duplicate lineup ids for goal', g.id, ids)
    }
  }
  })
  

  // pick first available player from given team (visible only)
  const teamPlayers = (team: TeamAB) =>
    get(lineups)
      .filter(l => l.team === team && l.deletedAt == null && l.op !== 'delete')
      .map(l => l.playerId)


  const quickAdd = async (team: TeamAB) => {
    if (adding) return
    adding = true
    try {
      const pool = teamPlayers(team)
      const scorer = pool[0]
      if (!scorer) return
      await addGoalQuick({ matchId, team, half, scorerId: scorer })
    } finally {
      adding = false
    }
  }

  const changeScorer = async (id: ULID, v: string) =>
    updateGoal(id, { scorerId: v as ULID })

  const changeAssist = async (id: ULID, v: string) =>
    updateGoal(id, { assistId: v ? (v as ULID) : null })

  const changeMinute = async (id: ULID, v: string) => {
    const n = Number(v)
    await updateGoal(id, { minute: Number.isFinite(n) ? n : null })
  }

  const removeGoal = async (id: ULID) => deleteGoal(id)
</script>

<div class="rounded-xl border bg-white p-4 space-y-3">
  <div class="flex gap-2 items-center">
    <h2 class="text-base font-semibold">{$t('match_day.match.goals.title')}</h2>

    <div class="flex items-center gap-2 ml-4">
      <span class="text-sm">{$t('match_day.match.half_label')}</span>
      <label class="flex items-center gap-1"><input type="radio" value={1} bind:group={half}/> H1</label>
      <label class="flex items-center gap-1"><input type="radio" value={2} bind:group={half}/> H2</label>
    </div>

    <div class="flex gap-2 ml-auto">
      <button class="btn btn-danger !bg-red-800" onclick={() => quickAdd('A')}>+ <span class="hidden sm:block">{$t('match_day.match.team.red')}</span></button>
      <button class="btn !bg-black !text-white" onclick={() => quickAdd('B')}>+ <span class="hidden sm:block">{$t('match_day.match.team.black')}</span></button>
    </div>
  </div>

  {#if $goalsUniq.length === 0}
    <div class="text-sm text-gray-600">{$t('match_day.match.goals.empty')}</div>
  {:else}
    <ul class="space-y-2">
      {#each $goalsUniq as g (g.id)}
        <li class="rounded border px-2 py-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded border">
              {g.team === 'A' ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
              · {$t('match_day.match.half', { values: { n: g.half } })}
            </span>

            <select class="rounded border px-2 py-1"
              onchange={(e) => changeScorer(g.id, (e.currentTarget as HTMLSelectElement).value)}>
              {#each lineupOptions(g) as p (p.id)}
                <option value={p.id} selected={p.id === g.scorerId}>{p.name}</option>
              {/each}
            </select>

            <select class="rounded border px-2 py-1"
              onchange={(e) => changeAssist(g.id, (e.currentTarget as HTMLSelectElement).value)}>
              <option value="">{ $t('common.none') }</option>
              {#each lineupOptions(g) as p (p.id)}
                <option value={p.id} selected={p.id === g.assistId}>{p.name}</option>
              {/each}
            </select>

            <input class="rounded border px-2 py-1 w-20" type="number" min="0" max="200"
              value={g.minute ?? ''} onchange={(e) => changeMinute(g.id, (e.currentTarget as HTMLInputElement).value)} />

            <button class="ml-auto btn btn-danger" onclick={() => removeGoal(g.id)}>-
              <!-- {$t('common.delete')} -->
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
