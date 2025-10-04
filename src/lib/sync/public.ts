// lib/sync/public.ts
import { browser } from '$app/environment'
import type { AnonSyncMeta, AnonWatermarks } from '$lib/types/sync'
import { assertDb } from '$lib/db/dexie'
import { getSupabase } from '$lib/supabase/client'
import { updateAnonSyncMeta } from '$lib/sync/state'
import { fetchCloudSessionsSince, preloadLocalSessions, applyCloudRowToLocal } from '$lib/sync/sessions'
import { fetchCloudMatchesSince, preloadLocalMatches, applyCloudMatchToLocal } from '$lib/sync/matches'
import { fetchCloudLineupsSince, preloadLocalLineups, applyCloudLineupToLocal } from '$lib/sync/lineups'
import { fetchCloudGoalsSince, preloadLocalGoals, applyCloudGoalToLocal } from '$lib/sync/goals'
import { fetchCloudPlayersSince, preloadLocalPlayers } from '$lib/sync/players'
import { toMs } from '$lib/utils/utils'

import type { CloudSession } from '$lib/types/cloud'
import type { PublicPullResult } from '$lib/types/sync'
// TODO: flytta
export type PublicTable = 'sessions' | 'matches' | 'lineups' | 'goals'


/** Nyckel för anon latest sync i localStorage */
const ANON_META_KEY = 'fs.sync.anon.v1'
/** Versionera ifall payload/RLS ändras framöver */
const SCHEMA_VERSION = 1

/** Körbar TTL (ms) – justera fritt */
const DEFAULT_TTL = 15 * 60 * 1000 // 15 min
const RECON_TTL = 24 * 60 * 60 * 1000 // 1 dygn

/** Enkel semafor så vi inte kör parallella pulls */
let anonBusy = false

type EnsureOpts = { ttlMs?: number; force?: boolean; metaKey?: string }
/**
 * Läs anon-sync meta från localStorage.
 * - Inget krusidull: returnerar exakt strukturen du angav.
 * - Vid SSR, saknad nyckel eller korrupt JSON → defaults.
 */
export function readAnonSyncMeta(key: string): AnonSyncMeta {
  const defaults: AnonSyncMeta = {
    lastSyncedAt: null,
    watermarks: {},
    schemaVersion: 1
  }

  if (!browser) return defaults

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<AnonSyncMeta> | null
    if (!parsed) return defaults

    return {
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
      watermarks: (parsed.watermarks && typeof parsed.watermarks === 'object')
        ? parsed.watermarks
        : {},
      schemaVersion:
        typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1
    }
  } catch {
    return defaults
  }
}

/**
 * Ska vi göra anon-pull nu?
 * - true om ingen meta finns (dvs lastSyncedAt saknas)
 * - true om lastSyncedAt är äldre än ttlMs
 */
export function shouldAnonPull(metaKey: string, ttlMs: number): boolean {
  const meta = readAnonSyncMeta(metaKey)
  if (!meta.lastSyncedAt) return true
  const age = Date.now() - meta.lastSyncedAt
  return age >= ttlMs
}

/**
 * Uppdatera meta efter en lyckad pull (kallas när Dexie skrivits klart).
 * - prevMeta: meta du läst innan pullen (från readAnonSyncMeta(metaKey))
 * - nextWatermarks: serverns nya vattenstämplar
 */
export function updateAnonMetaAfterSuccess(
  metaKey: string,
  prevMeta: AnonSyncMeta,
  nextWatermarks: AnonWatermarks
): void {
  const next: AnonSyncMeta = {
    ...prevMeta,
    lastSyncedAt: Date.now(),
    watermarks: { ...prevMeta.watermarks, ...nextWatermarks },
    schemaVersion: prevMeta.schemaVersion ?? 1
  }

  updateAnonSyncMeta(metaKey, JSON.stringify(next))
}

/**
 * ensureAnonData
 * - Minimal orkestrering: besluta → pull → uppdatera meta
 *
 * @param metaKey   t.ex. 'fs.sync.anon.v1'
 * @param ttlMs     t.ex. 15 * 60 * 1000
 * @param doPull    DIN pull-funktion som hämtar & skriver till Dexie och returnerar nextWatermarks
 *                  Signatur: () => Promise<{ nextWatermarks: AnonWatermarks, wrote: number }>
 */
export async function ensureAnonData(metaKey?: string, ttlMs?: number): Promise<{ pulled: number }> {
  if (anonBusy) return { pulled: 0 }
  anonBusy = true

  metaKey ??= ANON_META_KEY
  ttlMs   ??= DEFAULT_TTL

  try {
    const meta = readAnonSyncMeta(metaKey)
    // ① Reconcile har egen TTL och ska kunna köras oberoende av pull
    const now = Date.now()
    const needsRecon = now - (meta.lastReconciledAt ?? 0) >= RECON_TTL
    if (needsRecon) {
      const remoteSessionIds = await fetchAllIds('sessions')
      const removedSessions  = await reconcileLocal('sessions', remoteSessionIds)
      if (removedSessions.length) await cascadeDeleteLocalForSessions(removedSessions)

      meta.lastReconciledAt = now
      // Viktigt: spara meta även om vi inte gör pull
      updateAnonSyncMeta(metaKey, meta)
    }

    // ② Vanlig pull enligt egen TTL
    if (!shouldAnonPull(metaKey, ttlMs)) return { pulled: 0 }

    const { nextWatermarks, wrote } = await doAnonPull(meta)

    // Uppdatera meta om något skrevs ELLER om någon watermark flyttades fram
    const advanced = wrote > 0 || Object.values(nextWatermarks ?? {}).some(Boolean)
    if (advanced || wrote) {
      updateAnonMetaAfterSuccess(metaKey, meta, nextWatermarks as AnonWatermarks)
    }

    return { pulled: wrote ?? 0 }
  } finally {
    anonBusy = false
  }
}

/**
 * Hämtar ALLA id:n för en tabell via RLS (anon).
 * - Paginering (range) för stora tabeller
 * - Returnerar Set<string> med unika id:n
 */
export async function fetchAllIds(table: PublicTable): Promise<Set<string>> {
  const sb = getSupabase()
  if (!sb) return new Set()

  const pageSize = 1000
  const ids: string[] = []
  let from = 0
  let to = pageSize - 1

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select('id')
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw new Error(`fetchAllIds(${table}) failed: ${error.message}`)

    const batch = (data ?? []).map((r: any) => String(r.id))
    if (batch.length === 0) break

    ids.push(...batch)
    if (batch.length < pageSize) break

    from += pageSize
    to += pageSize
  }

  return new Set(ids)
}

async function getAllLocalIds(table: PublicTable): Promise<string[]> {
  const db = assertDb()
  switch (table) {
    case 'sessions': return db.sessions_local.toCollection().primaryKeys() as Promise<string[]>
    case 'matches':  return db.matches_local.toCollection().primaryKeys()  as Promise<string[]>
    case 'lineups':  return db.lineups_local.toCollection().primaryKeys()  as Promise<string[]>
    case 'goals':    return db.goals_local.toCollection().primaryKeys()    as Promise<string[]>
  }
}
export async function reconcileLocal(table: PublicTable, remoteIds: Set<string>): Promise<string[]> {
  const db = assertDb()
  const localIds = new Set(await getAllLocalIds(table))
  const toRemove: string[] = []
  for (const id of localIds) if (!remoteIds.has(id)) toRemove.push(id)

  if (toRemove.length === 0) return []

  switch (table) {
    case 'sessions': await db.sessions_local.bulkDelete(toRemove); break
    case 'matches':  await db.matches_local.bulkDelete(toRemove);  break
    case 'lineups':  await db.lineups_local.bulkDelete(toRemove);  break
    case 'goals':    await db.goals_local.bulkDelete(toRemove);    break
  }
  return toRemove
}

export async function cascadeDeleteLocalForSessions(sessionIds: string[]): Promise<void> {
  if (!sessionIds.length) return
  const db = assertDb()

  const matchIds = (await db.matches_local
    .where('session_id')  // kräver index i Dexie
    .anyOf(sessionIds)
    .primaryKeys()) as string[]

  await db.transaction('rw', db.matches_local, db.lineups_local, db.goals_local, async () => {
    if (matchIds.length) {
      const lineupIds = (await db.lineups_local.where('match_id').anyOf(matchIds).primaryKeys()) as string[]
      const goalIds   = (await db.goals_local.where('match_id').anyOf(matchIds).primaryKeys())   as string[]

      if (lineupIds.length) await db.lineups_local.bulkDelete(lineupIds)
      if (goalIds.length)   await db.goals_local.bulkDelete(goalIds)
      await db.matches_local.bulkDelete(matchIds)
    }
  })
}

/** 1) Sessions (public) */
export async function pullSessionsPublic(sinceIso?: string): Promise<PublicPullResult> {
  const sb = getSupabase()
  if (!sb) return { pulled: 0, nextWatermark: sinceIso }

  // 1) Hämta publika sessions via samma fetch-funktion (utan club_id)
  const cloudRows = await fetchCloudSessionsSince(sb, undefined, sinceIso)

  // 2) Skriv till Dexie med dina befintliga helpers
  const db = assertDb()
  let maxUpdatedAtMs = sinceIso ? Date.parse(sinceIso) : 0

  await db.transaction('rw', db.sessions_local, async () => {
    const localById = await preloadLocalSessions(db, cloudRows.map((r: CloudSession) => r.id))

    for (const row of cloudRows) {
      const updatedAtMs = toMs ? toMs(row.updated_at) : Date.parse(row.updated_at ?? '')
      if (updatedAtMs !== null && Number.isFinite(updatedAtMs) && updatedAtMs > maxUpdatedAtMs) {
        maxUpdatedAtMs = updatedAtMs
      }

      await applyCloudRowToLocal(db, row, localById.get(row.id))
    }
  })

  const nextWatermark = maxUpdatedAtMs > 0 ? new Date(maxUpdatedAtMs).toISOString() : sinceIso
  return { pulled: cloudRows.length, nextWatermark }
}

/** 2) Matches (public) */
export async function pullMatchesPublic(sinceIso?: string): Promise<PublicPullResult> {
  // TODO: hämta publika matches sedan sinceIso → upsert Dexie
  const sb = getSupabase()
  if (!sb) return { pulled: 0, nextWatermark: sinceIso }

  // 1) Hämta publika matcher via RLS (ingen club_id för anon)
  const cloudRows = await fetchCloudMatchesSince(sb, undefined, sinceIso)

  // 2) Skriv till Dexie
  const db = assertDb()
  let maxUpdatedAtMs = sinceIso ? Date.parse(sinceIso) : 0

  await db.transaction('rw', db.matches_local, async () => {
    const localById = await preloadLocalMatches(db, cloudRows.map(r => r.id))
    for (const row of cloudRows) {
      const t = row.updated_at ? Date.parse(row.updated_at) : NaN
      if (Number.isFinite(t) && t > maxUpdatedAtMs) maxUpdatedAtMs = t
      await applyCloudMatchToLocal(db, row, localById.get(row.id))
    }
  })

  const nextWatermark =
    maxUpdatedAtMs > 0 ? new Date(maxUpdatedAtMs).toISOString() : sinceIso

  return { pulled: cloudRows.length, nextWatermark }
}

/** 3) Lineups (public) */
export async function pullLineupsPublic(sinceIso?: string): Promise<PublicPullResult> {
  const sb = getSupabase()
  if (!sb) return { pulled: 0, nextWatermark: sinceIso }

  // 1) Hämta publika lineups (RLS)
  const cloudRows = await fetchCloudLineupsSince(sb, undefined, sinceIso)

  // 2) Skriv till Dexie
  const db = assertDb()
  let maxMs = sinceIso ? Date.parse(sinceIso) : 0

  await db.transaction('rw', db.lineups_local, async () => {
    const localById = await preloadLocalLineups(db, cloudRows.map(r => r.id))
    for (const row of cloudRows) {
      const t = row.updated_at ? Date.parse(row.updated_at) : NaN
      if (Number.isFinite(t) && t > maxMs) maxMs = t
      await applyCloudLineupToLocal(db, row, localById.get(row.id))
    }
  })

  const nextWatermark = maxMs > 0 ? new Date(maxMs).toISOString() : sinceIso
  return { pulled: cloudRows.length, nextWatermark }
}

/** 4) Goals (public) */
export async function pullGoalsPublic(sinceIso?: string): Promise<PublicPullResult> {
  const sb = getSupabase()
  if (!sb) return { pulled: 0, nextWatermark: sinceIso }

  // 1) Hämta publika (RLS, ingen club_id för anon)
  const cloudRows = await fetchCloudGoalsSince(sb, undefined, sinceIso)

  // 2) Skriv till Dexie
  const db = assertDb()
  let maxMs = sinceIso ? Date.parse(sinceIso) : 0

  await db.transaction('rw', db.goals_local, async () => {
    const localById = await preloadLocalGoals(db, cloudRows.map(r => r.id))
    for (const row of cloudRows) {
      const t = row.updated_at ? Date.parse(row.updated_at) : NaN
      if (Number.isFinite(t) && t > maxMs) maxMs = t
      await applyCloudGoalToLocal(db, row, localById.get(row.id))
    }
  })

  const nextWatermark = maxMs > 0 ? new Date(maxMs).toISOString() : sinceIso
  return { pulled: cloudRows.length, nextWatermark }
}

/** 5) Players (public) */
export async function pullPlayersPublic(sinceIso?: string): Promise<PublicPullResult> {
  const sb = getSupabase()
  if (!sb) return { pulled: 0, nextWatermark: sinceIso }

  // 1) Hämta publika (RLS; ingen club_id för anon)
  const cloudRows = await fetchCloudPlayersSince(sb, undefined, sinceIso)

  // 2) Skriv till Dexie
  const db = assertDb()
  const mapped = preloadLocalPlayers(cloudRows)
  await db.players_local.bulkPut(mapped)

  // 3) Beräkna watermark (senaste updated_at)
  let maxMs = sinceIso ? Date.parse(sinceIso) : 0
  for (const r of cloudRows) {
    const t = r.updated_at ? Date.parse(String(r.updated_at)) : NaN
    if (Number.isFinite(t) && t > maxMs) maxMs = t
  }

  const nextWatermark = maxMs > 0 ? new Date(maxMs).toISOString() : sinceIso
  return { pulled: cloudRows.length, nextWatermark }
}

/** Komposition: använd denna i ensureAnonData() */
export async function doAnonPull(meta: AnonSyncMeta): Promise<{ nextWatermarks: AnonWatermarks; wrote: number }> {
  const wm = meta.watermarks ?? {}

  const s = await pullSessionsPublic(wm.sessions)
  const m = await pullMatchesPublic(wm.matches)
  const l = await pullLineupsPublic(wm.lineups)
  const g = await pullGoalsPublic(wm.goals)
  const p = await pullPlayersPublic(wm.players)

  return {
    nextWatermarks: {
      sessions: s.nextWatermark,
      matches:  m.nextWatermark,
      lineups:  l.nextWatermark,
      goals:    g.nextWatermark,
      players:  p.nextWatermark
    },
    wrote: (s.pulled || 0) + (m.pulled || 0) + (l.pulled || 0) + (g.pulled || 0) + (p.pulled || 0)
  }
}


/* Hjälp (om du vill ha en enkel max-ISO lokalt) */
function maxISO(values: (string | undefined)[] = []): string | undefined {
  let max = 0
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isFinite(t) && t > max) max = t
  }
  return max ? new Date(max).toISOString() : undefined
}