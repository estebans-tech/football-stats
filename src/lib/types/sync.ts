export type AnonWatermarks = {
  sessions?: string
  matches?: string
  lineups?: string
  goals?: string
  players?: string
}

export type AnonSyncMeta = {
  lastSyncedAt: number | null
  watermarks: AnonWatermarks
  schemaVersion: number
  lastReconciledAt?: number | null
}

export type DoPullResult = {
  nextWatermarks: AnonWatermarks
  wrote: number // antal skrivna/upsertade rader totalt (frivilligt men bra för logg)
}

export type PublicPullResult = {
  pulled: number
  nextWatermark?: string
}