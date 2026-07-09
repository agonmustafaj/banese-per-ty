const STORAGE_KEY = 'banese_theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
  syncThemeButtons();
}

function syncThemeButtons() {
  const current = getTheme();
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeMode === current);
  });
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') {
    setTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  setTheme(prefersDark ? 'dark' : 'light');
}

export function renderThemeToggleHtml() {
  const theme = getTheme();
  return `
    <div class="theme-switch" role="group" aria-label="Theme">
      <button type="button" class="theme-btn ${theme === 'light' ? 'active' : ''}" data-theme-mode="light" aria-label="Light mode" title="Light">☀</button>
      <button type="button" class="theme-btn ${theme === 'dark' ? 'active' : ''}" data-theme-mode="dark" aria-label="Dark mode" title="Dark">☾</button>
    </div>`;
}

export function attachThemeToggle(container, onChange) {
  if (!container) return;
  container.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.themeMode;
      if (mode && mode !== getTheme()) {
        setTheme(mode);
        onChange?.(mode);
      }
    });
  });
}

export function renderHeaderControlsHtml(renderLangHtml) {
  return `<div class="header-controls">${renderThemeToggleHtml()}${renderLangHtml || ''}</div>`;
}
