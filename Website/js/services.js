import {
  loadData,
  saveData,
  saveDataAsync,
  generateId,
  PAGE_SIZE,
  PHOTO_MAX_BYTES,
  OVERDUE_DAYS,
  CAMPUSES,
  KOSOVO_CITIES,
  EXPENSE_TYPES,
  hasValidPhotos,
  getExpenseTypeLabel,
  formatContractNumber,
} from './data.js';
import { getCurrentUserSync } from './auth.js';
import { addNotification, addAuditLog } from './services-core.js';
import { isSupabaseEnabled } from './config.js';
import { uploadPropertyPhotos, uploadPaymentProof, uploadSignature, updatePropertySupabase } from './supabase/sync.js';

const RESERVING_STATUSES = ['pending_signature', 'generated_pdf', 'signed'];

const LANDLORD_VISIBLE_STATUSES = new Set(['publikuar', 'në pritje', 'rezervuar', 'me qera']);

function dedupePropertiesById(list) {
  const seen = new Set();
  return list.filter((p) => {
    if (!p?.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export function addMonthsToDateString(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function ensureContractRequests(data) {
  if (!Array.isArray(data.contractRequests)) data.contractRequests = [];
  return data.contractRequests;
}

export function syncOverduePayments() {
  const data = loadData();
  const now = new Date();
  let changed = false;
  data.payments.forEach((p) => {
    if (p.status !== 'pending' && p.status !== 'created') return;
    const due = new Date(p.dueDate);
    const daysPast = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    if (daysPast > OVERDUE_DAYS && p.status !== 'overdue') {
      p.status = 'overdue';
      changed = true;
      addNotification(
        p.tenantId,
        'borxh',
        `Pagesa ${p.type} (${p.amount}€) ka kaluar ${OVERDUE_DAYS} ditë — status: e vonuar.`
      );
      if (p.landlordId) {
        addNotification(p.landlordId, 'borxh', `Pagesë e vonuar nga qeramarrësi: ${p.amount}€ (${p.type}).`);
      }
    }
  });
  if (changed) saveData(data);
}

export function getUnreadCount(userId) {
  const data = loadData();
  return data.notifications.filter((n) => n.userId === userId && !n.read).length;
}

export function getNotifications(userId) {
  const data = loadData();
  return data.notifications.filter((n) => n.userId === userId).slice(0, 50);
}

export async function markNotificationRead(id) {
  const data = loadData();
  const n = data.notifications.find((x) => x.id === id);
  if (!n || n.read) return false;
  n.read = true;
  if (isSupabaseEnabled()) {
    await saveDataAsync(data);
  } else {
    saveData(data);
  }
  return true;
}

export function hasUnpaidDebt(tenantId) {
  syncOverduePayments();
  const data = loadData();
  return data.payments.some(
    (p) => p.tenantId === tenantId && ['pending', 'overdue', 'disputed'].includes(p.status)
  );
}

export function isPropertyOccupied(propertyId) {
  const data = loadData();
  return data.contracts.some(
    (c) => c.propertyId === propertyId && ['active', 'signed'].includes(c.status)
  );
}

export function isPropertyReserved(propertyId) {
  const data = loadData();
  return data.contracts.some(
    (c) => c.propertyId === propertyId && RESERVING_STATUSES.includes(c.status)
  );
}

export function getPublishedProperties(filters = {}, page = 1) {
  syncOverduePayments();
  const data = loadData();
  let list = dedupePropertiesById(
    data.properties.filter(
      (p) =>
        p.status === 'publikuar' &&
        !isPropertyOccupied(p.id) &&
        !isPropertyReserved(p.id)
    )
  );

  if (filters.city) {
    list = list.filter((p) => p.city.toLowerCase().includes(filters.city.toLowerCase()));
  }
  if (filters.type) list = list.filter((p) => p.type === filters.type);
  if (filters.minRooms) list = list.filter((p) => p.rooms >= Number(filters.minRooms));
  if (filters.maxRooms) list = list.filter((p) => p.rooms <= Number(filters.maxRooms));
  if (filters.minArea) list = list.filter((p) => p.area >= Number(filters.minArea));
  if (filters.maxPrice) list = list.filter((p) => p.rentPrice <= Number(filters.maxPrice));
  if (filters.minPrice) list = list.filter((p) => p.rentPrice >= Number(filters.minPrice));
  if (filters.mobiluar) list = list.filter((p) => p.amenities?.mobiluar);
  if (filters.parking) list = list.filter((p) => p.amenities?.parking);

  list.sort((a, b) => {
    if (filters.budgetSort === 'asc') return a.rentPrice - b.rentPrice;
    if (filters.budgetSort === 'desc') return b.rentPrice - a.rentPrice;
    return a.rentPrice - b.rentPrice;
  });

  const total = list.length;
  const start = (page - 1) * PAGE_SIZE;
  const items = list.slice(start, start + PAGE_SIZE);
  return { items, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) || 1 };
}

export function getOwnerProperties(ownerId) {
  const data = loadData();
  return data.properties.filter((p) => p.ownerId === ownerId);
}

/** Prona të dukshme te paneli i qeradhënësit (pa refuzuar, pa dublikata). */
export function getLandlordDisplayProperties(ownerId) {
  return dedupePropertiesById(
    getOwnerProperties(ownerId).filter((p) => LANDLORD_VISIBLE_STATUSES.has(p.status))
  );
}

export function getPendingProperties() {
  const data = loadData();
  return data.properties.filter((p) => p.status === 'në pritje');
}

export function getLandlordStats(ownerId) {
  const props = getLandlordDisplayProperties(ownerId);
  const occupied = props.filter((p) => isPropertyOccupied(p.id)).length;
  const available = props.filter(
    (p) => p.status === 'publikuar' && !isPropertyOccupied(p.id) && !isPropertyReserved(p.id)
  ).length;
  const monthlyIncome = props
    .filter((p) => isPropertyOccupied(p.id))
    .reduce((s, p) => s + p.rentPrice, 0);
  return { total: props.length, occupied, available, monthlyIncome };
}

export function getTenantCurrentProperty(tenantId) {
  const data = loadData();
  const contract = data.contracts.find(
    (c) => c.tenantId === tenantId && c.status === 'active'
  );
  if (!contract) return null;
  const property = data.properties.find((p) => p.id === contract.propertyId);
  const landlord = data.users.find((u) => u.id === contract.landlordId);
  return { property, contract, landlord };
}

export function getTenantProperties(tenantId) {
  const data = loadData();
  return data.contracts
    .filter((c) => c.tenantId === tenantId && c.status === 'active')
    .map((contract) => ({
      contract,
      property: data.properties.find((p) => p.id === contract.propertyId),
      landlord: data.users.find((u) => u.id === contract.landlordId),
    }))
    .filter((entry) => entry.property);
}

export function getPendingContractsForTenant(tenantId) {
  const data = loadData();
  return data.contracts.filter(
    (c) =>
      c.tenantId === tenantId &&
      (c.status === 'pending_signature' || c.status === 'generated_pdf')
  );
}

export function validatePropertyInput(property) {
  const errors = [];
  if (!property.title?.trim()) errors.push('Titulli është i detyrueshëm.');
  if (!property.address?.trim()) errors.push('Adresa është e detyrueshme.');
  if (!property.city) errors.push('Qyteti është i detyrueshëm.');
  if (!property.rentPrice || property.rentPrice <= 0) errors.push('Çmimi duhet të jetë pozitiv.');
  if (property.rooms < 1) errors.push('Numri i dhomave duhet të jetë ≥ 1.');
  if (property.area < 1) errors.push('Sipërfaqja duhet të jetë ≥ 1 m².');
  if (!hasValidPhotos(property.photos)) errors.push('Duhet të ngarkoni të paktën 1 foto për publikim.');
  if (property.photos?.length > 5) errors.push('Maksimumi 5 foto.');
  return errors;
}

export async function saveProperty(property) {
  const data = loadData();
  const user = getCurrentUserSync();
  if (!user) return { success: false, error: 'Duhet të jeni i kyçur.' };
  const errors = validatePropertyInput(property);
  if (errors.length) return { success: false, error: errors.join(' ') };

  const existing = data.properties.find((p) => p.id === property.id);

  if (existing) {
    const wasPublished = existing.status === 'publikuar';
    Object.assign(existing, property);
    if (wasPublished) existing.status = 'në pritje';
    existing.updatedAt = new Date().toISOString();

    if (isSupabaseEnabled()) {
      try {
        existing.photos = await uploadPropertyPhotos(user.id, existing.id, existing.photos);
      } catch (err) {
        return { success: false, error: err.message || 'Gabim gjatë ngarkimit të fotove.' };
      }
    }

    const admin = data.users.find((u) => u.role === 'administrator');
    if (admin) {
      addNotification(admin.id, 'miratim', `Prona "${existing.title}" kërkon miratim pas ndryshimit.`);
    }
    addAuditLog('property_update', user.id, `Përditësim pronë: ${existing.title}`);
    try {
      await saveDataAsync(data);
    } catch (err) {
      return { success: false, error: err.message || 'Gabim gjatë ruajtjes në server.' };
    }
    return { success: true, property: existing, pendingApproval: true };
  }

  const newProp = {
    ...property,
    id: property.id || generateId('p'),
    ownerId: user.id,
    status: 'në pritje',
    occupied: false,
    createdAt: new Date().toISOString().slice(0, 10),
    amenities: property.amenities || {},
    photos: property.photos || [],
    nearCampus: property.nearCampus || '',
  };

  if (isSupabaseEnabled()) {
    try {
      newProp.photos = await uploadPropertyPhotos(user.id, newProp.id, newProp.photos);
    } catch (err) {
      return { success: false, error: err.message || 'Gabim gjatë ngarkimit të fotove.' };
    }
  }

  data.properties.push(newProp);
  const admin = data.users.find((u) => u.role === 'administrator');
  if (admin) {
    addNotification(admin.id, 'miratim', `Pronë e re për miratim: "${newProp.title}".`);
  }
  addAuditLog('property_create', user.id, `Pronë e re: ${newProp.title}`);
  try {
    await saveDataAsync(data);
  } catch (err) {
    data.properties.pop();
    return { success: false, error: err.message || 'Gabim gjatë ruajtjes në server.' };
  }
  return { success: true, property: newProp, pendingApproval: true };
}

export function deleteProperty(id) {
  const data = loadData();
  const user = getCurrentUserSync();
  const prop = data.properties.find((p) => p.id === id);

  if (isPropertyOccupied(id)) {
    return { success: false, error: 'Nuk mund të fshihet — ka kontratë aktive.' };
  }
  if (isPropertyReserved(id)) {
    return { success: false, error: 'Nuk mund të fshihet — prona është e rezervuar.' };
  }

  const hasDebt = data.payments.some(
    (p) => p.propertyId === id && ['pending', 'overdue', 'disputed'].includes(p.status)
  );
  if (hasDebt) {
    return { success: false, error: 'Nuk mund të fshihet — ka borxhe të hapura për këtë pronë.' };
  }

  data.properties = data.properties.filter((p) => p.id !== id);
  addAuditLog('property_delete', user?.id, `Fshirje pronë: ${prop?.title}`);
  saveData(data);
  return { success: true };
}

export async function approveProperty(id, approved, reason = '') {
  const data = loadData();
  const user = getCurrentUserSync();
  const prop = data.properties.find((p) => p.id === id);
  if (!prop) return { success: false, error: 'Prona nuk u gjet.' };

  if (approved && !hasValidPhotos(prop.photos)) {
    return { success: false, error: 'Nuk mund të miratohet — prona nuk ka foto të ngarkuara.' };
  }

  prop.status = approved ? 'publikuar' : 'refuzuar';
  prop.updatedAt = new Date().toISOString();
  if (!approved) prop.rejectReason = reason;
  else delete prop.rejectReason;

  addNotification(
    prop.ownerId,
    approved ? 'sukses' : 'refuzim',
    approved
      ? `Prona "${prop.title}" u miratua nga administratori dhe u publikua në platformë.`
      : `Prona "${prop.title}" u refuzua nga administratori.${reason ? ` Arsyeja: ${reason}` : ''} Nuk shfaqet në platformë.`,
    data
  );
  data.auditLog.unshift({
    id: generateId('log'),
    action: approved ? 'property_approved' : 'property_rejected',
    userId: user?.id,
    details: `${prop.title} — ${approved ? 'miratuar' : 'refuzuar'}`,
    timestamp: new Date().toISOString(),
  });
  if (data.auditLog.length > 200) data.auditLog.length = 200;

  try {
    await updatePropertySupabase(prop);
    await saveDataAsync(data);
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë ruajtjes në server.' };
  }
  return { success: true };
}

export function toggleFavorite(propertyId) {
  const user = getCurrentUserSync();
  const data = loadData();
  const property = data.properties.find((p) => p.id === propertyId);

  if (!property || property.status !== 'publikuar') {
    return { success: false, error: 'Banesa nuk është e disponueshme.' };
  }
  if (isPropertyOccupied(propertyId)) {
    return { success: false, error: 'Banesa nuk është e lirë — nuk mund të ruhet te të preferuarat.' };
  }
  if (isPropertyReserved(propertyId)) {
    return { success: false, error: 'Banesa është e rezervuar.' };
  }

  const idx = data.favorites.findIndex((f) => f.userId === user.id && f.propertyId === propertyId);
  if (idx >= 0) {
    data.favorites.splice(idx, 1);
    saveData(data);
    return { success: true, added: false };
  }
  data.favorites.push({ userId: user.id, propertyId, savedAt: new Date().toISOString() });
  saveData(data);
  return { success: true, added: true };
}

export function getFavorites(userId) {
  const data = loadData();
  return dedupePropertiesById(
    data.favorites
      .filter((f) => f.userId === userId)
      .map((f) => data.properties.find((p) => p.id === f.propertyId))
      .filter(
        (p) =>
          p &&
          p.status === 'publikuar' &&
          !isPropertyOccupied(p.id) &&
          !isPropertyReserved(p.id)
      )
  );
}

export function isFavorite(userId, propertyId) {
  const data = loadData();
  return data.favorites.some((f) => f.userId === userId && f.propertyId === propertyId);
}

export function getPendingRequestsForProperty(propertyId) {
  const data = loadData();
  return ensureContractRequests(data).filter(
    (r) =>
      r.propertyId === propertyId &&
      r.status === 'në pritje' &&
      data.properties.some((p) => p.id === propertyId)
  );
}

export function getPendingRequestsForLandlord(landlordId) {
  const data = loadData();
  return ensureContractRequests(data).filter(
    (r) =>
      r.landlordId === landlordId &&
      r.status === 'në pritje' &&
      data.properties.some((p) => p.id === r.propertyId)
  );
}

export function hasTenantPendingRequest(tenantId, propertyId) {
  const data = loadData();
  return ensureContractRequests(data).some(
    (r) => r.tenantId === tenantId && r.propertyId === propertyId && r.status === 'në pritje'
  );
}

export async function requestContract(propertyId) {
  const user = getCurrentUserSync();
  if (user.role !== 'qiramarrësi') {
    return { success: false, error: 'Vetëm qeramarrësit mund të kërkojnë kontratë.' };
  }

  const data = loadData();
  const requests = ensureContractRequests(data);
  const property = data.properties.find((p) => p.id === propertyId);

  if (!property || property.status !== 'publikuar') {
    return { success: false, error: 'Banesa nuk është e disponueshme.' };
  }
  if (isPropertyOccupied(propertyId) || isPropertyReserved(propertyId)) {
    return { success: false, error: 'Banesa nuk është e lirë.' };
  }

  if (requests.some((r) => r.tenantId === user.id && r.propertyId === propertyId && r.status === 'në pritje')) {
    return { success: false, error: 'Keni dërguar tashmë kërkesë për këtë banesë.' };
  }

  const request = {
    id: generateId('req'),
    propertyId,
    tenantId: user.id,
    landlordId: property.ownerId,
    status: 'në pritje',
    createdAt: new Date().toISOString(),
  };

  requests.push(request);
  addNotification(
    property.ownerId,
    'kërkesë',
    `${user.fullName} kërkoi kontratë për "${property.title}". Shkoni te paneli për ta gjeneruar.`,
    data
  );
  addNotification(
    user.id,
    'kërkesë',
    `Kërkesa juaj për "${property.title}" u dërgua te qeradhënësi.`,
    data
  );
  data.auditLog.unshift({
    id: generateId('log'),
    action: 'contract_request',
    userId: user.id,
    details: `Kërkesë kontrate për ${property.title}`,
    timestamp: new Date().toISOString(),
  });
  if (data.auditLog.length > 200) data.auditLog.length = 200;
  try {
    await saveDataAsync(data);
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë dërgimit të kërkesës.' };
  }
  return { success: true, request };
}

function nextContractNumber(data) {
  const nums = (data.contracts || [])
    .map((c) => c.contractNumber)
    .filter((n) => typeof n === 'number' && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export async function createContract({ propertyId, tenantId, startDate, endDate, requestId, landlordSignature }) {
  const data = loadData();
  const user = getCurrentUserSync();
  const property = data.properties.find((p) => p.id === propertyId);
  const tenant = data.users.find((u) => u.id === tenantId);
  const requests = ensureContractRequests(data);

  if (!property || !tenant) return { success: false, error: 'Të dhënat e pamjaftueshme.' };
  if (property.ownerId !== user.id) return { success: false, error: 'Nuk keni leje për këtë pronë.' };
  if (isPropertyOccupied(propertyId)) {
    return { success: false, error: 'Ka kontratë ekzistuese për këtë banesë.' };
  }

  if (hasUnpaidDebt(tenantId)) {
    return { success: false, error: 'Ky qeramarrës ka ende borxhe të papaguara.' };
  }

  const request = requests.find(
    (r) =>
      r.id === requestId &&
      r.propertyId === propertyId &&
      r.tenantId === tenantId &&
      r.landlordId === user.id &&
      r.status === 'në pritje'
  );

  if (!request) {
    return {
      success: false,
      error: 'Nuk mund të gjeneroni kontratë pa kërkesë nga qeramarrësi.',
    };
  }

  const hasLandlordDrawn = landlordSignature?.dataUrl;
  const hasLandlordTyped = landlordSignature?.typedName?.trim();
  if (!hasLandlordDrawn && !hasLandlordTyped) {
    return { success: false, error: 'Kërkohet nënshkrimi digjital i qeradhënësit.' };
  }

  const effectiveStartDate =
    startDate || request.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const effectiveEndDate =
    endDate || addMonthsToDateString(effectiveStartDate, 12);

  const contract = {
    id: generateId('c'),
    contractNumber: nextContractNumber(data),
    propertyId,
    landlordId: user.id,
    tenantId,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    status: 'pending_signature',
    requestId: request.id,
    pdfUrl: null,
    createdAt: new Date().toISOString(),
    partiesSummary: `Kontratë mes ${user.fullName} (Qeradhënës) dhe ${tenant.fullName} (Qeramarrës)`,
    landlordSignature: {
      dataUrl: hasLandlordDrawn || null,
      typedName: hasLandlordTyped || null,
      signedAt: new Date().toISOString(),
    },
  };

  if (isSupabaseEnabled() && hasLandlordDrawn) {
    try {
      contract.landlordSignature = await uploadSignature(
        user.id,
        contract.id,
        contract.landlordSignature,
        'landlord'
      );
    } catch (err) {
      return { success: false, error: err.message || 'Gabim gjatë ruajtjes së nënshkrimit të qeradhënësit.' };
    }
  }

  data.contracts.push(contract);
  request.status = 'kontratë_gjeneruar';
  request.contractId = contract.id;
  request.resolvedAt = new Date().toISOString();
  property.status = 'rezervuar';

  addNotification(
    tenantId,
    'kontratë',
    `Qeradhënësi dërgoi kontratë për "${property.title}". Nënshkruani te faqja Kontratat.`,
    data
  );
  addNotification(
    user.id,
    'kontratë',
    `Kontrata për "${property.title}" u dërgua te ${tenant.fullName} për nënshkrim.`,
    data
  );
  data.auditLog.unshift({
    id: generateId('log'),
    action: 'contract_generated',
    userId: user.id,
    details: `Kontratë ${contract.id} për ${property.title}`,
    timestamp: new Date().toISOString(),
  });
  if (data.auditLog.length > 200) data.auditLog.length = 200;

  try {
    await saveDataAsync(data);
  } catch (err) {
    console.error('createContract sync:', err);
    return { success: false, error: 'Kontrata nuk u ruajt në server. Provoni përsëri.' };
  }
  return { success: true, contract };
}

export async function signContract(contractId, accepted, signature = null) {
  const data = loadData();
  const user = getCurrentUserSync();
  const contract = data.contracts.find((c) => c.id === contractId);
  if (!contract) return { success: false, error: 'Kontrata nuk u gjet.' };
  if (contract.tenantId !== user.id) return { success: false, error: 'Nuk keni leje.' };
  if (contract.status !== 'pending_signature') {
    return { success: false, error: 'Kontrata nuk pret nënshkrim.' };
  }

  const property = data.properties.find((p) => p.id === contract.propertyId);

  if (!accepted) {
    contract.status = 'cancelled';
    if (property) property.status = 'publikuar';
    const request = ensureContractRequests(data).find((r) => r.id === contract.requestId);
    if (request) {
      request.status = 'në pritje';
      request.contractId = null;
      request.resolvedAt = null;
    }
    addNotification(
      contract.landlordId,
      'kontratë',
      `Qeramarrësi refuzoi nënshkrimin e kontratës për "${property?.title || 'banesë'}".`,
      data
    );
    addNotification(contract.tenantId, 'kontratë', 'Ju refuzuat kontratën.', data);
    data.auditLog.unshift({
      id: generateId('log'),
      action: 'contract_refused',
      userId: user.id,
      details: `Refuzim kontrate ${contractId}`,
      timestamp: new Date().toISOString(),
    });
    if (data.auditLog.length > 200) data.auditLog.length = 200;
    await saveDataAsync(data);
    return { success: true, refused: true };
  }

  const hasDrawnSignature = signature?.dataUrl;
  const hasTypedSignature = signature?.typedName?.trim();
  if (!hasDrawnSignature && !hasTypedSignature) {
    return { success: false, error: 'Kërkohet nënshkrimi digjital (vizatoni ose shkruani emrin tuaj të plotë).' };
  }

  let finalSignature = {
    dataUrl: hasDrawnSignature || null,
    typedName: hasTypedSignature || null,
    signedAt: new Date().toISOString(),
  };

  if (isSupabaseEnabled() && hasDrawnSignature) {
    try {
      finalSignature = await uploadSignature(user.id, contractId, finalSignature, 'tenant');
    } catch (err) {
      return { success: false, error: err.message || 'Gabim gjatë ruajtjes së nënshkrimit.' };
    }
  }

  contract.signature = finalSignature;
  contract.status = 'signed';
  contract.signedAt = new Date().toISOString();
  contract.pdfUrl = `#pdf-${contract.id}`;

  const start = new Date(contract.startDate);
  const now = new Date();
  if (now >= start) contract.status = 'active';

  if (property) {
    property.occupied = contract.status === 'active';
    property.status = contract.status === 'active' ? 'me qera' : 'rezervuar';
  }

  generateContractPayments(contract, property, data);
  checkContractRenewal(contract, data);

  const title = property?.title || 'banesë';
  addNotification(
    contract.landlordId,
    'kontratë',
    `Qeramarrësi ${user.fullName} nënshkroi kontratën për "${title}".`,
    data
  );
  addNotification(
    contract.tenantId,
    'kontratë',
    `Kontrata për "${title}" u aktivizua. Pagesat e qerasë fillojnë nga data e nënshkrimit.`,
    data
  );
  data.auditLog.unshift({
    id: generateId('log'),
    action: 'contract_signed',
    userId: user.id,
    details: `Nënshkrim kontrate ${contractId}`,
    timestamp: new Date().toISOString(),
  });
  if (data.auditLog.length > 200) data.auditLog.length = 200;

  try {
    await saveDataAsync(data);
  } catch (err) {
    return { success: false, error: err.message || 'Gabim gjatë ruajtjes së kontratës.' };
  }
  return { success: true, contract };
}

function generateContractPayments(contract, property, data = loadData()) {
  const signedAt = contract.signedAt ? new Date(contract.signedAt) : new Date();
  const end = new Date(contract.endDate);
  let current = new Date(signedAt.getFullYear(), signedAt.getMonth(), 1);
  const dueDay = signedAt.getDate();

  while (current <= end) {
    const month = current.toISOString().slice(0, 7);
    const dueDate = `${month}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`;

    const exists = data.payments.some(
      (p) => p.contractId === contract.id && p.month === month && p.type === 'qera'
    );
    if (!exists) {
      data.payments.push({
        id: generateId('pay'),
        contractId: contract.id,
        propertyId: contract.propertyId,
        tenantId: contract.tenantId,
        landlordId: contract.landlordId,
        amount: property?.rentPrice || 350,
        dueDate,
        status: 'pending',
        type: 'qera',
        month,
      });
    }

    current.setMonth(current.getMonth() + 1);
  }
}

function checkContractRenewal(contract, data = null) {
  const end = new Date(contract.endDate);
  const now = new Date();
  const daysLeft = Math.floor((end - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 30 && daysLeft > 0) {
    addNotification(
      contract.landlordId,
      'rinovim',
      `Kontrata ${contract.id} skadon në ${daysLeft} ditë — sugjerim rinovimi automatik.`,
      data
    );
    addNotification(
      contract.tenantId,
      'rinovim',
      `Kontrata juaj skadon në ${daysLeft} ditë. Kontaktoni qeradhënësin për rinovim.`,
      data
    );
  }
}

export function markPaymentPaid(paymentId) {
  const data = loadData();
  const user = getCurrentUserSync();
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Pagesa nuk u gjet.' };
  if (user.role !== 'qiradhënësi' && user.role !== 'administrator') {
    return { success: false, error: 'Vetëm qeradhënësi mund ta konfirmojë pagesën direkt.' };
  }
  payment.status = 'paguar';
  payment.paidAt = new Date().toISOString();
  payment.verifiedBy = user.fullName;
  addAuditLog('payment_paid', user.id, `Pagesë ${paymentId} u shënua si paguar.`);
  saveData(data);
  return { success: true };
}

function isProofAdequate(proof) {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
  if (!proof?.dataUrl) return false;
  if (proof.type && !validTypes.includes(proof.type)) return false;
  if (!proof.size || proof.size < 200) return false;
  return true;
}

export async function submitPaymentProof(paymentId, proof) {
  const data = loadData();
  const user = getCurrentUserSync();
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Pagesa nuk u gjet.' };
  if (payment.tenantId !== user.id) return { success: false, error: 'Nuk keni leje për këtë pagesë.' };
  if (!['pending', 'overdue', 'nën_shqyrtim'].includes(payment.status)) {
    return { success: false, error: 'Kjo pagesë nuk pret dëshmi pagese.' };
  }
  if (!proof?.dataUrl) {
    return { success: false, error: 'Duhet të ngarkoni një dëshmi pagese (foto ose PDF, deri 5MB).' };
  }
  if (proof.size > PHOTO_MAX_BYTES) {
    return { success: false, error: 'Dëshmia e pagesës tejkalon 5MB.' };
  }

  let storedProof = { name: proof.name, dataUrl: proof.dataUrl, type: proof.type, uploadedAt: new Date().toISOString(), size: proof.size };

  if (isSupabaseEnabled()) {
    try {
      storedProof = await uploadPaymentProof(user.id, paymentId, proof);
    } catch (err) {
      return { success: false, error: err.message || 'Gabim gjatë ngarkimit të dëshmisë.' };
    }
  }

  payment.proof = storedProof;

  if (isProofAdequate(proof)) {
    payment.status = 'paguar';
    payment.paidAt = new Date().toISOString();
    payment.verifiedBy = 'Sistemi (automatik)';
    addNotification(
      payment.landlordId,
      'pagesë',
      `Pagesa (${payment.amount}€, ${getExpenseTypeLabel(payment.type)}) u verifikua automatikisht nga sistemi bazuar në dëshminë e ngarkuar.`
    );
    addAuditLog('payment_verified', user.id, `Pagesë ${paymentId} u verifikua automatikisht.`);
    saveData(data);
    return { success: true, approved: true };
  }

  payment.status = 'nën_shqyrtim';
  addNotification(
    payment.landlordId,
    'pagesë',
    `Dëshmi pagese e re kërkon shqyrtimin tuaj (${payment.amount}€, ${getExpenseTypeLabel(payment.type)}).`
  );
  addAuditLog('payment_proof_submitted', user.id, `Dëshmi pagese për ${paymentId} — kërkon shqyrtim manual.`);
  saveData(data);
  return { success: true, approved: false, pendingReview: true };
}

export function reviewPaymentProof(paymentId, approve) {
  const data = loadData();
  const user = getCurrentUserSync();
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== 'nën_shqyrtim') {
    return { success: false, error: 'Pagesa nuk pret shqyrtim.' };
  }
  if (approve) {
    payment.status = 'paguar';
    payment.paidAt = new Date().toISOString();
    payment.verifiedBy = user.fullName;
    addNotification(payment.tenantId, 'pagesë', 'Dëshmia juaj e pagesës u miratua nga qeradhënësi.');
  } else {
    payment.status = 'pending';
    addNotification(payment.tenantId, 'pagesë', 'Dëshmia e pagesës u refuzua. Ngarkoni një dëshmi tjetër.');
  }
  addAuditLog('payment_proof_reviewed', user.id, `Pagesë ${paymentId} — ${approve ? 'miratuar' : 'refuzuar'} nga qeradhënësi.`);
  saveData(data);
  return { success: true };
}

export function disputePayment(paymentId, reason) {
  const data = loadData();
  const user = getCurrentUserSync();
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Pagesa nuk u gjet.' };
  payment.status = 'disputed';
  payment.disputeReason = reason || '';
  addNotification(payment.landlordId, 'mosmarrëveshje', `Mosmarrëveshje për pagesën ${payment.type}: ${reason || '—'}`);
  addAuditLog('payment_disputed', user.id, `Mosmarrëveshje ${paymentId}`);
  saveData(data);
  return { success: true };
}

export function resolveDispute(paymentId, accept) {
  const data = loadData();
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== 'disputed') {
    return { success: false, error: 'Pagesa nuk është në mosmarrëveshje.' };
  }
  payment.status = accept ? 'paguar' : 'pending';
  if (accept) payment.paidAt = new Date().toISOString();
  saveData(data);
  return { success: true };
}

export function addMonthlyExpense({ propertyId, type, amount, month, tenantId }) {
  const data = loadData();
  const user = getCurrentUserSync();
  const property = data.properties.find((p) => p.id === propertyId);
  if (!property || property.ownerId !== user.id) {
    return { success: false, error: 'Nuk keni leje për këtë pronë.' };
  }
  if (!EXPENSE_TYPES.find((t) => t.id === type)) {
    return { success: false, error: 'Lloji i shpenzimit është i pavlefshëm.' };
  }

  const contract = data.contracts.find(
    (c) => c.propertyId === propertyId && c.status === 'active'
  );
  const dueMonth = month || new Date().toISOString().slice(0, 7);
  const payment = {
    id: generateId('pay'),
    contractId: contract?.id || null,
    propertyId,
    tenantId: tenantId || contract?.tenantId,
    landlordId: user.id,
    amount: Number(amount),
    dueDate: `${dueMonth}-15`,
    status: 'pending',
    type,
    month: dueMonth,
  };
  data.payments.push(payment);
  if (payment.tenantId) {
    addNotification(payment.tenantId, 'shpenzim', `Shpenzim i ri ${type}: ${amount}€ për ${dueMonth}.`);
  }
  addAuditLog('expense_added', user.id, `${type} ${amount}€ — ${property.title}`);
  saveData(data);
  return { success: true, payment };
}

export function getExpenses(userId, role, fromDate, toDate) {
  syncOverduePayments();
  const data = loadData();
  let payments = [...data.payments];

  if (role === 'qiramarrësi') payments = payments.filter((p) => p.tenantId === userId);
  else if (role === 'qiradhënësi') {
    const ownerProps = data.properties.filter((p) => p.ownerId === userId).map((p) => p.id);
    payments = payments.filter((p) => ownerProps.includes(p.propertyId));
  }

  if (fromDate) payments = payments.filter((p) => p.dueDate >= fromDate);
  if (toDate) payments = payments.filter((p) => p.dueDate <= toDate);

  return payments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function generateExpenseReport(payments) {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const paid = payments.filter((p) => p.status === 'paguar').reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
  return { total, paid, pending: total - paid, overdue, count: payments.length };
}

export function processPhotos(files) {
  return Promise.all(
    [...files].slice(0, 5).map(
      (file) =>
        new Promise((resolve, reject) => {
          if (file.size > PHOTO_MAX_BYTES) {
            reject(new Error(`Foto "${file.name}" tejkalon 5MB.`));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}

export function getAuditLog(limit = 50) {
  const data = loadData();
  return data.auditLog.slice(0, limit);
}

export {
  loadData,
  formatDate,
  formatCurrency,
  getFirstName,
  monthsUntil,
  getExpenseTypeLabel,
  getContractStatusLabel,
  getPaymentStatusLabel,
  getCampusName,
  getPhotoSrc,
  hasValidPhotos,
  CAMPUSES,
  KOSOVO_CITIES,
  EXPENSE_TYPES,
  PAGE_SIZE,
} from './data.js';
