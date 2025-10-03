<script lang="ts">
    import { browser } from '$app/environment'
    import { writable, derived } from 'svelte/store'
    import type { PageData } from './$types'
    import { db } from '$lib/db/dexie'
    import { t } from 'svelte-i18n'
    import SessionStatistic from '$lib/components/session/SessionStatistic.svelte'
    import Heading from '$lib/components/Heading.svelte'

    import type {
        MatchLocal,
        GoalLocal,
        LineupLocal,
        PlayerLocal
    } from '$lib/types/domain'

    // ---------- props (runes)
    type Props = { data: PageData }
    let { data }: Props = $props()

    // ---------- snapshot stores
    const matches$ = writable<MatchLocal[]>([])
    const goals$   = writable<GoalLocal[]>([])
    const lineups$ = writable<LineupLocal[]>([])
    const players$ = writable<Record<string, PlayerLocal>>({})
    const appearance$ = writable<Record<string, PlayerLocal>>({})

    type AppearanceRow = { id: string; player: PlayerLocal; appearances: number }
    export const appearancesList$ = derived(
  [lineups$, players$],
  ([$lineups, $players]): AppearanceRow[] => {
    const counts = new Map<string, number>()

    // count appearances per playerId from the already-filtered lineups
    for (const lu of $lineups) {
      if (lu?.deletedAt) continue
      const pid = lu?.playerId as string | undefined
      if (!pid) continue
      counts.set(pid, (counts.get(pid) ?? 0) + 1)
    }

    // build rows only for players we can resolve
    const rows: AppearanceRow[] = []
    for (const [id, appearances] of counts) {
      const player = $players[id]
      if (player) rows.push({ id, player, appearances })
    }

    // optional: sort by player name
    rows.sort((a, b) => a.player.name.localeCompare(b.player.name))
    return rows
  },
  [] as AppearanceRow[]
)
    const ready: Promise<void> = browser
        ? (async () => {
            const sessionId = data.id as string;
            if (!sessionId) {
                const players = await db.players_local.toArray();
                players$.set(Object.fromEntries(players.map(p => [p.id, p])));
                return;
            }

            // Hämta enbart icke-borttagna matcher och sortera efter orderNo
            const matches = await db.matches_local
                .where('sessionId')
                .equals(sessionId)
                .filter(m => !m.deletedAt)
                .toArray();

            matches.sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0));
            matches$.set(matches);

            const matchIds = matches.map(m => m.id);

            // Hämta bara icke-borttagna mål & lineups för de här matcherna
            const [goals, lineups, players] = await Promise.all([
                matchIds.length
                ? db.goals_local
                    .where('matchId').anyOf(matchIds)
                    .and(g => !g.deletedAt)
                    .toArray()
                : Promise.resolve([]),
                matchIds.length
                ? db.lineups_local
                    .where('matchId').anyOf(matchIds)
                    .and(l => !l.deletedAt)
                    .toArray()
                : Promise.resolve([]),
                db.players_local.toArray()
            ]);

            goals$.set(goals);
            lineups$.set(lineups);
            players$.set(Object.fromEntries(players.map(p => [p.id, p])));
            const ids = new Set<string>();
            for (const lu of lineups) {
                const pid = lu.playerId as string | undefined;
                if (pid) ids.add(pid);
            }
            const appearanceRec: Record<string, PlayerLocal> = {};
            for (const id of ids) {
                const p = players.find(pp => pp.id === id);
                if (p) appearanceRec[id] = p;
            }
            appearance$.set(appearanceRec);
            })()
        : Promise.resolve();
</script>
<section class="max-w-5xl space-y-6">
  <header class="flex flex-col gap-2
               md:flex-row md:items-center md:justify-between md:gap-4">
    <Heading level={1} underline>
      {$t('session.statistics.title')}
    </Heading>

    <a href="/" class="self-start md:self-auto btn btn-outline text-sm active:scale-95">
      {$t('common.back')}
    </a>
  </header>

  {#await ready}{:then}
  <SessionStatistic
      matches={$matches$}
      goals={$goals$}
      lineups={$lineups$}
      players={$players$}
      appearance={$appearancesList$}
    />
  {/await}
</section>