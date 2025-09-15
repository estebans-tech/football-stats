export type ULID = string;
export type SessionStatus = 'open' | 'locked'
export type Half = 1 | 2
export type TeamColor= 'red' | 'black'
export type TeamAB = 'A' | 'B'
export type DedupeMode = 'keep-recent' | 'keep-A' | 'keep-B'
export type LocalPlayerOp = 'create' | 'update' | 'delete' | null

export interface BaseLocal {
  id: ULID;
  updatedAtLocal: number | null;   // ms since epoch for easy comparisons
  deletedAtLocal?: number | null;  // set to ms when “deleted”; undefined = alive
}

export interface PlayerLocal extends BaseLocal, Player {
  createdAt: number | null;
  deletedAt: number | null;
  updatedAt: number | null;
  dirty: boolean;
}
export interface SessionLocal extends BaseLocal {
  date: string;           // 'YYYY-MM-DD'
  status: 'open'|'locked';
}

export interface MatchLocal extends BaseLocal {
  sessionId: ULID;
  orderNo: number;
}

export interface LineupLocal extends BaseLocal {
  matchId: ULID;
  half: Half;
  team: TeamAB;
  playerId: ULID;
  createdAt?: number
}

export interface GoalLocal extends BaseLocal {
  matchId: ULID;
  half: Half;
  team: TeamAB;
  scorerId: ULID;
  assistId?: ULID;
  minute?: number;
  createdAt?: number
}

export interface KeyValLocal {
  key: 'clubId' | 'role' | 'schemaVersion' | 'lastOpenedSessionId' | string;
  value: any;
}

export type Player = { name: string; nickname?: string | null; active: boolean }
