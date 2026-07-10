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
  needsRoleSelection,
} from './auth.js';
import { enforceSessionExpiry } from './auth-session.js';
import { loadDataAsync, refreshDataAsync, refreshContractsAsync, formatContractNumber } from './data.js';
import { startRealtimeSync } from './supabase/realtime-sync.js';
import { parseAppUrl, resolvePageAfterAuth, syncUrlState, canAccessPage } from './nav.js';
import { initI18n, onLangChange, t, getDeleteConfirmWord } from './i18n.js';
import { renderLogin, renderRoleSelection, renderAppShell, attachShellEvents } from './views/layout.js';
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
  showPhotoLightbox,
  showContractModal,
  showSignatureModal,
  showPaymentProofModal,
  showProofViewerModal,
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
  ensureMonthlyRentPayments,
  processPhotos,
  markNotificationRead,
  getUnreadCount,
  getPendingContractsForTenant,
  loadData,
} from './services.js';
import { downloadContractPdf, downloadPaymentsPdf } from './pdf.js';
import { hydrateContractSignatures, getPaymentProofSignedUrl } from './supabase/sync.js';
import { formatDate, saveData, saveDataAsync } from './data.js';
import {
  initUIGuard,
  resetUIBaseline,
  shouldBlockAutoRender,
  patchNotificationBadge,
  patchContractNavBadge,
  runWithSubmitGuard,
} from './ui-guard.js';
import { initTheme } from './theme.js';

const app = document.getElementById('app');
let currentPage = 'home';
let editingPropertyId = null;
let searchState = { page: 1, filters: {}, advanced: false };
let paymentPeriod = {};
let oauthBootstrapError = null;
let dataLoadError = null;
let visibilityReloadTimer = null;
let sessionCheckTimer = null;
let stopRealtimeSync = null;
let pollSyncTimer = null;
let refreshInFlight = null;

const AUTO_SYNC_INTERVAL_MS = 60 * 1000;

async function handleSessionExpiry() {
  if (!isAuthenticatedSync()) return false;
  if (!(await enforceSessionExpiry(logout))) return false;
  currentPage = 'login';
  alert(t('auth.sessionExpired'));
  await render();
  return true;
}

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

async function refreshInBackground() {
  if (!isAuthenticatedSync()) return;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const user = getCurrentUserSync();
      if (user?.role === 'qiramarrësi' || user?.role === 'qiradhënësi') {
        await refreshContractsAsync();
      } else {
        await refreshDataAsync();
      }
      ensureMonthlyRentPayments();
      dataLoadError = null;
      if (user) {
        patchNotificationBadge(app, getUnreadCount(user.id));
        if (user.role === 'qiramarrësi') {
          patchContractNavBadge(app, getPendingContractsForTenant(user.id).length);
        }
      }
    } catch (err) {
      console.error('refreshDataAsync:', err);
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function startAutoSync() {
  stopAutoSync();
  if (!isAuthenticatedSync()) return;

  stopRealtimeSync = startRealtimeSync(() => {
    refreshInBackground();
  });

  pollSyncTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && isAuthenticatedSync()) {
      refreshInBackground();
    }
  }, AUTO_SYNC_INTERVAL_MS);
}

function stopAutoSync() {
  stopRealtimeSync?.();
  stopRealtimeSync = null;
  if (pollSyncTimer) {
    clearInterval(pollSyncTimer);
    pollSyncTimer = null;
  }
}

async function navigate(page) {
  currentPage = page;
  if (page !== 'add-property') editingPropertyId = null;
  if (page !== 'login' && isAuthenticatedSync()) {
    syncUrlState(page);
  }
  if (await handleSessionExpiry()) return;
  if (page === 'contract' && isAuthenticatedSync()) {
    try {
      await refreshContractsAsync();
      ensureMonthlyRentPayments();
    } catch (err) {
      console.error('refreshContractsAsync before contract:', err);
    }
  }
  if (page === 'home' && isAuthenticatedSync()) {
    const user = getCurrentUserSync();
    if (user?.role === 'qiramarrësi' || user?.role === 'qiradhënësi') {
      try {
        await refreshContractsAsync();
        ensureMonthlyRentPayments();
      } catch (err) {
        console.error('refreshContractsAsync before home:', err);
      }
    }
  }
  if (page === 'payments' && isAuthenticatedSync()) {
    ensureMonthlyRentPayments();
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
  if (currentPage === 'login') {
    const { html, attachEvents } = renderLogin(async (p) => {
      await reloadAppData();
      startAutoSync();
      await navigate(p);
    });
    app.innerHTML = html;
    attachEvents(app);
    if (oauthBootstrapError) {
      const alertEl = app.querySelector('#auth-alert');
      if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">${oauthBootstrapError}</div>`;
      oauthBootstrapError = null;
    }
    resetUIBaseline();
    return;
  }

  let user = getCurrentUserSync();
  if (!user) {
    user = await getCurrentUser();
  }
  if (!user) {
    currentPage = 'login';
    const { html, attachEvents } = renderLogin(async (p) => {
      await reloadAppData();
      startAutoSync();
      await navigate(p);
    });
    app.innerHTML = html;
    attachEvents(app);
    if (oauthBootstrapError) {
      const alertEl = app.querySelector('#auth-alert');
      if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">${oauthBootstrapError}</div>`;
      oauthBootstrapError = null;
    }
    resetUIBaseline();
    return;
  }

  if (needsRoleSelection()) {
    const { entry } = parseAppUrl();
    const { html, attachEvents } = renderRoleSelection(async () => {
      await reloadAppData();
      startAutoSync();
      const u = getCurrentUserSync();
      currentPage = resolvePageAfterAuth(u, entry, null);
      syncUrlState(currentPage, true);
      await render();
    });
    app.innerHTML = html;
    attachEvents(app);
    resetUIBaseline();
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
    stopAutoSync();
    await logout();
    currentPage = 'login';
    history.replaceState({}, '', window.location.pathname);
    await render();
  });
  attachPageEvents(currentPage, user);
  resetUIBaseline();
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
          showSignatureModal(app, null, async (landlordSignature) => {
            await runWithSubmitGuard(async () => {
              const result = await createContract({ ...form, landlordSignature });
              if (!result.success) { alert(result.error); return; }
              await saveContractPdf(result.contract, loadData());
              alert(t('alert.contractGenerated'));
              await render();
            });
          }, {
            title: t('modal.landlordSignatureTitle'),
            hint: t('modal.landlordSignatureHint'),
            confirmLabel: t('modal.generateSend'),
          });
        });
      });
    });
  }

  if (page === 'approvals') {
    app.querySelectorAll('.approval-photo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.src;
        if (src) showPhotoLightbox(app, src);
      });
    });
    app.querySelectorAll('.approve-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const approved = btn.dataset.action === 'approve';
        let reason = '';
        if (!approved) reason = prompt(t('alert.rejectReason')) || '';
        const result = await approveProperty(btn.dataset.id, approved, reason);
        if (!result.success) { alert(result.error); render(); return; }
        alert(approved ? t('alert.propertyApproved') : t('alert.propertyRejected'));
        await render();
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
          await render();
        } else {
          alert(result.error);
        }
      });
    });
  }

  if (page === 'notifications') {
    app.querySelectorAll('.activity-item[data-id]').forEach((el) => {
      el.addEventListener('click', async () => {
        await markNotificationRead(el.dataset.id);
        await render();
      });
    });
    app.querySelectorAll('.notification-open-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await markNotificationRead(btn.dataset.id);
        if (btn.dataset.page === 'contract') {
          try {
            await refreshContractsAsync();
          } catch (err) {
            console.error('refreshContractsAsync from notification:', err);
          }
        }
        await navigate(btn.dataset.page);
      });
    });
  }

  if (page === 'add-property') {
    app.querySelector('#property-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await runWithSubmitGuard(async () => {
        const form = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn?.disabled) return;
        if (submitBtn) submitBtn.disabled = true;

        try {
          const fd = new FormData(form);
          const data = loadData();
          const existing = editingPropertyId ? data.properties.find((p) => p.id === editingPropertyId) : null;
          let photos = existing?.photos || [];
          const fileInput = form.querySelector('input[name="photos"]');
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

          if (!result.success) {
            alert(result.error);
            return;
          }
          alert(result.pendingApproval ? t('alert.savedPending') : t('alert.saved'));
          editingPropertyId = null;
          await navigate('home');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    });
  }

  if (page === 'profile') {
    app.querySelector('#profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await runWithSubmitGuard(async () => {
        const form = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const fd = new FormData(form);
          const result = await updateProfile(user.id, {
            fullName: fd.get('fullName'),
            email: fd.get('email'),
            phone: fd.get('phone'),
            address: fd.get('address'),
            userType: fd.get('userType'),
            campusId: fd.get('campusId'),
          });
          alert(result.success ? t('alert.saved') : result.error);
          if (result.success) await render();
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    });

    app.querySelector('#password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await runWithSubmitGuard(async () => {
        const form = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const fd = new FormData(form);
          if (fd.get('newPassword') !== fd.get('confirmPassword')) {
            alert(t('alert.passwordMismatch'));
            return;
          }
          const result = await changePassword(user.id, fd.get('currentPassword'), fd.get('newPassword'));
          alert(result.success ? t('alert.passwordChanged') : result.error);
          if (result.success) form.reset();
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
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
          await runWithSubmitGuard(async () => {
            const result = await submitPaymentProof(btn.dataset.id, proof);
            if (!result.success) { onError(result.error); return; }
            close();
            alert(t('alert.proofSent'));
            await render();
          });
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
      btn.addEventListener('click', async () => {
        const result = await reviewPaymentProof(btn.dataset.id, true);
        if (!result.success) alert(result.error);
        else alert(t('alert.proofReviewed'));
        await render();
      });
    });
    app.querySelectorAll('.review-reject-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('alert.rejectProofConfirm'))) return;
        const result = await reviewPaymentProof(btn.dataset.id, false);
        if (!result.success) alert(result.error);
        else alert(t('alert.proofRejected'));
        await render();
      });
    });
    app.querySelectorAll('.view-proof-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const payment = loadData().payments.find((p) => p.id === btn.dataset.id);
        if (!payment?.proof) {
          alert(t('alert.proofNotFound'));
          return;
        }
        btn.disabled = true;
        try {
          const url = await getPaymentProofSignedUrl(payment.proof);
          if (!url) {
            alert(t('alert.proofNotFound'));
            return;
          }
          showProofViewerModal(app, payment, url);
        } catch (err) {
          console.error('view-proof:', err);
          alert(err?.message || t('alert.proofLoadError'));
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  if (page === 'expenses') {
    app.querySelector('#expense-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await runWithSubmitGuard(async () => {
        const form = e.target;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const fd = new FormData(form);
          const result = addMonthlyExpense({
            propertyId: fd.get('propertyId'),
            type: fd.get('type'),
            amount: fd.get('amount'),
            month: fd.get('month'),
          });
          alert(result.success ? t('alert.expenseAdded') : result.error);
          if (result.success) {
            form.reset();
            resetUIBaseline();
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    });
  }

  if (page === 'contract') {
    app.querySelectorAll('.sign-accept-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const data = loadData();
        const contract = data.contracts.find((c) => c.id === btn.dataset.id);
        if (!contract) return;
        showSignatureModal(app, contract, async (signature) => {
          await runWithSubmitGuard(async () => {
            const result = await signContract(btn.dataset.id, true, signature);
            if (!result.success) { alert(result.error); return; }
            alert(t('alert.contractSigned'));
            await render();
          });
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
  app.querySelector('#toggle-advanced-search')?.addEventListener('click', () => {
    const nextAdvanced = !searchState.advanced;
    searchState = {
      ...searchState,
      advanced: nextAdvanced,
      filters: nextAdvanced
        ? searchState.filters
        : { city: searchState.filters?.city || '' },
    };
    render();
  });

  const runSearch = (page = 1) => {
    const city = app.querySelector('#filter-city')?.value || '';
    const nextFilters = { city, budgetSort: 'asc' };
    if (searchState.advanced) {
      Object.assign(nextFilters, {
        type: app.querySelector('#filter-type')?.value,
        maxPrice: app.querySelector('#filter-max-price')?.value,
        minRooms: app.querySelector('#filter-min-rooms')?.value,
        minArea: app.querySelector('#filter-min-area')?.value,
        mobiluar: app.querySelector('#filter-mobiluar')?.checked,
      });
    }
    searchState = { ...searchState, page, filters: nextFilters };
    render();
  };

  app.querySelector('#search-btn')?.addEventListener('click', () => {
    runSearch(1);
  });
  app.querySelector('#prev-page')?.addEventListener('click', () => runSearch(searchState.page - 1));
  app.querySelector('#next-page')?.addEventListener('click', () => runSearch(searchState.page + 1));

  app.querySelectorAll('.request-contract-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await runWithSubmitGuard(async () => {
        const result = await requestContract(btn.dataset.id);
        alert(result.success ? t('alert.requestSent') : result.error);
        await render();
      });
      btn.disabled = false;
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
  await hydrateContractSignatures([stored]);
  const property = data.properties.find((p) => p.id === stored.propertyId);
  const landlord = data.users.find((u) => u.id === stored.landlordId);
  const tenant = data.users.find((u) => u.id === stored.tenantId);
  await downloadContractPdf(
    `Kontrata_${formatContractNumber(stored) || stored.id}.pdf`,
    stored,
    property,
    landlord,
    tenant
  );
  stored.pdfGeneratedAt = new Date().toISOString();
  if (stored.status === 'generated_pdf') stored.status = 'pending_signature';
  await saveDataAsync(data);
}

async function init() {
  showLoading();
  initTheme();
  initI18n();
  initUIGuard(app);
  onLangChange(() => {
    if (!shouldBlockAutoRender()) render();
  });

  try {
    oauthBootstrapError = consumeOAuthUrlError();
    await initAuth();
    if (await handleSessionExpiry()) return;

    const { entry, page } = parseAppUrl();

    if (isAuthenticatedSync()) {
      await reloadAppData();
      ensureMonthlyRentPayments();
      startAutoSync();
      const user = getCurrentUserSync();
      currentPage = resolvePageAfterAuth(user, entry, page);
      syncUrlState(currentPage, true);
    } else {
      currentPage = 'login';
    }

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !isAuthenticatedSync()) return;
      handleSessionExpiry().then((expired) => {
        if (expired) return;
        clearTimeout(visibilityReloadTimer);
        visibilityReloadTimer = setTimeout(() => {
          refreshInBackground();
        }, 200);
      });
    });
    sessionCheckTimer = setInterval(() => {
      handleSessionExpiry();
    }, 60 * 1000);
    await render();
  } catch (err) {
    console.error('Init error:', err);
    showFatalError(err?.message || t('app.loadError'));
  }
}

init();
