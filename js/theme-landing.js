import { initTheme, renderThemeToggleHtml, attachThemeToggle } from './theme.js';

initTheme();

const headerActions = document.querySelector('.header-actions');
const langSwitch = document.getElementById('lang-switch');
const mainNav = document.getElementById('main-nav');

if (headerActions && langSwitch) {
  const controls = document.createElement('div');
  controls.className = 'header-controls';
  controls.innerHTML = renderThemeToggleHtml();
  headerActions.insertBefore(controls, langSwitch);
  attachThemeToggle(controls);

  if (mainNav) {
    const prefs = document.createElement('div');
    prefs.className = 'nav-mobile-prefs';
    prefs.setAttribute('aria-label', 'Tema dhe gjuha');

    const mobileControls = document.createElement('div');
    mobileControls.className = 'header-controls';
    mobileControls.innerHTML = renderThemeToggleHtml();
    prefs.appendChild(mobileControls);
    attachThemeToggle(mobileControls);

    const langClone = langSwitch.cloneNode(true);
    langClone.removeAttribute('id');
    prefs.appendChild(langClone);
    mainNav.appendChild(prefs);
  }
}
