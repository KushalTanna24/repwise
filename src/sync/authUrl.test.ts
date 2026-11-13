import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isNetworkError, onAuthEvent, readAuthParams, signInNotice, stripAuthParams } from './authUrl';

const user = { id: 'u1', email: 'a@b.co' } as User;

describe('readAuthParams', () => {
  it('reads a magic-link session from the hash', () => {
    expect(readAuthParams('https://x/#access_token=a&type=magiclink')).toEqual({ kind: 'session' });
  });
  it('reads a PKCE code from the query', () => {
    expect(readAuthParams('https://x/?code=abc')).toEqual({ kind: 'session' });
  });
  it('maps expired and denied links to one message', () => {
    const msg = 'That link expired or was already used';
    expect(readAuthParams('https://x/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toEqual({ kind: 'error', code: 'otp_expired', message: msg });
    expect(readAuthParams('https://x/#error=access_denied')).toMatchObject({ kind: 'error', message: msg });
  });
  it('passes other errors through decoded', () => {
    expect(readAuthParams('https://x/#error=server_error&error_description=Something+broke')).toEqual({ kind: 'error', code: 'server_error', message: 'Something broke' });
  });
  it('ignores ordinary routes', () => {
    expect(readAuthParams('https://x/#/profile')).toBeNull();
  });
});

describe('stripAuthParams', () => {
  it('drops auth params and lands on Today', () => {
    expect(stripAuthParams('https://x/?code=a#error=x')).toBe('/#/today');
  });
});

describe('signInNotice', () => {
  it('announces a sign-in that came from a link', () => {
    expect(signInNotice(null, user, 'SIGNED_IN', true, false)).toBe('signed-in');
  });
  it('announces a link sign-in delivered as INITIAL_SESSION', () => {
    expect(signInNotice(null, user, 'INITIAL_SESSION', true, false)).toBe('signed-in');
  });
  it('stays quiet on a restored session', () => {
    expect(signInNotice(null, user, 'INITIAL_SESSION', false, false)).toBeNull();
  });
  it('stays quiet for a sign-in without a link or re-check', () => {
    expect(signInNotice(null, user, 'SIGNED_IN', false, false)).toBeNull();
  });
  it('stays quiet when the user did not change', () => {
    expect(signInNotice(user, user, 'SIGNED_IN', true, false)).toBeNull();
  });
  it('announces a sign-in found by a re-check', () => {
    expect(signInNotice(null, user, 'SIGNED_IN', false, true)).toBe('signed-in');
  });
});

describe('onAuthEvent', () => {
  const step = (prev: User | null, next: User | null, event: Parameters<typeof signInNotice>[2], viaLink: boolean, initialHandled: boolean) => onAuthEvent({ prev, next, event, viaLink, initialHandled });

  it('announces a SIGNED_IN that follows an empty INITIAL_SESSION', () => {
    const a = step(null, null, 'INITIAL_SESSION', false, false);
    expect(a).toEqual({ notice: false, initialHandled: true });
    expect(step(null, user, 'SIGNED_IN', false, a.initialHandled).notice).toBe(true);
  });
  it('stays quiet when SIGNED_IN is queued before INITIAL_SESSION', () => {
    const a = step(null, user, 'SIGNED_IN', false, false);
    expect(a.notice).toBe(false);
    expect(step(user, user, 'INITIAL_SESSION', false, a.initialHandled).notice).toBe(false);
  });
  it('announces the link sign-in when the URL session arrives as SIGNED_IN after INITIAL_SESSION', () => {
    const a = step(null, null, 'INITIAL_SESSION', true, false);
    expect(step(null, user, 'SIGNED_IN', true, a.initialHandled).notice).toBe(true);
  });
});

describe('isNetworkError', () => {
  it('recognises retryable fetch errors, status 0, offline and Safari wording', () => {
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: 'x' }, true)).toBe(true);
    expect(isNetworkError({ status: 0, message: 'x' }, true)).toBe(true);
    expect(isNetworkError({ message: 'x' }, false)).toBe(true);
    expect(isNetworkError({ message: 'Load failed' }, true)).toBe(true);
    expect(isNetworkError({ message: 'Failed to fetch' }, true)).toBe(true);
  });
  it('leaves server errors alone', () => {
    expect(isNetworkError({ name: 'AuthApiError', status: 429, message: 'Rate limited' }, true)).toBe(false);
  });
});
