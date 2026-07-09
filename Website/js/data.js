import { isSupabaseEnabled } from './config.js';
import { t, locale } from './i18n.js';
import { loadAllFromSupabase, loadVolatileFromSupabase, syncAllToSupabase, fetchContractsForCurrentUser, fetchPropertiesByIds } from './supabase/sync.js';

export const PAGE_SIZE = 20;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const OVERDUE_DAYS = 30;

export const CAMPUSES = [
  { id: 'up', name: 'Universiteti i Prishtinës', city: 'Prishtinë' },
  { id: 'uibm', name: 'UIBM', city: 'Prishtinë' },
  { id: 'ubt', name: 'UBT', city: 'Prishtinë' },
  { id: 'upz', name: 'UPZ — Prizren', city: 'Prizren' },
];

// Të gjitha 38 komunat e Republikës së Kosovës — platforma është e disponueshme në secilën.
export const KOSOVO_CITIES = [
  'Prishtinë',
  'Prizren',
  'Pejë',
  'Gjakovë',
  'Mitrovicë',
  'Ferizaj',
  'Gjilan',
  'Vushtrri',
  'Podujevë',
  'Suharekë',
  'Rahovec',
  'Lipjan',
  'Drenas',
  'Skenderaj',
  'Deçan',
  'Istog',
  'Kamenicë',
  'Viti',
  'Malishevë',
  'Dragash',
  'Shtime',
  'Klinë',
  'Obiliq',
  'Fushë Kosovë',
  'Kaçanik',
  'Shtërpcë',
  'Novobërdë',
  'Zubin Potok',
  'Zveçan',
  'Leposaviq',
  'Mitrovicë e Veriut',
  'Junik',
  'Mamushë',
  'Graçanicë',
  'Ranillug',
  'Partesh',
  'Kllokot',
  'Hani i Elezit',
];

export const defaultData = {
  users: [],
  properties: [],
  favorites: [],
  contractRequests: [],
  contracts: [],
  payments: [],
  notifications: [],
  agencyRequests: [],
  auditLog: [],
  adminStats: { totalProperties: 0, activeUsers: 0, pendingApproval: 0 },
  activityFeed: [],
};

export function getPhotoSrc(photo) {
  if (!photo) return '';
  return photo.url || photo.dataUrl || '';
}

export function hasValidPhotos(photos) {
  return Array.isArray(photos) && photos.length > 0 && photos.some((p) => getPhotoSrc(p));
}

export const EXPENSE_TYPES = [
  { id: 'qera', label: 'Qera' },
  { id: 'rryme', label: 'Rrymë' },
  { id: 'uji', label: 'Ujë' },
  { id: 'termokos', label: 'Termokos' },
  { id: 'mbeturina', label: 'Mbeturina' },
  { id: 'mirembajtje', label: 'Mirëmbajtje' },
  { id: 'depozite', label: 'Depozitë' },
];

export const CONTRACT_STATUSES = {
  draft: 'Draft',
  generated_pdf: 'PDF i gjeneruar',
  pending_signature: 'Në pritje të nënshkrimit',
  signed: 'Nënshkruar',
  active: 'Aktive',
  cancelled: 'Anuluar',
  expired: 'Skaduar',
  terminated: 'Përfunduar parakohshëm',
  archived: 'Arkivuar',
};

export const PAYMENT_STATUSES = {
  created: 'Krijuar',
  pending: 'Në pritje',
  nën_shqyrtim: 'Dëshmi në shqyrtim',
  paguar: 'Paguar',
  overdue: 'E vonuar',
  disputed: 'Mosmarrëveshje',
  archived: 'Arkivuar',
};

function cloneData(data) {
  if (typeof structuredClone === 'function') return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
}

function normalizeContractStatus(status) {
  const map = {
    aktive: 'active',
    'në pritje': 'pending_signature',
    nënshkruar: 'signed',
    anuluar: 'cancelled',
  };
  return map[status] || status;
}

function normalizePaymentStatus(status) {
  const map = { 'në pritje': 'pending' };
  return map[status] || status;
}

function migrateData(data) {
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.properties)) data.properties = [];
  if (!Array.isArray(data.favorites)) data.favorites = [];
  if (!Array.isArray(data.contractRequests)) data.contractRequests = [];
  if (!Array.isArray(data.contracts)) data.contracts = [];
  if (!Array.isArray(data.payments)) data.payments = [];
  if (!Array.isArray(data.notifications)) data.notifications = [];
  if (!Array.isArray(data.auditLog)) data.auditLog = [];
  if (!Array.isArray(data.agencyRequests)) data.agencyRequests = [];

  data.contracts.forEach((c) => {
    c.status = normalizeContractStatus(c.status);
  });

  data.payments.forEach((p) => {
    p.status = normalizePaymentStatus(p.status);
    if (p.type === 'qira') p.type = 'qera';
    if (!p.landlordId && p.propertyId) {
      const prop = data.properties.find((x) => x.id === p.propertyId);
      if (prop) p.landlordId = prop.ownerId;
    }
    if (!p.month && p.dueDate) p.month = p.dueDate.slice(0, 7);
  });

  data.notifications.forEach((n) => {
    n.read = !!n.read;
  });

  data.properties.forEach((p) => {
    if (p.status === 'me qira') p.status = 'me qera';
    if (!p.photos) p.photos = [];
    delete p.preferredTenantType;
    if (!p.nearCampus) p.nearCampus = '';
  });

  data.users.forEach((u) => {
    if (!u.userType) u.userType = u.role === 'qiramarrësi' ? 'student' : 'employed';
    if (u.twoFactorEnabled === undefined) u.twoFactorEnabled = false;
  });

  const propertyIds = new Set(data.properties.map((p) => p.id));
  data.favorites = data.favorites.filter((f) => propertyIds.has(f.propertyId));
  data.contractRequests = data.contractRequests.filter((r) => propertyIds.has(r.propertyId));
  data.contracts = data.contracts.filter((c) => !c.propertyId || propertyIds.has(c.propertyId));
  data.payments = data.payments.filter((p) => !p.propertyId || propertyIds.has(p.propertyId));
  data.agencyRequests = [];

  return data;
}

let memoryCache = null;
let syncInFlight = null;

export function loadData() {
  if (memoryCache) return migrateData(cloneData(memoryCache));
  return migrateData(cloneData(defaultData));
}

const LOAD_TIMEOUT_MS = 28000;
const VOLATILE_TIMEOUT_MS = 12000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Koha e ngarkimit skadoi. Provoni përsëri.')), ms);
    }),
  ]);
}

export async function loadDataAsync(retries = 1) {
  if (!isSupabaseEnabled()) {
    throw new Error('Aplikacioni kërkon lidhje me serverin.');
  }

  for (let i = 0; i <= retries; i++) {
    try {
      memoryCache = migrateData(await withTimeout(loadAllFromSupabase(), LOAD_TIMEOUT_MS));
      return memoryCache;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return loadData();
}

/** Bashkon listat nga serveri me cache lokale — mos fshi rekordet që s'janë sync-uar ende. */
function mergeEntityList(local = [], remote = []) {
  const byId = new Map();
  for (const item of local) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const item of remote) {
    if (item?.id) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function mergeVolatileIntoCache(cache, volatile) {
  return {
    ...cache,
    properties: mergeEntityList(cache.properties, volatile.properties),
    favorites: mergeEntityList(cache.favorites, volatile.favorites),
    contractRequests: mergeEntityList(cache.contractRequests, volatile.contractRequests),
    contracts: mergeEntityList(cache.contracts, volatile.contracts),
    payments: mergeEntityList(cache.payments, volatile.payments),
    notifications: mergeEntityList(cache.notifications, volatile.notifications),
    auditLog: mergeEntityList(cache.auditLog, volatile.auditLog),
  };
}

/** Ngarko kontratat + pronat e lidhura për përdoruesin aktual (qiramarrës/qeradhënës). */
export async function refreshContractsAsync() {
  if (!isSupabaseEnabled()) return memoryCache;
  if (!memoryCache) return loadDataAsync(1);

  const contracts = await fetchContractsForCurrentUser();
  const propertyIds = contracts.map((c) => c.propertyId).filter(Boolean);
  const properties = propertyIds.length ? await fetchPropertiesByIds(propertyIds) : [];

  memoryCache = migrateData({
    ...memoryCache,
    contracts: mergeEntityList(memoryCache.contracts, contracts),
    properties: mergeEntityList(memoryCache.properties, properties),
  });
  refreshAdminStats(memoryCache);
  return memoryCache;
}

/** Rifreskim i shpejtë në sfond — përditëson cache, pa fshirë të dhëna lokale. */
export async function refreshDataAsync() {
  if (!isSupabaseEnabled()) {
    throw new Error('Aplikacioni kërkon lidhje me serverin.');
  }
  if (!memoryCache) return loadDataAsync(1);

  const volatile = await withTimeout(loadVolatileFromSupabase(), VOLATILE_TIMEOUT_MS);
  memoryCache = migrateData(mergeVolatileIntoCache(memoryCache, volatile));
  refreshAdminStats(memoryCache);
  return memoryCache;
}

function reportSyncError(err) {
  console.error('Sinkronizim Supabase:', err);
}

export function saveData(data) {
  memoryCache = data;
  refreshAdminStats(data);
  if (!isSupabaseEnabled()) return;

  if (syncInFlight) {
    syncInFlight = syncInFlight
      .then(() => syncAllToSupabase(data))
      .catch(reportSyncError);
  } else {
    syncInFlight = syncAllToSupabase(data)
      .catch(reportSyncError)
      .finally(() => { syncInFlight = null; });
  }
}

export async function saveDataAsync(data) {
  memoryCache = data;
  refreshAdminStats(data);
  if (isSupabaseEnabled()) await syncAllToSupabase(data);
}

function refreshAdminStats(data) {
  data.adminStats = {
    totalProperties: data.properties.length,
    activeUsers: data.users.filter((u) => u.role !== 'administrator').length,
    pendingApproval: data.properties.filter((p) => p.status === 'në pritje').length,
  };
}

export function formatContractNumber(contract) {
  const n = contract?.contractNumber;
  if (typeof n === 'number' && n > 0) return String(n).padStart(5, '0');
  return null;
}

export function generateId(prefix) {
  if (isSupabaseEnabled() && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

export function getRoleLabel(role) {
  return t(`role.${role}`) || role;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString(locale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatCurrency(amount) {
  return `${Number(amount).toFixed(0)}€`;
}

export function getFirstName(fullName) {
  return fullName?.split(' ')[0] || fullName;
}

export function monthsUntil(dateStr) {
  const now = new Date();
  const end = new Date(dateStr);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, months);
}

export function getExpenseTypeLabel(type) {
  return t(`expenseType.${type}`) || EXPENSE_TYPES.find((e) => e.id === type)?.label || type;
}

export function getContractStatusLabel(status) {
  return t(`contractStatus.${status}`) || CONTRACT_STATUSES[status] || status;
}

export function getPaymentStatusLabel(status) {
  return t(`paymentStatus.${status}`) || PAYMENT_STATUSES[status] || status;
}

export function getCampusName(id) {
  return CAMPUSES.find((c) => c.id === id)?.name || '';
}
