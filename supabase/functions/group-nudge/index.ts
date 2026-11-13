// Deno edge function, called by the app with the user's JWT. Decides delivery, saves the nudge, pushes. The work lives in run.ts.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { handleNudge, type NudgeRow } from './run.ts';
import { configureWebPush, type SubRow } from '../_shared/push.ts';

// A nudge is still worth showing an hour later, but not the next morning.
const SEND_OPTIONS = { TTL: 3600, urgency: 'normal' } as const;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Deployed with --no-verify-jwt (this project's signing keys don't suit the gateway check); the auth server verifies the token here.
  const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json({ error: 'Sign in to send nudges' }, 401);

  let input: { group?: string; to?: string; preset?: string; note?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  configureWebPush(webpush, env);

  try {
    const result = await handleNudge(
      {
        async shareGroup(group, a, b) {
          const { data, error } = await db.from('group_members').select('user_id').eq('group_id', group).in('user_id', [a, b]);
          if (error) throw error;
          return new Set((data ?? []).map((r) => r.user_id)).size === 2;
        },
        async senderName(group, uid) {
          const { data } = await db.from('group_members').select('display_name').eq('group_id', group).eq('user_id', uid).maybeSingle();
          return (data?.display_name as string | undefined) ?? 'Someone';
        },
        async receiverTz(uid) {
          const { data } = await db.from('push_subscriptions').select('tz').eq('user_id', uid).order('created_at', { ascending: false }).limit(1);
          return (data?.[0]?.tz as string | undefined) ?? 'UTC';
        },
        async loadDoc(uid) {
          const { data } = await db.from('repwise_user_data').select('workout_data').eq('user_id', uid).maybeSingle();
          return data?.workout_data ?? null;
        },
        async sentToday(from, to, since) {
          const { data, error } = await db.from('nudges').select('id').eq('from_user', from).eq('to_user', to).gte('created_at', since).limit(1);
          if (error) throw error;
          return (data ?? []).length > 0;
        },
        async pushesToday(to, since) {
          const { count, error } = await db.from('nudges').select('id', { count: 'exact', head: true }).eq('to_user', to).eq('delivery', 'push').gte('created_at', since);
          if (error) throw error;
          return count ?? 0;
        },
        async unreadSendersToday(to, since) {
          const { data } = await db.from('nudges').select('from_user').eq('to_user', to).is('read_at', null).gte('created_at', since);
          return (data ?? []).map((r) => r.from_user as string);
        },
        async insert(row: NudgeRow) {
          const { error } = await db.from('nudges').insert(row);
          if (error) throw error;
        },
        async devices(to) {
          const { data } = await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,tz,last_sent_at,kinds').eq('user_id', to).contains('kinds', ['nudges']);
          return (data ?? []) as SubRow[];
        },
        send: (target, payload, topic) => webpush.sendNotification(target, payload, { ...SEND_OPTIONS, topic }),
        remove: async (id) => await db.from('push_subscriptions').delete().eq('id', id),
      },
      { from: auth.user.id, group: input.group ?? '', to: input.to ?? '', preset: input.preset as never, note: input.note },
      new Date(),
    );
    return json(result.body, result.status);
  } catch (e) {
    console.error('group-nudge failed', e);
    return json({ error: "Couldn't send the nudge. Try again." }, 500);
  }
});
