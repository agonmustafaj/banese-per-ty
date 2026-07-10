import {
  login,
  register,
  requestPasswordReset,
  signInWithGoogle,
  confirmOAuthRole,
} from '../auth.js';
import { getRoleLabel } from '../data.js';
import { getPendingContractsForTenant, getPendingContractsForLandlord } from '../services.js';
import { icons } from '../icons.js';
import { parseAppUrl, resolvePageAfterAuth } from '../nav.js';
import { t } from '../i18n.js';
import { renderThemeToggleHtml, attachThemeToggle } from '../theme.js';

export function renderLogin(onNavigate) {
  let mode = 'login';
  let selectedRole = 'qiradhënësi';

  function roleSelectorHtml() {
    return `
      <div class="form-group">
        <label>${t('auth.accountRole')}</label>
        <div class="role-selector" id="role-selector">
          <div class="role-option ${selectedRole === 'qiradhënësi' ? 'active' : ''}" data-role="qiradhënësi">${t('role.qiradhënësi')}</div>
          <div class="role-option ${selectedRole === 'qiramarrësi' ? 'active' : ''}" data-role="qiramarrësi">${t('role.qiramarrësi')}</div>
        </div>
      </div>`;
  }

  function passwordFieldHtml() {
    return `
      <div class="form-group">
        <label>${icons.lock} ${t('auth.password')}</label>
        <div class="password-field">
          <input type="password" name="password" id="auth-password" required minlength="6" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" />
          <button type="button" class="password-toggle" id="auth-password-toggle" aria-label="${t('auth.showPassword')}" aria-pressed="false">${icons.eye}</button>
        </div>
      </div>`;
  }

  function attachPasswordToggle(container) {
    const input = container.querySelector('#auth-password');
    const btn = container.querySelector('#auth-password-toggle');
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? t('auth.hidePassword') : t('auth.showPassword'));
      btn.innerHTML = show ? icons.eyeOff : icons.eye;
    });
  }

  function googleButtonHtml() {
    return `
      <div class="auth-divider"><span>${t('auth.or')}</span></div>
      <button type="button" class="btn btn-google btn-block btn-lg" id="google-auth-btn">
        <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        ${t('auth.continueGoogle')}
      </button>`;
  }

  function render() {
    const titles = {
      login: t('auth.loginTitle'),
      register: t('auth.registerTitle'),
      forgot: t('auth.forgotTitle'),
    };

    let body = '';
    if (mode === 'forgot') {
      body = `
        <p class="field-hint">${t('auth.forgotHint')}</p>
        <form id="auth-form">
          <div class="form-group"><label>${t('common.email')}</label><input type="email" name="email" required placeholder="${t('auth.emailPlaceholder')}" /></div>
          <button type="submit" class="btn btn-primary btn-block">${t('auth.sendLink')}</button>
        </form>`;
    } else {
      body = `
        <form id="auth-form">
          ${mode === 'register' ? `
            <div class="form-group"><label>${t('auth.fullName')}</label><input type="text" name="fullName" required /></div>
            ${roleSelectorHtml()}
          ` : ''}
          <div class="form-group"><label>${icons.mail} ${t('common.email')}</label><input type="email" name="email" required placeholder="${t('auth.emailPlaceholder')}" /></div>
          ${passwordFieldHtml()}
          ${mode === 'login' ? `
            <div class="form-row">
              <a href="#" id="forgot-link">${t('auth.forgotLink')}</a>
            </div>` : ''}
          <button type="submit" class="btn btn-primary btn-block btn-lg">${mode === 'register' ? t('auth.registerBtn') : t('auth.loginBtn')}</button>
        </form>
        ${googleButtonHtml()}
        <div class="auth-footer">
          ${mode === 'register' ? t('auth.hasAccount') : t('auth.noAccount')}
          <a href="#" id="toggle-auth">${mode === 'register' ? ` ${t('auth.loginBtn')}` : ` ${t('auth.registerBtn')}`}</a>
        </div>`;
    }

    return `
      ${authShellHeaderHtml()}
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="icon-box">${icons.login}</div>
            <h2>${titles[mode]}</h2>
          </div>
          <div class="auth-card-body">
            <div id="auth-alert"></div>
            ${body}
            ${mode === 'forgot' ? `<a href="#" id="back-login" class="auth-back">${t('auth.backLogin')}</a>` : ''}
          </div>
        </div>
      </div>`;
  }

  function showAlert(container, type, message) {
    const el = container.querySelector('#auth-alert');
    if (el) el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  }

  function attachEvents(container) {
    container.querySelectorAll('.header-controls').forEach((el) => attachThemeToggle(el));
    attachPasswordToggle(container);

    container.querySelector('#toggle-auth')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = mode === 'register' ? 'login' : 'register';
      container.innerHTML = render();
      attachEvents(container);
    });

    container.querySelector('#forgot-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = 'forgot';
      container.innerHTML = render();
      attachEvents(container);
    });

    container.querySelector('#back-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = 'login';
      container.innerHTML = render();
      attachEvents(container);
    });

    container.querySelectorAll('.role-option').forEach((el) => {
      el.addEventListener('click', () => {
        selectedRole = el.dataset.role;
        container.innerHTML = render();
        attachEvents(container);
      });
    });

    container.querySelector('#google-auth-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#google-auth-btn');
      btn.disabled = true;
      const result = await signInWithGoogle(mode === 'register' ? { role: selectedRole } : {});
      if (!result.success) {
        btn.disabled = false;
        showAlert(container, 'error', result.error);
      }
    });

    container.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (mode === 'forgot') {
          const result = await requestPasswordReset(fd.get('email'));
          if (result.success) {
            showAlert(container, 'success', result.message);
          } else {
            showAlert(container, 'error', result.error);
          }
          return;
        }

        const email = fd.get('email');
        const password = fd.get('password');

        if (mode === 'register') {
          const result = await register({
            fullName: fd.get('fullName'),
            email,
            password,
            role: selectedRole,
          });
          if (result.success) {
            if (result.needsConfirmation) {
              showAlert(container, 'success', result.message);
              mode = 'login';
              setTimeout(() => { container.innerHTML = render(); attachEvents(container); }, 5000);
            } else {
              const { entry } = parseAppUrl();
              onNavigate(resolvePageAfterAuth(result.user, entry, null));
            }
          } else {
            showAlert(container, 'error', result.error);
          }
        } else {
          const result = await login(email, password);
          if (result.success) {
            const { entry } = parseAppUrl();
            onNavigate(resolvePageAfterAuth(result.user, entry, null));
          } else showAlert(container, 'error', result.error);
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  return { html: render(), attachEvents };
}

function platformLogoSvg(gradId = 'appBrandGrad') {
  return `
    <svg class="app-brand-mark" width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill="url(#${gradId})"/>
      <path d="M11.5 21 20 13.5 28.5 21" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14.5 19.5V27a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-7.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="20" cy="25" r="1.4" fill="#fff"/>
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" style="stop-color:var(--primary)"/>
          <stop offset="1" style="stop-color:var(--primary-dark)"/>
        </linearGradient>
      </defs>
    </svg>`;
}

function headerThemeHtml() {
  return `<div class="header-controls">${renderThemeToggleHtml()}</div>`;
}

function appBrandHtml() {
  return `
    <a href="../index.html" class="app-brand">
      ${platformLogoSvg()}
      <span class="app-brand-text">Banesë <span>për ty</span></span>
    </a>`;
}

function centeredHeaderBarHtml({ center, right = '' }) {
  return `
    <div class="header-bar header-bar--centered">
      <div class="header-bar-slot header-bar-slot--left" aria-hidden="true"></div>
      <div class="header-bar-slot header-bar-slot--center">${center}</div>
      <div class="header-bar-slot header-bar-slot--right">${right}</div>
    </div>`;
}

function authShellHeaderHtml() {
  return `
    <header class="auth-shell-header">
      ${centeredHeaderBarHtml({
        center: appBrandHtml(),
        right: headerThemeHtml(),
      })}
    </header>`;
}

function roleSelectorHtml(selectedRole) {
  return `
    <div class="form-group">
      <label>${t('auth.accountRole')}</label>
      <div class="role-selector" id="role-selector">
        <div class="role-option ${selectedRole === 'qiradhënësi' ? 'active' : ''}" data-role="qiradhënësi">${t('role.qiradhënësi')}</div>
        <div class="role-option ${selectedRole === 'qiramarrësi' ? 'active' : ''}" data-role="qiramarrësi">${t('role.qiramarrësi')}</div>
      </div>
    </div>`;
}

export function renderRoleSelection(onComplete) {
  let selectedRole = 'qiramarrësi';

  function render() {
    return `
      ${authShellHeaderHtml()}
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="icon-box">${icons.user}</div>
            <h2>${t('auth.pickRoleTitle')}</h2>
          </div>
          <div class="auth-card-body">
            <p class="field-hint">${t('auth.pickRoleHint')}</p>
            <div id="role-alert"></div>
            ${roleSelectorHtml(selectedRole)}
            <button type="button" class="btn btn-primary btn-block btn-lg" id="confirm-role-btn">${t('auth.pickRoleContinue')}</button>
          </div>
        </div>
      </div>`;
  }

  function attachEvents(container) {
    container.querySelectorAll('.header-controls').forEach((el) => attachThemeToggle(el));

    container.querySelectorAll('.role-option').forEach((el) => {
      el.addEventListener('click', () => {
        selectedRole = el.dataset.role;
        container.innerHTML = render();
        attachEvents(container);
      });
    });

    container.querySelector('#confirm-role-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#confirm-role-btn');
      const alertEl = container.querySelector('#role-alert');
      btn.disabled = true;
      try {
        await confirmOAuthRole(selectedRole);
        await onComplete();
      } catch (err) {
        if (alertEl) {
          alertEl.innerHTML = `<div class="alert alert-error">${err.message || 'Gabim.'}</div>`;
        }
        btn.disabled = false;
      }
    });
  }

  return { html: render(), attachEvents };
}

function getPageTitle(role, page) {
  const map = {
    profile: 'page.profile',
    'add-property': 'page.addProperty',
    search: 'page.search',
    favorites: 'page.favorites',
    payments: 'page.payments',
    expenses: 'page.expenses',
    contract: 'page.contract',
    approvals: 'page.approvals',
    users: 'page.users',
    notifications: 'page.notifications',
  };
  if (map[page]) return t(map[page]);
  if (role === 'qiradhënësi') return t('page.properties');
  if (role === 'qiramarrësi') return t('page.myHome');
  return t('page.admin');
}

function getNavItems(role) {
  if (role === 'qiradhënësi') {
    return [
      { id: 'home', label: t('nav.properties'), icon: icons.house },
      { id: 'contract', label: t('nav.contracts'), icon: icons.doc },
      { id: 'expenses', label: t('nav.expenses'), icon: icons.card },
      { id: 'payments', label: t('nav.payments'), icon: icons.doc },
      { id: 'notifications', label: t('nav.notifications'), icon: icons.bell },
      { id: 'profile', label: t('nav.profile'), icon: icons.user },
    ];
  }
  if (role === 'qiramarrësi') {
    return [
      { id: 'home', label: t('nav.myHome'), icon: icons.house },
      { id: 'contract', label: t('nav.contracts'), icon: icons.doc },
      { id: 'favorites', label: t('nav.favorites'), icon: icons.heart },
      { id: 'notifications', label: t('nav.notifications'), icon: icons.bell },
      { id: 'profile', label: t('nav.profile'), icon: icons.user },
    ];
  }
  return [
    { id: 'home', label: t('nav.panel'), icon: icons.house },
    { id: 'users', label: t('nav.users'), icon: icons.user },
    { id: 'approvals', label: t('nav.approvals'), icon: icons.check },
    { id: 'notifications', label: t('nav.notifications'), icon: icons.bell },
    { id: 'profile', label: t('nav.profile'), icon: icons.user },
  ];
}

export function renderAppShell(user, page, content, unreadCount = 0) {
  const role = user.role;
  const navItems = getNavItems(role);
  const title = getPageTitle(role, page);
  const subPages = ['add-property', 'search', 'payments', 'contract', 'favorites', 'expenses', 'approvals', 'users', 'notifications'];
  const pendingContractCount =
    role === 'qiramarrësi'
      ? getPendingContractsForTenant(user.id).length
      : role === 'qiradhënësi'
        ? getPendingContractsForLandlord(user.id).length
        : 0;

  function navBadge(item) {
    if (item.id === 'notifications' && unreadCount > 0) {
      return `<span class="nav-badge">${unreadCount}</span>`;
    }
    if (item.id === 'contract' && pendingContractCount > 0) {
      return `<span class="nav-badge nav-badge--contract">${pendingContractCount}</span>`;
    }
    return '';
  }

  if (!subPages.includes(page)) {
    return `
    <div class="app-shell">
      <header class="top-header">
        ${centeredHeaderBarHtml({
          center: appBrandHtml(),
          right: `${headerThemeHtml()}<span class="user-role-badge user-role-badge--bar">${getRoleLabel(role)}</span>`,
        })}
        <nav class="top-nav" id="top-nav" aria-label="Kryesore">
          ${navItems.map((item) => `
            <button class="top-nav-item ${page === item.id ? 'active' : ''}" data-page="${item.id}" title="${item.label}">
              <span class="top-nav-icon">${item.icon}</span>
              <span class="top-nav-label">${item.label}</span>
              ${navBadge(item)}
            </button>
          `).join('')}
          <button class="top-nav-item logout-link" id="logout-btn" title="${t('common.logout')}">
            <span class="top-nav-icon">${icons.login}</span>
            <span class="top-nav-label">${t('common.logout')}</span>
          </button>
        </nav>
      </header>
      <main class="page-content">${content}</main>
    </div>`;
  }

  return `
    <div class="app-shell">
      <header class="top-header sub-page-header">
        ${centeredHeaderBarHtml({
          center: appBrandHtml(),
          right: `${headerThemeHtml()}<button class="logout-link logout-link--compact" id="logout-btn">${t('common.logout')}</button>`,
        })}
        <p class="sub-header-meta">${user.fullName} · ${getRoleLabel(role)}</p>
      </header>
      <main class="page-content">${content}</main>
    </div>`;
}

export function attachShellEvents(container, onNavigate, onLogout) {
  container.querySelectorAll('.header-controls').forEach((el) => attachThemeToggle(el));

  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onNavigate(btn.dataset.page);
    });
  });

  container.querySelector('#logout-btn')?.addEventListener('click', () => {
    onLogout();
  });
}

export function renderBackButton(label, page = 'home') {
  return `<button type="button" class="page-back" data-page="${page}">${icons.arrowLeft} ${label ?? t('common.back')}</button>`;
}
