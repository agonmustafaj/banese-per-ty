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
  ] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('properties').select('*'),
    supabase.from('favorites').select('*'),
    supabase.from('contract_requests').select('*'),
    supabase.from('contracts').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('notifications').select('*').order('sent_at', { ascending: false }).limit(50),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
  ]);

  return mapSupabasePayload({
    profilesRes,
    propertiesRes,
    favoritesRes,
    requestsRes,
    contractsRes,
    paymentsRes,
    notificationsRes,
    auditRes,
  });
}

/** Ngarkim i shpejtë — vetëm tabelat që ndryshojnë shpesh (pa profiles). */
export async function loadVolatileFromSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase nuk është konfiguruar.');

  const [
    propertiesRes,
    favoritesRes,
    requestsRes,
    contractsRes,
    paymentsRes,
    notificationsRes,
    auditRes,
  ] = await Promise.all([
    supabase.from('properties').select('*'),
    supabase.from('favorites').select('*'),
    supabase.from('contract_requests').select('*'),
    supabase.from('contracts').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('notifications').select('*').order('sent_at', { ascending: false }).limit(40),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  return mapSupabasePayload({
    propertiesRes,
    favoritesRes,
    requestsRes,
    contractsRes,
    paymentsRes,
    notificationsRes,
    auditRes,
  });
}

function mapSupabasePayload(responses) {
  const errors = Object.values(responses)
    .map((r) => r?.error)
    .filter(Boolean);

  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join('; '));
  }

  const profilesRes = responses.profilesRes;
  const properties = (responses.propertiesRes.data || []).map(propertyFromRow);
  const users = profilesRes ? (profilesRes.data || []).map(profileToUser) : undefined;

  const payload = {
    properties,
    favorites: (responses.favoritesRes.data || []).map(favoriteFromRow),
    contractRequests: (responses.requestsRes.data || []).map(contractRequestFromRow),
    contracts: (responses.contractsRes.data || []).map(contractFromRow),
    payments: (responses.paymentsRes.data || []).map(paymentFromRow),
    notifications: (responses.notificationsRes.data || []).map(notificationFromRow),
    auditLog: (responses.auditRes.data || []).map(auditFromRow),
  };

  if (users) {
    payload.users = users;
    payload.adminStats = {
      totalProperties: properties.length,
      activeUsers: users.filter((u) => u.role !== 'administrator').length,
      pendingApproval: properties.filter((p) => p.status === 'në pritje').length,
    };
    payload.activityFeed = [];
  }

  return payload;
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

async function syncProperties(properties) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const uid = session.user.id;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).single();
  const isAdmin = profile?.role === 'administrator';

  const rows = (properties || []).filter((p) => isUuid(p.id) && (isAdmin || p.ownerId === uid));
  if (!rows.length) return;

  for (const prop of rows) {
    if (!isAdmin && prop.ownerId === uid) {
      const { data: remote } = await supabase
        .from('properties')
        .select('status, updated_at')
        .eq('id', prop.id)
        .maybeSingle();
      if (remote?.status && prop.status === 'në pritje' && remote.status !== 'në pritje') {
        prop.status = remote.status;
        if (remote.updated_at) prop.updatedAt = remote.updated_at;
      }
    }
  }

  await upsertTable('properties', rows, propertyToRow);
}

export async function updatePropertySupabase(property) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase nuk është konfiguruar.');
  const { error } = await supabase
    .from('properties')
    .update(propertyToRow(property))
    .eq('id', property.id);
  if (error) throw error;
}

async function syncProfiles(users) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const own = (users || []).find((u) => u.id === user.id);
  if (!own || !isUuid(own.id)) return;

  const { error } = await supabase.from('profiles').update(userToProfile(own)).eq('id', own.id);
  if (error) throw error;
}

export async function syncAllToSupabase(data) {
  const supabase = getSupabase();
  if (!supabase) return;

  await syncProfiles(data.users || []);
  await syncProperties(data.properties);
  await upsertTable('favorites', data.favorites, favoriteToRow);
  await upsertTable('contract_requests', data.contractRequests, contractRequestToRow);
  await upsertTable('contracts', data.contracts, contractToRow);
  await upsertTable('payments', data.payments, paymentToRow);
  await upsertTable('notifications', data.notifications?.filter((n) => isUuid(n.id)), notificationToRow);
  await upsertTable('audit_log', data.auditLog?.filter((l) => isUuid(l.id)), auditToRow);
}

/** Ruaj kontratë të re + përditëso kërkesën — para njoftimit te qiramarrësi. */
export async function persistNewContract(contract, request, property) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase nuk është konfiguruar.');

  const row = contractToRow(contract);
  const { data: saved, error: contractError } = await supabase
    .from('contracts')
    .insert(row)
    .select()
    .single();
  if (contractError) throw contractError;

  const savedContract = contractFromRow(saved);
  Object.assign(contract, savedContract);

  const { error: requestError } = await supabase
    .from('contract_requests')
    .update(contractRequestToRow(request))
    .eq('id', request.id);
  if (requestError) throw requestError;

  if (property?.id) {
    await updatePropertySupabase(property);
  }

  return savedContract;
}

/** Ngarko kontratat e përdoruesit aktual (qiramarrës ose qiradhënës). */
export async function fetchContractsForCurrentUser() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(contractFromRow);
}

/** Ngarko prona sipas ID (për faqen e kontratës te qiramarrësi). */
export async function fetchPropertiesByIds(ids) {
  const supabase = getSupabase();
  if (!supabase || !ids?.length) return [];

  const unique = [...new Set(ids.filter(isUuid))];
  if (!unique.length) return [];

  const { data, error } = await supabase.from('properties').select('*').in('id', unique);
  if (error) throw error;
  return (data || []).map(propertyFromRow);
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
    contentType: proof.type || blob.type || 'application/octet-stream',
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

/** URL e përkohshme për shikimin e dëshmisë nga storage privat. */
export async function getPaymentProofSignedUrl(proof) {
  if (!proof) return null;
  if (proof.dataUrl) return proof.dataUrl;
  if (!proof.storagePath) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(proof.storagePath, 3600);
  if (error) throw error;
  return data?.signedUrl || null;
}

/** Ruaj / përditëso një pagesë në Supabase (p.sh. pas dëshmisë). */
export async function upsertPaymentSupabase(payment) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase nuk është konfiguruar.');
  if (!isUuid(payment?.id)) throw new Error('Pagesa nuk është e sinkronizuar me serverin.');

  const row = paymentToRow(payment);
  const { error } = await supabase.from('payments').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return payment;
}

export async function uploadSignature(userId, contractId, signature, role = 'tenant') {
  const supabase = getSupabase();
  if (!signature?.dataUrl) return signature;

  const blob = dataUrlToBlob(signature.dataUrl);
  const path = `${userId}/${contractId}/${role}-signature.png`;

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

/** Ngarko nënshkrimin nga storage kur në DB ka vetëm storagePath. */
export async function resolveSignatureDataUrl(signature) {
  if (!signature) return null;
  if (signature.dataUrl) return signature;
  if (!signature.storagePath) return signature;

  const supabase = getSupabase();
  if (!supabase) return signature;

  const { data, error } = await supabase.storage
    .from('contract-signatures')
    .download(signature.storagePath);
  if (error) {
    console.error('resolveSignatureDataUrl:', error);
    return signature;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(data);
  });

  return { ...signature, dataUrl };
}

export async function hydrateContractSignatures(contracts = []) {
  for (const contract of contracts) {
    if (contract.landlordSignature) {
      contract.landlordSignature = await resolveSignatureDataUrl(contract.landlordSignature);
    }
    if (contract.signature) {
      contract.signature = await resolveSignatureDataUrl(contract.signature);
    }
  }
  return contracts;
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

export async function deleteUserByAdminSupabase(userId, reason) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('admin_delete_user', {
    target_user_id: userId,
    reason,
  });
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
