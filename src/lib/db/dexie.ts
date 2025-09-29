import Dexie, { type Table } from 'dexie';
import type {
  PlayerLocal, SessionLocal, MatchLocal, LineupLocal, GoalLocal, KeyValLocal
} from '$lib/types/domain';

export class LocalDB extends Dexie {
  players_local!: Table<PlayerLocal, string>
  sessions_local!: Table<SessionLocal, string>
  matches_local!: Table<MatchLocal, string>
  lineups_local!: Table<LineupLocal, string>
  goals_local!: Table<GoalLocal, string>

  constructor() {
    super('football_stats')
    this.version(1).stores({
      // Index:
      // - id (PK implicit)
      // - active (listningar)
      // - createdAt (cloud-spegel, historik/sortering)
      // - updatedAt (cloud-spegel, diff/konflikt)
      // - deletedAt (cloud-tombstone)
      // - deletedAtLocal (lokal tombstone)
      // - push-kö: [dirty+op+updatedAtLocal]
      players_local: `
        id,
        active,
        createdAt,
        updatedAt,
        deletedAt,
        updatedAtLocal,
        [dirty+op+updatedAtLocal]
      `,
      sessions_local: 'id, date, status, updatedAtLocal, deletedAtLocal',
      matches_local:  'id, sessionId, orderNo, createdAt, updatedAt, deletedAt, updatedAtLocal, dirty',
      lineups_local:  'id, matchId, half, team, playerId, updatedAtLocal, deletedAtLocal',
      goals_local:    'id, matchId, half, team, scorerId, assistId, minute, updatedAtLocal, deletedAtLocal',
      keyval_local:   'key' // { key: string; value: unknown }
    })

    this.version(2).stores({
      // Index: id (PK), club_id, date, [club_id+date] för snabba klubb+datum-queries,
      // dirty/op för sync-urval, updatedAt/updatedAtLocal för sort/checkpoints
      sessions_local:
        'id, club_id, date, [club_id+date], dirty, op, updatedAt, updatedAtLocal',
    })
    .upgrade((tx) => {
      // Migrera äldre poster till nya regler.
      return tx.table<SessionLocal>('sessions_local').toCollection().modify((row) => {
        // Säkerställ alltid updatedAtLocal (fallback till 0 om helt saknas)
        if (row.updatedAtLocal == null) row.updatedAtLocal = 0

        // createdAt/updatedAt är speglar — låt vara som de är (kan vara null/undefined)
        // Rensa bort ev. legacy-fält (om du hade createdAtLocal/deletedAtLocal tidigare)
        // @ts-expect-error legacy
        delete row.createdAtLocal
        delete row.deletedAtLocal

        // Normalisera op/dirty
        if (row.dirty && !row.op) row.op = 'update'
        if (!row.op) row.op = null
      })
    })

    this.version(3).stores({
      // …behåll dina andra stores oförändrade
      matches_local: `
        id,
        sessionId,
        clubId,
        orderNo,
        [sessionId+orderNo],
        updatedAtLocal,
        dirty, op,
        updatedAt,
        createdAt,
        deletedAt
      `
    })
    .upgrade(async (tx) => {
      const t = tx.table('matches_local')
      await t.toCollection().modify((m: any) => {
        if (m.createdAt === undefined) m.createdAt = null
        if (m.updatedAt === undefined) m.updatedAt = null
        if (m.deletedAt === undefined) m.deletedAt = null
        if (typeof m.updatedAtLocal !== 'number') m.updatedAtLocal = Date.now()
        if (typeof m.dirty !== 'boolean') m.dirty = false
        if (m.op === undefined) m.op = null
  
        // Rensa ev. gammalt brus — valfritt:
        if ('deletedAtLocal' in m) delete m.deletedAtLocal
      })
    })

    this._installSessionHooks()
    this._installMatchHooks()
  }

  private _installSessionHooks() {
    const t = this.sessions_local

    // Skapande: ny rad lokalt ⇒ op='create', dirty=true
    t.hook('creating', (_pk, obj: SessionLocal) => {
      const now = Date.now()
      obj.updatedAtLocal ??= now
      obj.dirty ??= true
      obj.op ??= 'create'

      // Speglar sätts EJ lokalt (väntar på server)
      obj.createdAt ??= null
      obj.updatedAt ??= null
    })

    // Uppdatering: bumpa updatedAtLocal + sätt op
    t.hook('updating', (mods, _pk, obj: SessionLocal) => {
      const now = Date.now()

      // Om något ändras i domänfält → markera för push
      const domainTouched =
        'date' in mods || 'status' in mods || 'club_id' in mods

      if (domainTouched) {
        const m = mods as Partial<SessionLocal>
        if (obj.op !== 'create') m.op = 'update' // redan känd av servern
        m.dirty = true
        m.updatedAtLocal = now
        return m
      }

      // Spegelfält från servern (createdAt/updatedAt) ska normalt inte skrivas i UI,
      // men om de råkar komma via pull, låt dem passera utan att smutsa ner raden.
      return mods
    })
  }

  private _installMatchHooks() {
    const t = this.matches_local
  
    // Skapande: ny rad lokalt ⇒ op='create', dirty=true
    t.hook('creating', (_pk, obj: MatchLocal) => {
      const now = Date.now()
  
      obj.updatedAtLocal = now
      obj.dirty = true
      obj.op = 'create'            // PlannedOperation (du har nullable i typen)
  
      // Speglar sätts EJ lokalt (väntar på server)
      obj.createdAt ??= null
      obj.updatedAt ??= null
      obj.deletedAt ??= null
    })
  
    // Uppdatering: bumpa updatedAtLocal + sätt op när domänfält ändras
    t.hook('updating', (mods, _pk, obj: MatchLocal) => {
      const now = Date.now()
  
      // Domänfält som ska trigga “smuts”
      const domainTouched =
        'clubId' in mods ||
        'sessionId' in mods ||
        'orderNo' in mods
  
      if (domainTouched) {
        const m = mods as Partial<MatchLocal>
        if (obj.op !== 'create') m.op = 'update' // redan känd av servern
        m.dirty = true
        m.updatedAtLocal = now
        return m
      }
  
      // Spegelfält från servern (createdAt/updatedAt/deletedAt) och lokal meta
      // ska kunna sättas utan att smutsa ner raden.
      return mods
    })
  }
}

export const _db = new LocalDB();
export const db = _db

export const assertDb = () => {
  if (!_db) throw new Error('IndexedDB är inte tillgängligt i den här miljön')
  return _db
}
