// Server-only module. Handles SSR auth init, invite redeem, and callback.
// Uses Supabase Admin (service key) to keep things simple & secure.

import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

import type { AuthState, Profile, Role, UserSummary } from '$lib/types/auth';
import type { FinalizeResult, InviteRecord, RedeemInput, RedeemResult } from '$lib/types/invites';

// ---------- utils ----------
export function getServerSupabase(event: RequestEvent) {
  return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return event.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { path: '/', ...options })
        );
      }
    }
  });
}

function getAdmin(): SupabaseClient {
  return createAdminClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function sanitizeNext(next?: string | null): string {
  if (!next) return '/';
  if (next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

export function userIsAdmin(user: { id: string } | null, role: Role): boolean {
  return !!user && (role === 'admin');
}

export function userCanEdit(user: { id: string } | null, role: Role): boolean {
  return !!user && (role === 'editor' || role === 'admin');
}

function resolveRole(profile: Profile, isLoggedIn: boolean): Role {
  if (!isLoggedIn) return 'anon';
  return profile?.role ?? 'anon';
}

// ---------- DB helpers (via service key) ----------
async function findInviteByCode(code: string): Promise<InviteRecord | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('invites')
    .select(
      'id, club_id, code, role, max_uses, redeemed_count, expires_at, created_by, created_at'
    )
    .eq('code', code)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

// Prefer an RPC for race-safety; this is the inline fallback.
async function consumeInviteAtomic(inviteId: string): Promise<void> {
  const admin = getAdmin();
  const { error } = await admin
    .rpc('consume_invite', { invite_id: inviteId }); // see SQL at bottom
  if (error) throw error;
}


async function ensureProfile(userId: string, role: Role, clubId?: string | null): Promise<Profile> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('profiles')
    .upsert({ user_id: userId, role, club_id: clubId ?? null }, { onConflict: 'user_id' })
    .select('user_id, display_name, role, club_id')
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getProfileFor(userId: string): Promise<Profile> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, display_name, role, club_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

// ---------- Public API ----------

export async function initRequestAuth(event: RequestEvent): Promise<AuthState> {
  const supa = getServerSupabase(event);

  // Verified user (contacts Supabase Auth)
  const { data, error } = await supa.auth.getUser();

  // Treat missing/invalid session as anon
  if (error || !data?.user) {
    return { user: null, role: 'anon', profile: null, canEdit: false, isAdmin: false };
  }

  const user: UserSummary = { id: data.user.id, email: data.user.email };
  const profile = await getProfileFor(user.id);
  const role = resolveRole(profile, true);
  const canEdit = userCanEdit(user, role);
  const isAdmin = userIsAdmin(user, role);

  return { user, role, profile, canEdit, isAdmin };
}

/** Redeem: validate code → ensure user (by email if you use it) → generate magic link → set short-lived cookie with invite.id → redirect to action_link. */
export async function redeemInviteAction(
  event: RequestEvent,
  input: RedeemInput
): Promise<RedeemResult> {
  try {
    // 1) Input
    const code = (input.code ?? '').trim();
    if (!code) {
      return { kind: 'error', message: 'Invite code is required', code: 'INVITE_INVALID' };
    }

    // 2) Lookup
    const invite = await findInviteByCode(code);
    if (!invite) {
      return { kind: 'error', message: 'Invalid invite code', code: 'INVITE_INVALID' };
    }

    // 3) Guards
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      return { kind: 'error', message: 'Invite expired', code: 'INVITE_INVALID' }; //INVITE_EXPIRED
    }
    if (invite.redeemed_count >= invite.max_uses) {
      return { kind: 'error', message: 'Invite already used', code: 'INVITE_INVALID' }; // INVITE_USED
    }

    // 4) Generate a magic link server-side (no email in schema → synthetic address is fine)
    const loginEmail = `invite+${invite.id}@example.com`;
    const admin = getAdmin();

    // We still pass a redirect target, but we won't follow the action_link.
    const redirectTo = `${event.url.origin}/`;
    const linkRes = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
      options: { redirectTo }
    });

    const props = linkRes.data?.properties;
    const tokenHash = props?.hashed_token;           // <-- IMPORTANT
    const vtype = props?.verification_type;          // usually 'magiclink'

    if (linkRes.error || !tokenHash || !vtype) {
      console.error('generateLink error', linkRes.error ?? linkRes.data);
      return { kind: 'error', message: 'Failed to generate login link', code: 'GENERIC' }; // INTERNAL_ERROR
    }

    // 5) Verify on the server using token_hash → sets HttpOnly cookies
    const supa = getServerSupabase(event);
    const verify = await supa.auth.verifyOtp({
      token_hash: tokenHash,
      type: vtype as 'magiclink' | 'signup' | 'invite' | 'recovery' | 'email_change'
    });

    if (verify.error || !verify.data?.user) {
      console.error('verifyOtp error', verify.error);
      return { kind: 'error', message: 'Login verification failed', code: 'GENERIC' }; // CALLBACK_FAILED
    }

    // 6) Upsert profile & consume invite (race-safe via RPC)
    try {
      await ensureProfile(verify.data.user.id, invite.role as Role, invite.club_id ?? null);
    } catch (e) {
      console.error('profile upsert failed', e);
      return { kind: 'error', message: 'Profile upsert failed', code: 'GENERIC' }; // PROFILE_UPSERT_FAILED
    }

    try {
      await consumeInviteAtomic(invite.id);
    } catch (e) {
      // non-fatal; log for observability
      console.error('consumeInviteAtomic failed', e);
    }

    // 7) Redirect to next (now fully logged in on SSR)
    const next = sanitizeNext(input.next);
    return { kind: 'redirect', to: next || '/' };
  } catch (e) {
    console.error('redeemInviteAction failed', e);
    return { kind: 'error', message: 'Internal error', code: 'GENERIC' }; // INTERNAL_ERROR
  }
}

/** Callback: exchange ?code → set supabase cookies → upsert profile with invite.role/club → consume invite atomically → redirect. */
export async function finalizeCallback(event: RequestEvent): Promise<FinalizeResult> {
  try {
    const code = event.url.searchParams.get('code');
    const next = sanitizeNext(event.url.searchParams.get('next'));
    if (!code) return { kind: 'error', message: 'Missing code', code: 'CALLBACK_FAILED' };

    const supa = getServerSupabase(event);
    const ex = await supa.auth.exchangeCodeForSession(code);
    if (ex.error || !ex.data?.user) {
      return { kind: 'error', message: 'Login failed', code: 'CALLBACK_FAILED' };
    }

    // tie invite to logged-in user
    const inviteId = event.cookies.get('inv_id');
    if (inviteId) {
      // fetch invite to get role/club
      const admin = getAdmin();
      const { data: inv, error } = await admin
        .from('invites')
        .select('id, role, club_id')
        .eq('id', inviteId)
        .maybeSingle();
      if (!error && inv) {
        // profile upsert
        try {
          await ensureProfile(ex.data.user.id, inv.role as Role, inv.club_id ?? null);
        } catch {
          return { kind: 'error', message: 'Profile upsert failed', code: 'PROFILE_UPSERT_FAILED' };
        }
        // consume invite (race-safe via RPC)
        try {
          await consumeInviteAtomic(inv.id);
        } catch {
          // swallow but log server-side if you have logging
        }
      }
      event.cookies.delete('inv_id', { path: '/' });
    }

    return { kind: 'redirect', to: next || '/' };
  } catch {
    return { kind: 'error', message: 'Internal error', code: 'INTERNAL_ERROR' };
  }
}

export function menuForRole(role: Role, canEdit: boolean): 'A' | 'B' | 'C' {
  if (role === 'admin') return 'C';
  if (canEdit) return 'B';
  return 'A';
}