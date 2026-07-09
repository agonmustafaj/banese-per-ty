/**
 * Mbrojtje kundër rifreskimit automatik që fshin të dhënat e përdoruesit.
 * Përdoret nga auto-sync (polling/realtime) për të mos thirrur render() kur
 * përdoruesi po plotëson forma, ka modal të hapur, ose fusha aktive.
 */

let root = null;
let editableBaseline = '';
let manualBlockCount = 0;

const EDITABLE_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';

function serializeEditableState(container) {
  if (!container) return '';
  const parts = [];
  container.querySelectorAll(EDITABLE_SELECTOR).forEach((el, index) => {
    const key = el.id || el.name || `field-${index}`;
    if (el.type === 'checkbox' || el.type === 'radio') {
      parts.push(`${key}=${el.checked}`);
    } else if (el.type === 'file') {
      parts.push(`${key}=files:${el.files?.length || 0}`);
    } else {
      parts.push(`${key}=${el.value}`);
    }
  });
  return parts.join('|');
}

export function initUIGuard(container) {
  root = container;
}

/** Thirret pas çdo render() të suksesshëm — rivendos bazën e krahasimit. */
export function resetUIBaseline() {
  editableBaseline = serializeEditableState(root);
  manualBlockCount = 0;
}

/** Për operacione async (ruajtje, upload) — blloko auto-render derisa të mbarojë. */
export function runWithSubmitGuard(fn) {
  manualBlockCount += 1;
  const release = () => {
    manualBlockCount = Math.max(0, manualBlockCount - 1);
  };
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.finally(release);
    }
    release();
    return result;
  } catch (err) {
    release();
    throw err;
  }
}

function hasOpenModal() {
  return !!root?.querySelector('.modal-overlay');
}

function hasFocusedEditable() {
  const el = document.activeElement;
  if (!el || !root?.contains(el)) return false;
  return el.matches?.(EDITABLE_SELECTOR) || el.isContentEditable;
}

function hasEditableChanges() {
  if (!root) return false;
  return serializeEditableState(root) !== editableBaseline;
}

/** A duhet të anashkalohet render() automatik (sync në sfond)? */
export function shouldBlockAutoRender() {
  if (!root) return false;
  if (manualBlockCount > 0) return true;
  if (hasOpenModal()) return true;
  if (hasFocusedEditable()) return true;
  if (hasEditableChanges()) return true;
  return false;
}

/** Përditëso vetëm numrin e njoftimeve pa rifreskuar faqen. */
export function patchNotificationBadge(container, unreadCount) {
  const navBtn = container?.querySelector('[data-page="notifications"]');
  if (!navBtn) return;
  let badge = navBtn.querySelector('.nav-badge');
  if (unreadCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-badge';
      navBtn.appendChild(badge);
    }
    badge.textContent = String(unreadCount);
  } else {
    badge?.remove();
  }
}
