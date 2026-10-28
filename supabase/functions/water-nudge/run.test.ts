import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorized, runNudges, type NudgeDeps, type SubRow } from './run.ts';

// 15:00 in Kolkata (UTC+5:30): 0 of 8 glasses is 4 behind, so every row below sends.
const NOW = new Date('2026-10-18T09:30:00Z');
const DOC = { profile: { waterGoal: 8, waterReminders: { on: true, from: 9, to: 21, everyHours: 2 } }, water: {} };

const row = (id: string, user = 'u1'): SubRow => ({ id, user_id: user, endpoint: `https://push.example/${id}`, p256dh: 'p', auth: 'a', tz: 'Asia/Kolkata', last_sent_at: null });

function deps(rows: SubRow[], over: Partial<NudgeDeps> = {}) {
  const d = {
    listSubscriptions: vi.fn(async () => rows),
    loadDocs: vi.fn(async (ids: string[]) => new Map<string, unknown>(ids.map((u) => [u, DOC]))),
    send: vi.fn(async () => undefined),
    markSent: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    ...over,
  };
  return d;
}

const gone = (statusCode: number) => Object.assign(new Error(`push ${statusCode}`), { statusCode });

afterEach(() => vi.restoreAllMocks());

describe('runNudges', () => {
  it('sends and stamps last_sent_at', async () => {
    const d = deps([row('s1')]);
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 1, removed: 0 });
    expect(d.send).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/s1', keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify({ title: 'Time for water', body: "0 of 8 glasses. You're 4 behind, have one now.", url: '/#/today' }),
      'water',
    );
    expect(d.markSent).toHaveBeenCalledWith('s1', NOW.toISOString());
    expect(d.remove).not.toHaveBeenCalled();
  });

  it('loads each user doc once', async () => {
    const d = deps([row('s1', 'u1'), row('s2', 'u1'), row('s3', 'u2')]);
    await runNudges(d, NOW);
    expect(d.loadDocs).toHaveBeenCalledTimes(1);
    expect(d.loadDocs).toHaveBeenCalledWith(['u1', 'u2']);
  });

  it('skips the doc load when there are no rows', async () => {
    const d = deps([]);
    expect(await runNudges(d, NOW)).toEqual({ checked: 0, sent: 0, removed: 0 });
    expect(d.loadDocs).not.toHaveBeenCalled();
  });

  it('does not send when the decision says no', async () => {
    const d = deps([row('s1')], { loadDocs: vi.fn(async () => new Map()) });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 0 });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('deletes a 410 subscription and counts it removed', async () => {
    const d = deps([row('s1')], { send: vi.fn(async () => Promise.reject(gone(410))) });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 1 });
    expect(d.remove).toHaveBeenCalledWith('s1');
    expect(d.markSent).not.toHaveBeenCalled();
  });

  it('deletes a 404 subscription', async () => {
    const d = deps([row('s1')], { send: vi.fn(async () => Promise.reject(gone(404))) });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 1 });
    expect(d.remove).toHaveBeenCalledWith('s1');
  });

  it('keeps a subscription on a transient 500', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps([row('s1')], { send: vi.fn(async () => Promise.reject(gone(500))) });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 0 });
    expect(d.remove).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });

  it('logs a failed last_sent_at write and does not count the send', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps([row('s1')], { markSent: vi.fn(async () => ({ error: { message: 'rls' } })) });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 0 });
    expect(err).toHaveBeenCalled();
  });

  it('logs a failed delete and does not count it removed', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps([row('s1')], {
      send: vi.fn(async () => Promise.reject(gone(410))),
      remove: vi.fn(async () => ({ error: { message: 'rls' } })),
    });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 0 });
    expect(err).toHaveBeenCalled();
  });

  it('carries on past a row that throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // s1: send throws a plain error; s2: gone, and the delete itself throws; s3: fine.
    const d = deps([row('s1'), row('s2'), row('s3')], {
      send: vi.fn(async (sub: { endpoint: string }) => {
        if (sub.endpoint.endsWith('s1')) throw new Error('socket hang up');
        if (sub.endpoint.endsWith('s2')) throw gone(410);
      }),
      remove: vi.fn(async () => Promise.reject(new Error('network down'))),
    });
    expect(await runNudges(d, NOW)).toEqual({ checked: 3, sent: 1, removed: 0 });
    expect(d.markSent).toHaveBeenCalledTimes(1);
    expect(d.markSent).toHaveBeenCalledWith('s3', NOW.toISOString());
  });

  it('a fast milestone wins over water, with its own topic', async () => {
    const fast = { id: 'f', startedAt: new Date(NOW.getTime() - 12.2 * 3_600_000).toISOString(), endedAt: null, targetHours: 16 };
    const d = deps([row('s1')], { loadDocs: vi.fn(async () => new Map<string, unknown>([['u1', { ...DOC, fasts: [fast] }]])) });
    await runNudges(d, NOW);
    expect(d.send).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('12 hours in'), 'fast');
  });

  it('the streak nudge wins over water at 8 pm', async () => {
    const at8 = new Date('2026-10-18T14:40:00Z'); // 20:10 Kolkata, water still behind
    const docs = new Map<string, unknown>([['u1', { ...DOC, streakHint: { date: '2026-10-18', current: 4, lit: false } }]]);
    const d = deps([row('s1')], { loadDocs: vi.fn(async () => docs) });
    await runNudges(d, at8);
    expect(d.send).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('4-day streak'), 'streak');
  });

  it('leave mutes everything', async () => {
    const d = deps([row('s1')], { loadDocs: vi.fn(async () => new Map<string, unknown>([['u1', { ...DOC, leave: [{ start: '2026-10-01', end: null }] }]])) });
    expect(await runNudges(d, NOW)).toEqual({ checked: 1, sent: 0, removed: 0 });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('lets a list failure reject the run', async () => {
    const d = deps([], { listSubscriptions: vi.fn(async () => Promise.reject(new Error('db down'))) });
    await expect(runNudges(d, NOW)).rejects.toThrow('db down');
  });
});

describe('authorized', () => {
  it('rejects when the key is missing or empty', () => {
    expect(authorized('Bearer x', undefined)).toBe(false);
    expect(authorized('Bearer ', '')).toBe(false);
    expect(authorized(null, '')).toBe(false);
  });
  it('rejects a missing or wrong bearer', () => {
    expect(authorized(null, 'secret')).toBe(false);
    expect(authorized('Bearer nope', 'secret')).toBe(false);
    expect(authorized('secret', 'secret')).toBe(false);
    expect(authorized('bearer secret', 'secret')).toBe(false);
  });
  it('accepts the exact service bearer', () => {
    expect(authorized('Bearer secret', 'secret')).toBe(true);
  });
});
