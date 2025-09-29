import type { Half, TeamAB } from '$lib/types/domain'

// Mirrors Supabase public tables (columns from your SQL)
export interface CloudSession {
  id: string;
  club_id: string;
  date: string;
  status: 'open'|'locked';
  created_at: string;
  updated_at: string;   // ISO
  deleted_at: string | null;
}

export interface CloudMatch {
  id: string;                // ULID
  club_id: string;           // FK → clubs.id
  session_id: string;        // FK → sessions.id
  order_no: number;          // unik per (session_id) bland aktiva

  created_at: string;        // ISO
  updated_at: string;        // ISO
  deleted_at: string | null; // ISO|null (soft delete)
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
  // Identifiers
  id: string
  club_id: string
  match_id: string

    // Domain fields
    half: Half
    team: TeamAB
  scorer_id: string
  assist_id: string | null
  minute: number | null

  // Server timestamps (ISO strings)
  created_at: string
  updated_at: string
  deleted_at: string | null
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

export type CloudAck = { id: string; created_at: string; updated_at: string }
