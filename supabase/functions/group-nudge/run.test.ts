import { describe, expect, it, vi } from 'vitest';
import { handleNudge, type GroupNudgeDeps } from './run.ts';
import type { SubRow } from '../_shared/push.ts';

// 15:00 in Kolkata, inside the default window.
const NOW = new Date('2026-11-13T09:30:00Z');
const dev = (id: string): SubRow => ({ id, user_id: 'mom', endpoint: `https://push.example/${id}`, p256dh: 'p', auth: 'a', tz: 'Asia/Kolkata', last_sent_at: null, kinds: ['nudges'] });

function deps(over: Partial<GroupNudgeDeps> = {}) {
  return {
    shareGroup: vi.fn(async () => true),
    senderName: vi.fn(async () => 'Dad'),
    receiverTz: vi.fn(async () => 'Asia/Kolkata'),
    loadDoc: vi.fn(async () => ({ profile: {}, sessions: [], leave: [] })),
    sentToday: vi.fn(async () => false),
    pushesToday: vi.fn(async () => 0),
    unreadSendersToday: vi.fn(async () => [] as string[]),
    insert: vi.fn(async () => undefined),
    devices: vi.fn(async () => [dev('d1')]),
    send: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    ...over,
  };
}
const req = { from: 'dad', group: 'g1', to: 'mom', preset: 'keep' as const };

describe('handleNudge', () => {
  it('403 when not in the same group', async () => {
    const d = deps({ shareGroup: vi.fn(async () => false) });
    expect((await handleNudge(d, req, NOW)).status).toBe(403);
    expect(d.insert).not.toHaveBeenCalled();
  });

  it('400 when nudging yourself', async () => {
    expect((await handleNudge(deps(), { ...req, to: 'dad' }, NOW)).status).toBe(400);
  });

  it('400 when the note is over 80 chars, or empty with no preset', async () => {
    expect((await handleNudge(deps(), { from: 'dad', group: 'g1', to: 'mom', note: 'x'.repeat(81) }, NOW)).status).toBe(400);
    expect((await handleNudge(deps(), { from: 'dad', group: 'g1', to: 'mom', note: '   ' }, NOW)).status).toBe(400);
    expect((await handleNudge(deps(), { from: 'dad', group: 'g1', to: 'mom', preset: 'nope' as never }, NOW)).status).toBe(400);
  });

  it('429 when already nudged today, and nothing is inserted', async () => {
    const d = deps({ sentToday: vi.fn(async () => true) });
    const r = await handleNudge(d, req, NOW);
    expect(r.status).toBe(429);
    expect(r.body.error).toBe('Already nudged today');
    expect(d.insert).not.toHaveBeenCalled();
    // The receiver's local day: Kolkata midnight.
    expect(d.sentToday).toHaveBeenCalledWith('dad', 'mom', '2026-11-12T18:30:00.000Z');
  });

  it('inserts and returns delivery even with zero devices', async () => {
    const d = deps({ devices: vi.fn(async () => []) });
    const r = await handleNudge(d, req, NOW);
    expect(r).toEqual({ status: 200, body: { delivery: 'push' } });
    expect(d.insert).toHaveBeenCalledWith({ group_id: 'g1', from_user: 'dad', to_user: 'mom', preset: 'keep', note: null, delivery: 'push' });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('sends the sender and line to every nudge device', async () => {
    const d = deps({ devices: vi.fn(async () => [dev('d1'), dev('d2')]) });
    await handleNudge(d, { from: 'dad', group: 'g1', to: 'mom', note: ' Gym at 6? ' }, NOW);
    expect(d.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(d.send.mock.calls[0][1])).toEqual({ title: 'Repwise', body: 'Dad: Gym at 6?', url: '/#/groups/nudges', tag: 'nudge' });
    expect(d.send.mock.calls[0][2]).toBe('nudge');
  });

  it('push body groups unread senders', async () => {
    const d = deps({ unreadSendersToday: vi.fn(async () => ['dad', 'sis', 'bro', 'sis']) });
    await handleNudge(d, req, NOW);
    expect(JSON.parse(d.send.mock.calls[0][1]).body).toBe('Dad and 2 others nudged you');
    const one = deps({ unreadSendersToday: vi.fn(async () => ['sis']) });
    await handleNudge(one, req, NOW);
    expect(JSON.parse(one.send.mock.calls[0][1]).body).toBe('Dad and 1 other nudged you');
  });

  it('does not push a cheer, quiet or capped nudge', async () => {
    const d = deps({ pushesToday: vi.fn(async () => 2) });
    expect((await handleNudge(d, req, NOW)).body.delivery).toBe('capped');
    expect(d.insert).toHaveBeenCalledWith(expect.objectContaining({ delivery: 'capped' }));
    expect(d.send).not.toHaveBeenCalled();
  });

  it('404 from the push service removes that device and still returns 200', async () => {
    const d = deps({
      devices: vi.fn(async () => [dev('d1'), dev('d2')]),
      send: vi.fn(async (t: { endpoint: string }) => {
        if (t.endpoint.endsWith('d1')) throw Object.assign(new Error('gone'), { statusCode: 404 });
      }),
    });
    expect((await handleNudge(d, req, NOW)).status).toBe(200);
    expect(d.remove).toHaveBeenCalledWith('d1');
    expect(d.send).toHaveBeenCalledTimes(2);
  });

  it('a transient push failure still returns 200 and keeps the device', async () => {
    const d = deps({ send: vi.fn(async () => { throw Object.assign(new Error('busy'), { statusCode: 500 }); }) });
    expect((await handleNudge(d, req, NOW)).status).toBe(200);
    expect(d.remove).not.toHaveBeenCalled();
  });
});
