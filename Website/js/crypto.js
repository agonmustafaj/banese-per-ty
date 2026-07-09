const JWT_SECRET = 'banese-per-ty-jwt-secret-v1';
const PBKDF2_ITERATIONS = 100000;

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bits;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith('pbkdf2:')) return password === stored;
  const [, iterations, saltB64, hashB64] = stored.split(':');
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: Number(iterations), hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function hmacSign(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toBase64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacVerify(data, signature) {
  const expected = await hmacSign(data);
  return expected === signature;
}

export async function createSessionToken(payload, expiresInMs = 8 * 60 * 60 * 1000) {
  const header = toBase64(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + expiresInMs,
  };
  const payloadB64 = toBase64(new TextEncoder().encode(JSON.stringify(body)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await hmacSign(`${header}.${payloadB64}`);
  return `${header}.${payloadB64}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payloadB64, sig] = parts;
  const valid = await hmacVerify(`${header}.${payloadB64}`, sig);
  if (!valid) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(fromBase64(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))));
    if (json.exp && Date.now() > json.exp) return null;
    return json;
  } catch (_) {
    return null;
  }
}

export function generateCode(length = 6) {
  return String(Math.floor(100000 + Math.random() * 900000)).slice(0, length);
}
