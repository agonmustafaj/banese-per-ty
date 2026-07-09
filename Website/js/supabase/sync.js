import { getSupabase } from './client.js';
import {
  profileToUser,
  userToProfile,
  propertyFromRow,
  propertyToRow,
  favoriteFromRow,
  favoriteToRow,
  contractRequestFromRow,
  contractRequestToRow,
  contractFromRow,
  contractToRow,
  paymentFromRow,
  paymentToRow,
  notificationFromRow,
  notificationToRow,
  auditFromRow,
  auditToRow,
  agencyFromRow,
  agencyToRow,
} from './mappers.js';

function isUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function loadAllFromSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase nuk është konfiguruar.');

  const [
    profilesRes,
    propertiesRes,
    favoritesRes,
    requestsRes,
    contractsRes,
    paymentsRes,
    notificationsRes,
    auditRes,
    agencyRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('properties').select('*'),
    supabase.from('favorites').select('*'),
    supabase.from('contract_requests').select('*'),
    supabase.from('contracts').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('notifications').select('*').order('sent_at', { ascending: false }).limit(200),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('agency_requests').select('*'),
  ]);

  const errors = [
    profilesRes.error,
    propertiesRes.error,
    favoritesRes.error,
    requestsRes.error,
    contractsRes.error,
    paymentsRes.error,
    notificationsRes.error,
    auditRes.error,
    agencyRes.error,
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join('; '));
  }

  const users = (profilesRes.data || []).map(profileToUser);
  const properties = (propertiesRes.data || []).map(propertyFromRow);
  const favorites = (favoritesRes.data || []).map(favoriteFromRow);
  const contractRequests = (requestsRes.data || []).map(contractRequestFromRow);
  const contracts = (contractsRes.data || []).map(contractFromRow);
  const payments = (paymentsRes.data || []).map(paymentFromRow);
  const notifications = (notificationsRes.data || []).map(notificationFromRow);
  const auditLog = (auditRes.data || []).map(auditFromRow);
  const agencyRequests = (agencyRes.data || []).map(agencyFromRow);

  return {
    users,
    properties,
    favorites,
    contractRequests,
    contracts,
    payments,
    notifications,
    agencyRequests,
    auditLog,
    adminStats: {
      totalProperties: properties.length,
      activeUsers: users.filter((u) => u.role !== 'administrator').length,
      pendingApproval: properties.filter((p) => p.status === 'në pritje').length,
    },
    activityFeed: [],
  };
}

async function upsertTable(table, rows, toRow) {
  if (!rows?.length) return;
  const supabase = getSupabase();
  const payload = rows.filter((r) => isUuid(r.id) || table === 'favorites').map(toRow);
  if (!payload.length) return;

  if (table === 'favorites') {
    const { error } = await supabase.from('favorites').upsert(payload, { onConflict: 'user_id,property_id' });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function syncProfiles(users) {
  const supabase = getSupabase();
  for (const user of users) {
    if (!isUuid(user.id)) continue;
    const { error } = await supabase.from('profiles').update(userToProfile(user)).eq('id', user.id);
    if (error) throw error;
  }
}

export async function syncAllToSupabase(data) {
  const supabase = getSupabase();
  if (!supabase) return;

  await syncProfiles(data.users || []);
  await upsertTable('properties', data.properties, propertyToRow);
  await upsertTable('favorites', data.favorites, favoriteToRow);
  await upsertTable('contract_requests', data.contractRequests, contractRequestToRow);
  await upsertTable('contracts', data.contracts, contractToRow);
  await upsertTable('payments', data.payments, paymentToRow);
  await upsertTable('notifications', data.notifications?.filter((n) => isUuid(n.id)), notificationToRow);
  await upsertTable('audit_log', data.auditLog?.filter((l) => isUuid(l.id)), auditToRow);
  await upsertTable('agency_requests', data.agencyRequests, agencyToRow);
}

export async function insertNotificationSupabase(notification) {
  const supabase = getSupabase();
  const row = notificationToRow(notification);
  const { data, error } = await supabase.from('notifications').insert(row).select().single();
  if (error) throw error;
  return notificationFromRow(data);
}

export async function insertAuditSupabase(log) {
  const supabase = getSupabase();
  const row = auditToRow(log);
  const { data, error } = await supabase.from('audit_log').insert(row).select().single();
  if (error) throw error;
  return auditFromRow(data);
}

export async function uploadPropertyPhotos(ownerId, propertyId, photos) {
  const supabase = getSupabase();
  const uploaded = [];

  for (const photo of photos || []) {
    if (photo.url && !photo.dataUrl) {
      uploaded.push(photo);
      continue;
    }
    if (!photo.dataUrl) continue;

    const blob = dataUrlToBlob(photo.dataUrl);
    const safeName = (photo.name || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${ownerId}/${propertyId}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage.from('property-photos').upload(path, blob, {
      upsert: true,
      contentType: blob.type,
    });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(path);
    uploaded.push({ url: urlData.publicUrl, name: safeName, storagePath: path });
  }

  return uploaded;
}

export async function uploadPaymentProof(tenantId, paymentId, proof) {
  const supabase = getSupabase();
  if (!proof?.dataUrl) return proof;

  const blob = dataUrlToBlob(proof.dataUrl);
  const safeName = (proof.name || 'deshmi.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${tenantId}/${paymentId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('payment-proofs').upload(path, blob, {
    upsert: true,
    contentType: proof.type || blob.type,
  });
  if (error) throw error;

  return {
    name: safeName,
    storagePath: path,
    type: proof.type || blob.type,
    size: proof.size,
    uploadedAt: new Date().toISOString(),
  };
}

export async function uploadSignature(tenantId, contractId, signature) {
  const supabase = getSupabase();
  if (!signature?.dataUrl) return signature;

  const blob = dataUrlToBlob(signature.dataUrl);
  const path = `${tenantId}/${contractId}/signature.png`;

  const { error } = await supabase.storage.from('contract-signatures').upload(path, blob, {
    upsert: true,
    contentType: 'image/png',
  });
  if (error) throw error;

  return {
    ...signature,
    storagePath: path,
    dataUrl: signature.dataUrl,
  };
}

export async function fetchProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return profileToUser(data);
}

export async function updateProfileSupabase(userId, updates) {
  const supabase = getSupabase();
  const row = {
    full_name: updates.fullName,
    email: updates.email,
    phone: updates.phone,
    address: updates.address,
    user_type: updates.userType,
    campus_id: updates.campusId,
    role: updates.role,
  };
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);

  const { data, error } = await supabase.from('profiles').update(row).eq('id', userId).select().single();
  if (error) throw error;
  return profileToUser(data);
}

export async function clearAuditLogSupabase() {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('clear_audit_log');
  if (error) throw error;
}

export async function fetchAllProfiles() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return (data || []).map(profileToUser);
}

export async function deleteOwnAccountSupabase() {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}

export function subscribeNotifications(userId, onInsert) {
  const supabase = getSupabase();
  if (!supabase || !userId) return () => {};

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(notificationFromRow(payload.new))
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
