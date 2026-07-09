import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getConfig, isSupabaseEnabled } from '../config.js';
import { getSupabaseAuthOptions } from './auth-storage.js';

let client = null;

export function getSupabase() {
  if (!isSupabaseEnabled()) return null;
  if (!client) {
    const cfg = getConfig();
    client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: getSupabaseAuthOptions(),
    });
  }
  return client;
}
