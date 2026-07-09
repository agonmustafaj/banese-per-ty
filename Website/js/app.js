import {
  getCurrentUser,
  getCurrentUserSync,
  isAuthenticatedSync,
  logout,
  updateProfile,
  changePassword,
  initAuth,
} from './auth.js';
import { loadDataAsync } from './data.js';
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

async function navigate(page) {
  currentPage = page;
  if (page !== 'add-property') editingPropertyId = null;
  await render();
}

async function render() {
  if (!isAuthenticatedSync() || currentPage === 'login') {
    currentPage = 'login';
    const { html, attachEvents } = renderLogin(async (p) => {
      if (p === 'home') await loadDataAsync();
      await navigate(p);
    });
    app.innerHTML = html;
    attachEvents(app);
    return;
  }

  const user = (await getCurrentUser()) || getCurrentUserSync();
  if (!user) {
    currentPage = 'login';
    const { html, attachEvents } = renderLogin(async (p) => {
      if (p === 'home') await loadDataAsync();
      await navigate(p);
    });
    app.innerHTML = html;
    attachEvents(app);
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
    case 'notifications':
      content = renderNotificationsPage();
      break;
    default:
      currentPage = 'home';
      content = user.role === 'qiradhënësi' ? renderLandlordHome() : user.role === 'qiramarrësi' ? renderTenantHome() : renderAdminHome();
  }

  const unread = getUnreadCount(user.id);
  app.innerHTML = renderAppShell(user, currentPage, content, unread);
  attachShellEvents(app, navigate, () => { logout(); navigate('login'); });
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
        if (confirm('Fshini këtë banesë?')) {
          const result = deleteProperty(btn.dataset.id);
          alert(result.error || 'U fshi.');
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
          alert('Kontrata u gjenerua dhe u dërgua te qeramarrësi për nënshkrim!');
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
        if (!approved) reason = prompt('Arsyeja e refuzimit:') || '';
        const result = approveProperty(btn.dataset.id, approved, reason);
        if (!result.success) { alert(result.error); render(); return; }
        alert(approved ? 'Prona u miratua!' : 'Prona u refuzua.');
        render();
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
      alert(result.pendingApproval ? 'Prona u dërgua për miratim te administratori.' : 'U ruajt!');
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
      alert(result.success ? 'U ruajt!' : result.error);
      render();
    });

    app.querySelector('#password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (fd.get('newPassword') !== fd.get('confirmPassword')) {
        alert('Fjalëkalimet nuk përputhen.');
        return;
      }
      const result = await changePassword(user.id, fd.get('currentPassword'), fd.get('newPassword'));
      alert(result.success ? 'Fjalëkalimi u ndryshua!' : result.error);
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
            ? 'Dëshmia e pagesës u verifikua automatikisht nga sistemi — pagesa është konfirmuar!'
            : 'Dëshmia u dërgua te qeradhënësi për shqyrtim manual.');
          render();
        });
      });
    });
    app.querySelectorAll('.dispute-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reason = prompt('Arsyeja e ankimimit:');
        if (reason) { disputePayment(btn.dataset.id, reason); render(); }
      });
    });
    app.querySelectorAll('.resolve-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        resolveDispute(btn.dataset.id, confirm('Pranoni pagesën si të paguar?'));
        render();
      });
    });
    app.querySelectorAll('.confirm-cash-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm('Konfirmoni se e keni marrë këtë pagesë në dorë (cash)?')) {
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
      alert(result.success ? 'Shpenzimi u shtua!' : result.error);
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
          alert('Kontrata u nënshkrua elektronikisht dhe është tani aktive!');
          render();
        });
      });
    });
    app.querySelectorAll('.sign-reject-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Refuzoni kontratën?')) {
          await signContract(btn.dataset.id, false);
          alert('Kontrata u anulua.');
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
    alert('Kërkesa u dërgua te agjencia partner. Do të kontaktoheni së shpejti.');
  });

  app.querySelectorAll('.request-contract-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = requestContract(btn.dataset.id);
      alert(result.success ? 'Kërkesa u dërgua!' : result.error);
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
  await initAuth();
  await loadDataAsync();
  await render();
}

init();
