<script lang="ts">
    import { browser } from '$app/environment'
    import { writable } from 'svelte/store'
    import type { PageData } from './$types'
    import { db } from '$lib/db/dexie'
    import { t } from 'svelte-i18n'
    import SessionStatistic from '$lib/components/session/SessionStatistic.svelte'

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
                .filter(m => !m.deletedAtLocal)
                .toArray();

            matches.sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0));
            matches$.set(matches);

            const matchIds = matches.map(m => m.id);

            // Hämta bara icke-borttagna mål & lineups för de här matcherna
            const [goals, lineups, players] = await Promise.all([
                matchIds.length
                ? db.goals_local
                    .where('matchId').anyOf(matchIds)
                    .and(g => !g.deletedAtLocal)
                    .toArray()
                : Promise.resolve([]),
                matchIds.length
                ? db.lineups_local
                    .where('matchId').anyOf(matchIds)
                    .and(l => !l.deletedAtLocal)
                    .toArray()
                : Promise.resolve([]),
                db.players_local.toArray()
            ]);

            goals$.set(goals);
            lineups$.set(lineups);
            players$.set(Object.fromEntries(players.map(p => [p.id, p])));
            })()
        : Promise.resolve();
</script>
<section class="mx-auto max-w-5xl w-full space-y-6">
    <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">{$t('session.statistics.title')}</h1>
        <a href="/" class="text-sm underline hover:no-underline">{$t('common.back')}</a>
    </header>

    {#await ready}{:then}
        <SessionStatistic
        matches={$matches$}
        goals={$goals$}
        lineups={$lineups$}
        players={$players$}
        />
    {/await}
</section>