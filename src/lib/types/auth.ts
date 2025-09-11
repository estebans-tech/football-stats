// Types only — no logic here.
export type Role = 'anon' | 'viewer' | 'editor' | 'admin';

export type Profile = {
  user_id: string;
  display_name?: string | null;
  role: Role;
  club_id?: string | null;
} | null;

export type UserSummary = {
  id: string;
  email?: string | null;
} | null;

export type AuthState = {
  user: UserSummary;
  role: Role;
  profile: Profile;
  canEdit: boolean;
  isAdmin?: boolean;
};

export type AuthErrorCode =
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'INVITE_USED'
  | 'EMAIL_MISMATCH'
  | 'CALLBACK_FAILED'
  | 'PROFILE_UPSERT_FAILED'
  | 'GENERIC' // +for iinternal
  | 'INTERNAL_ERROR';

  export const isRole = (val: unknown): val is Role =>
    val === 'anon' || val === 'viewer' || val === 'editor' || val === 'admin'
  