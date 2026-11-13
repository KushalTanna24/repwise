// Deno edge function, called by the app with the user's JWT. Returns 5-minute photo links for one group member.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handlePhotos } from './run.ts';

const BUCKET = 'progress-photos';
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

  const asUser = createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json({ error: 'Sign in to see photos' }, 401);

  let input: { group?: string; member?: string };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (!input.group || !input.member) return json({ error: 'Missing group or member' }, 400);

  const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const result = await handlePhotos(
      {
        async shareBody(group, viewer, member) {
          const { data, error } = await db.from('group_members').select('user_id,share_body').eq('group_id', group).in('user_id', [viewer, member]);
          if (error) throw error;
          const rows = data ?? [];
          const target = rows.find((r) => r.user_id === member);
          if (!target || !rows.some((r) => r.user_id === viewer)) return null;
          return target.share_body === true;
        },
        async listPaths(member) {
          const { data } = await db.from('repwise_user_data').select('workout_data').eq('user_id', member).maybeSingle();
          const photos = (data?.workout_data as { photos?: { path?: unknown }[] } | null)?.photos;
          return Array.isArray(photos) ? photos.map((p) => p?.path).filter((p): p is string => typeof p === 'string') : [];
        },
        async sign(path, seconds) {
          const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds);
          if (error) throw error;
          return data.signedUrl;
        },
      },
      { viewer: auth.user.id, group: input.group, member: input.member },
    );
    return json(result.body, result.status);
  } catch (e) {
    console.error('member-photos failed', e);
    return json({ error: "Couldn't load photos. Try again." }, 500);
  }
});
