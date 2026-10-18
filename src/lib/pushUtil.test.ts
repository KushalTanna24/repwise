import { afterEach, describe, expect, it, vi } from 'vitest';
import { reminderToggle, urlBase64ToUint8Array, withTimeout } from './pushUtil';

// A real-shaped VAPID public key: 65 bytes, uncompressed point, first byte 0x04.
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-ib37J8xQmh7PJhkUCGqJWMfI0IuLZtv3WzgbVJj1fcvS_8VtGYuDQKp0AGE';

describe('urlBase64ToUint8Array', () => {
  it('decodes a VAPID key to 65 bytes starting with 4', () => {
    const out = urlBase64ToUint8Array(KEY);
    expect(out.length).toBe(65);
    expect(out[0]).toBe(4);
  });
});

describe('reminderToggle', () => {
  it('on', () => expect(reminderToggle('on')).toEqual({ on: true, message: null }));
  it('signed-out', () => expect(reminderToggle('signed-out')).toEqual({ on: false, message: 'Sign in to get water reminders' }));
  it('denied', () =>
    expect(reminderToggle('denied')).toEqual({ on: false, message: 'Notifications are blocked. Allow them in Chrome site settings, then come back' }));
  it('unsupported', () =>
    expect(reminderToggle('unsupported')).toEqual({ on: false, message: 'Install Repwise to your home screen to get reminders' }));
  it('failed', () => expect(reminderToggle('failed')).toEqual({ on: false, message: "Couldn't turn on reminders. Try again" }));
});

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());
  it('passes a settled value through', async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });
  it('passes a rejection through', async () => {
    await expect(withTimeout(Promise.reject(new Error('nope')), 100)).rejects.toThrow('nope');
  });
  it('rejects once the wait runs out', async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 8000);
    vi.advanceTimersByTime(8000);
    await expect(p).rejects.toThrow('timed out');
  });
});
