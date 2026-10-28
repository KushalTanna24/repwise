// One cron run, with every outside call injected so vitest can drive it. index.ts wires the real ones.
import { decideNudge, localClock, type NudgeDecision } from './decide.ts';
import { decideFast } from './decideFast.ts';
import { decideStreak } from './decideStreak.ts';
import { onLeaveDoc } from './leave.ts';

export interface SubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; tz: string; last_sent_at: string | null; }
export interface PushTarget { endpoint: string; keys: { p256dh: string; auth: string } }
type DbResult = { error: unknown };

export interface NudgeDeps {
  /** Throws on a read failure; the run then fails as a whole. */
  listSubscriptions(): Promise<SubRow[]>;
  loadDocs(userIds: string[]): Promise<Map<string, unknown>>;
  /** Resolves when the push service accepted it; rejects with { statusCode } otherwise. Same-topic pushes replace each other. */
  send(sub: PushTarget, payload: string, topic: string): Promise<unknown>;
  /** Writes resolve to supabase-js's { error } rather than throwing. */
  markSent(id: string, iso: string): Promise<DbResult>;
  remove(id: string): Promise<DbResult>;
}

/** Only the cron job (service role bearer) may trigger a run; the function is deployed with --no-verify-jwt. */
export function authorized(header: string | null, key: string | undefined): boolean {
  return !!key && header === `Bearer ${key}`;
}

/** One push per device per run: fast milestone, then streak at risk, then water. Leave mutes all. */
function decide(row: SubRow, doc: unknown, now: Date): NudgeDecision {
  const clock = localClock(now, row.tz);
  if (clock && onLeaveDoc(doc, clock.date)) return { send: false, reason: 'off' };
  for (const d of [decideFast({ now, doc }), decideStreak({ now, tz: row.tz, doc })]) if (d.send) return d;
  return decideNudge({ now, tz: row.tz, lastSentAt: row.last_sent_at, doc });
}

export async function runNudges(deps: NudgeDeps, now: Date): Promise<{ checked: number; sent: number; removed: number }> {
  const rows = await deps.listSubscriptions();
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const docs = userIds.length ? await deps.loadDocs(userIds) : new Map<string, unknown>();

  let sent = 0;
  let removed = 0;
  for (const row of rows) {
    try {
      const d = decide(row, docs.get(row.user_id) ?? null, now);
      if (!d.send) continue;
      try {
        await deps.send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ title: d.title, body: d.body, url: d.url }), d.topic);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Subscription is gone for good; any other failure is transient and retried next hour.
        if (status !== 404 && status !== 410) throw e;
        const { error } = await deps.remove(row.id);
        if (error) console.error('water-nudge delete failed', row.id, error);
        else removed++;
        continue;
      }
      // Unstamped, the device would be nudged again next hour, so only a recorded send counts.
      const { error } = await deps.markSent(row.id, now.toISOString());
      if (error) console.error('water-nudge last_sent_at write failed', row.id, error);
      else sent++;
    } catch (e) {
      console.error('water-nudge row failed', row.id, e);
    }
  }
  return { checked: rows.length, sent, removed };
}
