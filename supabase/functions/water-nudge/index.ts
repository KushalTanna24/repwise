// Deno edge function. Called hourly by pg_cron; decides per device and sends Web Push.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { decideNudge } from './decide.ts';

interface SubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; tz: string; last_sent_at: string | null; }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // Only the cron job (service role bearer) may trigger a run; the function is deployed with --no-verify-jwt.
  if (!serviceKey || req.headers.get('Authorization') !== `Bearer ${serviceKey}`) return json({ error: 'unauthorized' }, 401);

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });

  const { data: subs, error } = await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,tz,last_sent_at');
  if (error) return json({ error: error.message }, 500);
  const rows = (subs ?? []) as SubRow[];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const docs = new Map<string, unknown>();
  if (userIds.length) {
    const { data, error: docErr } = await db.from('repwise_user_data').select('user_id,workout_data').in('user_id', userIds);
    if (docErr) return json({ error: docErr.message }, 500);
    for (const d of data ?? []) docs.set(d.user_id as string, d.workout_data);
  }

  const now = new Date();
  let sent = 0;
  let removed = 0;
  for (const row of rows) {
    try {
      const d = decideNudge({ now, tz: row.tz, lastSentAt: row.last_sent_at, doc: docs.get(row.user_id) ?? null });
      if (!d.send) continue;
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ title: d.title, body: d.body, url: d.url }),
      );
      sent++;
      await db.from('push_subscriptions').update({ last_sent_at: now.toISOString() }).eq('id', row.id);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Subscription is gone for good; any other failure is transient and retried next hour.
        await db.from('push_subscriptions').delete().eq('id', row.id);
        removed++;
      } else {
        console.error('water-nudge row failed', row.id, e);
      }
    }
  }
  return json({ checked: rows.length, sent, removed });
});
