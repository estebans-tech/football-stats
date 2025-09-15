// Mirrors Supabase public tables (columns from your SQL)
export interface CloudSession {
  id: string;
  club_id: string;
  date: string;
  status: 'open'|'locked';
  updated_at: string;   // ISO
  deleted_at: string | null;
}

export interface CloudMatch {
  id: string;
  club_id: string;
  session_id: string;
  order_no: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface CloudLineup {
  id: string;
  club_id: string;
  match_id: string;
  half: 1|2;
  team: 'A'|'B';
  player_id: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CloudGoal {
  id: string;
  club_id: string;
  match_id: string;
  half: 1|2;
  team: 'A'|'B';
  scorer_id: string;
  assist_id?: string | null;
  minute?: number | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface CloudPlayer {
  id: string;
  club_id: string;
  name: string;
  nickname?: string | null;
  active: boolean;
  updated_at: string;
  deleted_at: string | null;
  created_at: string | null;
}

export type GoalRow = {
  id: string
  match_id: string
  half: number | null
  team: string
  scorer_id: string
  assist_id: string | null
  minute: number | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export type LineupRow = {
  id: string
  match_id: string
  half: number | null
  team: string
  player_id: string
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export type MatchRow = {
  id: string
  session_id: string
  order_no: number
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}