import { getCurrentUserSync } from '../auth.js';
import {
  getOwnerProperties,
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
  getExpenseTypeLabel,
  getContractStatusLabel,
  getPaymentStatusLabel,
  getCampusName,
  CAMPUSES,
  KOSOVO_CITIES,
  EXPENSE_TYPES,
  PAGE_SIZE,
} from '../services.js';
import { getPhotoSrc, hasValidPhotos } from '../data.js';
import { icons } from '../icons.js';
import { renderBackButton } from './layout.js';

function propertySpecs(p) {
  return `${p.rooms} Dhoma • ${p.bathrooms || 1} Banjë • ${p.area || '-'}m²`;
}

function statusBadgeClass(status) {
  if (['paguar', 'publikuar', 'active', 'signed'].includes(status)) return 'available';
  if (['overdue', 'refuzuar', 'cancelled', 'disputed'].includes(status)) return 'danger';
  if (['në pritje', 'pending', 'pending_signature', 'rezervuar'].includes(status)) return 'pending';
  return 'occupied';
}

function propertyStatusLabel(p) {
  if (p.status === 'në pritje') return 'Në pritje miratimi';
  if (p.status === 'refuzuar') return 'Refuzuar';
  if (p.status === 'rezervuar') return 'E rezervuar';
  if (p.status === 'me qera' || isPropertyOccupied(p.id)) return 'Me qera';
  if (isPropertyReserved(p.id)) return 'E rezervuar';
  return p.status === 'publikuar' ? 'E lirë' : p.status;
}

function propertyRow(p) {
  const occupied = isPropertyOccupied(p.id);
  const reserved = isPropertyReserved(p.id);
  const pendingRequests = getPendingRequestsForProperty(p.id);
  const statusClass = statusBadgeClass(p.status === 'publikuar' && !occupied ? 'publikuar' : p.status);

  let contractAction = '';
  if (!occupied && p.status === 'publikuar') {
    contractAction = pendingRequests.length > 0
      ? `<button class="btn btn-blue btn-sm contract-btn" data-id="${p.id}">Gjenero Kontratë (${pendingRequests.length})</button>`
      : `<span class="request-hint">Në pritje të kërkesës nga qeramarrësi</span>`;
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
          <h3>${p.title}</h3>
          <div class="address">${icons.pin} ${p.address}</div>
          <div class="specs">${icons.bed} ${propertySpecs(p)}</div>
          <div class="price">${formatCurrency(p.rentPrice)}/muaj</div>
          ${p.nearCampus ? `<div class="sub-status">Afër: ${getCampusName(p.nearCampus)}</div>` : ''}
        </div>
        <div class="property-status">
          <span class="status-badge ${statusClass}">${propertyStatusLabel(p)}</span>
          ${p.status === 'në pritje' ? '<div class="sub-status">Dërguar te admin</div>' : ''}
          ${p.status === 'refuzuar' ? `<div class="sub-status">${p.rejectReason || ''}</div>` : ''}
        </div>
      </div>
      <div class="property-actions-row">
        ${contractAction}
        <button class="btn btn-outline btn-sm edit-btn" data-id="${p.id}" ${occupied ? 'disabled' : ''}>${icons.edit} Modifiko</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}" ${occupied || reserved ? 'disabled' : ''}>${icons.trash} Fshi</button>
      </div>
    </div>`;
}

export function renderLandlordHome() {
  const user = getCurrentUserSync();
  const stats = getLandlordStats(user.id);
  const properties = getOwnerProperties(user.id);
  const pendingRequests = getPendingRequestsForLandlord(user.id);
  const data = loadData();

  return `
    <div class="welcome-section">
      <h2>Mirësevini, ${getFirstName(user.fullName)}!</h2>
      <p>Paneli i Qeradhënësit</p>
    </div>
    ${pendingRequests.length > 0 ? `
      <div class="profile-section" style="margin-bottom:1.5rem">
        <h4>Kërkesat për Kontratë (${pendingRequests.length})</h4>
        ${pendingRequests.map((req) => {
          const prop = data.properties.find((p) => p.id === req.propertyId);
          const tenant = data.users.find((u) => u.id === req.tenantId);
          return `
            <div class="request-item">
              <div>
                <strong>${tenant?.fullName}</strong> — ${prop?.title}
                <div class="request-meta">${formatDate(req.createdAt.slice(0, 10))}</div>
              </div>
              <button class="btn btn-blue btn-sm contract-btn" data-id="${prop?.id}">Gjenero Kontratë</button>
            </div>`;
        }).join('')}
      </div>` : ''}
    <div class="stats-row">
      <div class="stat-card-colored blue"><div class="label">Total Pronash</div><div class="value">${stats.total}</div></div>
      <div class="stat-card-colored green"><div class="label">Të Zëna</div><div class="value">${stats.occupied}</div><div class="sub">${stats.available} të lira</div></div>
      <div class="stat-card-colored orange"><div class="label">Të Ardhura Mujore</div><div class="value">${formatCurrency(stats.monthlyIncome)}</div></div>
    </div>
    <button class="btn btn-primary btn-lg" id="add-property-btn" style="margin-bottom:1.5rem">+ Shto Banesë të Re</button>
    <div class="property-list">${properties.map(propertyRow).join('')}</div>`;
}

export function renderTenantHome() {
  const user = getCurrentUserSync();
  const activeProperties = getTenantProperties(user.id);
  const pendingContracts = getPendingContractsForTenant(user.id);

  return `
    <div class="welcome-section">
      <h2>Mirësevini, ${getFirstName(user.fullName)}!</h2>
      <p>Paneli i Qeramarrësit</p>
    </div>
    ${pendingContracts.length > 0 ? `
      <div class="alert alert-warning" style="margin-bottom:1rem">
        <strong>${pendingContracts.length} kontratë pret nënshkrimin tuaj!</strong>
        <button class="btn btn-blue btn-sm" data-page="contract" style="margin-left:1rem">Shiko & Nënshkruaj</button>
      </div>` : ''}
    ${activeProperties.length > 0 ? `
      <div class="tenant-grid">
        ${activeProperties.map(({ property: p, contract, landlord }) => `
          <div class="tenant-apartment-card">
            <div class="card-label">Banesa Ime</div>
            <h3>${p.title}</h3>
            <div class="address">${icons.pin} ${p.address}</div>
            <div class="price">${formatCurrency(p.rentPrice)}/muaj</div>
            <div class="tenant-contact">Qeradhënës: ${landlord?.fullName} · ${landlord?.phone || ''}</div>
            <div class="rent-card" style="margin-top:0.5rem"><div class="label">Kontrata Skadon</div><div class="value">${monthsUntil(contract.endDate)} muaj</div></div>
          </div>
        `).join('')}
      </div>` : '<div class="empty-state"><p>Nuk keni banesë aktive.</p></div>'}
    <div class="action-cards-row">
      <div class="action-card"><h3>Pagesat</h3><button class="btn btn-primary btn-sm" data-page="payments">Shiko</button></div>
      <div class="action-card"><h3>Kontratat</h3><button class="btn btn-blue btn-sm" data-page="contract">Shiko</button></div>
      <div class="action-card"><h3>Kërkim</h3><button class="btn btn-outline btn-sm" data-page="search">Kërko</button></div>
    </div>`;
}

export function renderAdminHome() {
  const data = loadData();
  const pending = getPendingProperties();
  const audit = getAuditLog(10);

  return `
    <div class="welcome-section"><h2>Panel Admin</h2><p>Menaxhimi i platformës</p></div>
    <div class="admin-stats">
      <div class="admin-stat"><div class="label">Banesa</div><div class="value">${data.properties.length}</div></div>
      <div class="admin-stat"><div class="label">Përdorues</div><div class="value">${data.users.length}</div></div>
      <div class="admin-stat"><div class="label">Për Miratim</div><div class="value">${pending.length}</div></div>
    </div>
    <button class="btn btn-primary" data-page="approvals" style="margin-bottom:1.5rem">Shqyrto Pronat (${pending.length})</button>
    <div class="activity-feed">
      <h4>Audit Log</h4>
      ${audit.map((a) => `
        <div class="activity-item">
          <div class="title">${a.action}</div>
          <div class="meta">${a.details} — ${new Date(a.timestamp).toLocaleString('sq-AL')}</div>
        </div>`).join('') || '<p class="empty-state">Asnjë aktivitet.</p>'}
    </div>`;
}

export function renderAdminApprovalsPage() {
  const pending = getPendingProperties();
  const data = loadData();

  return `
    ${renderBackButton()}
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">Miratimi i Pronave</h2>
    ${pending.length === 0 ? '<div class="empty-state"><p>Nuk ka prona në pritje.</p></div>' : pending.map((p) => {
      const owner = data.users.find((u) => u.id === p.ownerId);
      return `
        <div class="property-row" style="margin-bottom:1rem">
          <div class="property-info">
            <h3>${p.title}</h3>
            <div>${p.address}, ${p.city} — ${formatCurrency(p.rentPrice)}/muaj</div>
            <div class="sub-status">Qeradhënës: ${owner?.fullName}</div>
          </div>
          <div class="property-actions-row">
            <button class="btn btn-primary btn-sm approve-btn" data-id="${p.id}" data-action="approve">Mirato</button>
            <button class="btn btn-danger btn-sm approve-btn" data-id="${p.id}" data-action="reject">Refuzo</button>
          </div>
        </div>`;
    }).join('')}`;
}

export function renderNotificationsPage() {
  const user = getCurrentUserSync();
  const notes = getNotifications(user.id);

  return `
    ${renderBackButton()}
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem">Njoftimet</h2>
    ${notes.length === 0 ? '<div class="empty-state"><p>Nuk ka njoftime.</p></div>' : notes.map((n) => `
      <div class="activity-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <div class="title">${n.type}</div>
        <div class="meta">${n.message}</div>
        <div class="request-meta">${new Date(n.sentAt).toLocaleString('sq-AL')}</div>
      </div>`).join('')}`;
}

export function renderProfilePage() {
  const user = getCurrentUserSync();
  const stats = user.role === 'qiradhënësi' ? getLandlordStats(user.id) : null;

  return `
    ${renderBackButton()}
    <div class="profile-header"><div class="profile-avatar">${user.fullName.charAt(0)}</div><h2>${user.fullName}</h2></div>
    <div class="profile-section">
      <form id="profile-form">
        <div class="form-grid">
          <div class="form-group"><label>Emri</label><input name="fullName" value="${user.fullName}" required /></div>
          <div class="form-group"><label>Email</label><input name="email" type="email" value="${user.email}" required /></div>
          <div class="form-group"><label>Telefon</label><input name="phone" value="${user.phone || ''}" /></div>
          <div class="form-group"><label>Adresa</label><input name="address" value="${user.address || ''}" /></div>
          ${user.role === 'qiramarrësi' ? `
            <div class="form-group"><label>Lloji</label>
              <select name="userType"><option value="student" ${user.userType === 'student' ? 'selected' : ''}>Student</option><option value="employed" ${user.userType === 'employed' ? 'selected' : ''}>I punësuar</option></select>
            </div>
            <div class="form-group"><label>Kampus</label>
              <select name="campusId">${CAMPUSES.map((c) => `<option value="${c.id}" ${user.campusId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            </div>` : ''}
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:1rem">Ruaj</button>
      </form>
    </div>
    <div class="profile-section">
      <form id="password-form">
        <div class="form-grid">
          <div class="form-group"><label>Fjalëkalimi aktual</label><input name="currentPassword" type="password" /></div>
          <div class="form-group"><label>Fjalëkalimi i ri</label><input name="newPassword" type="password" /></div>
          <div class="form-group"><label>Konfirmo</label><input name="confirmPassword" type="password" /></div>
        </div>
        <button type="submit" class="btn btn-outline" style="margin-top:1rem">Ndrysho Fjalëkalimin</button>
      </form>
    </div>
    ${stats ? `<div class="profile-stats-grid">
      <div class="stat-card-white"><div class="label">Prona</div><div class="value">${stats.total}</div></div>
      <div class="stat-card-white"><div class="label">Aktive</div><div class="value">${stats.occupied}</div></div>
    </div>` : ''}`;
}

export function renderAddPropertyPage(property = null) {
  const isEdit = !!property?.id;
  const a = property?.amenities || {};
  const hasExistingPhotos = hasValidPhotos(property?.photos);
  const photoRequired = !isEdit || !hasExistingPhotos;

  return `
    ${renderBackButton('Kthehu', 'home')}
    <h2>${isEdit ? 'Modifiko Banesën' : 'Shto Banesë të Re'}</h2>
    <p class="field-hint" style="margin-bottom:1rem">Pronat e reja dërgohen te administratori për miratim (brenda 24 orëve).</p>
    <form id="property-form">
      <div class="form-section">
        <div class="form-grid">
          <div class="form-group full"><label>Titulli</label><input name="title" required value="${property?.title || ''}" /></div>
          <div class="form-group"><label>Qyteti / Komuna</label>
            <select name="city">${KOSOVO_CITIES.map((c) => `<option ${property?.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Lloji</label>
            <select name="type">
              <option value="apartament" ${property?.type === 'apartament' ? 'selected' : ''}>Apartament</option>
              <option value="shtepi" ${property?.type === 'shtepi' ? 'selected' : ''}>Shtëpi</option>
              <option value="studio" ${property?.type === 'studio' ? 'selected' : ''}>Studio</option>
            </select>
          </div>
          <div class="form-group full"><label>Adresa</label><input name="address" required value="${property?.address || ''}" /></div>
          <div class="form-group"><label>Afër kampusit (opsionale)</label>
            <select name="nearCampus">
              <option value="">—</option>
              ${CAMPUSES.map((c) => `<option value="${c.id}" ${property?.nearCampus === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Dhoma</label><input name="rooms" type="number" min="1" required value="${property?.rooms || ''}" /></div>
          <div class="form-group"><label>Banjë</label><input name="bathrooms" type="number" min="1" required value="${property?.bathrooms || ''}" /></div>
          <div class="form-group"><label>Sipërfaqja m²</label><input name="area" type="number" min="1" required value="${property?.area || ''}" /></div>
          <div class="form-group"><label>Qera €/muaj</label><input name="rentPrice" type="number" min="1" required value="${property?.rentPrice || ''}" /></div>
          <div class="form-group"><label>Depozita €</label><input name="deposit" type="number" min="0" value="${property?.deposit || ''}" /></div>
          <div class="form-group full"><label>Përshkrimi</label><textarea name="description" rows="3">${property?.description || ''}</textarea></div>
          <div class="form-group full">
            <label>Foto <span class="required-mark">*</span> (min 1, max 5, 5MB secila)</label>
            <p class="field-hint">Prona nuk mund të publikohet pa të paktën një foto.</p>
            ${hasExistingPhotos ? `
              <div class="existing-photos-preview">
                ${property.photos.map((ph) => {
                  const src = getPhotoSrc(ph);
                  return src ? `<img src="${src}" alt="${ph.name || ''}" class="photo-preview-thumb" />` : '';
                }).join('')}
              </div>
              <p class="field-hint">Foto aktuale (${property.photos.length}). Ngarkoni foto shtesë (deri në 5 gjithsej) ose lëreni bosh për t'i mbajtur ato aktuale.</p>
            ` : ''}
            <input type="file" name="photos" accept="image/*" multiple ${photoRequired ? 'required' : ''} />
          </div>
        </div>
        <h4 style="margin-top:1rem">Komoditete</h4>
        <div class="amenities-grid">
          ${[['mobiluar', 'Mobiluar'], ['ngrohje', 'Ngrohje'], ['ac', 'AC'], ['parking', 'Parking'], ['ballkon', 'Ballkon'], ['ashensor', 'Ashensor']].map(([k, l]) => `
            <label class="amenity-item"><input type="checkbox" name="amenity_${k}" ${a[k] ? 'checked' : ''} /> ${l}</label>`).join('')}
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-lg btn-block">${isEdit ? 'Ruaj (kërkon miratim)' : 'Dërgo për Miratim'}</button>
    </form>`;
}

export function renderSearchPage(searchState = {}) {
  const user = getCurrentUserSync();
  const page = searchState.page || 1;
  const filters = searchState.filters || {};

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
          <div class="address">${icons.pin} ${p.address}</div>
          <div class="specs">${propertySpecs(p)}</div>
          ${p.nearCampus ? `<div class="sub-status">Afër ${getCampusName(p.nearCampus)}</div>` : ''}
          <div class="price">${formatCurrency(p.rentPrice)}/muaj</div>
          <div class="card-actions">
            <button class="btn btn-outline btn-sm favorite-btn" data-id="${p.id}">${fav ? '★ Heq' : '☆ Ruaj'}</button>
            <button class="btn ${pending ? 'btn-outline' : 'btn-primary'} btn-sm request-contract-btn" data-id="${p.id}" ${pending ? 'disabled' : ''}>
              ${pending ? 'Kërkesa dërguar' : 'Kërko Kontratë'}
            </button>
          </div>
        </div>
      </div>`;
  }

  return `
    ${renderBackButton()}
    <h2>Kërko Banesa</h2>
    <div class="search-filters">
      <div class="form-grid">
        <div class="form-group"><label>Qyteti / Komuna</label><select id="filter-city"><option value="">Të gjitha (gjithë Kosova)</option>${KOSOVO_CITIES.map((c) => `<option value="${c}" ${filters.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Tipi</label><select id="filter-type"><option value="">Të gjitha</option><option value="apartament">Apartament</option><option value="studio">Studio</option><option value="shtepi">Shtëpi</option></select></div>
        <div class="form-group"><label>Çmim max €</label><input id="filter-max-price" type="number" min="0" placeholder="500" value="${filters.maxPrice || ''}" /></div>
        <div class="form-group"><label>Dhoma min</label><input id="filter-min-rooms" type="number" min="1" value="${filters.minRooms || ''}" /></div>
        <div class="form-group"><label>Sipërfaqja min m²</label><input id="filter-min-area" type="number" min="0" value="${filters.minArea || ''}" /></div>
        <div class="form-group"><label>Afër kampusit</label><select id="filter-campus"><option value="">—</option>${CAMPUSES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
        <div class="form-group"><label><input type="checkbox" id="filter-mobiluar" /> Mobiluar</label></div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap">
        <button class="btn btn-primary" id="search-btn">Kërko</button>
        <button class="btn btn-outline" id="agency-btn">Kërko ndihmë nga agjencia</button>
      </div>
    </div>
    <div id="search-meta" style="margin:1rem 0;color:var(--text-muted)">${result.total} rezultate · Faqja ${result.page}/${result.totalPages}</div>
    <div id="search-results" class="search-results-grid">
      ${result.items.length === 0
        ? '<div class="empty-state full-width"><p>Nuk u gjet asnjë banesë. Provoni filtra alternative (zgjeroni lokacionin ose buxhetin).</p></div>'
        : result.items.map(card).join('')}
    </div>
    ${result.totalPages > 1 ? `
      <div class="pagination">
        <button class="btn btn-outline btn-sm" id="prev-page" ${page <= 1 ? 'disabled' : ''}>← Para</button>
        <span>Faqja ${page} / ${result.totalPages}</span>
        <button class="btn btn-outline btn-sm" id="next-page" ${page >= result.totalPages ? 'disabled' : ''}>Tjetra →</button>
      </div>` : ''}`;
}

export function renderFavoritesPage() {
  const user = getCurrentUserSync();
  const favs = getFavorites(user.id);

  return `
    ${renderBackButton()}
    <h2>Të Preferuarat</h2>
    ${favs.length === 0 ? '<div class="empty-state"><p>Nuk keni banesa të ruajtura.</p><button class="btn btn-primary" data-page="search">Kërko Banesa</button></div>' : `
      <div class="search-results-grid">${favs.map((p) => `
        <div class="search-result-card">
          <h3>${p.title}</h3>
          <div>${p.address}</div>
          <div class="price">${formatCurrency(p.rentPrice)}/muaj</div>
          <button class="btn btn-outline btn-sm favorite-btn" data-id="${p.id}">Heq nga lista</button>
        </div>`).join('')}</div>`}`;
}

export function renderPaymentsPage(period = {}) {
  const user = getCurrentUserSync();
  const payments = getExpenses(user.id, user.role, period.from, period.to);
  const report = generateExpenseReport(payments);

  return `
    ${renderBackButton()}
    <h2>Pagesat e Banesës</h2>
    <div class="form-grid" style="margin-bottom:1rem">
      <div class="form-group"><label>Nga data</label><input type="date" id="period-from" value="${period.from || ''}" /></div>
      <div class="form-group"><label>Deri data</label><input type="date" id="period-to" value="${period.to || ''}" /></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-outline btn-sm" id="filter-period">Filtro</button></div>
    </div>
    <div class="stats-row" style="margin-bottom:1rem">
      <div class="stat-card-white"><div class="label">Total</div><div class="value">${formatCurrency(report.total)}</div></div>
      <div class="stat-card-white"><div class="label">Paguar</div><div class="value">${formatCurrency(report.paid)}</div></div>
      <div class="stat-card-white"><div class="label">E vonuar</div><div class="value">${formatCurrency(report.overdue)}</div></div>
    </div>
    <button class="btn btn-outline btn-sm" id="export-payments-pdf" style="margin-bottom:1rem">Shkarko PDF</button>
    ${payments.length === 0 ? '<div class="empty-state"><p>Nuk ka shpenzime për këtë periudhë.</p></div>' : `
      <table>
        <thead><tr><th>Data</th><th>Lloji</th><th>Shuma</th><th>Statusi</th><th>Veprime</th></tr></thead>
        <tbody>${payments.map((p) => `
          <tr>
            <td>${formatDate(p.dueDate)}</td>
            <td>${getExpenseTypeLabel(p.type)}</td>
            <td>${formatCurrency(p.amount)}</td>
            <td><span class="status-badge ${statusBadgeClass(p.status)}">${getPaymentStatusLabel(p.status)}</span>${p.proof ? ' <span class="sub-status">📎 dëshmi</span>' : ''}</td>
            <td>
              ${user.role === 'qiramarrësi' && ['pending', 'overdue'].includes(p.status) ? `<button class="btn btn-primary btn-sm pay-btn" data-id="${p.id}">Ngarko Dëshmi & Paguaj</button>` : ''}
              ${user.role === 'qiramarrësi' && p.status === 'nën_shqyrtim' ? `<span class="sub-status">Në shqyrtim nga qeradhënësi…</span>` : ''}
              ${user.role === 'qiramarrësi' && p.status === 'pending' ? `<button class="btn btn-outline btn-sm dispute-btn" data-id="${p.id}">Ankim</button>` : ''}
              ${user.role === 'qiradhënësi' && ['pending', 'overdue'].includes(p.status) ? `<button class="btn btn-outline btn-sm confirm-cash-btn" data-id="${p.id}">Konfirmo Pagesë Cash</button>` : ''}
              ${user.role === 'qiradhënësi' && p.status === 'disputed' ? `<button class="btn btn-sm resolve-btn" data-id="${p.id}">Zgjidh</button>` : ''}
              ${user.role === 'qiradhënësi' && p.status === 'nën_shqyrtim' ? `
                <button class="btn btn-primary btn-sm review-approve-btn" data-id="${p.id}">✓ Mirato</button>
                <button class="btn btn-outline btn-sm review-reject-btn" data-id="${p.id}">✗ Refuzo</button>
                ${p.proof ? `<a href="${p.proof.dataUrl}" target="_blank" class="btn btn-outline btn-sm">Shiko Dëshmi</a>` : ''}` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`}`;
}

export function showPaymentProofModal(container, payment, onSubmit) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Dëshmi Pagese</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p class="field-hint">Ngarkoni foton/PDF-në e dëshmisë së pagesës (fatura, transferta bankare, etj). Sistemi do ta verifikojë automatikisht nëse dëshmia është adekuate; përndryshe do t'i dërgohet qeradhënësit për shqyrtim.</p>
        <div class="form-group"><label>Shuma: ${formatCurrency(payment.amount)} — ${getExpenseTypeLabel(payment.type)}</label></div>
        <div class="form-group"><input type="file" id="proof-file" accept="image/*,application/pdf" required /></div>
        <div id="proof-error" class="alert alert-warning" style="display:none;margin-top:0.5rem"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline modal-cancel">Anulo</button>
        <button type="button" class="btn btn-primary" id="submit-proof-btn">Dërgo Dëshminë</button>
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
      errBox.textContent = 'Zgjidhni një skedar.';
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
    <h2>Menaxho Shpenzimet</h2>
    <p class="field-hint">Shtoni shpenzime mujore: rrymë, ujë, termokos, etj.</p>
    <form id="expense-form" class="profile-section">
      <div class="form-grid">
        <div class="form-group"><label>Prona</label>
          <select name="propertyId" required>${props.map((p) => `<option value="${p.id}">${p.title}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Lloji</label>
          <select name="type">${EXPENSE_TYPES.filter((t) => t.id !== 'qera').map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Shuma €</label><input name="amount" type="number" min="1" required /></div>
        <div class="form-group"><label>Muaji</label><input name="month" type="month" required /></div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:1rem">Shto Shpenzim</button>
    </form>
    <button class="btn btn-outline" data-page="payments" style="margin-top:1rem">Shiko të gjitha pagesat</button>`;
}

export function renderContractPage() {
  const user = getCurrentUserSync();
  const activeProperties = getTenantProperties(user.id);
  const pending = getPendingContractsForTenant(user.id);
  const data = loadData();

  let html = `${renderBackButton()}<h2>Kontratat</h2>`;

  if (pending.length > 0) {
    html += pending.map((c) => {
      const p = data.properties.find((x) => x.id === c.propertyId);
      const landlord = data.users.find((u) => u.id === c.landlordId);
      return `
        <div class="contract-preview pending-contract" data-id="${c.id}" style="margin-bottom:1.5rem;border:2px solid var(--primary)">
          <strong>KONTRATË PËR NËNSHKRIM</strong><br/><br/>
          Mes: <strong>${landlord?.fullName}</strong> (Qeradhënës) dhe <strong>${user.fullName}</strong> (Qeramarrës)<br/><br/>
          Objekti: ${p?.title} — ${p?.address}<br/>
          Qera: ${formatCurrency(p?.rentPrice)}/muaj<br/>
          Periudha: ${formatDate(c.startDate)} — ${formatDate(c.endDate)}<br/>
          Status: ${getContractStatusLabel(c.status)}<br/>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-blue sign-accept-btn" data-id="${c.id}">✓ Nënshkruaj Digjitalisht</button>
            <button class="btn btn-danger sign-reject-btn" data-id="${c.id}">✗ Refuzoj</button>
            <button class="btn btn-outline download-pending-btn" data-id="${c.id}">Shkarko PDF</button>
          </div>
        </div>`;
    }).join('');
  }

  if (activeProperties.length > 0) {
    html += activeProperties.map(({ contract, property, landlord }) => `
      <div class="contract-preview" style="margin-bottom:1.5rem">
        <strong>KONTRATË AKTIVE</strong><br/><br/>
        Mes: <strong>${landlord?.fullName}</strong> (Qeradhënës) dhe <strong>${user.fullName}</strong> (Qeramarrës)<br/><br/>
        ${property.title} — ${property.address}<br/>
        Qera: ${formatCurrency(property.rentPrice)}<br/>
        Periudha: ${formatDate(contract.startDate)} — ${formatDate(contract.endDate)}<br/>
        Status: ${getContractStatusLabel(contract.status)}<br/>
        ${contract.signature ? `<div class="sub-status">✓ Nënshkruar elektronikisht më ${new Date(contract.signedAt).toLocaleDateString('sq-AL')}</div>` : ''}
        <button class="btn btn-blue download-contract-btn" style="margin-top:1rem" data-id="${contract.id}">Shkarko PDF</button>
      </div>`).join('');
  } else if (pending.length === 0) {
    html += '<div class="empty-state"><p>Nuk keni kontratë aktive.</p></div>';
  }

  return html;
}

export function showSignatureModal(container, contract, onSign) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Nënshkrimi Digjital i Kontratës</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <p class="field-hint">Vizatoni nënshkrimin tuaj më poshtë, ose shkruani emrin tuaj të plotë si nënshkrim.</p>
        <canvas id="signature-canvas" width="400" height="150" style="border:2px dashed var(--border);border-radius:8px;width:100%;max-width:400px;touch-action:none;cursor:crosshair;background:#fff"></canvas>
        <div style="margin-top:0.5rem"><button type="button" class="btn btn-outline btn-sm" id="clear-signature">Pastro</button></div>
        <div class="form-group" style="margin-top:1rem"><label>OSE shkruani emrin e plotë (nënshkrim i shtypur)</label><input id="typed-signature" placeholder="Emri Mbiemri" /></div>
        <label style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem"><input type="checkbox" id="signature-consent" /> Konfirmoj se ky është nënshkrimi im elektronik dhe pranoj kushtet e kontratës.</label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline modal-cancel">Anulo</button>
        <button type="button" class="btn btn-blue" id="confirm-sign-btn">✓ Nënshkruaj & Aktivizo</button>
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
        alert('Duhet të konfirmoni pranimin e kushteve për të vazhduar.');
        return;
      }
      const typedName = modal.querySelector('#typed-signature').value.trim();
      const signature = !pad.isEmpty()
        ? { dataUrl: pad.toDataUrl(), typedName: null }
        : typedName
          ? { dataUrl: null, typedName }
          : null;
      if (!signature) {
        alert('Vizatoni nënshkrimin ose shkruani emrin tuaj të plotë.');
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
    alert('Nuk ka kërkesa nga qeramarrësit.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Gjenero Kontratë — ${property.title}</h3><button class="modal-close">&times;</button></div>
      <form id="contract-form">
        <div class="modal-body">
          <div class="form-group"><label>Qeramarrësi</label>
            <select name="requestId" required>
              ${pendingRequests.map((req) => {
                const tenant = data.users.find((u) => u.id === req.tenantId);
                return `<option value="${req.id}" data-tenant="${req.tenantId}">${tenant?.fullName} (${tenant?.email})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group"><label>Fillimi</label><input name="startDate" type="date" required /></div>
          <div class="form-group"><label>Mbarimi</label><input name="endDate" type="date" required /></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline modal-cancel">Anulo</button>
          <button type="submit" class="btn btn-blue">Gjenero PDF & Dërgo</button>
        </div>
      </form>
    </div>`;
  container.appendChild(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.modal-cancel').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
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
