import { loadData, saveData, generateId } from './data.js';
import { isSupabaseEnabled } from './config.js';
import { insertNotificationSupabase, insertAuditSupabase, clearAuditLogSupabase, deleteAuditLogSupabase } from './supabase/sync.js';

export async function addNotificationAsync(userId, type, message, existingData = null) {
  const notification = {
    id: generateId('n'),
    userId,
    type,
    message,
    sentAt: new Date().toISOString(),
    read: false,
  };

  const data = existingData || loadData();
  data.notifications.unshift(notification);

  if (isSupabaseEnabled()) {
    const saved = await insertNotificationSupabase(notification);
    notification.id = saved.id;
    if (!existingData) saveData(data);
    return notification;
  }

  if (!existingData) saveData(data);
  return notification;
}

export function addNotification(userId, type, message, existingData = null) {
  const notification = {
    id: generateId('n'),
    userId,
    type,
    message,
    sentAt: new Date().toISOString(),
    read: false,
  };

  const data = existingData || loadData();
  data.notifications.unshift(notification);

  if (isSupabaseEnabled()) {
    insertNotificationSupabase(notification)
      .then((saved) => {
        notification.id = saved.id;
      })
      .catch((err) => console.error('Njoftim Supabase:', err));
    if (!existingData) saveData(data);
    return;
  }

  if (!existingData) saveData(data);
}

export async function clearAuditLog() {
  const data = loadData();
  data.auditLog = [];
  saveData(data);
  if (isSupabaseEnabled()) {
    try {
      await clearAuditLogSupabase();
    } catch (err) {
      console.error('Pastrim audit log:', err);
    }
  }
}

export function addAuditLog(action, userId, details, existingData = null) {
  const entry = {
    id: generateId('log'),
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
  };

  const data = existingData || loadData();
  data.auditLog.unshift(entry);
  if (data.auditLog.length > 200) data.auditLog.length = 200;

  if (isSupabaseEnabled()) {
    insertAuditSupabase(entry)
      .then((saved) => {
        entry.id = saved.id;
      })
      .catch((err) => console.error('Audit Supabase:', err));
    if (!existingData) saveData(data);
    return;
  }

  if (!existingData) saveData(data);
}

export async function deleteAuditLogEntry(id) {
  if (!id) return { success: false, error: 'Regjistrimi nuk u gjet.' };

  const data = loadData();
  const before = data.auditLog.length;
  data.auditLog = data.auditLog.filter((l) => l.id !== id);
  if (data.auditLog.length === before) {
    return { success: false, error: 'Regjistrimi nuk u gjet.' };
  }
  saveData(data);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isSupabaseEnabled() && isUuid(id)) {
    try {
      await deleteAuditLogSupabase(id);
    } catch (err) {
      console.error('Fshirje audit log:', err);
      return { success: false, error: err.message || 'Gabim gjatë fshirjes.' };
    }
  }

  return { success: true };
}
