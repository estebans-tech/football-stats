// Centralize cookie names & default options
export const COOKIE_LOCALE = 'locale';
export const COOKIE_INVITE_ID = 'inv_id';

export const defaultCookieOpts = {
  path: '/',
  sameSite: 'lax' as const,
  secure: true,
  maxAge: 60 * 60 * 24 * 365
};