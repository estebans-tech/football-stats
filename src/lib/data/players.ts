import { readable, writable, type Writable } from 'svelte/store'
import { liveQuery } from 'dexie'
import { assertDb } from '$lib/db/dexie'
import type { PlayerLocal, Player } from '$lib/types/domain'


const isActive = (p: PlayerLocal) =>
  (p.active !== false) && !p.deletedAtLocal

export function observeLocalActivePlayersMap() {
  const db = assertDb()
  return readable<Record<string, PlayerLocal>>({}, (set) => {
    const sub = liveQuery(() => db.players_local.toArray()).subscribe({
      next: (rows) => {
        const map: Record<string, PlayerLocal> = {}
        for (const p of rows) if (isActive(p)) map[p.id] = p
        set(map)
      },
      error: () => set({})
    })
    return () => sub.unsubscribe()
  })
}

// Alla spelare (inkl. arkiverade). Vi filtrerar i UI.
export function observeLocalPlayersMap() {
  const db = assertDb()
  return readable<Record<string, PlayerLocal>>({}, (set) => {
    const sub = liveQuery(() => db.players_local.toArray()).subscribe({
      next: (rows) => {
        const map: Record<string, PlayerLocal> = {}
        for (const p of rows) map[p.id] = p
        set(map)
      },
      error: () => set({})
    })
    return () => sub.unsubscribe()
  })
}

// === WRITE / MUTATIONS ====================================================

// Skapa spelare. Tar ett Player-liknande objekt; fyller i id/tidsstämplar här.
// (Använder Date.now() direkt – inga extra utils behövs för ms.)
export async function addPlayer(input: Pick<Player, 'name'> & Partial<Pick<Player, 'nickname' | 'active'>>) {
  const db = assertDb()
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.players_local.add({
    id,
    name: input.name.trim(),
    nickname: input.nickname?.trim() || null,
    active: input.active ?? true,
    createdAt: now,
    updatedAtLocal: now,
    // Vi använder archivedAtLocal för arkiv, deletedAtLocal lämnas ifred (hard delete).
    deletedAtLocal: undefined
  } as PlayerLocal)
  return id
}

// Toggle active
export async function setPlayerActive(playerId: string, active: boolean) {
  const db = assertDb()
  await db.players_local.update(playerId, {
    active,
    updatedAtLocal: Date.now()
  })
}

// Toggle archive (soft delete via archivedAtLocal). Unarchive = undefined.
export async function setPlayerArchived(playerId: string, archived: boolean) {
  const db = assertDb()
  await db.players_local.update(playerId, {
    deletedAtLocal: archived ? Date.now() : undefined,
    updatedAtLocal: Date.now()
  })
}

// Uppdatera namn/smeknamn (enkelt patch)
export async function updatePlayer(playerId: string, patch: Pick<Player, 'name' | 'nickname'>) {
  const db = assertDb()
  await db.players_local.update(playerId, {
    name: patch.name?.trim(),
    nickname: (patch.nickname ?? '').trim() || null,
    updatedAtLocal: Date.now()
  })
}