import { initTheme, renderThemeToggleHtml, attachThemeToggle } from './theme.js';

initTheme();

const headerActions = document.querySelector('.header-actions');
const langSwitch = document.getElementById('lang-switch');
if (headerActions && langSwitch) {
  const controls = document.createElement('div');
  controls.className = 'header-controls';
  controls.innerHTML = renderThemeToggleHtml();
  headerActions.insertBefore(controls, langSwitch);
  attachThemeToggle(controls);
}
