import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getConfig, isSupabaseEnabled } from '../config.js';

let client = null;

export function getSupabase() {
  if (!isSupabaseEnabled()) return null;
  if (!client) {
    const cfg = getConfig();
    client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
