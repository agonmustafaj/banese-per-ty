import { loadData, saveData, generateId } from './data.js';
import { isSupabaseEnabled } from './config.js';
import { insertNotificationSupabase, insertAuditSupabase, clearAuditLogSupabase } from './supabase/sync.js';

export function addNotification(userId, type, message) {
  const notification = {
    id: generateId('n'),
    userId,
    type,
    message,
    sentAt: new Date().toISOString(),
    read: false,
  };

  const data = loadData();
  data.notifications.unshift(notification);

  if (isSupabaseEnabled()) {
    insertNotificationSupabase(notification)
      .then((saved) => {
        notification.id = saved.id;
      })
      .catch((err) => console.error('Njoftim Supabase:', err));
    saveData(data);
    return;
  }

  saveData(data);
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

export function addAuditLog(action, userId, details) {
  const entry = {
    id: generateId('log'),
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
  };

  const data = loadData();
  data.auditLog.unshift(entry);
  if (data.auditLog.length > 200) data.auditLog.length = 200;

  if (isSupabaseEnabled()) {
    insertAuditSupabase(entry)
      .then((saved) => {
        entry.id = saved.id;
      })
      .catch((err) => console.error('Audit Supabase:', err));
    saveData(data);
    return;
  }

  saveData(data);
}
