import {
  getCurrentUser,
  getCurrentUserSync,
  isAuthenticatedSync,
  logout,
  updateProfile,
  changePassword,
  deleteAccount,
  deleteUserAsAdmin,
  initAuth,
  consumeOAuthUrlError,
} from './auth.js';
import { loadDataAsync } from './data.js';
import { parseAppUrl, resolvePageAfterAuth, syncUrlState, canAccessPage } from './nav.js';
import { initI18n, onLangChange, t, getDeleteConfirmWord } from './i18n.js';
import { renderLogin, renderAppShell, attachShellEvents } from './views/layout.js';
import {
  renderLandlordHome,
  renderTenantHome,
  renderAdminHome,
  renderProfilePage,
  renderAddPropertyPage,
  renderSearchPage,
  renderPaymentsPage,
  renderContractPage,
  renderFavoritesPage,
  renderLandlordExpensesPage,
  renderAdminApprovalsPage,
  renderAdminUsersPage,
  renderNotificationsPage,
  showContractModal,
  showSignatureModal,
  showPaymentProofModal,
} from './views/pages.js';
import {
  saveProperty,
  deleteProperty,
  createContract,
  approveProperty,
  signContract,
  toggleFavorite,
  requestContract,
  hasTenantPendingRequest,
  getPublishedProperties,
  getExpenses,
  markPaymentPaid,
  disputePayment,
  resolveDispute,
  reviewPaymentProof,
  submitPaymentProof,
  addMonthlyExpense,
  requestAgencyHelp,
  processPhotos,
  markNotificationRead,
  getUnreadCount,
  loadData,
} from './services.js';
import { downloadContractPdf, downloadPaymentsPdf } from './pdf.js';
import { formatDate, saveData } from './data.js';

const app = document.getElementById('app');
let currentPage = 'home';
let editingPropertyId = null;
let searchState = { page: 1, filters: {} };
let paymentPeriod = {};
let oauthBootstrapError = null;
let dataLoadError = null;

function showLoading() {
  app.innerHTML = `
    <div class="app-loading">
      <div class="app-loading-spinner" aria-hidden="true"></div>
      <p>${t('app.loading')}</p>
    </div>`;
}

function showFatalError(message) {
  app.innerHTML = `
    <div class="app-error-screen">
      <h2>${t('app.renderError')}</h2>
      <p>${message || t('app.loadError')}</p>
      <button class="btn btn-primary" type="button" onclick="location.reload()">${t('app.retry')}</button>
    </div>`;
}

async function reloadAppData() {
  try {
    await loadDataAsync();
    dataLoadError = null;
  } catch (err) {
    console.error('loadDataAsync:', err);
    dataLoadError = err?.message || t('app.loadError');
  }
}

async function navigate(page) {
  currentPage = page;
  if (page !== 'add-property') editingPropertyId = null;
  if (page !== 'login' && isAuthenticatedSync()) {
    syncUrlState(page);
  }
  await render();
}

function handlePopState() {
  const { entry, page } = parseAppUrl();
  if (!isAuthenticatedSync()) {
    currentPage = 'login';
  } else {
    const user = getCurrentUserSync();
    if (page && user && canAccessPage(user, page)) {
      currentPage = page;
    } else if (user) {
      currentPage = resolvePageAfterAuth(user, entry, null);
    }
  }
  render();
}

async function render() {
  try {
    await renderPage();
  } catch (err) {
    console.error('Render error:', err);
    showFatalError(err?.message || t('app.renderError'));
  }
}

async function renderPage() {
  if (!isAuthenticatedSync() || currentPage === 'login') {
    currentPage = 'login';
    const { html, attachEvents } = renderLogin(async (p) => {
      await reloadAppData();
      await navigate(p);
    }, () => render());
    app.innerHTML = html;
    attachEvents(app);
    if (oauthBootstrapError) {
      const alertEl = app.querySelector('#auth-alert');
      if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">${oauthBootstrapError}</div>`;
      oauthBootstrapError = null;
    }
    return;
  }

  const user = getCurrentUserSync() || (await getCurrentUser());
  if (!user) {
    currentPage = 'login';
    const { html, attachEvents } = renderLogin(async (p) => {
      await reloadAppData();
      await navigate(p);
    }, () => render());
    app.innerHTML = html;
    attachEvents(app);
    if (oauthBootstrapError) {
      const alertEl = app.querySelector('#auth-alert');
      if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">${oauthBootstrapError}</div>`;
      oauthBootstrapError = null;
    }
    return;
  }

  let content = '';
  switch (currentPage) {
    case 'home':
      if (user.role === 'qiradhënësi') content = renderLandlordHome();
      else if (user.role === 'qiramarrësi') content = renderTenantHome();
      else content = renderAdminHome();
      break;
    case 'profile':
      content = renderProfilePage();
      break;
    case 'add-property': {
      const data = loadData();
      content = renderAddPropertyPage(editingPropertyId ? data.properties.find((p) => p.id === editingPropertyId) : null);
      break;
    }
    case 'search':
      content = renderSearchPage(searchState);
      break;
    case 'favorites':
      content = renderFavoritesPage();
      break;
    case 'payments':
      content = renderPaymentsPage(paymentPeriod);
      break;
    case 'expenses':
      content = renderLandlordExpensesPage();
      break;
    case 'contract':
      content = renderContractPage();
      break;
    case 'approvals':
      content = renderAdminApprovalsPage();
      break;
    case 'users':
      content = renderAdminUsersPage();
      break;
    case 'notifications':
      content = renderNotificationsPage();
      break;
    default:
      currentPage = 'home';
      content = user.role === 'qiradhënësi' ? renderLandlordHome() : user.role === 'qiramarrësi' ? renderTenantHome() : renderAdminHome();
  }

  const unread = getUnreadCount(user.id);
  const banner = dataLoadError
    ? `<div class="app-banner" role="alert">${dataLoadError}</div>`
    : '';
  app.innerHTML = renderAppShell(user, currentPage, banner + content, unread);
  attachShellEvents(app, navigate, async () => {
    await logout();
    currentPage = 'login';
    history.replaceState({}, '', window.location.pathname);
    await render();
  }, () => render());
  attachPageEvents(currentPage, user);
}

function attachPageEvents(page, user) {
  app.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  if (page === 'home' && user.role === 'qiradhënësi') {
    app.querySelector('#add-property-btn')?.addEventListener('click', () => navigate('add-property'));
    app.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => { editingPropertyId = btn.dataset.id; navigate('add-property'); });
    });
    app.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm(t('alert.deleteProperty'))) {
          const result = deleteProperty(btn.dataset.id);
          alert(result.error || t('alert.deleted'));
          render();
        }
      });
    });
    app.querySelectorAll('.contract-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const property = loadData().properties.find((p) => p.id === btn.dataset.id);
        showContractModal(app, property, async (form) => {
          const result = createContract(form);
          if (!result.success) { alert(result.error); return; }
          await saveContractPdf(result.contract, loadData());
          alert(t('alert.contractGenerated'));
          render();
        });
      });
    });
  }

  if (page === 'approvals') {
    app.querySelectorAll('.approve-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const approved = btn.dataset.action === 'approve';
        let reason = '';
        if (!approved) reason = prompt(t('alert.rejectReason')) || '';
        const result = approveProperty(btn.dataset.id, approved, reason);
        if (!result.success) { alert(result.error); render(); return; }
        alert(approved ? t('alert.propertyApproved') : t('alert.propertyRejected'));
        render();
      });
    });
  }

  if (page === 'users' && user.role === 'administrator') {
    app.querySelectorAll('.admin-delete-user-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name || '';
        if (!confirm(t('admin.deleteUserConfirm', { name }))) return;
        const reason = prompt(t('admin.deleteUserReason'));
        if (!reason?.trim()) return;
        const result = await deleteUserAsAdmin(btn.dataset.id, reason);
        if (result.success) {
          alert(t('admin.userDeleted'));
          await reloadAppData();
          render();
        } else {
          alert(result.error);
        }
      });
    });
  }

  if (page === 'notifications') {
    app.querySelectorAll('.activity-item[data-id]').forEach((el) => {
      el.addEventListener('click', () => markNotificationRead(el.dataset.id));
    });
  }

  if (page === 'add-property') {
    app.querySelector('#property-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = loadData();
      const existing = editingPropertyId ? data.properties.find((p) => p.id === editingPropertyId) : null;
      let photos = existing?.photos || [];
      const fileInput = e.target.querySelector('input[name="photos"]');
      if (fileInput?.files?.length) {
        try {
          const newPhotos = await processPhotos(fileInput.files);
          photos = [...(existing?.photos || []), ...newPhotos].slice(0, 5);
        } catch (err) {
          alert(err.message);
          return;
        }
      }

      const result = await saveProperty({
        id: existing?.id,
        title: fd.get('title'),
        address: fd.get('address'),
        city: fd.get('city'),
        type: fd.get('type'),
        rentPrice: Number(fd.get('rentPrice')),
        deposit: Number(fd.get('deposit')) || Number(fd.get('rentPrice')),
        rooms: Number(fd.get('rooms')),
        bathrooms: Number(fd.get('bathrooms')),
        area: Number(fd.get('area')),
        description: fd.get('description'),
        nearCampus: fd.get('nearCampus') || '',
        photos,
        amenities: {
          mobiluar: fd.get('amenity_mobiluar') === 'on',
          ngrohje: fd.get('amenity_ngrohje') === 'on',
          ac: fd.get('amenity_ac') === 'on',
          parking: fd.get('amenity_parking') === 'on',
          ballkon: fd.get('amenity_ballkon') === 'on',
          ashensor: fd.get('amenity_ashensor') === 'on',
        },
      });

      if (!result.success) { alert(result.error); return; }
      alert(result.pendingApproval ? t('alert.savedPending') : t('alert.saved'));
      navigate('home');
    });
  }

  if (page === 'profile') {
    app.querySelector('#profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const result = await updateProfile(user.id, {
        fullName: fd.get('fullName'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        address: fd.get('address'),
        userType: fd.get('userType'),
        campusId: fd.get('campusId'),
      });
      alert(result.success ? t('alert.saved') : result.error);
      render();
    });

    app.querySelector('#password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (fd.get('newPassword') !== fd.get('confirmPassword')) {
        alert(t('alert.passwordMismatch'));
        return;
      }
      const result = await changePassword(user.id, fd.get('currentPassword'), fd.get('newPassword'));
      alert(result.success ? t('alert.passwordChanged') : result.error);
    });

    app.querySelector('#delete-account-btn')?.addEventListener('click', async () => {
      if (!confirm(t('alert.deleteAccountConfirm'))) return;
      const typed = prompt(t('alert.deleteAccountType'));
      if (typed !== getDeleteConfirmWord()) return;
      const result = await deleteAccount();
      if (result.success) {
        alert(t('alert.deleteAccountDone'));
        currentPage = 'login';
        history.replaceState({}, '', window.location.pathname);
        await render();
      } else {
        alert(result.error);
      }
    });
  }

  if (page === 'search') {
    bindSearchEvents(user);
  }

  if (page === 'favorites') {
    app.querySelectorAll('.favorite-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleFavorite(btn.dataset.id);
        render();
      });
    });
  }

  if (page === 'payments') {
    app.querySelector('#filter-period')?.addEventListener('click', () => {
      paymentPeriod = {
        from: app.querySelector('#period-from')?.value,
        to: app.querySelector('#period-to')?.value,
      };
      render();
    });
    app.querySelector('#export-payments-pdf')?.addEventListener('click', async () => {
      const payments = getExpenses(user.id, user.role, paymentPeriod.from, paymentPeriod.to);
      const label = paymentPeriod.from ? `${paymentPeriod.from} — ${paymentPeriod.to || 'sot'}` : 'Të gjitha';
      await downloadPaymentsPdf('Raport_Pagesave.pdf', payments, label, user.fullName);
    });
    app.querySelectorAll('.pay-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const payment = loadData().payments.find((p) => p.id === btn.dataset.id);
        if (!payment) return;
        showPaymentProofModal(app, payment, async (proof, onError, close) => {
          const result = await submitPaymentProof(btn.dataset.id, proof);
          if (!result.success) { onError(result.error); return; }
          close();
          alert(result.approved
            ? t('alert.proofApproved')
            : t('alert.proofSent'));
          render();
        });
      });
    });
    app.querySelectorAll('.dispute-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reason = prompt(t('alert.disputeReason'));
        if (reason) { disputePayment(btn.dataset.id, reason); render(); }
      });
    });
    app.querySelectorAll('.resolve-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        resolveDispute(btn.dataset.id, confirm(t('alert.acceptPayment')));
        render();
      });
    });
    app.querySelectorAll('.confirm-cash-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm(t('alert.confirmCash'))) {
          markPaymentPaid(btn.dataset.id);
          render();
        }
      });
    });
    app.querySelectorAll('.review-approve-btn').forEach((btn) => {
      btn.addEventListener('click', () => { reviewPaymentProof(btn.dataset.id, true); render(); });
    });
    app.querySelectorAll('.review-reject-btn').forEach((btn) => {
      btn.addEventListener('click', () => { reviewPaymentProof(btn.dataset.id, false); render(); });
    });
  }

  if (page === 'expenses') {
    app.querySelector('#expense-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const result = addMonthlyExpense({
        propertyId: fd.get('propertyId'),
        type: fd.get('type'),
        amount: fd.get('amount'),
        month: fd.get('month'),
      });
      alert(result.success ? t('alert.expenseAdded') : result.error);
      if (result.success) e.target.reset();
    });
  }

  if (page === 'contract') {
    app.querySelectorAll('.sign-accept-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const data = loadData();
        const contract = data.contracts.find((c) => c.id === btn.dataset.id);
        if (!contract) return;
        showSignatureModal(app, contract, async (signature) => {
          const result = await signContract(btn.dataset.id, true, signature);
          if (!result.success) { alert(result.error); return; }
          alert(t('alert.contractSigned'));
          render();
        });
      });
    });
    app.querySelectorAll('.sign-reject-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm(t('alert.rejectContract'))) {
          await signContract(btn.dataset.id, false);
          alert(t('alert.contractCancelled'));
          render();
        }
      });
    });
    app.querySelectorAll('.download-pending-btn, .download-contract-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const data = loadData();
        const c = data.contracts.find((x) => x.id === btn.dataset.id);
        if (c) await saveContractPdf(c, data);
      });
    });
  }
}

function bindSearchEvents(user) {
  const runSearch = (page = 1) => {
    searchState = {
      page,
      filters: {
        city: app.querySelector('#filter-city')?.value,
        type: app.querySelector('#filter-type')?.value,
        maxPrice: app.querySelector('#filter-max-price')?.value,
        minRooms: app.querySelector('#filter-min-rooms')?.value,
        minArea: app.querySelector('#filter-min-area')?.value,
        nearCampus: app.querySelector('#filter-campus')?.value,
        mobiluar: app.querySelector('#filter-mobiluar')?.checked,
        budgetSort: 'asc',
      },
    };
    render();
  };

  app.querySelector('#search-btn')?.addEventListener('click', () => runSearch(1));
  app.querySelector('#prev-page')?.addEventListener('click', () => runSearch(searchState.page - 1));
  app.querySelector('#next-page')?.addEventListener('click', () => runSearch(searchState.page + 1));
  app.querySelector('#agency-btn')?.addEventListener('click', () => {
    requestAgencyHelp(searchState.filters);
    alert(t('alert.agencySent'));
  });

  app.querySelectorAll('.request-contract-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = requestContract(btn.dataset.id);
      alert(result.success ? t('alert.requestSent') : result.error);
      render();
    });
  });

  app.querySelectorAll('.favorite-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = toggleFavorite(btn.dataset.id);
      if (!result.success) alert(result.error);
      render();
    });
  });
}

async function saveContractPdf(contract, data) {
  const stored = data.contracts.find((c) => c.id === contract.id) || contract;
  const property = data.properties.find((p) => p.id === stored.propertyId);
  const landlord = data.users.find((u) => u.id === stored.landlordId);
  const tenant = data.users.find((u) => u.id === stored.tenantId);
  await downloadContractPdf(`Kontrata_${stored.id}.pdf`, stored, property, landlord, tenant);
  stored.pdfGeneratedAt = new Date().toISOString();
  if (stored.status === 'generated_pdf') stored.status = 'pending_signature';
  saveData(data);
}

async function init() {
  showLoading();
  initI18n();
  onLangChange(() => render());

  try {
    oauthBootstrapError = consumeOAuthUrlError();
    await initAuth();
    const { entry, page } = parseAppUrl();

    if (isAuthenticatedSync()) {
      await reloadAppData();
      const user = getCurrentUserSync();
      currentPage = resolvePageAfterAuth(user, entry, page);
      syncUrlState(currentPage, true);
    } else {
      currentPage = 'login';
    }

    window.addEventListener('popstate', handlePopState);
    await render();
  } catch (err) {
    console.error('Init error:', err);
    showFatalError(err?.message || t('app.loadError'));
  }
}

init();
