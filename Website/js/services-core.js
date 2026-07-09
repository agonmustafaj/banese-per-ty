import { loadData, saveData, generateId } from './data.js';

export function addNotification(userId, type, message) {
  const data = loadData();
  data.notifications.unshift({
    id: generateId('n'),
    userId,
    type,
    message,
    sentAt: new Date().toISOString(),
    read: false,
  });
  saveData(data);
}

export function addAuditLog(action, userId, details) {
  const data = loadData();
  data.auditLog.unshift({
    id: generateId('log'),
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
  });
  if (data.auditLog.length > 200) data.auditLog.length = 200;
  saveData(data);
}
