import { loadData, saveData } from './data.js';
import { addAuditLog, clearAuditLog } from './services-core.js';
import { isSupabaseEnabled } from './config.js';
import { getSupabase } from './supabase/client.js';
import { fetchProfile, updateProfileSupabase, deleteOwnAccountSupabase } from './supabase/sync.js';

let cachedUser = null;

function requireSupabase() {
  if (!isSupabaseEnabled()) {
    throw new Error('Aplikacioni kërkon lidhje me serverin. Kontaktoni administratorin.');
  }
}

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

async function cacheUser(user) {
  cachedUser = user;
  if (user) {
    sessionStorage.setItem('banese_user_cache', JSON.stringify({ userId: user.id }));
  } else {
    sessionStorage.removeItem('banese_user_cache');
  }
}

export async function initAuth() {
  requireSupabase();
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
  requireSupabase();
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

export function getCurrentUserSync() {
  return cachedUser;
}

export async function login(email, password) {
  return withRetry(async () => {
    requireSupabase();
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
    await clearAuditLog();
    return { success: true, user: cachedUser };
  });
}

export async function register({ fullName, email, password, role, userType, campusId }) {
  const REGISTER_ROLES = ['qiradhënësi', 'qiramarrësi'];
  if (!REGISTER_ROLES.includes(role)) {
    return { success: false, error: 'Zgjidhni rolin: Qeradhënës ose Qeramarrës.' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  return withRetry(async () => {
    requireSupabase();
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
    await clearAuditLog();
    return { success: true, user: cachedUser };
  });
}

export async function requestPasswordReset(email) {
  requireSupabase();
  const supabase = getSupabase();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), { redirectTo });
  if (error) return { success: false, error: error.message };
  return {
    success: true,
    message: 'Nëse email ekziston, do të merrni udhëzime për rivendosjen e fjalëkalimit.',
  };
}

export async function updateProfile(userId, updates) {
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

export async function changePassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere.' };
  }

  requireSupabase();
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

export async function logout() {
  await clearAuditLog();
  if (isSupabaseEnabled()) {
    await getSupabase().auth.signOut();
  }
  cachedUser = null;
  sessionStorage.removeItem('banese_user_cache');
}

export async function deleteAccount() {
  try {
    requireSupabase();
    await deleteOwnAccountSupabase();
    if (isSupabaseEnabled()) {
      await getSupabase().auth.signOut();
    }
    cachedUser = null;
    sessionStorage.removeItem('banese_user_cache');
    const data = loadData();
    data.auditLog = [];
    saveData(data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë fshirjes së llogarisë.' };
  }
}

export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

export function isAuthenticatedSync() {
  return !!cachedUser;
}

export async function unblockAccount(email, adminId) {
  addAuditLog('account_unblocked', adminId, `Llogaria ${email} u zhbllokua.`);
  return { success: true };
}
