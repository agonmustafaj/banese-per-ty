import { getCurrentUserSync } from '../auth.js';
import {
  getOwnerProperties,
  getLandlordDisplayProperties,
  getPublishedProperties,
  getLandlordStats,
  getTenantCurrentProperty,
  getTenantProperties,
  getExpenses,
  generateExpenseReport,
  isPropertyOccupied,
  isPropertyReserved,
  getPendingRequestsForProperty,
  getPendingRequestsForLandlord,
  hasTenantPendingRequest,
  getPendingContractsForTenant,
  getLandlordContracts,
  getPendingContractsForLandlord,
  getPendingProperties,
  getFavorites,
  isFavorite,
  getNotifications,
  getAuditLog,
  loadData,
  formatCurrency,
  formatDate,
  getFirstName,
  monthsUntil,
  getPaymentDisplayName,
  getExpenseTypeLabel,
  getContractStatusLabel,
  getPaymentStatusLabel,
  getCampusName,
  CAMPUSES,
  KOSOVO_CITIES,
  EXPENSE_TYPES,
  PAGE_SIZE,
  addMonthsToDateString,
} from '../services.js';
import { getPhotoSrc, hasValidPhotos, getRoleLabel, formatContractNumber } from '../data.js';
import { icons } from '../icons.js';
import { renderBackButton } from './layout.js';
import { t, formatLocaleString, formatLocaleDate } from '../i18n.js';

function propertySpecs(p) {
  if (!p) return '—';
  return t('property.specs', { rooms: p.rooms, bathrooms: p.bathrooms || 1, area: p.area || '-' });
}

function statusBadgeClass(status) {
  if (['paguar', 'publikuar', 'active', 'signed'].includes(status)) return 'available';
  if (['overdue', 'refuzuar', 'cancelled', 'disputed'].includes(status)) return 'danger';
  if (['në pritje', 'pending', 'pending_signature', 'rezervuar'].includes(status)) return 'pending';
  return 'occupied';
}

function propertyStatusLabel(p) {
  if (p.status === 'në pritje') return t('property.status.pendingApproval');
  if (p.status === 'refuzuar') return t('property.status.rejected');
  if (p.status === 'rezervuar') return t('property.status.reserved');
  if (p.status === 'me qera' || isPropertyOccupied(p.id)) return t('property.status.rented');
  if (isPropertyReserved(p.id)) return t('property.status.reserved');
  return p.status === 'publikuar' ? t('property.status.available') : p.status;
}

function propertyRow(p) {
  const occupied = isPropertyOccupied(p.id);
  const reserved = isPropertyReserved(p.id);
  const pendingRequests = getPendingRequestsForProperty(p.id);
  const statusClass = statusBadgeClass(p.status === 'publikuar' && !occupied ? 'publikuar' : p.status);

  let contractAction = '';
  if (!occupied && p.status === 'publikuar') {
    contractAction = pendingRequests.length > 0
      ? `<button class="btn btn-blue btn-sm contract-btn" data-id="${p.id}">${t('landlord.generateContractCount', { count: pendingRequests.length })}</button>`
      : `<span class="request-hint">${t('landlord.waitingTenant')}</span>`;
  }

  const thumbSrc = getPhotoSrc(p.photos?.[0]);
  const thumb = thumbSrc
    ? `<img src="${thumbSrc}" alt="" class="property-thumb-img" />`
    : icons.houseLg;

  return `
    <div class="property-row" data-id="${p.id}">
      <div class="property-row-main">
        <div class="property-thumb">${thumb}</div>
        <div class="property-info">
          <h3>${p?.title || t('common.unknown')}</h3>
          <div class="address">${icons.pin} ${p?.address || '—'}</div>
          <div class="specs">${icons.bed} ${propertySpecs(p)}</div>
          <div class="price">${formatCurrency(p?.rentPrice || 0)}${t('common.perMonth')}</div>
          ${p.city ? `<div class="sub-status">${p.city}</div>` : ''}
        </div>
        <div class="property-status">
          <span class="status-badge ${statusClass}">${propertyStatusLabel(p)}</span>
          ${p.status === 'në pritje' ? `<div class="sub-status">${t('landlord.sentToAdmin')}</div>` : ''}
          ${p.status === 'refuzuar' ? `<div class="sub-status">${p.rejectReason || ''}</div>` : ''}
        </div>
      </div>
      <div class="property-actions-row">
        ${contractAction}
        <button class="btn btn-outline btn-sm edit-btn" data-id="${p.id}" ${occupied ? 'disabled' : ''}>${icons.edit} ${t('common.edit')}</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}" ${occupied || reserved ? 'disabled' : ''}>${icons.trash} ${t('common.delete')}</button>
      </div>
    </div>`;
}

export function renderLandlordHome() {
  const user = getCurrentUserSync();
  const stats = getLandlordStats(user.id);
  const properties = getLandlordDisplayProperties(user.id);
  const pendingRequests = getPendingRequestsForLandlord(user.id);
  const data = loadData();

  return `
    <div class="welcome-section">
      <h2>${t('welcome.greeting', { name: getFirstName(user.fullName) })}</h2>
      <p>${t('welcome.landlord')}</p>
    </div>
    ${pendingRequests.length > 0 ? `
      <div class="profile-section" style="margin-bottom:1.5rem">
        <h4>${t('landlord.contractRequests', { count: pendingRequests.length })}</h4>
        ${pendingRequests.map((req) => {
          const prop = data.properties.find((p) => p.id === req.propertyId);
          const tenant = data.users.find((u) => u.id === req.tenantId);
          return `
            <div class="request-item">
              <div>
                <strong>${tenant?.fullName}</strong> — ${prop?.title}
                <div class="request-meta">${formatDate(req.createdAt.slice(0, 10))}</div>
              </div>
              <button class="btn btn-blue btn-sm contract-btn" data-id="${prop?.id}">${t('landlord.generateContract')}</button>
            </div>`;
        }).join('')}
      </div>` : ''}
    <div class="stats-row">
      <div class="stat-card-colored blue"><div class="label">${t('landlord.totalProperties')}</div><div class="value">${stats.total}</div></div>
      <div class="stat-card-colored green"><div class="label">${t('landlord.occupied')}</div><div class="value">${stats.occupied}</div><div class="sub">${t('landlord.freeCount', { count: stats.available })}</div></div>
      <div class="stat-card-colored orange"><div class="label">${t('landlord.monthlyIncome')}</div><div class="value">${formatCurrency(stats.monthlyIncome)}</div></div>
    </div>
    <button class="btn btn-primary btn-lg" id="add-property-btn" style="margin-bottom:1.5rem">${t('landlord.addProperty')}</button>
    <div class="property-list">${properties.map(propertyRow).join('')}</div>`;
}

export function renderTenantHome() {
  const user = getCurrentUserSync();
  const activeProperties = getTenantProperties(user.id);
  const pendingContracts = getPendingContractsForTenant(user.id);

  return `
    <div class="welcome-section">
      <h2>${t('welcome.greeting', { name: getFirstName(user.fullName) })}</h2>
      <p>${t('welcome.tenant')}</p>
    </div>
    ${pendingContracts.length > 0 ? `
      <div class="alert alert-warning" style="margin-bottom:1rem">
        <strong>${t('tenant.pendingContracts', { count: pendingContracts.length })}</strong>
        <button class="btn btn-blue btn-sm" data-page="contract" style="margin-left:1rem">${t('tenant.viewSign')}</button>
      </div>` : ''}
    ${activeProperties.length > 0 ? `
      <div class="tenant-grid">
        ${activeProperties.map(({ property: p, contract, landlord }) => `
          <div class="tenant-apartment-card">
            <div class="card-label">${t('tenant.myApartment')}</div>
            <h3>${p?.title || t('common.unknown')}</h3>
            <div class="address">${icons.pin} ${p?.address || '—'}</div>
            <div class="price">${formatCurrency(p?.rentPrice || 0)}${t('common.perMonth')}</div>
            <div class="tenant-contact">${t('tenant.landlordContact', { name: landlord?.fullName, phone: landlord?.phone || '' })}</div>
            <div class="rent-card" style="margin-top:0.5rem"><div class="label">${t('tenant.contractExpires')}</div><div class="value">${monthsUntil(contract.endDate)} ${t('common.months')}</div></div>
          </div>
        `).join('')}
      </div>` : `<div class="empty-state"><p>${t('tenant.noActive')}</p></div>`}
    <div class="action-cards-row">
      <div class="action-card"><h3>${t('tenant.paymentsCard')}</h3><button class="btn btn-primary btn-sm" data-page="payments">${t('common.view')}</button></div>
      <div class="action-card"><h3>${t('tenant.contractsCard')}</h3><button class="btn btn-blue btn-sm" data-page="contract">${t('common.view')}</button></div>
      <div class="action-card"><h3>${t('tenant.searchCard')}</h3><button class="btn btn-outline btn-sm" data-page="search">${t('common.search')}</button></div>
    </div>`;
}

export function renderAdminHome() {
  const data = loadData();
  const pending = getPendingProperties();
  const audit = getAuditLog(10);

  return `
    <div class="welcome-section"><h2>${t('page.admin')}</h2><p>${t('admin.subtitle')}</p></div>
    <div class="admin-stats">
      <div class="admin-stat"><div class="label">${t('admin.properties')}</div><div class="value">${data.properties.length}</div></div>
      <div class="admin-stat"><div class="label">${t('admin.users')}</div><div class="value">${data.users.length}</div></div>
      <div class="admin-stat"><div class="label">${t('admin.pending')}</div><div class="value">${pending.length}</div></div>
    </div>
    <button class="btn btn-primary" data-page="approvals" style="margin-bottom:1.5rem">${t('admin.reviewProperties', { count: pending.length })}</button>
    <div class="activity-feed">
      <h4>${t('admin.auditLog')}</h4>
      ${audit.map((a) => `
        <div class="activity-item">
          <div class="title">${a.action}</div>
          <div class="meta">${a.details} — ${formatLocaleString(a.timestamp)}</div>
        </div>`).join('') || `<p class="empty-state">${t('admin.noActivity')}</p>`}
    </div>`;
}

function propertyTypeLabel(type) {
  return t(`property.type.${type}`) || type || '—';
}

const AMENITY_KEYS = ['mobiluar', 'ngrohje', 'ac', 'parking', 'ballkon', 'ashensor'];

function formatAmenities(amenities) {
  const list = AMENITY_KEYS.filter((k) => amenities?.[k]).map((k) => t(`property.amenity.${k}`));
  return list.length ? list.join(' · ') : '—';
}

function renderApprovalPhotoGallery(photos) {
  const items = (photos || [])
    .map((ph, index) => {
      const src = getPhotoSrc(ph);
      if (!src) return '';
      return `
        <button type="button" class="approval-photo-btn" data-src="${src}" aria-label="${t('admin.viewPhoto')} ${index + 1}">
          <img src="${src}" alt="" loading="lazy" />
        </button>`;
    })
    .filter(Boolean);

  if (!items.length) {
    return `<div class="approval-no-photos">${t('admin.noPhotos')}</div>`;
  }

  return `<div class="approval-photo-gallery">${items.join('')}</div>`;
}

function renderAdminApprovalCard(property, owner) {
  const hasPhotos = hasValidPhotos(property.photos);

  return `
    <article class="approval-review-card" data-id="${property.id}">
      <header class="approval-review-header">
        <div>
          <h3>${property.title}</h3>
          <p class="approval-review-address">${icons.pin} ${property.address}, ${property.city}</p>
        </div>
        <span class="status-badge pending">${t('property.status.pendingApproval')}</span>
      </header>

      <section class="approval-review-section">
        <h4>${t('property.photos')}</h4>
        ${renderApprovalPhotoGallery(property.photos)}
      </section>

      <section class="approval-review-section">
        <h4>${t('admin.propertyDetails')}</h4>
        <dl class="approval-details-grid">
          <div><dt>${t('property.type')}</dt><dd>${propertyTypeLabel(property.type)}</dd></div>
          <div><dt>${t('property.rooms')}</dt><dd>${property.rooms ?? '—'}</dd></div>
          <div><dt>${t('property.bathrooms')}</dt><dd>${property.bathrooms ?? '—'}</dd></div>
          <div><dt>${t('property.area')}</dt><dd>${property.area ? `${property.area} m²` : '—'}</dd></div>
          <div><dt>${t('property.rent')}</dt><dd>${formatCurrency(property.rentPrice)}${t('common.perMonth')}</dd></div>
          <div><dt>${t('property.deposit')}</dt><dd>${formatCurrency(property.deposit || property.rentPrice || 0)}</dd></div>
          <div><dt>${t('property.amenities')}</dt><dd>${formatAmenities(property.amenities)}</dd></div>
          <div><dt>${t('admin.submittedAt')}</dt><dd>${property.createdAt ? formatDate(property.createdAt) : '—'}</dd></div>
        </dl>
      </section>

      ${property.description?.trim() ? `
        <section class="approval-review-section">
          <h4>${t('property.description')}</h4>
          <p class="approval-description">${property.description}</p>
        </section>` : ''}

      <section class="approval-review-section">
        <h4>${t('admin.landlordContact')}</h4>
        <dl class="approval-details-grid">
          <div><dt>${t('common.name')}</dt><dd>${owner?.fullName || '—'}</dd></div>
          <div><dt>${t('common.email')}</dt><dd>${owner?.email || '—'}</dd></div>
          <div><dt>${t('common.phone')}</dt><dd>${owner?.phone || '—'}</dd></div>
        </dl>
      </section>

      <footer class="approval-review-actions">
        <button class="btn btn-primary approve-btn" data-id="${property.id}" data-action="approve" ${hasPhotos ? '' : 'disabled title="' + t('admin.noPhotos') + '"'}>${t('common.approve')}</button>
        <button class="btn btn-danger approve-btn" data-id="${property.id}" data-action="reject">${t('common.reject')}</button>
      </footer>
    </article>`;
}

export function showPhotoLightbox(container, src, title = '') {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-photo">
      <div class="modal-header">
        <h3>${title || t('modal.photoTitle')}</h3>
        <button type="button" class="modal-close" aria-label="${t('common.cancel')}">&times;</button>
      </div>
      <div class="modal-body approval-photo-lightbox">
        <img src="${src}" alt="" />
      </div>
    </div>`;
  container.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

export function renderAdminApprovalsPage() {
  const pending = getPendingProperties();
  const data = loadData();

  return `
    ${renderBackButton()}
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem">${t('page.approvals')}</h2>
    <p class="field-hint" style="margin-bottom:1.5rem">${t('admin.reviewHint')}</p>
    ${pending.length === 0 ? `<div class="empty-state"><p>${t('admin.noPending')}</p></div>` : `
      <div class="approval-review-list">
        ${pending.map((p) => renderAdminApprovalCard(p, data.users.find((u) => u.id === p.ownerId))).join('')}
      </div>`}`;
}

export function renderAdminUsersPage() {
  const admin = getCurrentUserSync();
  const data = loadData();
  const users = [...data.users].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'sq'));

  return `
    ${renderBackButton()}
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">${t('page.users')}</h2>
    <p class="field-hint" style="margin-bottom:1rem">${t('admin.deleteUserHint')}</p>
    ${users.length === 0 ? `<div class="empty-state"><p>${t('admin.noUsers')}</p></div>` : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('common.name')}</th>
              <th>${t('common.email')}</th>
              <th>${t('common.role')}</th>
              <th>${t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u) => {
              const canDelete = u.id !== admin?.id && u.role !== 'administrator';
              return `
              <tr>
                <td>${u.fullName || '—'}</td>
                <td>${u.email || '—'}</td>
                <td><span class="user-role-badge">${getRoleLabel(u.role)}</span></td>
                <td>
                  ${canDelete
                    ? `<button type="button" class="btn btn-danger btn-sm admin-delete-user-btn" data-id="${u.id}" data-name="${(u.fullName || u.email || '').replace(/"/g, '&quot;')}">${t('admin.deleteUser')}</button>`
                    : `<span class="sub-status">${u.id === admin?.id ? t('admin.you') : '—'}</span>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}`;
}

export function renderNotificationsPage() {
  const user = getCurrentUserSync();
  const notes = getNotifications(user.id);

  const actionPageFor = (notification) => {
    if (['sukses', 'refuzim', 'kërkesë'].includes(notification.type)) return 'home';
    if (notification.type === 'kontratë') return 'contract';
    if (notification.type === 'pagesë' || notification.type === 'shpenzim') return 'payments';
    if (notification.type === 'miratim') return 'approvals';
    return '';
  };

  const contractActionLabel = (notification, role) => {
    if (notification.type !== 'kontratë') return t('common.view');
    const needsSign =
      role === 'qiramarrësi' && /nënshkruani/i.test(notification.message || '');
    return needsSign ? t('tenant.viewSign') : t('common.view');
  };

  return `
    ${renderBackButton()}
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">${t('page.notifications')}</h2>
    ${notes.length === 0 ? `<div class="empty-state"><p>${t('notifications.none')}</p></div>` : notes.map((n) => {
      const actionPage = actionPageFor(n);
      const actionLabel = contractActionLabel(n, user.role);
      const isSignAction = actionLabel === t('tenant.viewSign');
      return `
        <div class="activity-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
          <div class="title">${n.type}</div>
          <div class="meta">${n.message}</div>
          <div class="request-meta">${formatLocaleString(n.sentAt)}</div>
          ${actionPage ? `<button type="button" class="btn ${isSignAction ? 'btn-blue' : 'btn-outline'} btn-sm notification-open-btn" data-id="${n.id}" data-page="${actionPage}" style="margin-top:0.75rem">${actionLabel}</button>` : ''}
        </div>`;
    }).join('')}`;
}

export function renderProfilePage() {
  const user = getCurrentUserSync();
  if (!user) return `<div class="empty-state"><p>${t('app.renderError')}</p></div>`;

  const displayName = user.fullName?.trim() || user.email?.split('@')[0] || t('common.name');
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const stats = user.role === 'qiradhënësi' ? getLandlordStats(user.id) : null;

  return `
    ${renderBackButton()}
    <div class="profile-header"><div class="profile-avatar">${avatarLetter}</div><h2>${displayName}</h2></div>
    <div class="profile-section">
      <form id="profile-form" novalidate>
        <div class="form-grid">
          <div class="form-group"><label>${t('common.name')}</label><input name="fullName" value="${user.fullName || ''}" required /></div>
          <div class="form-group"><label>${t('common.email')}</label><input name="email" type="email" value="${user.email}" required /></div>
          <div class="form-group"><label>${t('common.phone')}</label><input name="phone" value="${user.phone || ''}" /></div>
          <div class="form-group"><label>${t('common.address')}</label><input name="address" value="${user.address || ''}" /></div>
          ${user.role === 'qiramarrësi' ? `
            <div class="form-group"><label>${t('profile.userType')}</label>
              <select name="userType"><option value="student" ${user.userType === 'student' ? 'selected' : ''}>${t('auth.student')}</option><option value="employed" ${user.userType === 'employed' ? 'selected' : ''}>${t('auth.employed')}</option></select>
            </div>
            <div class="form-group"><label>${t('profile.campus')}</label>
              <select name="campusId">${CAMPUSES.map((c) => `<option value="${c.id}" ${user.campusId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            </div>` : ''}
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:1rem">${t('common.save')}</button>
      </form>
    </div>
    <div class="profile-section">
      <form id="password-form" novalidate>
        <div class="form-grid">
          <div class="form-group"><label>${t('profile.currentPassword')}</label><input name="currentPassword" type="password" /></div>
          <div class="form-group"><label>${t('profile.newPassword')}</label><input name="newPassword" type="password" /></div>
          <div class="form-group"><label>${t('profile.confirmPassword')}</label><input name="confirmPassword" type="password" /></div>
        </div>
        <button type="submit" class="btn btn-outline" style="margin-top:1rem">${t('profile.changePassword')}</button>
      </form>
    </div>
    ${stats ? `<div class="profile-stats-grid">
      <div class="stat-card-white"><div class="label">${t('profile.properties')}</div><div class="value">${stats.total}</div></div>
      <div class="stat-card-white"><div class="label">${t('profile.active')}</div><div class="value">${stats.occupied}</div></div>
    </div>` : ''}
    <div class="profile-section profile-danger" style="margin-top:2rem;border-top:1px solid var(--border);padding-top:1.5rem">
      <h3 style="margin-bottom:0.5rem;color:var(--danger)">${t('profile.deleteTitle')}</h3>
      <p class="field-hint" style="margin-bottom:1rem">${t('profile.deleteHint')}</p>
      <button type="button" class="btn btn-danger" id="delete-account-btn">${t('profile.deleteBtn')}</button>
    </div>`;
}

export function renderAddPropertyPage(property = null) {
  const isEdit = !!property?.id;
  const a = property?.amenities || {};
  const hasExistingPhotos = hasValidPhotos(property?.photos);
  const photoRequired = !isEdit || !hasExistingPhotos;

  return `
    ${renderBackButton(undefined, 'home')}
    <h2>${isEdit ? t('page.editProperty') : t('page.addProperty')}</h2>
    <p class="field-hint" style="margin-bottom:1rem">${t('property.approvalHint')}</p>
    <form id="property-form" novalidate>
      <div class="form-section">
        <div class="form-grid">
          <div class="form-group full"><label>${t('property.title')}</label><input name="title" required value="${property?.title || ''}" /></div>
          <div class="form-group"><label>${t('property.city')}</label>
            <select name="city">${KOSOVO_CITIES.map((c) => `<option ${property?.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>${t('property.type')}</label>
            <select name="type">
              <option value="apartament" ${property?.type === 'apartament' ? 'selected' : ''}>${t('property.type.apartament')}</option>
              <option value="shtepi" ${property?.type === 'shtepi' ? 'selected' : ''}>${t('property.type.shtepi')}</option>
              <option value="studio" ${property?.type === 'studio' ? 'selected' : ''}>${t('property.type.studio')}</option>
            </select>
          </div>
          <div class="form-group full"><label>${t('common.address')}</label><input name="address" required value="${property?.address || ''}" /></div>
          <div class="form-group"><label>${t('property.rooms')}</label><input name="rooms" type="number" min="1" required value="${property?.rooms || ''}" /></div>
          <div class="form-group"><label>${t('property.bathrooms')}</label><input name="bathrooms" type="number" min="1" required value="${property?.bathrooms || ''}" /></div>
          <div class="form-group"><label>${t('property.area')}</label><input name="area" type="number" min="1" required value="${property?.area || ''}" /></div>
          <div class="form-group"><label>${t('property.rent')}</label><input name="rentPrice" type="number" min="1" required value="${property?.rentPrice || ''}" /></div>
          <div class="form-group"><label>${t('property.deposit')}</label><input name="deposit" type="number" min="0" value="${property?.deposit || ''}" /></div>
          <div class="form-group full"><label>${t('property.description')}</label><textarea name="description" rows="3">${property?.description || ''}</textarea></div>
          <div class="form-group full">
            <label>${t('property.photos')} <span class="required-mark">*</span> (min 1, max 5, 5MB)</label>
            <p class="field-hint">${t('property.photosHint')}</p>
            ${hasExistingPhotos ? `
              <div class="existing-photos-preview">
                ${property.photos.map((ph) => {
                  const src = getPhotoSrc(ph);
                  return src ? `<img src="${src}" alt="${ph.name || ''}" class="photo-preview-thumb" />` : '';
                }).join('')}
              </div>
              <p class="field-hint">${t('property.photosExisting', { count: property.photos.length })}</p>
            ` : ''}
            <input type="file" name="photos" accept="image/*" multiple ${photoRequired ? 'required' : ''} />
          </div>
        </div>
        <h4 style="margin-top:1rem">${t('property.amenities')}</h4>
        <div class="amenities-grid">
          ${[['mobiluar', 'property.amenity.mobiluar'], ['ngrohje', 'property.amenity.ngrohje'], ['ac', 'property.amenity.ac'], ['parking', 'property.amenity.parking'], ['ballkon', 'property.amenity.ballkon'], ['ashensor', 'property.amenity.ashensor']].map(([k, labelKey]) => `
            <label class="amenity-item"><input type="checkbox" name="amenity_${k}" ${a[k] ? 'checked' : ''} /> ${t(labelKey)}</label>`).join('')}
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-lg btn-block">${isEdit ? t('property.saveApproval') : t('property.submitApproval')}</button>
    </form>`;
}

export function renderSearchPage(searchState = {}) {
  const user = getCurrentUserSync();
  const page = searchState.page || 1;
  const filters = searchState.filters || {};
  const advanced = !!searchState.advanced;

  const result = getPublishedProperties(filters, page);

  function card(p) {
    const pending = hasTenantPendingRequest(user.id, p.id);
    const fav = isFavorite(user.id, p.id);
    const thumbSrc = getPhotoSrc(p.photos?.[0]);
    const thumb = thumbSrc ? `<img src="${thumbSrc}" class="property-thumb-img" alt="" />` : icons.houseLg;
    return `
      <div class="search-result-card">
        <div class="property-thumb-lg">${thumb}</div>
        <div class="body">
          <h3>${p.title}</h3>
          <div class="address">${icons.pin} ${p.address}, ${p.city}</div>
          <div class="specs">${propertySpecs(p)}</div>
          <div class="price">${formatCurrency(p.rentPrice)}${t('common.perMonth')}</div>
          <div class="card-actions">
            <button class="btn btn-outline btn-sm favorite-btn" data-id="${p.id}">${fav ? t('search.unsave') : t('search.save')}</button>
            <button class="btn ${pending ? 'btn-outline' : 'btn-primary'} btn-sm request-contract-btn" data-id="${p.id}" ${pending ? 'disabled' : ''}>
              ${pending ? t('search.requestSent') : t('search.requestContract')}
            </button>
          </div>
        </div>
      </div>`;
  }

  return `
    ${renderBackButton()}
    <h2>${t('page.search')}</h2>
    <div class="search-filters">
      <div class="form-grid search-filters-basic">
        <div class="form-group full"><label>${t('property.city')}</label><select id="filter-city"><option value="">${t('search.allKosovo')}</option>${KOSOVO_CITIES.map((c) => `<option value="${c}" ${filters.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      ${advanced ? `
        <div class="form-grid search-filters-advanced">
          <div class="form-group"><label>${t('property.type')}</label><select id="filter-type"><option value="">${t('common.all')}</option><option value="apartament" ${filters.type === 'apartament' ? 'selected' : ''}>${t('property.type.apartament')}</option><option value="studio" ${filters.type === 'studio' ? 'selected' : ''}>${t('property.type.studio')}</option><option value="shtepi" ${filters.type === 'shtepi' ? 'selected' : ''}>${t('property.type.shtepi')}</option></select></div>
          <div class="form-group"><label>${t('search.maxPrice')}</label><input id="filter-max-price" type="number" min="0" placeholder="500" value="${filters.maxPrice || ''}" /></div>
          <div class="form-group"><label>${t('search.minRooms')}</label><input id="filter-min-rooms" type="number" min="1" value="${filters.minRooms || ''}" /></div>
          <div class="form-group"><label>${t('search.minArea')}</label><input id="filter-min-area" type="number" min="0" value="${filters.minArea || ''}" /></div>
          <div class="form-group form-group--checkbox full"><label class="checkbox-label" for="filter-mobiluar"><input type="checkbox" id="filter-mobiluar" ${filters.mobiluar ? 'checked' : ''} /><span>${t('property.amenity.mobiluar')}</span></label></div>
        </div>` : ''}
      <div class="search-filter-toolbar">
        <button type="button" class="btn btn-text" id="toggle-advanced-search">${advanced ? t('search.simpleSearch') : t('search.advancedSearch')}</button>
      </div>
      <div class="search-filter-actions">
        <button class="btn btn-primary" id="search-btn">${t('common.search')}</button>
      </div>
    </div>
    <div id="search-meta" style="margin:1rem 0;color:var(--text-muted)">${result.total} ${t('common.results')} · ${t('common.page')} ${result.page}/${result.totalPages}</div>
    <div id="search-results" class="search-results-grid">
      ${result.items.length === 0
        ? `<div class="empty-state full-width"><p>${t('search.noResults')}</p></div>`
        : result.items.map(card).join('')}
    </div>
    ${result.totalPages > 1 ? `
      <div class="pagination">
        <button class="btn btn-outline btn-sm" id="prev-page" ${page <= 1 ? 'disabled' : ''}>${t('common.previous')}</button>
        <span>${t('common.page')} ${page} / ${result.totalPages}</span>
        <button class="btn btn-outline btn-sm" id="next-page" ${page >= result.totalPages ? 'disabled' : ''}>${t('common.next')}</button>
      </div>` : ''}`;
}

export function renderFavoritesPage() {
  const user = getCurrentUserSync();
  const favs = getFavorites(user.id);

  return `
    ${renderBackButton()}
    <h2>${t('page.favorites')}</h2>
    ${favs.length === 0 ? `<div class="empty-state"><p>${t('search.noFavorites')}</p><button class="btn btn-primary" data-page="search">${t('page.search')}</button></div>` : `
      <div class="search-results-grid">${favs.map((p) => `
        <div class="search-result-card">
          <h3>${p.title}</h3>
          <div>${p.address}</div>
          <div class="price">${formatCurrency(p.rentPrice)}${t('common.perMonth')}</div>
          <button class="btn btn-outline btn-sm favorite-btn" data-id="${p.id}">${t('search.removeFromList')}</button>
        </div>`).join('')}</div>`}`;
}

export function renderPaymentsPage(period = {}) {
  const user = getCurrentUserSync();
  const payments = getExpenses(user.id, user.role, period.from, period.to);
  const report = generateExpenseReport(payments);

  return `
    ${renderBackButton()}
    <h2>${t('page.payments')}</h2>
    <div class="form-grid" style="margin-bottom:1rem">
      <div class="form-group"><label>${t('common.from')}</label><input type="date" id="period-from" value="${period.from || ''}" /></div>
      <div class="form-group"><label>${t('common.to')}</label><input type="date" id="period-to" value="${period.to || ''}" /></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-outline btn-sm" id="filter-period">${t('common.filter')}</button></div>
    </div>
    <div class="stats-row" style="margin-bottom:1rem">
      <div class="stat-card-white"><div class="label">${t('common.total')}</div><div class="value">${formatCurrency(report.total)}</div></div>
      <div class="stat-card-white"><div class="label">${t('common.paid')}</div><div class="value">${formatCurrency(report.paid)}</div></div>
      <div class="stat-card-white"><div class="label">${t('common.overdue')}</div><div class="value">${formatCurrency(report.overdue)}</div></div>
    </div>
    <button class="btn btn-outline btn-sm" id="export-payments-pdf" style="margin-bottom:1rem">${t('payments.downloadPdf')}</button>
    ${payments.length === 0 ? `<div class="empty-state"><p>${t('payments.noExpenses')}</p></div>` : `
      <div class="table-responsive">
      <table>
        <thead><tr><th>${t('common.date')}</th><th>${t('payments.item')}</th><th>${t('common.amount')}</th><th>${t('common.status')}</th><th>${t('common.actions')}</th></tr></thead>
        <tbody>${payments.map((p) => `
          <tr>
            <td>${formatDate(p.dueDate)}</td>
            <td>${getPaymentDisplayName(p)}</td>
            <td>${formatCurrency(p.amount)}</td>
            <td><span class="status-badge ${statusBadgeClass(p.status)}">${getPaymentStatusLabel(p.status)}</span>${p.proof ? ` <span class="sub-status">📎 ${t('common.proof')}</span>` : ''}</td>
            <td>
              ${user.role === 'qiramarrësi' && ['pending', 'overdue'].includes(p.status) ? `<button class="btn btn-primary btn-sm pay-btn" data-id="${p.id}">${t('payments.uploadProof')}</button>` : ''}
              ${user.role === 'qiramarrësi' && p.status === 'nën_shqyrtim' ? `<span class="sub-status">${t('payments.underReview')}</span>` : ''}
              ${user.role === 'qiramarrësi' && p.status === 'pending' ? `<button class="btn btn-outline btn-sm dispute-btn" data-id="${p.id}">${t('payments.dispute')}</button>` : ''}
              ${p.proof ? `<button type="button" class="btn btn-outline btn-sm view-proof-btn" data-id="${p.id}">${t('payments.viewProof')}</button>` : ''}
              ${user.role === 'qiradhënësi' && ['pending', 'overdue'].includes(p.status) ? `<button class="btn btn-outline btn-sm confirm-cash-btn" data-id="${p.id}">${t('payments.confirmCash')}</button>` : ''}
              ${user.role === 'qiradhënësi' && p.status === 'disputed' ? `<button class="btn btn-sm resolve-btn" data-id="${p.id}">${t('payments.resolve')}</button>` : ''}
              ${user.role === 'qiradhënësi' && p.status === 'nën_shqyrtim' ? `
                <button class="btn btn-primary btn-sm review-approve-btn" data-id="${p.id}">✓ ${t('common.approve')}</button>
                <button class="btn btn-outline btn-sm review-reject-btn" data-id="${p.id}">✗ ${t('common.reject')}</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>`}`;
}

export function showProofViewerModal(container, payment, url) {
  const proofType = payment.proof?.type || '';
  const isPdf = proofType.includes('pdf') || /\.pdf($|\?)/i.test(url);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-proof-viewer">
      <div class="modal-header">
        <h3>${t('payments.viewProof')}</h3>
        <button type="button" class="modal-close" aria-label="${t('common.cancel')}">&times;</button>
      </div>
      <div class="modal-body proof-viewer-body">
        <p class="field-hint">${getPaymentDisplayName(payment)} · ${formatCurrency(payment.amount)} · ${formatDate(payment.dueDate)}</p>
        ${isPdf
          ? `<iframe src="${url}" class="proof-viewer-frame" title="${t('payments.viewProof')}"></iframe>`
          : `<img src="${url}" alt="${t('payments.viewProof')}" class="proof-viewer-img" />`}
      </div>
      <div class="modal-footer">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">${t('common.openNewTab')}</a>
        <button type="button" class="btn btn-primary modal-close-footer">${t('common.cancel')}</button>
      </div>
    </div>`;
  container.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.querySelector('.modal-close-footer').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

export function showPaymentProofModal(container, payment, onSubmit) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>${t('modal.proofTitle')}</h3><button type="button" class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p class="field-hint">${t('modal.proofHint')}</p>
        <div class="form-group"><label>${getPaymentDisplayName(payment)} — ${formatCurrency(payment.amount)}</label></div>
        <div class="form-group"><input type="file" id="proof-file" accept="image/*,application/pdf" required /></div>
        <div id="proof-error" class="alert alert-warning" style="display:none;margin-top:0.5rem"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline modal-cancel">${t('common.cancel')}</button>
        <button type="button" class="btn btn-primary" id="submit-proof-btn">${t('modal.submitProof')}</button>
      </div>
    </div>`;
  container.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.querySelector('.modal-cancel').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('#submit-proof-btn').onclick = () => {
    const fileInput = modal.querySelector('#proof-file');
    const file = fileInput.files[0];
    const errBox = modal.querySelector('#proof-error');
    if (!file) {
      errBox.textContent = t('modal.selectFile');
      errBox.style.display = 'block';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onSubmit({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result }, (error) => {
        errBox.textContent = error;
        errBox.style.display = 'block';
      }, close);
    };
    reader.readAsDataURL(file);
  };
}

export function renderLandlordExpensesPage() {
  const user = getCurrentUserSync();
  const props = getOwnerProperties(user.id).filter((p) => isPropertyOccupied(p.id));

  return `
    ${renderBackButton()}
    <h2>${t('page.expenses')}</h2>
    <p class="field-hint">${t('expense.hint')}</p>
    <form id="expense-form" class="profile-section" novalidate>
      <div class="form-grid">
        <div class="form-group"><label>${t('expense.property')}</label>
          <select name="propertyId" required>${props.map((p) => `<option value="${p.id}">${p.title}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>${t('common.type')}</label>
          <select name="type">${EXPENSE_TYPES.filter((et) => et.id !== 'qera').map((et) => `<option value="${et.id}">${t(`expenseType.${et.id}`)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>${t('common.amount')} €</label><input name="amount" type="number" min="1" required /></div>
        <div class="form-group"><label>${t('expense.month')}</label><input name="month" type="month" required /></div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:1rem">${t('expense.add')}</button>
    </form>
    <button class="btn btn-outline" data-page="payments" style="margin-top:1rem">${t('expense.viewAll')}</button>`;
}

function renderSignaturePreview(signature, label) {
  if (!signature) return '';
  if (signature.dataUrl) {
    return `<div class="signature-preview"><div class="signature-label">${label}</div><img src="${signature.dataUrl}" alt="${label}" class="signature-img" /></div>`;
  }
  if (signature.typedName) {
    return `<div class="signature-preview signature-typed"><div class="signature-label">${label}</div><span class="signature-typed-name">${signature.typedName}</span></div>`;
  }
  return '';
}

function renderContractCardBody({ contract, property, landlord, tenant, user }) {
  const partyA = landlord?.fullName || user.fullName;
  const partyB = tenant?.fullName || user.fullName;
  const isLandlordView = user.role === 'qiradhënësi';

  return `
    ${formatContractNumber(contract) ? `<span class="sub-status">Nr. ${formatContractNumber(contract)}</span>` : ''}<br/><br/>
    ${t('contract.between', { landlord: isLandlordView ? partyA : landlord?.fullName, tenant: isLandlordView ? tenant?.fullName : partyB })}<br/><br/>
    ${t('contract.object', { title: property?.title, address: property?.address })}<br/>
    ${t('contract.rent', { amount: formatCurrency(property?.rentPrice) })}<br/>
    ${t('contract.period', { start: formatDate(contract.startDate), end: formatDate(contract.endDate) })}<br/>
    ${t('contract.status', { status: getContractStatusLabel(contract.status) })}<br/>
    <div class="signatures-row" style="margin-top:1rem">
      ${renderSignaturePreview(contract.landlordSignature, t('contract.landlordSign'))}
      ${renderSignaturePreview(contract.signature, t('contract.tenantSign'))}
    </div>
    ${contract.signedAt ? `<div class="sub-status">${t('contract.signedOn', { date: formatLocaleDate(contract.signedAt) })}</div>` : ''}`;
}

function renderLandlordContractPage(user) {
  const entries = getLandlordContracts(user.id);
  const pending = entries.filter((e) => ['pending_signature', 'generated_pdf'].includes(e.contract.status));
  const active = entries.filter((e) => ['active', 'signed'].includes(e.contract.status));

  let html = `${renderBackButton()}<h2>${t('page.contract')}</h2>`;

  if (pending.length > 0) {
    html += `<h3 class="section-subtitle">${t('contract.awaitingTenant')}</h3>`;
    html += pending.map(({ contract, property, tenant }) => `
      <div class="contract-preview pending-contract" data-id="${contract.id}" style="margin-bottom:1.5rem;border:2px solid var(--warning)">
        <strong>${t('contract.sentTitle')}</strong>
        ${renderContractCardBody({ contract, property, landlord: user, tenant, user })}
        <button class="btn btn-outline download-pending-btn" data-id="${contract.id}" style="margin-top:1rem">${t('contract.downloadPdf')}</button>
      </div>`).join('');
  }

  if (active.length > 0) {
    html += `<h3 class="section-subtitle">${t('contract.activeTitle')}</h3>`;
    html += active.map(({ contract, property, tenant }) => `
      <div class="contract-preview" style="margin-bottom:1.5rem">
        <strong>${property?.title || t('common.unknown')}</strong>
        ${renderContractCardBody({ contract, property, landlord: user, tenant, user })}
        <button class="btn btn-blue download-contract-btn" style="margin-top:1rem" data-id="${contract.id}">${t('contract.downloadPdf')}</button>
      </div>`).join('');
  }

  if (pending.length === 0 && active.length === 0) {
    html += `<div class="empty-state"><p>${t('contract.landlordNone')}</p></div>`;
  }

  return html;
}

function renderTenantContractPage(user) {
  const activeProperties = getTenantProperties(user.id);
  const pending = getPendingContractsForTenant(user.id);
  const data = loadData();

  let html = `${renderBackButton()}<h2>${t('page.contract')}</h2>`;

  if (pending.length > 0) {
    html += pending.map((c) => {
      const p = data.properties.find((x) => x.id === c.propertyId);
      const landlord = data.users.find((u) => u.id === c.landlordId);
      return `
        <div class="contract-preview pending-contract" data-id="${c.id}" style="margin-bottom:1.5rem;border:2px solid var(--primary)">
          <strong>${t('contract.pendingTitle')}</strong>
          ${renderContractCardBody({ contract: c, property: p, landlord, tenant: user, user })}
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-blue sign-accept-btn" data-id="${c.id}">${t('contract.signDigital')}</button>
            <button class="btn btn-danger sign-reject-btn" data-id="${c.id}">${t('contract.reject')}</button>
            <button class="btn btn-outline download-pending-btn" data-id="${c.id}">${t('contract.downloadPdf')}</button>
          </div>
        </div>`;
    }).join('');
  }

  if (activeProperties.length > 0) {
    html += activeProperties.map(({ contract, property, landlord }) => `
      <div class="contract-preview" style="margin-bottom:1.5rem">
        <strong>${t('contract.activeTitle')}</strong><br/><br/>
        ${renderContractCardBody({ contract, property, landlord, tenant: user, user })}
        <button class="btn btn-blue download-contract-btn" style="margin-top:1rem" data-id="${contract.id}">${t('contract.downloadPdf')}</button>
      </div>`).join('');
  } else if (pending.length === 0) {
    html += `<div class="empty-state"><p>${t('contract.noActive')}</p></div>`;
  }

  return html;
}

export function renderContractPage() {
  const user = getCurrentUserSync();
  if (user.role === 'qiradhënësi') return renderLandlordContractPage(user);
  return renderTenantContractPage(user);
}

export function showSignatureModal(container, contract, onSign, options = {}) {
  const title = options.title || t('modal.signatureTitle');
  const hint = options.hint || t('modal.signatureHint');
  const confirmLabel = options.confirmLabel || t('modal.signActivate');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>${title}</h3><button type="button" class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p class="field-hint">${hint}</p>
        <canvas id="signature-canvas" width="400" height="150" style="border:2px dashed var(--border);border-radius:8px;width:100%;max-width:400px;touch-action:none;cursor:crosshair;background:#fff"></canvas>
        <div style="margin-top:0.5rem"><button type="button" class="btn btn-outline btn-sm" id="clear-signature">${t('modal.clearSignature')}</button></div>
        <div class="form-group" style="margin-top:1rem"><label>${t('modal.typedSignature')}</label><input id="typed-signature" placeholder="${t('modal.signaturePlaceholder')}" /></div>
        <label style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem"><input type="checkbox" id="signature-consent" /> ${t('modal.signatureConsent')}</label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline modal-cancel">${t('common.cancel')}</button>
        <button type="button" class="btn btn-blue" id="confirm-sign-btn">${confirmLabel}</button>
      </div>
    </div>`;
  container.appendChild(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.modal-cancel').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  import('../pdf.js').then(({ generateSignaturePad }) => {
    const canvas = modal.querySelector('#signature-canvas');
    canvas.width = canvas.offsetWidth || 400;
    const pad = generateSignaturePad(canvas);
    modal.querySelector('#clear-signature').onclick = () => pad.clear();

    modal.querySelector('#confirm-sign-btn').onclick = () => {
      if (!modal.querySelector('#signature-consent').checked) {
        alert(t('alert.consentRequired'));
        return;
      }
      const typedName = modal.querySelector('#typed-signature').value.trim();
      const signature = !pad.isEmpty()
        ? { dataUrl: pad.toDataUrl(), typedName: null }
        : typedName
          ? { dataUrl: null, typedName }
          : null;
      if (!signature) {
        alert(t('alert.signatureRequired'));
        return;
      }
      onSign(signature);
      modal.remove();
    };
  });
}

export function showContractModal(container, property, onCreate) {
  const data = loadData();
  const pendingRequests = getPendingRequestsForProperty(property.id);
  if (pendingRequests.length === 0) {
    alert(t('alert.noTenantRequests'));
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>${t('modal.generateContract', { title: property.title })}</h3><button type="button" class="modal-close">&times;</button></div>
      <form id="contract-form" novalidate>
        <div class="modal-body">
          <div class="form-group"><label>${t('modal.tenantSelect')}</label>
            <select name="requestId" required>
              ${pendingRequests.map((req) => {
                const tenant = data.users.find((u) => u.id === req.tenantId);
                return `<option value="${req.id}" data-tenant="${req.tenantId}">${tenant?.fullName} (${tenant?.email})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group"><label>${t('modal.startDate')}</label><input name="startDate" type="date" required /></div>
          <div class="form-group"><label>${t('modal.endDate')}</label><input name="endDate" type="date" required /></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline modal-cancel">${t('common.cancel')}</button>
          <button type="submit" class="btn btn-blue">${t('modal.generateSend')}</button>
        </div>
      </form>
    </div>`;
  container.appendChild(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.modal-cancel').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const startInput = modal.querySelector('[name="startDate"]');
  const endInput = modal.querySelector('[name="endDate"]');
  const requestSelect = modal.querySelector('[name="requestId"]');

  const applyRequestDates = () => {
    const req = pendingRequests.find((r) => r.id === requestSelect.value);
    const start = req?.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    startInput.value = start;
    endInput.value = addMonthsToDateString(start, 12);
  };

  applyRequestDates();
  requestSelect.addEventListener('change', applyRequestDates);

  modal.querySelector('#contract-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const select = modal.querySelector('[name="requestId"]');
    onCreate({
      propertyId: property.id,
      tenantId: select.selectedOptions[0]?.dataset.tenant,
      requestId: fd.get('requestId'),
      startDate: fd.get('startDate'),
      endDate: fd.get('endDate'),
    });
    modal.remove();
  };
}

export { propertyRow, PAGE_SIZE };
