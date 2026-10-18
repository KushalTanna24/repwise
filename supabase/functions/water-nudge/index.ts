// Deno edge function. Called hourly by pg_cron; decides per device and sends Web Push. The work lives in run.ts.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { authorized, runNudges, type SubRow } from './run.ts';

// A reminder is only useful within the hour: drop it rather than deliver it late to a phone that was offline.
const SEND_OPTIONS = { TTL: 1800, urgency: 'normal', topic: 'water' } as const;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  // The cron job proves itself with a dedicated secret, so the gate never depends on which API key flavour the project hands the function.
  if (!authorized(req.headers.get('Authorization'), Deno.env.get('CRON_SECRET'))) return json({ error: 'unauthorized' }, 401);

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  try {
    const result = await runNudges(
      {
        async listSubscriptions() {
          const { data, error } = await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,tz,last_sent_at');
          if (error) throw error;
          return (data ?? []) as SubRow[];
        },
        async loadDocs(userIds) {
          const { data, error } = await db.from('repwise_user_data').select('user_id,workout_data').in('user_id', userIds);
          if (error) throw error;
          return new Map((data ?? []).map((d): [string, unknown] => [d.user_id as string, d.workout_data]));
        },
        send: (sub, payload) => webpush.sendNotification(sub, payload, SEND_OPTIONS),
        markSent: async (id, iso) => await db.from('push_subscriptions').update({ last_sent_at: iso }).eq('id', id),
        remove: async (id) => await db.from('push_subscriptions').delete().eq('id', id),
      },
      new Date(),
    );
    return json(result);
  } catch (e) {
    return json({ error: (e as { message?: string }).message ?? String(e) }, 500);
  }
});
