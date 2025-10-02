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


/** Nyckel för anon latest sync i localStorage */
const ANON_META_KEY = 'fs.sync.anon.v1'
/** Versionera ifall payload/RLS ändras framöver */
const SCHEMA_VERSION = 1

/** Körbar TTL (ms) – justera fritt */
const DEFAULT_TTL = 15 * 60 * 1000 // 15 min

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
    if (!shouldAnonPull(metaKey, ttlMs)) return { pulled: 0 }

    const { nextWatermarks, wrote } = await doAnonPull(meta)

    // Uppdatera meta om något skrevs ELLER om någon watermark flyttades fram
    const advanced = Object.values(nextWatermarks ?? {}).some(Boolean)
    if (wrote > 0 || advanced) {
      updateAnonMetaAfterSuccess(metaKey, meta, nextWatermarks as AnonWatermarks)
    }

    return { pulled: wrote ?? 0 }
  } finally {
    anonBusy = false
  }
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