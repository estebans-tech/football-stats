export type ULID = string;
export type SessionStatus = 'open' | 'locked'
export type Half = 1 | 2
export type TeamColor= 'red' | 'black'
export type TeamAB = 'A' | 'B'
export type DedupeMode = 'keep-recent' | 'keep-A' | 'keep-B'
export type LocalPlayerOp = 'create' | 'update' | 'delete' | null
export type PlanedOperation = 'create' | 'update' | 'delete' | null

export interface BaseLocal {
  id: ULID;
  updatedAtLocal: number;   // ms since epoch for easy comparisons
  deletedAtLocal?: number | null;  // set to ms when “deleted”; undefined = alive
}

export interface PlayerLocal extends BaseLocal, Player {
  createdAt: number | null
  deletedAt: number | null
  updatedAt: number | null
  dirty: boolean;
}

export interface SessionLocal extends BaseLocal {
  // domänfält
  club_id: string;
  date: string;
  status: SessionStatus;

  // server-spegel (okänd före första sync)
  createdAt?: number | null;    // ms, från created_at
  updatedAt?: number | null;    // ms, från updated_at
  deletedAt?: number | null;

  // lokal metadata (endast klienten skriver detta)
  dirty: boolean;               // behöver pushas
  op: PlanedOperation;          // planerad åtgärd vid nästa push
}

export interface MatchLocal extends BaseLocal {
  // domänfält
  clubId: ULID
  sessionId: ULID
  orderNo: number

  // server-spegel (okänd före första sync)
  createdAt?: number | null    // ms, från created_at
  updatedAt?: number | null    // ms, från updated_at
  deletedAt?: number | null    // ms, från deleted_at (spegling)

  // lokal metadata (endast klienten skriver detta)
  dirty: boolean
  op: PlanedOperation
}

export interface LineupLocal extends BaseLocal {
  matchId: ULID;
  half: Half;
  team: TeamAB;
  playerId: ULID;
  createdAt: number | null
  deletedAt: number | null
  updatedAt: number | null
}

export interface GoalLocal extends BaseLocal {
  // Domain fields
  matchId: ULID
  half: Half
  team: TeamAB
  scorerId: ULID
  assistId: ULID | null      // ← tillåt null
  minute: number | null      // ← tillåt null
  // TODO: add support for:
  // ownGoal: boolean;
  // penalty: boolean;

  // Server mirrors (ISO strings)
  createdAt: string | null    // ← var number | null
  updatedAt: string | null    // ← var number | null
  deletedAt: string | null    // ← var number | null

  // Offline state (same lifecycle as matches/sessions)
  dirty: boolean
  op: PlanedOperation | null
}

export interface KeyValLocal {
  key: 'clubId' | 'role' | 'schemaVersion' | 'lastOpenedSessionId' | string;
  value: any;
}

export type Player = { name: string; nickname?: string | null; active: boolean }
