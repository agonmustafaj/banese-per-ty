const TENANT_PAGES = new Set(['home', 'search', 'favorites', 'notifications', 'profile', 'contract', 'payments']);
const LANDLORD_PAGES = new Set(['home', 'add-property', 'expenses', 'payments', 'notifications', 'profile', 'contract']);
const ADMIN_PAGES = new Set(['home', 'approvals', 'users', 'notifications', 'profile']);

export function parseAppUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    entry: params.get('entry'),
    page: params.get('page'),
  };
}

export function canAccessPage(user, page) {
  if (!user || !page) return false;
  if (user.role === 'qiramarrësi') return TENANT_PAGES.has(page);
  if (user.role === 'qiradhënësi') return LANDLORD_PAGES.has(page);
  if (user.role === 'administrator') return ADMIN_PAGES.has(page);
  return false;
}

export function resolvePageAfterAuth(user, entry, pageParam) {
  if (pageParam && canAccessPage(user, pageParam)) return pageParam;
  if (entry === 'search' && user.role === 'qiramarrësi') return 'search';
  if (entry === 'publish' && user.role === 'qiradhënësi') return 'home';
  return 'home';
}

export function syncUrlState(page, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete('entry');
  if (!page || page === 'login') {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }
  const next = url.pathname + url.search;
  if (replace) {
    history.replaceState({ page }, '', next);
  } else {
    history.pushState({ page }, '', next);
  }
}
