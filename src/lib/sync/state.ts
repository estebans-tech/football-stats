export const getLastSync = async (key: string) =>
  Number(localStorage.getItem(`fs.sync.${key}`) || '0')

export const setLastSync = async (key: string, ts: number) =>
  localStorage.setItem(`fs.sync.${key}`, String(ts))

// --- Help functions ---
export async function getPullCheckpoint(key: string) {
  const lastMs: number = (await getLastSync(key)) ?? 0;
  const lastIso: string =
    lastMs > 0 ? new Date(lastMs).toISOString() : '1970-01-01T00:00:00.000Z';
  return { lastMs, lastIso }
}

export async function updatePullCheckpoint(key: string, maxMs: number) {
  if (maxMs > 0) await setLastSync(key, maxMs)
}

/**
 * Skriv anon-sync meta till localStorage.
 * - Skriver precis payloaden, inget extra.
 */
export function updateAnonSyncMeta(key: string, payload: string | object): void {
  if (typeof payload === 'object') payload = JSON.stringify(payload)

  localStorage.setItem(key, payload)
}