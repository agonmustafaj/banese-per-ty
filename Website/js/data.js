import { hashPassword } from './crypto.js';
import { isSupabaseEnabled } from './config.js';
import { loadAllFromSupabase, syncAllToSupabase } from './supabase/sync.js';

const STORAGE_KEY = 'banese_per_ty_v4';
export const MAX_LOGIN_ATTEMPTS = 3;
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

export const DEMO_PROPERTY_PHOTOS = {
  p1: [
    { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=480&h=320&fit=crop', name: 'dhoma-dite.jpg' },
    { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=480&h=320&fit=crop', name: 'kuzhine.jpg' },
    { url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=480&h=320&fit=crop', name: 'dhoma-gjumi.jpg' },
  ],
  p2: [
    { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=480&h=320&fit=crop', name: 'jashte.jpg' },
    { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=480&h=320&fit=crop', name: 'dhoma-dite.jpg' },
    { url: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=480&h=320&fit=crop', name: 'banjo.jpg' },
  ],
  p3: [
    { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=480&h=320&fit=crop', name: 'studio.jpg' },
    { url: 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=480&h=320&fit=crop', name: 'kuzhine-studio.jpg' },
    { url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=480&h=320&fit=crop', name: 'pamje.jpg' },
  ],
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

export const defaultData = {
  users: [
    {
      id: 'u1',
      fullName: 'Hajdar Dushi',
      email: 'qeradhenes@example.com',
      passwordHash: '',
      role: 'qiradhënësi',
      phone: '+383 49 123 456',
      address: 'Prishtinë, Kosovë',
      userType: 'employed',
      twoFactorEnabled: true,
    },
    {
      id: 'u2',
      fullName: 'Filan Fisteku',
      email: 'qeramarreses@example.com',
      passwordHash: '',
      role: 'qiramarrësi',
      phone: '+383 44 987 654',
      address: 'Prishtinë, Kosovë',
      userType: 'student',
      campusId: 'up',
      twoFactorEnabled: true,
    },
    {
      id: 'u3',
      fullName: 'Admin Sistemi',
      email: 'admin@example.com',
      passwordHash: '',
      role: 'administrator',
      phone: '+383 38 200 200',
      address: 'Prishtinë, Kosovë',
      userType: 'employed',
      twoFactorEnabled: false,
    },
  ],
  properties: [
    {
      id: 'p1',
      ownerId: 'u1',
      title: 'Apartament 2+1',
      address: "Rruga 'Agim Ramadani', Prishtinë",
      city: 'Prishtinë',
      type: 'apartament',
      rentPrice: 350,
      deposit: 350,
      rooms: 2,
      bathrooms: 1,
      area: 85,
      status: 'publikuar',
      occupied: true,
      nearCampus: 'up',
      photos: DEMO_PROPERTY_PHOTOS.p1,
      amenities: { mobiluar: true, ngrohje: true, ac: true, parking: false, ballkon: true, ashensor: true },
      description: 'Apartament modern në qendër të qytetit, afër UP.',
      createdAt: '2026-01-15',
    },
    {
      id: 'p2',
      ownerId: 'u1',
      title: 'Apartament 3+1',
      address: "Rruga 'Rexhep Luci', Prishtinë",
      city: 'Prishtinë',
      type: 'apartament',
      rentPrice: 450,
      deposit: 450,
      rooms: 3,
      bathrooms: 2,
      area: 120,
      status: 'publikuar',
      occupied: false,
      nearCampus: '',
      photos: DEMO_PROPERTY_PHOTOS.p2,
      amenities: { mobiluar: true, ngrohje: true, ac: true, parking: true, ballkon: true, ashensor: false },
      description: 'Apartament i gjerë me pamje të bukur.',
      createdAt: '2026-02-01',
    },
    {
      id: 'p3',
      ownerId: 'u1',
      title: 'Studio',
      address: "Rruga 'Bill Clinton', Prishtinë",
      city: 'Prishtinë',
      type: 'studio',
      rentPrice: 250,
      deposit: 250,
      rooms: 1,
      bathrooms: 1,
      area: 45,
      status: 'publikuar',
      occupied: false,
      nearCampus: 'uibm',
      photos: DEMO_PROPERTY_PHOTOS.p3,
      amenities: { mobiluar: true, ngrohje: false, ac: true, parking: false, ballkon: false, ashensor: true },
      description: 'Studio kompakte afër UIBM.',
      createdAt: '2026-03-10',
    },
  ],
  favorites: [],
  contractRequests: [],
  contracts: [
    {
      id: 'c1',
      propertyId: 'p1',
      landlordId: 'u1',
      tenantId: 'u2',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      status: 'active',
      signedAt: '2025-12-20T10:00:00.000Z',
      pdfGeneratedAt: '2025-12-20T10:00:00.000Z',
      createdAt: '2025-12-15T10:00:00.000Z',
      signature: { typedName: 'Filan Fisteku', dataUrl: null, signedAt: '2025-12-20T10:00:00.000Z' },
      partiesSummary: 'Kontratë mes Hajdar Dushi (Qeradhënës) dhe Filan Fisteku (Qeramarrës)',
    },
  ],
  payments: [
    { id: 'pay1', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 350, dueDate: '2026-01-01', status: 'paguar', type: 'qera', month: '2026-01' },
    { id: 'pay2', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 350, dueDate: '2026-02-01', status: 'paguar', type: 'qera', month: '2026-02' },
    { id: 'pay3', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 45, dueDate: '2026-02-01', status: 'paguar', type: 'rryme', month: '2026-02' },
    { id: 'pay4', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 350, dueDate: '2026-03-01', status: 'paguar', type: 'qera', month: '2026-03' },
    { id: 'pay5', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 350, dueDate: '2026-04-01', status: 'pending', type: 'qera', month: '2026-04' },
    { id: 'pay6', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 25, dueDate: '2026-04-01', status: 'pending', type: 'uji', month: '2026-04' },
    { id: 'pay7', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 350, dueDate: '2026-05-01', status: 'pending', type: 'qera', month: '2026-05' },
    { id: 'pay8', contractId: 'c1', propertyId: 'p1', tenantId: 'u2', landlordId: 'u1', amount: 350, dueDate: '2026-06-01', status: 'pending', type: 'qera', month: '2026-06' },
  ],
  notifications: [],
  loginAttempts: {},
  blockedAccounts: {},
  pending2fa: {},
  passwordResetTokens: [],
  agencyRequests: [],
  auditLog: [],
  adminStats: { totalProperties: 0, activeUsers: 0, pendingApproval: 0 },
  activityFeed: [],
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
  if (!Array.isArray(data.auditLog)) data.auditLog = [];
  if (!Array.isArray(data.agencyRequests)) data.agencyRequests = [];
  if (!Array.isArray(data.passwordResetTokens)) data.passwordResetTokens = [];
  if (!data.pending2fa) data.pending2fa = {};
  if (!data.blockedAccounts) data.blockedAccounts = {};
  if (!Array.isArray(data.contractRequests)) data.contractRequests = [];

  data.contracts?.forEach((c) => {
    c.status = normalizeContractStatus(c.status);
  });

  data.payments?.forEach((p) => {
    p.status = normalizePaymentStatus(p.status);
    if (p.type === 'qira') p.type = 'qera';
    if (!p.landlordId && p.propertyId) {
      const prop = data.properties?.find((x) => x.id === p.propertyId);
      if (prop) p.landlordId = prop.ownerId;
    }
    if (!p.month && p.dueDate) p.month = p.dueDate.slice(0, 7);
  });

  data.properties?.forEach((p) => {
    if (p.status === 'me qira') p.status = 'me qera';
    if (!p.photos) p.photos = [];
    if (!hasValidPhotos(p.photos) && DEMO_PROPERTY_PHOTOS[p.id]) {
      p.photos = DEMO_PROPERTY_PHOTOS[p.id];
    }
    delete p.preferredTenantType;
    if (!p.nearCampus) p.nearCampus = '';
  });

  data.users?.forEach((u) => {
    if (u.password && !u.passwordHash) {
      u._plainPassword = u.password;
      delete u.password;
    }
    if (!u.userType) u.userType = u.role === 'qiramarrësi' ? 'student' : 'employed';
    if (u.twoFactorEnabled === undefined) u.twoFactorEnabled = u.role !== 'administrator';
  });

  return data;
}

let demoHashesReady = false;
let memoryCache = null;
let syncInFlight = null;

async function ensureDemoHashes(data) {
  if (demoHashesReady) return;
  let changed = false;
  for (const user of data.users) {
    if (user._plainPassword) {
      user.passwordHash = await hashPassword(user._plainPassword);
      delete user._plainPassword;
      changed = true;
    } else if (!user.passwordHash) {
      user.passwordHash = await hashPassword('123456');
      changed = true;
    }
  }
  demoHashesReady = true;
  if (changed) saveData(data);
}

export function loadData() {
  if (memoryCache) return migrateData(cloneData(memoryCache));
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return migrateData(JSON.parse(stored));
  } catch (_) {}
  return migrateData(cloneData(defaultData));
}

export async function loadDataAsync(retries = 2) {
  if (isSupabaseEnabled()) {
    for (let i = 0; i <= retries; i++) {
      try {
        memoryCache = migrateData(await loadAllFromSupabase());
        return memoryCache;
      } catch (err) {
        if (i === retries) throw err;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const data = loadData();
      await ensureDemoHashes(data);
      memoryCache = data;
      return data;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return loadData();
}

export function saveData(data) {
  memoryCache = data;
  refreshAdminStats(data);

  if (isSupabaseEnabled()) {
    if (syncInFlight) syncInFlight = syncInFlight.then(() => syncAllToSupabase(data));
    else syncInFlight = syncAllToSupabase(data).finally(() => { syncInFlight = null; });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function saveDataAsync(data) {
  memoryCache = data;
  refreshAdminStats(data);
  if (isSupabaseEnabled()) await syncAllToSupabase(data);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function refreshAdminStats(data) {
  data.adminStats = {
    totalProperties: data.properties.length,
    activeUsers: data.users.filter((u) => u.role !== 'administrator').length,
    pendingApproval: data.properties.filter((p) => p.status === 'në pritje').length,
  };
}

export function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY);
  memoryCache = null;
  demoHashesReady = false;
}

export function generateId(prefix) {
  if (isSupabaseEnabled() && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

export function getRoleLabel(role) {
  const labels = {
    'qiradhënësi': 'Qeradhënës',
    'qiramarrësi': 'Qeramarrës',
    administrator: 'Administrator',
  };
  return labels[role] || role;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' });
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
  return EXPENSE_TYPES.find((t) => t.id === type)?.label || type;
}

export function getContractStatusLabel(status) {
  return CONTRACT_STATUSES[status] || status;
}

export function getPaymentStatusLabel(status) {
  return PAYMENT_STATUSES[status] || status;
}

export function getCampusName(id) {
  return CAMPUSES.find((c) => c.id === id)?.name || '';
}
