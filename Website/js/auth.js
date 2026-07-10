import { loadData, saveData } from './data.js';
import { addAuditLog, clearAuditLog } from './services-core.js';
import { isSupabaseEnabled } from './config.js';
import { getSupabase } from './supabase/client.js';
import { fetchProfile, updateProfileSupabase, deleteOwnAccountSupabase, deleteUserByAdminSupabase } from './supabase/sync.js';
import { checkEmailRateLimit, recordEmailAttempt, isEmailRateLimitError } from './auth-rate-limit.js';
import { markSessionStart, clearSessionStart, syncSessionStartFromSupabase } from './auth-session.js';
import { t } from './i18n.js';

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
    syncSessionStartFromSupabase(session);
    try {
      await completeOAuthSignup();
      cachedUser = await fetchProfile(session.user.id);
    } catch (_) {
      if (!cachedUser || cachedUser.id !== session.user.id) {
        cachedUser = {
          id: session.user.id,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
          role: session.user.user_metadata?.role || 'qiramarrësi',
        };
      }
    }
  } else {
    cachedUser = null;
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      if (event === 'SIGNED_IN') {
        markSessionStart();
      } else {
        syncSessionStartFromSupabase(session);
      }
      try {
        if (event === 'SIGNED_IN') await completeOAuthSignup();
        cachedUser = await fetchProfile(session.user.id);
      } catch (_) {
        if (!cachedUser || cachedUser.id !== session.user.id) {
          cachedUser = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
            role: session.user.user_metadata?.role || 'qiramarrësi',
          };
        }
      }
    } else {
      cachedUser = null;
      clearSessionStart();
    }
  });
}

function oauthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export async function completeOAuthSignup() {
  const pendingRole = sessionStorage.getItem('banese_oauth_role');
  sessionStorage.removeItem('banese_oauth_role');
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await fetchProfile(user.id);
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', user.id)
    .single();

  const isNewUser = profileRow?.created_at
    && (Date.now() - new Date(profileRow.created_at).getTime() < 5 * 60 * 1000);

  if (isNewUser && !pendingRole) {
    sessionStorage.setItem('banese_needs_role', '1');
  }
  if (isNewUser && pendingRole) {
    sessionStorage.removeItem('banese_needs_role');
  }

  const fullName = user.user_metadata?.full_name
    || user.user_metadata?.name
    || profile.fullName
    || user.email?.split('@')[0]
    || '';

  const updates = {};
  if (isNewUser && pendingRole && ['qiradhënësi', 'qiramarrësi'].includes(pendingRole) && profile.role !== pendingRole) {
    updates.role = pendingRole;
  }
  if (!profile.fullName && fullName) {
    updates.fullName = fullName;
  }
  if (!profile.email && user.email) {
    updates.email = user.email;
  }

  if (!Object.keys(updates).length) {
    cachedUser = profile;
    return profile;
  }

  const updated = await updateProfileSupabase(user.id, updates);
  await supabase.auth.updateUser({
    data: {
      full_name: updated.fullName,
      role: updated.role,
    },
  });
  await clearAuditLog();
  cachedUser = updated;
  return updated;
}

export function needsRoleSelection() {
  return sessionStorage.getItem('banese_needs_role') === '1';
}

export async function confirmOAuthRole(role) {
  if (!['qiradhënësi', 'qiramarrësi'].includes(role)) {
    throw new Error('Roli nuk është i vlefshëm.');
  }
  requireSupabase();
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesioni ka skaduar.');

  const updated = await updateProfileSupabase(user.id, { role });
  await supabase.auth.updateUser({
    data: {
      full_name: updated.fullName,
      role: updated.role,
      role_confirmed: true,
    },
  });
  sessionStorage.removeItem('banese_needs_role');
  await clearAuditLog();
  cachedUser = updated;
  return updated;
}

export async function signInWithGoogle({ role } = {}) {
  try {
    requireSupabase();
    const supabase = getSupabase();
    if (role) {
      sessionStorage.setItem('banese_oauth_role', role);
    } else {
      sessionStorage.removeItem('banese_oauth_role');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectUrl(),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      if (error.message?.toLowerCase().includes('provider is not enabled')) {
        return { success: false, error: t('auth.error.googleNotEnabled') };
      }
      return { success: false, error: formatAuthError(error) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë lidhjes me Google.' };
  }
}

export async function getCurrentUser() {
  requireSupabase();
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    cachedUser = null;
    return null;
  }
  if (cachedUser?.id === session.user.id) return cachedUser;
  cachedUser = await fetchProfile(session.user.id);
  return cachedUser;
}

export function getCurrentUserSync() {
  return cachedUser;
}

function formatAuthError(error, waitSeconds) {
  if (waitSeconds) {
    return t('auth.error.rateLimitWait', { seconds: waitSeconds });
  }
  const msg = error?.message || String(error || '');
  if (isEmailRateLimitError(msg)) {
    return t('auth.error.rateLimit');
  }
  if (msg.includes('Invalid login')) {
    return 'Email ose fjalëkalim i pasaktë.';
  }
  if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
    return t('auth.error.userExists');
  }
  if (msg.toLowerCase().includes('provider is not enabled') || msg.toLowerCase().includes('unsupported provider')) {
    return t('auth.error.googleNotEnabled');
  }
  return msg || t('auth.error.generic');
}

export function consumeOAuthUrlError() {
  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);
  const raw = hashParams.get('error_description')
    || hashParams.get('error')
    || queryParams.get('error_description')
    || queryParams.get('error');
  if (!raw) return null;

  const cleanUrl = window.location.pathname + window.location.search;
  history.replaceState({}, '', cleanUrl);
  return formatAuthError({ message: decodeURIComponent(raw.replace(/\+/g, ' ')) });
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
    markSessionStart();
    await clearAuditLog();
    return { success: true, user: cachedUser };
  });
}

export async function register({ fullName, email, password, role }) {
  const REGISTER_ROLES = ['qiradhënësi', 'qiramarrësi'];
  if (!REGISTER_ROLES.includes(role)) {
    return { success: false, error: 'Zgjidhni rolin: Qeradhënës ose Qeramarrës.' };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const limit = checkEmailRateLimit('register', normalizedEmail);
  if (!limit.allowed) {
    return { success: false, error: formatAuthError(null, limit.waitSeconds) };
  }

  try {
    requireSupabase();
    const supabase = getSupabase();
    const redirectTo = oauthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName.trim(),
          role,
          user_type: 'employed',
          campus_id: '',
        },
      },
    });

    if (error) {
      if (isEmailRateLimitError(error.message)) {
        recordEmailAttempt('register', normalizedEmail, true);
      }
      return { success: false, error: formatAuthError(error) };
    }

    recordEmailAttempt('register', normalizedEmail);

    if (!data.session) {
      return {
        success: true,
        needsConfirmation: true,
        message: t('auth.confirmEmailHint'),
      };
    }

    cachedUser = await fetchProfile(data.user.id);
    markSessionStart();
    await clearAuditLog();
    return { success: true, user: cachedUser };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const limit = checkEmailRateLimit('reset', normalizedEmail);
  if (!limit.allowed) {
    return { success: false, error: formatAuthError(null, limit.waitSeconds) };
  }

  try {
    requireSupabase();
    const supabase = getSupabase();
    const redirectTo = oauthRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    if (error) {
      if (isEmailRateLimitError(error.message)) {
        recordEmailAttempt('reset', normalizedEmail, true);
      }
      return { success: false, error: formatAuthError(error) };
    }
    recordEmailAttempt('reset', normalizedEmail);
    return {
      success: true,
      message: t('auth.resetEmailSent'),
    };
  } catch (err) {
    return { success: false, error: formatAuthError(err) };
  }
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
  clearSessionStart();
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
    clearSessionStart();
    sessionStorage.removeItem('banese_user_cache');
    const data = loadData();
    data.auditLog = [];
    saveData(data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë fshirjes së llogarisë.' };
  }
}

export async function deleteUserAsAdmin(targetUserId, reason) {
  try {
    requireSupabase();
    const current = getCurrentUserSync();
    if (current?.role !== 'administrator') {
      return { success: false, error: 'Nuk keni të drejtë për këtë veprim.' };
    }
    if (current.id === targetUserId) {
      return { success: false, error: 'Nuk mund të fshini llogarinë tuaj nga këtu.' };
    }
    const trimmed = reason?.trim() || '';
    if (trimmed.length < 5) {
      return { success: false, error: 'Shkruani arsyen e fshirjes (të paktën 5 karaktere).' };
    }

    const data = loadData();
    const target = data.users.find((u) => u.id === targetUserId);
    if (target?.role === 'administrator') {
      return { success: false, error: 'Nuk mund të fshini një administrator.' };
    }

    await deleteUserByAdminSupabase(targetUserId, trimmed);
    data.users = data.users.filter((u) => u.id !== targetUserId);
    saveData(data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë fshirjes së përdoruesit.' };
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
