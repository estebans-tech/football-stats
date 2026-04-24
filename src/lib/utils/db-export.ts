import { assertDb } from '$lib/db/dexie'
import { DB_TABLES } from '$lib/constants/db'
import { LS_SYNC_PREFIX } from '$lib/constants/sync'
import type { DbExportPayload } from '$lib/types/db'
import type { ImportResult } from '$lib/types/sync'

function exportSyncState(): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LS_SYNC_PREFIX)) {
      result[key] = localStorage.getItem(key) ?? ''
    }
  }
  return result
}

function restoreSyncState(syncState: Record<string, string>): void {
  for (const [key, value] of Object.entries(syncState)) {
    if (key.startsWith(LS_SYNC_PREFIX)) {
      localStorage.setItem(key, value)
    }
  }
}

export async function exportDb(): Promise<void> {
  const db = assertDb()
  const tables: Record<string, unknown[]> = {}

  for (const name of DB_TABLES) {
    tables[name] = await db.table(name).toArray()
  }

  const payload: DbExportPayload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables,
    syncState: exportSyncState()
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `kaefig-db-${new Date().toISOString().slice(0, 10)}.json`
  a.click()

  URL.revokeObjectURL(url)
}

export async function importDb(file: File): Promise<ImportResult> {
  const db = assertDb()
  const text = await file.text()
  const errors: string[] = []
  let imported = 0

  let payload: DbExportPayload

  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
  }

  if (payload.version !== 1) {
    throw new Error(`Unsupported export version: ${payload.version}`)
  }

  // Only import tables defined in contract — reject unknown tables
  await db.transaction('rw', DB_TABLES.map(n => db.table(n)), async () => {
    for (const name of DB_TABLES) {
      const rows = payload.tables?.[name]
      if (!Array.isArray(rows)) {
        errors.push(`Missing table in export: ${name}`)
        continue
      }
      await db.table(name).clear()     
      await db.table(name).bulkPut(rows)
      imported += rows.length
    }
  })

  if (payload.syncState) {
    restoreSyncState(payload.syncState)
  }

  return { imported, errors }
}

