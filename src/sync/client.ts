import { createClient } from '@supabase/supabase-js';
// Imported first so the sign-in URL is captured before Supabase clears it.
import './authUrl';

// Publishable key only. Row-level security limits each user to their own row.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://mvrimyshkrwsjuwyapgw.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6aEgv0uKGkQaIIUdIEZPBQ_PtKfNWc7';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const TABLE = 'repwise_user_data';
