import { getSupabase } from './client.js';
import { isSupabaseEnabled } from '../config.js';

const WATCHED_TABLES = ['properties', 'contracts', 'contract_requests', 'notifications', 'payments'];

/**
 * Dëgjon ndryshimet në Supabase dhe njofton aplikacionin (me debounce).
 * Kthen funksionin për të ndalur sinkronizimin.
 */
export function startRealtimeSync(onDataChange) {
  if (!isSupabaseEnabled()) return () => {};
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let debounceTimer = null;
  const schedule = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onDataChange(), 700);
  };

  let channel = supabase.channel(`banese-sync-${Date.now()}`);
  WATCHED_TABLES.forEach((table) => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      schedule
    );
  });
  channel.subscribe();

  return () => {
    clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
}
