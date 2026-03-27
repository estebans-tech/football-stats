<script lang="ts">
  import { t } from 'svelte-i18n'
  import type { PlayerLocal, LineupLocal, TeamAB, Half, ULID } from '$lib/types/domain'
  import { addLineup, deleteLineup, updateLineup } from '$lib/data/lineups'

  type Props = {
    matchId: string
    players: Record<string, PlayerLocal>
    lineups: LineupLocal[]
    half?: Half
  }

  let { matchId, players, lineups, half = 1 }: Props = $props()

  let collapsed = $state(false)
  const busyByPlayer = new Map<ULID, boolean>()

  const roster = $derived.by(() => {
    const all = Object.values(players ?? {})
    const assigned = new Set(Object.keys(membershipById))
    return all
      .filter(p => (p.active && !p.deletedAt) || assigned.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const membershipById = $derived.by((): Record<string, TeamAB | undefined> => {
    const m: Record<string, TeamAB | undefined> = {}
    for (const lineup of (lineups ?? [])) {
      if (lineup.deletedAt == null && lineup.op !== 'delete' && lineup.half === half) {
        m[lineup.playerId] = lineup.team
      }
    }
    return m
  })

  const totalRedPlayers   = $derived(Object.values(membershipById).filter(t => t === 'A').length)
  const totalBlackPlayers = $derived(Object.values(membershipById).filter(t => t === 'B').length)
  const totalPlayers      = $derived(totalRedPlayers + totalBlackPlayers)

  const isInactive = (pid: string) => !players?.[pid]?.active
  const isBenched  = (pid: string) => membershipById[pid] === undefined
  const canAssign  = (pid: string, team: TeamAB) => membershipById[pid] !== team && !isInactive(pid)

  async function removeTeamPlayer(playerId: ULID, team: TeamAB) {
    const rows = (lineups ?? []).filter(l =>
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

  async function setTeamForPlayer(playerId: ULID, team: TeamAB) {
    const existing = (lineups ?? []).filter(l =>
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
    if (head.team !== team) await updateLineup(head.id, { team })
    if (rest.length) await Promise.allSettled(rest.map(r => deleteLineup(r.id)))
  }

  async function assign(pid: string, team: TeamAB) {
    await setTeamForPlayer(pid, team)
  }

  async function toBench(pid: ULID) {
    await Promise.allSettled([
      removeTeamPlayer(pid, 'A'),
      removeTeamPlayer(pid, 'B')
    ])
  }

  function guard(fn: () => Promise<void>, pid: ULID) {
    if (busyByPlayer.get(pid)) return
    busyByPlayer.set(pid, true)
    fn().finally(() => busyByPlayer.set(pid, false))
  }

  function pillClass(pid: string) {
    const team = membershipById[pid]
    if (team === 'A') return 'w-full rounded border px-3 py-2 bg-red-800 text-white border-red-700 text-left'
    if (team === 'B') return 'w-full rounded border px-3 py-2 bg-black text-white border-black text-right'
    return 'w-full rounded border px-3 py-2 bg-white/5 text-white/50 border-white/10 text-center'
  }

  function rowClass(pid: string) {
    const team = membershipById[pid]
    if (team === 'A') return 'flex flex-1 justify-start'
    if (team === 'B') return 'flex flex-1 justify-end'
    return 'flex flex-1 justify-center'
  }

  const redBtnClass = (disabled: boolean) => [
    'btn btn-sm btn-danger',
    disabled ? 'opacity-50 cursor-default' : '',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
  ].join(' ')

const blackBtnClass = (disabled: boolean) => [
  'btn btn-sm !bg-black !text-white border border-white/20',
  disabled ? 'opacity-50 cursor-default' : 'hover:!bg-gray-900',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
].join(' ')

const benchBtnClass = (benched: boolean) =>
  'btn btn-sm border ' + (benched
    ? 'bg-transparent text-white/20 border-white/8 cursor-default'
    : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10')

  $effect(() => {
    if (totalRedPlayers + totalBlackPlayers === roster.length) collapsed = true
  })
</script>

<section class="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
  <header class="sticky top-14 z-10 -mx-4 px-4 py-2 bg-[#1a1212]/90 backdrop-blur flex items-center gap-3 border-b border-white/8">
    <h2 class="text-base font-semibold text-white">{$t('match_day.match.lineups.title')}</h2>
  </header>

  <div class="{collapsed ? 'max-h-40 pb-5 overflow-hidden [mask-image:linear-gradient(to_bottom,black_90%,transparent)]' : ''}">
    <ul id="lineups" class="space-y-2 pr-1">
      {#each roster as p (p.id)}
        <li class="flex items-center justify-between gap-x-3">
          <div class={rowClass(p.id)}>
            <div class={pillClass(p.id)}>
              <span class="truncate">{p.nickname ?? p.name}</span>
              {#if isInactive(p.id)}
                <span class="mt-1 inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/20 text-white/50">
                  Inactive
                </span>
              {/if}
            </div>
          </div>

          <div class="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              class={redBtnClass(!canAssign(p.id, 'A'))}
              disabled={!canAssign(p.id, 'A')}
              onclick={() => guard(() => assign(p.id, 'A'), p.id)}
              aria-label={$t('common.add')}
            >＋</button>

            <button
              type="button"
              class={blackBtnClass(!canAssign(p.id, 'B'))}
              disabled={!canAssign(p.id, 'B')}
              onclick={() => guard(() => assign(p.id, 'B'), p.id)}
              aria-label={$t('common.add')}
            >＋</button>

            <button
              class={benchBtnClass(isBenched(p.id))}
              disabled={isBenched(p.id)}
              onclick={() => guard(() => toBench(p.id), p.id)}
            >−</button>
         </div>
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex items-center justify-end gap-4 text-sm text-white/60">
    <span>{$t('match_day.match.team.red')}: {totalRedPlayers}</span>
    <span>{$t('match_day.match.team.black')}: {totalBlackPlayers}</span>
    <span class="text-white/35">Total: {totalPlayers}</span>
  </div>

  <div class="flex justify-center">
    <button
      class="btn btn-sm btn-soft"
      onclick={() => collapsed = !collapsed}
      aria-expanded={!collapsed}
      aria-controls="lineups"
    >
      {collapsed ? $t('common.expand') : $t('common.collapse')}
    </button>
  </div>
</section>

