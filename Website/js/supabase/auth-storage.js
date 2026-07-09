import { getConfig } from '../config.js';

const TAB_ID_KEY = 'banesaperty_tab_id';

function getTabId() {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

export function getSupabaseAuthStorageKey() {
  const cfg = getConfig();
  const projectRef = cfg.supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'supabase';
  return `sb-${projectRef}-auth-token-${getTabId()}`;
}

/** Sesion i pavarur për çdo tab — shmang përzierjen e roleve në taba të ndryshme. */
export function getSupabaseAuthOptions() {
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage,
    storageKey: getSupabaseAuthStorageKey(),
  };
}
