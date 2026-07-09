const COOLDOWN_MS = 2 * 60 * 1000;
const SERVER_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;

function storageKey(action, email) {
  return `banese_email_limit_${action}_${email.toLowerCase().trim()}`;
}

export function checkEmailRateLimit(action, email) {
  const normalized = email?.toLowerCase?.().trim();
  if (!normalized) return { allowed: true };

  const until = Number(sessionStorage.getItem(storageKey(action, normalized)) || 0);
  const now = Date.now();
  if (until > now) {
    return { allowed: false, waitSeconds: Math.ceil((until - now) / 1000) };
  }
  return { allowed: true };
}

export function recordEmailAttempt(action, email, extended = false) {
  const normalized = email?.toLowerCase?.().trim();
  if (!normalized) return;
  const ms = extended ? SERVER_RATE_LIMIT_COOLDOWN_MS : COOLDOWN_MS;
  sessionStorage.setItem(storageKey(action, normalized), String(Date.now() + ms));
}

export function isEmailRateLimitError(message = '') {
  const m = message.toLowerCase();
  return m.includes('rate limit') || m.includes('over_email_send_rate_limit');
}
