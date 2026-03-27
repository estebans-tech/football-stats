<script lang="ts">
  import { browser } from '$app/environment'
  import { t, locale } from 'svelte-i18n'
  import { db } from '$lib/db/dexie'
  import { formatDate } from '$lib/utils/utils'
  import type { PageData } from './$types'
  import type {
    MatchLocal,
    GoalLocal,
    LineupLocal,
    PlayerLocal,
    AppearanceRow
  } from '$lib/types/domain'
  import SessionStatistic from '$lib/components/session/SessionStatistic.svelte'
  import Heading from '$lib/components/Heading.svelte'
  import PageContainer from '$lib/components/PageContainer.svelte'

  type Props = { data: PageData }
  let { data }: Props = $props()

  let matches  = $state<MatchLocal[]>([])
  let goals    = $state<GoalLocal[]>([])
  let lineups  = $state<LineupLocal[]>([])
  let players  = $state<Record<string, PlayerLocal>>({})
  let session  = $state<{ date: string; id: string } | null>(null)
  let loaded   = $state(false)

  const fmt = $derived((iso: string) => formatDate(iso, $locale))

  const appearance = $derived.by<AppearanceRow[]>(() => {
    const counts = new Map<string, number>()
    for (const l of lineups) {
      if (l.deletedAt || l.half !== 1) continue
      counts.set(l.playerId, (counts.get(l.playerId) ?? 0) + 1)
    }
    const rows: AppearanceRow[] = []
    for (const [id, appearances] of counts) {
      const player = players[id]
      if (player) rows.push({ id, player, appearances })
    }
    return rows.sort((a, b) => b.appearances - a.appearances)
  })

  async function load() {
    if (!browser) return
    const sessionId = data.id

    const sessionRow = await db.sessions_local.get(sessionId)
    if (sessionRow) session = { date: sessionRow.date, id: sessionRow.id }

    const matchRows = await db.matches_local
      .where('sessionId')
      .equals(sessionId)
      .filter(m => !m.deletedAt)
      .toArray()

    matchRows.sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
    matches = matchRows

    const matchIds = matchRows.map(m => m.id)

    const [goalRows, lineupRows, playerRows] = await Promise.all([
      matchIds.length
        ? db.goals_local.where('matchId').anyOf(matchIds).and(g => !g.deletedAt).toArray()
        : Promise.resolve([]),
      matchIds.length
        ? db.lineups_local.where('matchId').anyOf(matchIds).and(l => !l.deletedAt).toArray()
        : Promise.resolve([]),
      db.players_local.toArray()
    ])

    goals   = goalRows
    lineups = lineupRows
    players = Object.fromEntries(playerRows.map(p => [p.id, p]))
    loaded  = true
  }

  $effect(() => { load() })
</script>

<PageContainer>
  <header class="flex flex-col gap-2 my-6 md:flex-row md:items-center md:justify-between md:gap-4">
    <Heading level={1} underline>
      {#if session}{fmt(session.date)}{:else}…{/if}
    </Heading>
    <a href="/" class="self-start md:self-auto btn btn-outline text-sm active:scale-95">
      {$t('common.back')}
    </a>
  </header>

  {#if loaded}
    <SessionStatistic
      {matches}
      {goals}
      {lineups}
      {players}
      {appearance}
    />
  {:else}
    <p class="py-8 text-center text-sm text-white/50">{$t('common.loading')}</p>
  {/if}
</PageContainer>

