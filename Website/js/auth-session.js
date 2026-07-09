const SESSION_STARTED_KEY = 'banese_session_started_at';

/** Sesioni skadon pas 1 ore — kërkon kyçje përsëri. */
export const SESSION_MAX_MS = 60 * 60 * 1000;

export function markSessionStart() {
  sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
}

export function clearSessionStart() {
  sessionStorage.removeItem(SESSION_STARTED_KEY);
}

/** Për sesione ekzistuese (pas rifreskimit) — llogarit kohën e fillimit nga JWT. */
export function syncSessionStartFromSupabase(session) {
  if (!session?.expires_at) return;
  if (sessionStorage.getItem(SESSION_STARTED_KEY)) return;
  const expiresMs = session.expires_at * 1000;
  const startedAt = Math.max(0, expiresMs - SESSION_MAX_MS);
  sessionStorage.setItem(SESSION_STARTED_KEY, String(startedAt));
}

export function isSessionExpired() {
  const raw = sessionStorage.getItem(SESSION_STARTED_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) >= SESSION_MAX_MS;
}

export async function enforceSessionExpiry(logoutFn) {
  if (!isSessionExpired()) return false;
  clearSessionStart();
  await logoutFn();
  return true;
}
