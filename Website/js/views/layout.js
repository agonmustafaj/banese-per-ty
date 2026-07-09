import {
  login,
  register,
  requestPasswordReset,
} from '../auth.js';
import { getRoleLabel } from '../data.js';
import { icons } from '../icons.js';

export function renderLogin(onNavigate) {
  let mode = 'login';
  let selectedRole = 'qiradhënësi';
  let selectedUserType = 'employed';

  function roleSelectorHtml() {
    return `
      <div class="form-group">
        <label>Roli i llogarisë</label>
        <div class="role-selector" id="role-selector">
          <div class="role-option ${selectedRole === 'qiradhënësi' ? 'active' : ''}" data-role="qiradhënësi">Qeradhënës</div>
          <div class="role-option ${selectedRole === 'qiramarrësi' ? 'active' : ''}" data-role="qiramarrësi">Qeramarrës</div>
        </div>
      </div>`;
  }

  function userTypeHtml() {
    return `
      <div class="form-group">
        <label>Lloji i përdoruesit</label>
        <select name="userType" id="user-type-select">
          <option value="employed" ${selectedUserType === 'employed' ? 'selected' : ''}>I punësuar</option>
          <option value="student" ${selectedUserType === 'student' ? 'selected' : ''}>Student</option>
        </select>
      </div>
      <div class="form-group" id="campus-group" style="${selectedUserType === 'student' ? '' : 'display:none'}">
        <label>Kampus / Fakultet</label>
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
      login: 'Kyçu në Llogari',
      register: 'Regjistrohu',
      forgot: 'Harrove Fjalëkalimin?',
    };

    let body = '';
    if (mode === 'forgot') {
      body = `
        <p class="field-hint">Vendosni email-in e llogarisë. Do të merrni një link për rivendosjen e fjalëkalimit.</p>
        <form id="auth-form">
          <div class="form-group"><label>Email</label><input type="email" name="email" required placeholder="emaili-juaj@email.com" /></div>
          <button type="submit" class="btn btn-primary btn-block">Dërgo Linkun</button>
        </form>`;
    } else {
      body = `
        <form id="auth-form">
          ${mode === 'register' ? `
            <div class="form-group"><label>Emri i plotë</label><input type="text" name="fullName" required /></div>
            ${roleSelectorHtml()}
            ${userTypeHtml()}
          ` : ''}
          <div class="form-group"><label>${icons.mail} Email</label><input type="email" name="email" required placeholder="emaili-juaj@email.com" /></div>
          <div class="form-group"><label>${icons.lock} Fjalëkalimi</label><input type="password" name="password" required minlength="6" /></div>
          ${mode === 'login' ? `
            <div class="form-row">
              <a href="#" id="forgot-link">Harrove fjalëkalimin?</a>
            </div>` : ''}
          <button type="submit" class="btn btn-primary btn-block btn-lg">${mode === 'register' ? 'Regjistrohu' : 'Kyçu'}</button>
        </form>
        <div class="auth-footer">
          ${mode === 'register' ? 'Ke llogari?' : 'Nuk ke llogari?'}
          <a href="#" id="toggle-auth">${mode === 'register' ? ' Kyçu' : ' Regjistrohu'}</a>
        </div>`;
    }

    return `
      <div class="auth-page">
        <div class="auth-header">
          <a href="../index.html" class="brand-link"><h1>Banesë për ty</h1></a>
          <p>Platforma për Menaxhimin e Qerasë</p>
        </div>
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="icon-box">${icons.login}</div>
            <h2>${titles[mode]}</h2>
          </div>
          <div class="auth-card-body">
            <div id="auth-alert"></div>
            ${body}
            ${mode === 'forgot' ? `<a href="#" id="back-login" class="auth-back">← Kthehu te kyçja</a>` : ''}
          </div>
        </div>
      </div>`;
  }

  function showAlert(container, type, message) {
    const el = container.querySelector('#auth-alert');
    if (el) el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  }

  function attachEvents(container) {
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
            onNavigate('home');
          }
        } else {
          showAlert(container, 'error', result.error);
        }
      } else {
        const result = await login(email, password);
        if (result.success) onNavigate('home');
        else showAlert(container, 'error', result.error);
      }
    });
  }

  return { html: render(), attachEvents };
}

function getPageTitle(role, page) {
  const titles = {
    profile: 'Profili Im',
    'add-property': 'Shto Banesë të Re',
    search: 'Kërko Banesa',
    favorites: 'Të Preferuarat',
    payments: 'Pagesat e Banesës',
    expenses: 'Menaxho Shpenzimet',
    contract: 'Kontrata',
    approvals: 'Miratime Admin',
    notifications: 'Njoftimet',
  };
  if (titles[page]) return titles[page];
  if (role === 'qiradhënësi') return 'Pronat e Mia';
  if (role === 'qiramarrësi') return 'Banesa Ime';
  return 'Panel Admin';
}

function getNavItems(role) {
  if (role === 'qiradhënësi') {
    return [
      { id: 'home', label: 'Pronat', icon: icons.house },
      { id: 'expenses', label: 'Shpenzimet', icon: icons.card },
      { id: 'payments', label: 'Pagesat', icon: icons.doc },
      { id: 'notifications', label: 'Njoftimet', icon: icons.bell },
      { id: 'profile', label: 'Profili', icon: icons.user },
    ];
  }
  if (role === 'qiramarrësi') {
    return [
      { id: 'home', label: 'Banesa', icon: icons.house },
      { id: 'favorites', label: 'Të Preferuarat', icon: icons.heart },
      { id: 'notifications', label: 'Njoftimet', icon: icons.bell },
      { id: 'profile', label: 'Profili', icon: icons.user },
    ];
  }
  return [
    { id: 'home', label: 'Panel', icon: icons.house },
    { id: 'approvals', label: 'Miratime', icon: icons.check },
    { id: 'notifications', label: 'Njoftimet', icon: icons.bell },
    { id: 'profile', label: 'Profili', icon: icons.user },
  ];
}

export function renderAppShell(user, page, content, unreadCount = 0) {
  const role = user.role;
  const navItems = getNavItems(role);
  const title = getPageTitle(role, page);
  const subPages = ['add-property', 'search', 'payments', 'contract', 'favorites', 'expenses', 'approvals', 'notifications'];

  if (!subPages.includes(page)) {
    return `
    <div class="app-shell">
      <header class="top-header">
        <div class="header-bar">
          <div class="header-left">
            <h1 class="page-title">${title}</h1>
            <span class="user-role-badge">${getRoleLabel(role)}</span>
          </div>
          <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Hap menynë" aria-expanded="false" aria-controls="top-nav">
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
          </button>
        </div>
        <nav class="top-nav" id="top-nav">
          ${navItems.map((item) => `
            <button class="${page === item.id ? 'active' : ''}" data-page="${item.id}">
              ${item.icon} ${item.label}
              ${item.id === 'notifications' && unreadCount > 0 ? `<span class="nav-badge">${unreadCount}</span>` : ''}
            </button>
          `).join('')}
          <button class="logout-link" id="logout-btn">${icons.login} Dil</button>
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
        <button class="logout-link logout-link--compact" id="logout-btn">Dil</button>
      </header>
      <main class="page-content">${content}</main>
    </div>`;
}

export function attachShellEvents(container, onNavigate, onLogout) {
  const navToggle = container.querySelector('#nav-toggle');
  const topNav = container.querySelector('#top-nav');

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

export function renderBackButton(label = 'Kthehu', page = 'home') {
  return `<button class="page-back" data-page="${page}">${icons.arrowLeft} ${label}</button>`;
}
