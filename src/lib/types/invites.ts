import type { Role } from '$lib/types/auth';
import type { AuthErrorCode } from '$lib/types/auth';

export type RedeemInput = {
  code: string;
  email?: string; // om du låser invites till e-post (valfritt)
  next?: string;
};

export type RedeemResult =
  | { kind: 'redirect'; to: string }
  | { kind: 'error'; message: string; code?: AuthErrorCode };

export type FinalizeResult =
  | { kind: 'redirect'; to: string }
  | { kind: 'error'; message: string; code?: AuthErrorCode };

export type InviteRecord = {
  id: string;
  club_id: string | null;
  code: string;
  role: Role;               // make sure Role includes 'viewer' if you use it in DB
  max_uses: number;
  redeemed_count: number;
  expires_at: string | null;
  created_by: string | null;
  created_at: string | null;
};