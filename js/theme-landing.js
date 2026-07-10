import { initTheme, renderThemeToggleHtml, attachThemeToggle } from './theme.js';

initTheme();

const headerTheme = document.getElementById('header-theme');
if (headerTheme) {
  headerTheme.innerHTML = renderThemeToggleHtml();
  attachThemeToggle(headerTheme);
}
