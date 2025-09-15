import Dexie, { type Table } from 'dexie';
import type {
  PlayerLocal, SessionLocal, MatchLocal, LineupLocal, GoalLocal, KeyValLocal
} from '$lib/types/domain';

export class LocalDB extends Dexie {
  players_local!: Table<PlayerLocal, string>;
  sessions_local!: Table<SessionLocal, string>;
  matches_local!: Table<MatchLocal, string>;
  lineups_local!: Table<LineupLocal, string>;
  goals_local!: Table<GoalLocal, string>;

  constructor() {
    super('football_stats');
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
        deletedAtLocal,
        [dirty+op+updatedAtLocal]
      `,
      sessions_local: 'id, date, status, updatedAtLocal, deletedAtLocal',
      matches_local:  'id, sessionId, orderNo, updatedAtLocal, deletedAtLocal',
      lineups_local:  'id, matchId, half, team, playerId, updatedAtLocal, deletedAtLocal',
      goals_local:    'id, matchId, half, team, scorerId, assistId, minute, updatedAtLocal, deletedAtLocal',
      keyval_local:   'key' // { key: string; value: unknown }
    });

  }
}

export const _db = new LocalDB();
export const db = _db

export const assertDb = () => {
  if (!_db) throw new Error('IndexedDB är inte tillgängligt i den här miljön')
  return _db
}
