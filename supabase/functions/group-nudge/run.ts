// One nudge request, with every outside call injected so vitest can drive it. index.ts wires the real ones.
import { decideGroupNudge, localDayStartIso, type Delivery } from './decide.ts';
import { isGone, targetOf, type PushTarget, type SubRow } from '../_shared/push.ts';

export const PRESETS = {
  keep: 'Keep pushing 💪',
  missed: 'Missed you at the gym',
  proud: 'Proud of you',
  today: "Let's train today",
} as const;
export type PresetId = keyof typeof PRESETS;
export const NOTE_MAX = 80;

export interface NudgeRow { group_id: string; from_user: string; to_user: string; preset: PresetId | null; note: string | null; delivery: Delivery }

export interface GroupNudgeDeps {
  shareGroup(group: string, a: string, b: string): Promise<boolean>;
  senderName(group: string, uid: string): Promise<string>;
  /** The receiver's newest device time zone, or 'UTC' when they have none. */
  receiverTz(uid: string): Promise<string>;
  loadDoc(uid: string): Promise<unknown>;
  sentToday(from: string, to: string, sinceIso: string): Promise<boolean>;
  /** Nudges to `to` since `sinceIso` that were delivered as a push. */
  pushesToday(to: string, sinceIso: string): Promise<number>;
  /** User ids behind the receiver's unread nudges since `sinceIso`. */
  unreadSendersToday(to: string, sinceIso: string): Promise<string[]>;
  insert(row: NudgeRow): Promise<void>;
  /** The receiver's devices that accept nudges. */
  devices(to: string): Promise<SubRow[]>;
  send(target: PushTarget, payload: string, topic: string): Promise<unknown>;
  remove(id: string): Promise<unknown>;
}

export interface NudgeRequest { from: string; group: string; to: string; preset?: PresetId; note?: string }
export interface NudgeResponse { status: 200 | 400 | 403 | 429; body: { delivery?: Delivery; error?: string } }

const bad = (error: string): NudgeResponse => ({ status: 400, body: { error } });

export async function handleNudge(deps: GroupNudgeDeps, req: NudgeRequest, now: Date): Promise<NudgeResponse> {
  if (!req.group || !req.to) return bad('Missing group or member');
  if (req.to === req.from) return bad("You can't nudge yourself");
  const note = req.note?.trim() || null;
  const preset = req.preset ?? null;
  if (preset !== null && !(preset in PRESETS)) return bad('Unknown nudge');
  if (!note && !preset) return bad('Pick a nudge or write a note');
  if (note && note.length > NOTE_MAX) return bad(`Keep the note under ${NOTE_MAX} characters`);

  if (!(await deps.shareGroup(req.group, req.from, req.to))) return { status: 403, body: { error: 'Not in this group' } };

  const tz = await deps.receiverTz(req.to);
  const since = localDayStartIso(now, tz);
  if (await deps.sentToday(req.from, req.to, since)) return { status: 429, body: { error: 'Already nudged today' } };

  const [doc, pushes] = await Promise.all([deps.loadDoc(req.to), deps.pushesToday(req.to, since)]);
  const delivery = decideGroupNudge({ now, tz, doc, pushesToday: pushes });
  await deps.insert({ group_id: req.group, from_user: req.from, to_user: req.to, preset, note, delivery });

  if (delivery === 'push') {
    const [sender, unread, devices] = await Promise.all([deps.senderName(req.group, req.from), deps.unreadSendersToday(req.to, since), deps.devices(req.to)]);
    const others = new Set(unread.filter((u) => u !== req.from)).size;
    const body = others ? `${sender} and ${others} other${others === 1 ? '' : 's'} nudged you` : `${sender}: ${note ?? PRESETS[preset!]}`;
    const payload = JSON.stringify({ title: 'Repwise', body, url: '/#/groups/nudges', tag: 'nudge' });
    for (const d of devices) {
      try {
        await deps.send(targetOf(d), payload, 'nudge');
      } catch (e) {
        // The nudge is saved either way; a dead device is dropped, a busy push service is not retried.
        if (isGone(e)) await deps.remove(d.id);
        else console.error('group-nudge send failed', d.id, e);
      }
    }
  }
  return { status: 200, body: { delivery } };
}
