import {
  loadData,
  loadDataAsync,
  saveData,
  generateId,
  MAX_LOGIN_ATTEMPTS,
} from './data.js';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  generateCode,
} from './crypto.js';
import { addAuditLog, addNotification } from './services-core.js';
import { isSupabaseEnabled } from './config.js';
import { getSupabase } from './supabase/client.js';
import { fetchProfile, updateProfileSupabase } from './supabase/sync.js';

const SESSION_KEY = 'banese_session_token';
const PENDING_2FA_KEY = 'banese_pending_2fa';
const REGISTER_ROLES = ['qiradhënësi', 'qiramarrësi'];

let cachedUser = null;

async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) {
        return { success: false, error: 'Probleme me lidhjen — provoni përsëri.' };
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return { success: false, error: 'Probleme me lidhjen — provoni përsëri.' };
}

function getStoredToken() {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
}

async function setSessionToken(user, remember = false) {
  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
  sessionStorage.setItem(SESSION_KEY, token);
  if (remember) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PENDING_2FA_KEY);
}

async function cacheUser(user) {
  cachedUser = user;
  sessionStorage.setItem('banese_user_cache', JSON.stringify({ userId: user.id }));
}

export async function initAuth() {
  if (!isSupabaseEnabled()) return;
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      cachedUser = await fetchProfile(session.user.id);
    } catch (_) {
      cachedUser = null;
    }
  } else {
    cachedUser = null;
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      try {
        cachedUser = await fetchProfile(session.user.id);
      } catch (_) {
        cachedUser = null;
      }
    } else {
      cachedUser = null;
    }
  });
}

export async function getCurrentUser() {
  if (isSupabaseEnabled()) {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      cachedUser = null;
      return null;
    }
    if (cachedUser?.id === user.id) return cachedUser;
    cachedUser = await fetchProfile(user.id);
    return cachedUser;
  }

  const token = getStoredToken();
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) {
    clearSession();
    return null;
  }
  const data = loadData();
  const user = data.users.find((u) => u.id === payload.userId) || null;
  if (user) await cacheUser(user);
  return user;
}

export function getCurrentUserSync() {
  if (isSupabaseEnabled()) return cachedUser;

  const data = loadData();
  if (sessionStorage.getItem(PENDING_2FA_KEY)) return null;

  if (cachedUser) return cachedUser;

  try {
    const raw = sessionStorage.getItem('banese_user_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = data.users.find((u) => u.id === parsed.userId);
      if (user) return user;
    }
  } catch (_) {}

  const token = getStoredToken();
  if (token) {
    try {
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(atob(padded));
        if (json.exp && Date.now() > json.exp) return null;
        return data.users.find((u) => u.id === json.userId) || null;
      }
    } catch (_) {}
  }
  return null;
}

export async function login(email, password, remember = false) {
  if (isSupabaseEnabled()) {
    return withRetry(async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });
      if (error) {
        const msg = error.message.includes('Invalid login')
          ? 'Email ose fjalëkalim i pasaktë.'
          : error.message;
        return { success: false, error: msg };
      }
      cachedUser = await fetchProfile(data.user.id);
      addAuditLog('login', cachedUser.id, `${cachedUser.fullName} u kyç në sistem.`);
      return { success: true, user: cachedUser };
    });
  }

  return withRetry(async () => {
    await loadDataAsync();
    const data = loadData();
    const key = email.toLowerCase().trim();

    if (data.blockedAccounts[key]) {
      return {
        success: false,
        error: 'Llogaria e bllokuar për arsye sigurie. Kontaktoni administratorin.',
      };
    }

    const attempts = data.loginAttempts[key] || 0;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      data.blockedAccounts[key] = true;
      saveData(data);
      const user = data.users.find((u) => u.email.toLowerCase() === key);
      if (user) {
        addNotification(user.id, 'siguri', 'Llogaria juaj u bllokua pas 3 tentativave të dështuara.');
        addAuditLog('account_blocked', user.id, `Llogaria ${key} u bllokua.`);
      }
      return {
        success: false,
        error: 'Llogaria e bllokuar për arsye sigurie. Kontaktoni administratorin.',
      };
    }

    const user = data.users.find((u) => u.email.toLowerCase() === key);
    if (!user) {
      data.loginAttempts[key] = attempts + 1;
      saveData(data);
      const remaining = MAX_LOGIN_ATTEMPTS - data.loginAttempts[key];
      return {
        success: false,
        error: remaining > 0
          ? `Email ose fjalëkalim i pasaktë. ${remaining} tentativa të mbetura.`
          : 'Llogaria u bllokua pas tentativave të shumta.',
      };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      data.loginAttempts[key] = attempts + 1;
      saveData(data);
      const remaining = MAX_LOGIN_ATTEMPTS - data.loginAttempts[key];
      if (remaining <= 0) {
        data.blockedAccounts[key] = true;
        addNotification(user.id, 'siguri', 'Llogaria juaj u bllokua pas 3 tentativave të dështuara (email simuluar).');
        addAuditLog('account_blocked', user.id, `Bllokim: ${key}`);
        saveData(data);
      }
      return {
        success: false,
        error: remaining > 0
          ? `Email ose fjalëkalim i pasaktë. ${remaining} tentativa të mbetura.`
          : 'Llogaria u bllokua pas 3 tentativave të dështuara.',
      };
    }

    delete data.loginAttempts[key];
    saveData(data);

    if (user.twoFactorEnabled) {
      const code = generateCode();
      data.pending2fa[key] = { code, userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 };
      saveData(data);
      sessionStorage.setItem(PENDING_2FA_KEY, JSON.stringify({ email: key, remember }));
      addNotification(user.id, 'siguri', `Kodi i verifikimit (2FA): ${code} — vlen 5 minuta.`);
      return { success: false, requires2fa: true, email: key, demoCode: code };
    }

    await setSessionToken(user, remember);
    await cacheUser(user);
    addAuditLog('login', user.id, `${user.fullName} u kyç në sistem.`);
    return { success: true, user };
  });
}

export async function verify2fa(email, code, remember = false) {
  if (isSupabaseEnabled()) {
    return { success: false, error: '2FA nuk është aktiv me Supabase Auth në këtë version.' };
  }

  const data = loadData();
  const key = email.toLowerCase().trim();
  const pending = data.pending2fa[key];
  if (!pending || pending.code !== code || Date.now() > pending.expiresAt) {
    return { success: false, error: 'Kodi i verifikimit është i pasaktë ose ka skaduar.' };
  }
  delete data.pending2fa[key];
  saveData(data);
  sessionStorage.removeItem(PENDING_2FA_KEY);

  const user = data.users.find((u) => u.id === pending.userId);
  if (!user) return { success: false, error: 'Përdoruesi nuk u gjet.' };

  await setSessionToken(user, remember);
  await cacheUser(user);
  addAuditLog('login_2fa', user.id, `${user.fullName} u verifikua me 2FA.`);
  return { success: true, user };
}

export async function register({ fullName, email, password, role, userType, campusId }) {
  if (!REGISTER_ROLES.includes(role)) {
    return { success: false, error: 'Zgjidhni rolin: Qeradhënës ose Qeramarrës.' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (isSupabaseEnabled()) {
    return withRetry(async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            user_type: userType || 'employed',
            campus_id: campusId || '',
          },
        },
      });
      if (error) return { success: false, error: error.message };

      if (!data.session) {
        return {
          success: true,
          needsConfirmation: true,
          message: 'Kontrolloni email-in për të konfirmuar llogarinë, pastaj kyçuni.',
        };
      }

      cachedUser = await fetchProfile(data.user.id);
      addAuditLog('register', cachedUser.id, `Regjistrim i ri: ${cachedUser.fullName}`);
      return { success: true, user: cachedUser };
    });
  }

  const data = loadData();
  if (data.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'Ky email është i regjistruar tashmë.' };
  }

  const passwordHash = await hashPassword(password);
  const user = {
    id: generateId('u'),
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    phone: '',
    address: '',
    userType: userType || 'employed',
    campusId: campusId || '',
    twoFactorEnabled: true,
  };

  data.users.push(user);
  saveData(data);
  await setSessionToken(user);
  await cacheUser(user);
  addAuditLog('register', user.id, `Regjistrim i ri: ${user.fullName}`);
  return { success: true, user };
}

export async function requestPasswordReset(email) {
  const key = email.toLowerCase().trim();

  if (isSupabaseEnabled()) {
    const supabase = getSupabase();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(key, { redirectTo });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      message: 'Nëse email ekziston, do të merrni udhëzime për rivendosje.',
    };
  }

  const data = loadData();
  const user = data.users.find((u) => u.email.toLowerCase() === key);
  if (!user) {
    return { success: true, message: 'Nëse email ekziston, do të merrni udhëzime për rivendosje.' };
  }

  const token = generateId('rst');
  data.passwordResetTokens.push({
    token,
    userId: user.id,
    expiresAt: Date.now() + 30 * 60 * 1000,
    used: false,
  });
  saveData(data);
  addNotification(
    user.id,
    'siguri',
    `Rivendosje fjalëkalimi — token: ${token} (simulim email, vlen 30 min)`
  );
  addAuditLog('password_reset_request', user.id, `Kërkesë rivendosje për ${key}`);
  return {
    success: true,
    message: 'U dërgua email me udhëzime (simuluar te njoftimet).',
    demoToken: token,
  };
}

export async function resetPassword(token, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.' };
  }

  if (isSupabaseEnabled()) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    addAuditLog('password_reset', cachedUser?.id, 'Fjalëkalimi u rivendos.');
    return { success: true };
  }

  const data = loadData();
  const entry = data.passwordResetTokens.find(
    (t) => t.token === token && !t.used && Date.now() < t.expiresAt
  );
  if (!entry) return { success: false, error: 'Token i pavlefshëm ose i skaduar.' };

  const user = data.users.find((u) => u.id === entry.userId);
  if (!user) return { success: false, error: 'Përdoruesi nuk u gjet.' };

  user.passwordHash = await hashPassword(newPassword);
  entry.used = true;
  const key = user.email.toLowerCase();
  delete data.loginAttempts[key];
  delete data.blockedAccounts[key];
  saveData(data);
  addAuditLog('password_reset', user.id, 'Fjalëkalimi u rivendos.');
  return { success: true };
}

export async function updateProfile(userId, updates) {
  if (isSupabaseEnabled()) {
    try {
      const user = await updateProfileSupabase(userId, updates);
      cachedUser = user;
      const data = loadData();
      const idx = data.users.findIndex((u) => u.id === userId);
      if (idx >= 0) data.users[idx] = user;
      else data.users.push(user);
      saveData(data);
      return { success: true, user };
    } catch (err) {
      return { success: false, error: err.message || 'Gabim gjatë përditësimit.' };
    }
  }

  const data = loadData();
  const user = data.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Përdoruesi nuk u gjet.' };

  if (updates.email) {
    const emailTaken = data.users.some(
      (u) => u.id !== userId && u.email.toLowerCase() === updates.email.toLowerCase().trim()
    );
    if (emailTaken) return { success: false, error: 'Ky email përdoret nga llogari tjetër.' };
    updates.email = updates.email.toLowerCase().trim();
  }

  Object.assign(user, updates);
  saveData(data);
  await setSessionToken(user);
  await cacheUser(user);
  return { success: true, user };
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere.' };
  }

  if (isSupabaseEnabled()) {
    const supabase = getSupabase();
    const email = cachedUser?.email;
    if (!email) return { success: false, error: 'Sesioni nuk është valid.' };

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) return { success: false, error: 'Fjalëkalimi aktual është i gabuar.' };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };

    addAuditLog('password_change', userId, 'Fjalëkalimi u ndryshua.');
    return { success: true };
  }

  const data = loadData();
  const user = data.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Përdoruesi nuk u gjet.' };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: 'Fjalëkalimi aktual është i gabuar.' };

  user.passwordHash = await hashPassword(newPassword);
  saveData(data);
  addAuditLog('password_change', userId, 'Fjalëkalimi u ndryshua.');
  return { success: true };
}

export async function logout() {
  if (isSupabaseEnabled()) {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  }
  cachedUser = null;
  clearSession();
  sessionStorage.removeItem('banese_user_cache');
}

export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

export function isAuthenticatedSync() {
  if (isSupabaseEnabled()) return !!cachedUser;
  return !!getStoredToken() && !sessionStorage.getItem(PENDING_2FA_KEY);
}

export async function unblockAccount(email, adminId) {
  if (isSupabaseEnabled()) {
    addAuditLog('account_unblocked', adminId, `Llogaria ${email} u zhbllokua (Supabase Auth).`);
    return { success: true };
  }

  const data = loadData();
  const key = email.toLowerCase().trim();
  delete data.blockedAccounts[key];
  delete data.loginAttempts[key];
  saveData(data);
  addAuditLog('account_unblocked', adminId, `Llogaria ${key} u zhbllokua.`);
  return { success: true };
}
