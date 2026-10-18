import type { AuthChangeEvent, User } from '@supabase/supabase-js';

export type AuthParams = { kind: 'session' } | { kind: 'error'; code: string; message: string } | null;

export const LAST_EMAIL_KEY = 'repwise_last_email';

const AUTH_KEYS = ['access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'type', 'provider_token', 'code', 'error', 'error_code', 'error_description'];
const EXPIRED = 'That link expired or was already used';

/** Reads a magic-link result from the hash (implicit flow) or query (PKCE flow). */
export function readAuthParams(href: string): AuthParams {
  const u = new URL(href);
  const hash = u.hash.startsWith('#') && u.hash.slice(1).split('/')[0].includes('=') ? new URLSearchParams(u.hash.slice(1)) : new URLSearchParams();
  const get = (k: string) => hash.get(k) ?? u.searchParams.get(k);
  const error = get('error');
  const code = get('error_code');
  if (error || code) {
    const c = code ?? error ?? '';
    const expired = c === 'otp_expired' || c === 'access_denied' || error === 'access_denied';
    return { kind: 'error', code: c, message: expired ? EXPIRED : (get('error_description') ?? 'Sign-in failed') };
  }
  if (get('access_token') || get('code')) return { kind: 'session' };
  return null;
}

/** Captured at module load, before Supabase strips the URL. Absent outside a browser. */
export const launchAuth: AuthParams = typeof location === 'undefined' ? null : readAuthParams(location.href);

/** Path to show once the auth params have been consumed. */
export function stripAuthParams(href: string): string {
  const u = new URL(href);
  for (const k of AUTH_KEYS) u.searchParams.delete(k);
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ''}#/today`;
}

/** Whether a user change deserves the "you're signed in" banner. */
export function signInNotice(prev: User | null, next: User | null, event: AuthChangeEvent, viaLink: boolean, viaRecheck: boolean): 'signed-in' | null {
  if (!next || next.id === prev?.id) return null;
  if (viaRecheck) return 'signed-in';
  // The URL session can surface as INITIAL_SESSION or as a later SIGNED_IN, depending on timing.
  return viaLink && !prev && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') ? 'signed-in' : null;
}

/**
 * Decides one auth event. A SIGNED_IN for a signed-out app after startup finished means the
 * sign-in happened elsewhere (another tab, Supabase's own focus recovery), so it counts as a re-check.
 */
export function onAuthEvent(i: { prev: User | null; next: User | null; event: AuthChangeEvent; viaLink: boolean; initialHandled: boolean }) {
  const viaRecheck = i.event === 'SIGNED_IN' && !i.prev && i.initialHandled;
  return {
    notice: signInNotice(i.prev, i.next, i.event, i.viaLink, viaRecheck) === 'signed-in',
    initialHandled: i.initialHandled || i.event === 'INITIAL_SESSION',
  };
}

/** True when a sign-in request failed because the device could not reach the server. */
export function isNetworkError(err: { name?: string; status?: number; message: string }, online: boolean): boolean {
  return err.name === 'AuthRetryableFetchError' || err.status === 0 || !online || /fetch|network|load failed/i.test(err.message);
}
