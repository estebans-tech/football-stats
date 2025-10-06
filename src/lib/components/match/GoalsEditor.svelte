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

<div class="rounded-xl bg-white ring-1 ring-black/10 p-4 space-y-4">
  <!-- Sticky tools row -->
  <header
    class="sticky top-14 z-10 -mx-4 px-4 py-2 bg-white/85 supports-[backdrop-filter]:bg-white/60 backdrop-blur flex items-center gap-3 border-b border-black/5"
  >
    <h2 class="text-base font-semibold">{$t('match_day.match.goals.title')}</h2>

    <!-- Segmented H1/H2 (no class: directives) -->
    <div class="shrink-0">
      <input id="half-1" type="radio" value={1} bind:group={half} class="sr-only" />
      <input id="half-2" type="radio" value={2} bind:group={half} class="sr-only" />
      <div class="inline-flex overflow-hidden rounded-2xl border border-black/10">
        <label
          for="half-1"
          class={`px-3 py-1.5 text-sm cursor-pointer ${half === 1 ? 'bg-black/80 text-white' : 'bg-white text-black'}`}
        >
          H1
        </label>
        <label
          for="half-2"
          class={`px-3 py-1.5 text-sm cursor-pointer ${half === 2 ? 'bg-black/80 text-white' : 'bg-white text-black'}`}
        >
          H2
        </label>
      </div>
    </div>

    <!-- Quick add buttons -->
    <div class="flex items-center gap-2  ml-auto">
      <button type="button" class="btn btn-danger btn-sm" onclick={() => quickAdd('A')}>
        + <span class="hidden sm:inline">{$t('match_day.match.team.red')}</span>
      </button>
      <button type="button" class="btn btn-sm !bg-black !text-white" onclick={() => quickAdd('B')}>
        + <span class="hidden sm:inline">{$t('match_day.match.team.black')}</span>
      </button>
    </div>
  </header>

  <!-- Big tap targets on mobile -->
  <div class="space-y-3 hidden">
    <button
      type="button"
      class="w-full h-12 md:h-12 rounded-2xl bg-red-900 text-white grid place-items-center hover:brightness-110 active:translate-y-px"
      onclick={() => quickAdd('A')}
      aria-label={$t('match_day.match.team.red')}
    >
      +
    </button>
    <button
      type="button"
      class="w-full h-12 md:h-12 rounded-2xl bg-black text-white grid place-items-center hover:brightness-110 active:translate-y-px"
      onclick={() => quickAdd('B')}
      aria-label={$t('match_day.match.team.black')}
    >
      +
    </button>
  </div>

  {#if $goalsUniq.length === 0}
    <div class="text-sm text-gray-600">{$t('match_day.match.goals.empty')}</div>
  {:else}
    <ul class="space-y-3">
      {#each $goalsUniq as g (g.id)}
        <li class="rounded-2xl border border-black/10 p-3">
          <div class="flex flex-wrap items-center gap-3">
            <!-- Pill: team + half -->
            <span class="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-black/[.03] border border-black/10">
              <span
                class={`inline-block size-2.5 rounded-full ${g.team === 'A' ? 'bg-red-900' : 'bg-black/80'}`}
                aria-hidden="true"
              ></span>
              {g.team === 'A' ? $t('match_day.match.team.red') : $t('match_day.match.team.black')}
              <span class="text-black/40">·</span>
              {$t('match_day.match.half', { values: { n: g.half } })}
            </span>

            <!-- Scorer -->
            <select
              class="rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
              onchange={(e) => changeScorer(g.id, (e.currentTarget as HTMLSelectElement).value)}
            >
              {#each lineupOptions(g) as p (p.id)}
                <option value={p.id} selected={p.id === g.scorerId}>{p.name}</option>
              {/each}
            </select>

            <!-- Assist -->
            <select
              class="rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
              onchange={(e) => changeAssist(g.id, (e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">{ $t('common.none') }</option>
              {#each lineupOptions(g) as p (p.id)}
                <option value={p.id} selected={p.id === g.assistId}>{p.name}</option>
              {/each}
            </select>

            <!-- Minute -->
            <input
              class="rounded-xl border border-black/15 px-3 py-2 w-20 text-sm"
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
              X
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>