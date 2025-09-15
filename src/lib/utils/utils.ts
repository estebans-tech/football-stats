export const uid = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  
export const isoDate = (d = new Date()) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}` // "YYYY-MM-DD" i lokal tid
}

export function nowIso() {
    return new Date().toISOString()
}

export function isValidYMD(s: string) {
  // YYYY-MM-DD (no timezone ambiguity)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  // Check month/day boundaries (e.g., 2025-02-30 -> invalid)
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10)
}

  // robust tidsparser: ISO/string/Date -> ms epoch | null
export const toMs = (v: unknown): number | null => {
    if (v == null) return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const t = new Date(v as any).getTime()
    return Number.isFinite(t) ? t : null
  }
