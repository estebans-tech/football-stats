<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { GoalLocal, Half, TeamAB, ULID, LineupLocal } from '$lib/types/domain'
  import { addGoalQuick, updateGoal, deleteGoal } from '$lib/data/goals'

  type Props = {
    matchId: ULID
    half?: Half
    goals: GoalLocal[]
    lineups: LineupLocal[]
    lineupFor: (g: GoalLocal) => Array<{ id: ULID; name: string }>
  }

  let { matchId, half = $bindable(1), goals, lineups, lineupFor }: Props = $props()

  let adding = $state(false)

  // Deduplicate and filter visible goals
  const goalsUniq = $derived.by(() => {
    const visible = goals.filter(g => g.deletedAt == null && g.op !== 'delete')
    const seen = new Set<ULID>()
    const out: GoalLocal[] = []
    for (const g of visible) {
      if (!seen.has(g.id)) {
        seen.add(g.id)
        out.push(g)
      }
    }
    return out
  })

  function lineupOptions(g: GoalLocal) {
    const m = new Map<ULID, { id: ULID; name: string }>()
    for (const p of lineupFor(g)) if (!m.has(p.id)) m.set(p.id, p)
    return Array.from(m.values())
  }

  function teamPlayers(team: TeamAB): ULID[] {
    return lineups
      .filter(l => l.team === team && l.deletedAt == null && l.op !== 'delete')
      .map(l => l.playerId)
  }

  async function quickAdd(team: TeamAB) {
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

  const changeScorer = (id: ULID, v: string) => updateGoal(id, { scorerId: v as ULID })
  const changeAssist = (id: ULID, v: string) => updateGoal(id, { assistId: v ? (v as ULID) : null })
  const changeMinute = (id: ULID, v: string) => {
    const n = Number(v)
    updateGoal(id, { minute: Number.isFinite(n) ? n : null })
  }
  const removeGoal = (id: ULID) => deleteGoal(id)
</script>

<div class="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">

  <!-- Header -->
  <header class="sticky top-14 z-10 -mx-4 px-4 py-2 bg-[#1a1212]/90 backdrop-blur flex items-center gap-3 border-b border-white/8">
    <h2 class="text-base font-semibold text-white">{$t('match_day.match.goals.title')}</h2>

    <!-- H1/H2 segmented control -->
    <div class="shrink-0">
      <input id="half-1" type="radio" value={1} bind:group={half} class="sr-only" />
      <input id="half-2" type="radio" value={2} bind:group={half} class="sr-only" />
      <div class="inline-flex overflow-hidden rounded-xl border border-white/15">
        <label
          for="half-1"
          class="px-3 py-1.5 text-sm cursor-pointer transition-colors {half === 1 ? 'bg-white/35 text-white' : 'text-white/50 hover:text-white/80'}"
        >
          H1
        </label>
        <label
          for="half-2"
          class="px-3 py-1.5 text-sm cursor-pointer transition-colors {half === 2 ? 'bg-white/35 text-white' : 'text-white/50 hover:text-white/80'}"
        >
          H2
        </label>
      </div>
    </div>

    <!-- Quick add -->
    <div class="flex items-center gap-2 ml-auto">
      <button
        type="button"
        class="btn btn-danger btn-sm"
        onclick={() => quickAdd('A')}
        disabled={adding}
      >
        + <span class="hidden sm:inline">{$t('match_day.match.team.red')}</span>
      </button>
      <button
        type="button"
        class="btn btn-sm hover:!bg-white/90" 
        onclick={() => quickAdd('B')}
        disabled={adding}
      >
        + <span class="hidden sm:inline">{$t('match_day.match.team.black')}</span>
      </button>
    </div>
  </header>

  <!-- Goals list -->
  {#if goalsUniq.length === 0}
    <p class="text-sm text-white/40">{$t('match_day.match.goals.empty')}</p>
  {:else}
    <ul class="space-y-3">
      {#each goalsUniq as g (g.id)}
        <li class="rounded-xl border border-white/10 bg-white/5 p-3">
          <div class="flex flex-wrap items-center gap-3">

            <!-- Team + half badge -->
            <span class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border
                         {g.team === 'A' ? 'bg-red-900/30 border-red-700/40 text-red-300' : 'bg-white/8 border-white/15 text-white/70'}">
              <span class="size-2 rounded-full {g.team === 'A' ? 'bg-red-500' : 'bg-white/40'}"></span>
              {g.team === 'A' ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
              <span class="opacity-40">·</span>
              {$t('match_day.match.half', { values: { n: g.half } })}
            </span>

            <!-- Scorer -->
            <select
              class="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm text-white"
              onchange={(e) => changeScorer(g.id, (e.currentTarget as HTMLSelectElement).value)}
            >
              {#each lineupOptions(g) as p (p.id)}
                <option value={p.id} selected={p.id === g.scorerId}>{p.name}</option>
              {/each}
            </select>

            <!-- Assist -->
            <select
              class="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm text-white"
              onchange={(e) => changeAssist(g.id, (e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">{$t('common.none')}</option>
              {#each lineupOptions(g) as p (p.id)}
                <option value={p.id} selected={p.id === g.assistId}>{p.name}</option>
              {/each}
            </select>

            <!-- Minute -->
            <input
              class="rounded-xl border border-white/15 bg-white/8 px-3 py-2 w-20 text-sm text-white"
              type="number"
              inputmode="numeric"
              min="0"
              max="200"
              placeholder="min"
              value={g.minute ?? ''}
              onchange={(e) => changeMinute(g.id, (e.currentTarget as HTMLInputElement).value)}
            />

            <!-- Delete -->
            <button
              type="button"
              class="ml-auto btn btn-danger btn-sm"
              onclick={() => removeGoal(g.id)}
              aria-label={$t('common.delete')}
            >
              ✕
            </button>

          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
