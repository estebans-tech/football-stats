export type ULID = string;

export interface BaseLocal {
  id: ULID;
  updatedAtLocal: number;   // ms since epoch for easy comparisons
  deletedAtLocal?: number;  // set to ms when “deleted”; undefined = alive
}

export interface PlayerLocal extends BaseLocal {
  active: boolean;
  createdAt: number;
  name: string;
  nickname?: string;
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
  half: 1|2;
  team: 'A'|'B';
  playerId: ULID;
}

export interface GoalLocal extends BaseLocal {
  matchId: ULID;
  half: 1|2;
  team: 'A'|'B';
  scorerId: ULID;
  assistId?: ULID;
  minute?: number;
}

export interface KeyValLocal {
  key: 'clubId' | 'role' | 'schemaVersion' | 'lastOpenedSessionId' | string;
  value: any;
}

export type SessionStatus = 'open' | 'locked'
