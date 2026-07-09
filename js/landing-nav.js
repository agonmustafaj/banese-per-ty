import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function getConfig() {
  return window.__BANESE_CONFIG__ || {};
}

function resolveLandingUrl(entry, role) {
  const base = 'Website/index.html';
  if (entry === 'search') {
    if (role === 'qiramarrësi') return `${base}?page=search`;
    return `${base}?entry=search`;
  }
  if (entry === 'publish') {
    if (role === 'qiradhënësi') return `${base}?page=home`;
    return `${base}?entry=publish`;
  }
  if (entry === 'login') {
    if (role) return `${base}?page=home`;
    return `${base}?entry=login`;
  }
  return base;
}

async function getSessionRole() {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  return data?.role || null;
}

async function initLandingNav() {
  const role = await getSessionRole();
  document.querySelectorAll('[data-app-entry]').forEach((el) => {
    el.href = resolveLandingUrl(el.dataset.appEntry, role);
  });
}

initLandingNav();
