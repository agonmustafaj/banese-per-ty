const PLACEHOLDER_URL = 'YOUR_PROJECT_ID';
const PLACEHOLDER_KEY = 'YOUR_ANON_PUBLIC_KEY';

export function getConfig() {
  return window.__BANESE_CONFIG__ || {};
}

export function isSupabaseEnabled() {
  const cfg = getConfig();
  const url = cfg.supabaseUrl || '';
  const key = cfg.supabaseAnonKey || '';
  const hasValidUrl = url.includes('.supabase.co') && !url.includes(PLACEHOLDER_URL);
  const hasValidKey =
    (key.startsWith('eyJ') && key.length > 20) ||
    key.startsWith('sb_publishable_');
  return hasValidUrl && hasValidKey && !key.includes(PLACEHOLDER_KEY);
}
