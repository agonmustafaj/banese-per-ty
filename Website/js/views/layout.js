import {
  login,
  register,
  requestPasswordReset,
} from '../auth.js';
import { getRoleLabel } from '../data.js';
import { icons } from '../icons.js';
import { parseAppUrl, resolvePageAfterAuth } from '../nav.js';
import { t, renderLangSwitchHtml, attachLangSwitch } from '../i18n.js';

export function renderLogin(onNavigate, onLangChange) {
  let mode = 'login';
  let selectedRole = 'qiradhënësi';
  let selectedUserType = 'employed';

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

  function userTypeHtml() {
    return `
      <div class="form-group">
        <label>${t('auth.userType')}</label>
        <select name="userType" id="user-type-select">
          <option value="employed" ${selectedUserType === 'employed' ? 'selected' : ''}>${t('auth.employed')}</option>
          <option value="student" ${selectedUserType === 'student' ? 'selected' : ''}>${t('auth.student')}</option>
        </select>
      </div>
      <div class="form-group" id="campus-group" style="${selectedUserType === 'student' ? '' : 'display:none'}">
        <label>${t('auth.campus')}</label>
        <select name="campusId">
          <option value="up">Universiteti i Prishtinës</option>
          <option value="uibm">UIBM</option>
          <option value="ubt">UBT</option>
          <option value="upz">UPZ — Prizren</option>
        </select>
      </div>`;
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
            ${userTypeHtml()}
          ` : ''}
          <div class="form-group"><label>${icons.mail} ${t('common.email')}</label><input type="email" name="email" required placeholder="${t('auth.emailPlaceholder')}" /></div>
          <div class="form-group"><label>${icons.lock} ${t('auth.password')}</label><input type="password" name="password" required minlength="6" /></div>
          ${mode === 'login' ? `
            <div class="form-row">
              <a href="#" id="forgot-link">${t('auth.forgotLink')}</a>
            </div>` : ''}
          <button type="submit" class="btn btn-primary btn-block btn-lg">${mode === 'register' ? t('auth.registerBtn') : t('auth.loginBtn')}</button>
        </form>
        <div class="auth-footer">
          ${mode === 'register' ? t('auth.hasAccount') : t('auth.noAccount')}
          <a href="#" id="toggle-auth">${mode === 'register' ? ` ${t('auth.loginBtn')}` : ` ${t('auth.registerBtn')}`}</a>
        </div>`;
    }

    return `
      <div class="auth-page">
        <div class="auth-header">
          <div class="auth-header-top">
            <a href="../index.html" class="brand-link"><h1>Banesë për ty</h1></a>
            ${renderLangSwitchHtml()}
          </div>
          <p>${t('auth.tagline')}</p>
        </div>
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
    attachLangSwitch(container, () => {
      container.innerHTML = render();
      attachEvents(container);
      onLangChange?.();
    });

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

    container.querySelector('#user-type-select')?.addEventListener('change', (e) => {
      selectedUserType = e.target.value;
      const campus = container.querySelector('#campus-group');
      if (campus) campus.style.display = selectedUserType === 'student' ? '' : 'none';
    });

    container.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

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
          userType: fd.get('userType') || 'employed',
          campusId: fd.get('campusId') || '',
        });
        if (result.success) {
          if (result.needsConfirmation) {
            showAlert(container, 'info', result.message);
            mode = 'login';
            setTimeout(() => { container.innerHTML = render(); attachEvents(container); }, 2500);
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
      { id: 'expenses', label: t('nav.expenses'), icon: icons.card },
      { id: 'payments', label: t('nav.payments'), icon: icons.doc },
      { id: 'notifications', label: t('nav.notifications'), icon: icons.bell },
      { id: 'profile', label: t('nav.profile'), icon: icons.user },
    ];
  }
  if (role === 'qiramarrësi') {
    return [
      { id: 'home', label: t('nav.myHome'), icon: icons.house },
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

  if (!subPages.includes(page)) {
    return `
    <div class="app-shell">
      <header class="top-header">
        <div class="header-bar">
          <div class="header-left">
            <h1 class="page-title">${title}</h1>
            <span class="user-role-badge">${getRoleLabel(role)}</span>
          </div>
          <div class="header-actions">
            ${renderLangSwitchHtml()}
            <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="top-nav">
              <span class="nav-toggle-bar"></span>
              <span class="nav-toggle-bar"></span>
              <span class="nav-toggle-bar"></span>
            </button>
          </div>
        </div>
        <nav class="top-nav" id="top-nav">
          ${navItems.map((item) => `
            <button class="${page === item.id ? 'active' : ''}" data-page="${item.id}">
              ${item.icon} ${item.label}
              ${item.id === 'notifications' && unreadCount > 0 ? `<span class="nav-badge">${unreadCount}</span>` : ''}
            </button>
          `).join('')}
          <button class="logout-link" id="logout-btn">${icons.login} ${t('common.logout')}</button>
        </nav>
      </header>
      <main class="page-content">${content}</main>
    </div>`;
  }

  return `
    <div class="app-shell">
      <header class="top-header sub-page-header">
        <div class="header-left sub-header-left">
          <span class="user-role-badge user-role-badge--sub">${user.fullName} · ${getRoleLabel(role)}</span>
        </div>
        <div class="header-actions sub-header-actions">
          ${renderLangSwitchHtml()}
          <button class="logout-link logout-link--compact" id="logout-btn">${t('common.logout')}</button>
        </div>
      </header>
      <main class="page-content">${content}</main>
    </div>`;
}

export function attachShellEvents(container, onNavigate, onLogout, onLangChange) {
  const navToggle = container.querySelector('#nav-toggle');
  const topNav = container.querySelector('#top-nav');

  attachLangSwitch(container, () => onLangChange?.());

  function setNavOpen(isOpen) {
    if (!navToggle || !topNav) return;
    topNav.classList.toggle('nav-open', isOpen);
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-menu-open', isOpen);
  }

  navToggle?.addEventListener('click', () => {
    setNavOpen(!topNav.classList.contains('nav-open'));
  });

  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setNavOpen(false);
      onNavigate(btn.dataset.page);
    });
  });

  container.querySelector('#logout-btn')?.addEventListener('click', () => {
    setNavOpen(false);
    onLogout();
  });
}

export function renderBackButton(label, page = 'home') {
  return `<button class="page-back" data-page="${page}">${icons.arrowLeft} ${label ?? t('common.back')}</button>`;
}
