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
  keyval_local!: Table<KeyValLocal, string>;

  constructor() {
    super('football_stats');
    this.version(1).stores({
      players_local:  'id, active, createdAt, updatedAtLocal, deletedAtLocal',
      sessions_local: 'id, date, status, updatedAtLocal, deletedAtLocal',
      matches_local:  'id, sessionId, orderNo, updatedAtLocal, deletedAtLocal',
      lineups_local:  'id, matchId, half, team, playerId, updatedAtLocal, deletedAtLocal',
      goals_local:    'id, matchId, half, team, scorerId, assistId, minute, updatedAtLocal, deletedAtLocal',
      keyval_local:   'key' // { key: string; value: unknown }
    });

    // v2 — add compound indexes (no data migration needed)
    this.version(2).stores({
      // 🔹 speeds up removePlayer({matchId, playerId, team, half}) and similar queries
      lineups_local:
        'id, matchId, half, team, playerId, updatedAtLocal, deletedAtLocal,' +
        ' [matchId+playerId+team+half],' +      // <- the one Dexie suggested
        ' [matchId+half],' +                    // optional but helpful
        ' [matchId+team+half]',                 // optional but helpful
      // (optional) if you often query goals by match/half/team
      goals_local:
        'id, matchId, half, team, scorerId, assistId, minute, updatedAtLocal, deletedAtLocal,' +
        ' [matchId+half],' +
        ' [matchId+team+half]'
    }).upgrade(() => {
      // no-op: just building indexes
    })
  }
}

export const _db = new LocalDB();
export const db = _db

export const assertDb = () => {
  if (!_db) throw new Error('IndexedDB är inte tillgängligt i den här miljön')
  return _db
}
