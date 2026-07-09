document.getElementById('year').textContent = new Date().getFullYear();

const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

function setNavOpen(isOpen) {
  if (!navToggle || !mainNav) return;
  mainNav.classList.toggle('nav-open', isOpen);
  navToggle.classList.toggle('is-open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('nav-menu-open', isOpen);
}

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    setNavOpen(!mainNav.classList.contains('nav-open'));
  });
  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setNavOpen(false));
  });
}

const translations = {
  sq: {
    'meta.title': 'Banesë për ty — Platforma Digjitale për Qera në Kosovë',
    'meta.description': 'Banesë për ty është platforma digjitale në Kosovë që lidh qeradhënësit dhe qeramarrësit në të gjithë vendin: kërkim i avancuar banesash, kontrata elektronike me nënshkrim digjital, pagesa të verifikuara dhe menaxhim i plotë i qerasë online.',
    'meta.ogTitle': 'Banesë për ty — Platforma Digjitale për Qera në Kosovë',
    'meta.ogDescription': 'Gjej ose jep me qera banesën ideale kudo në Kosovë. Kontrata elektronike, pagesa të verifikuara dhe kërkim i avancuar — gjithçka në një platformë.',
    'nav.how': 'Si Funksionon',
    'nav.forWhom': 'Për Kë Është',
    'nav.features': 'Veçoritë',
    'nav.contact': 'Kontakt',
    'header.cta': 'Hyr në Platformë',
    'hero.eyebrow': 'Platforma #1 për qera në Kosovë',
    'hero.title': 'Gjej ose jep me qera banesën ideale, <span class="accent">pa telashe.</span>',
    'hero.sub': 'Kërkim i avancuar banesash, kontrata elektronike me nënshkrim digjital, pagesa të verifikuara automatikisht dhe menaxhim i plotë i qerasë — kudo në Kosovë, në një vend.',
    'hero.ctaSearch': 'Kërko Banesë →',
    'hero.ctaPublish': 'Publiko Pronën Tënde',
    'hero.trust1': 'Prona të Publikuara',
    'hero.trust2': 'Përdorues Aktivë',
    'hero.trust3': 'Komuna të Mbuluara',
    'heroCard.signed': 'Kontratë e Nënshkruar',
    'heroCard.perMonth': '280€ / muaj',
    'heroCard.verified': 'Pagesë e Verifikuar nga Sistemi',
    'heroCard.rentJune': 'Qershor 2026 — Qera',
    'heroCard.paid': 'Paguar',
    'heroCard.newNotif': 'Njoftim i Ri',
    'heroCard.newRequest': 'Kërkesë e re për kontratë',
    'steps.eyebrow': 'Procesi',
    'steps.title': 'Si funksionon Banesë për ty',
    'steps.subtitle': 'Nga kërkimi deri te kontrata e nënshkruar — katër hapa të thjeshtë.',
    'step1.title': 'Kërko & Filtro',
    'step1.desc': 'Filtro banesat sipas qytetit, çmimit, numrit të dhomave dhe komoditeteve, kudo në Kosovë, për të gjetur atë që të përshtatet.',
    'step2.title': 'Kërko Kontratë',
    'step2.desc': 'Dërgo kërkesë direkt te qeradhënësi. Ai merr njoftim të menjëhershëm dhe përgjigjet brenda platformës.',
    'step3.title': 'Nënshkruaj Digjitalisht',
    'step3.desc': "Kontrata gjenerohet automatikisht në PDF, specifikon qartë palët dhe kërkon nënshkrim elektronik për t'u aktivizuar.",
    'step4.title': 'Menaxho Pagesat',
    'step4.desc': 'Ngarko dëshminë e pagesës — sistemi e verifikon automatikisht ose ia dërgon qeradhënësit për miratim.',
    'perKend.eyebrow': 'Për të gjithë',
    'perKend.title': 'Një platformë, dy përfitime',
    'tenant.title': 'Për Qeramarrës',
    'tenant.li1': 'Kërko banesa kudo në Kosovë me filtra të avancuar (lokacion, çmim, madhësi)',
    'tenant.li2': 'Ruaj banesat e preferuara dhe krahaso me lehtësi',
    'tenant.li3': 'Nënshkruaj kontrata elektronikisht, pa letra e pa dalje',
    'tenant.li4': 'Mund të kesh njëkohësisht disa kontrata aktive',
    'tenant.li5': 'Ngarko dëshmi pagese dhe merr konfirmim të shpejtë',
    'tenant.cta': 'Gjej Banesën Tënde',
    'landlord.title': 'Për Qeradhënës',
    'landlord.li1': 'Publiko prona kudo në Kosovë, me foto dhe të gjitha detajet e nevojshme',
    'landlord.li2': 'Merr njoftim të menjëhershëm për çdo kërkesë kontrate',
    'landlord.li3': 'Gjenero kontrata profesionale me PDF automatik',
    'landlord.li4': 'Menaxho shpenzime shtesë (rrymë, ujë, termokos, etj.)',
    'landlord.li5': 'Shqyrto dëshmitë e pagesave dhe mirato me një klik',
    'landlord.cta': 'Publiko Pronën Tënde',
    'features.eyebrow': 'Veçoritë',
    'features.title': 'Gjithçka që të duhet për qeranë',
    'feature1.title': 'Kontrata & Nënshkrim Digjital',
    'feature1.desc': "Kontratat specifikojnë qartë palët dhe kërkojnë nënshkrim elektronik për t'u aktivizuar.",
    'feature2.title': 'Pagesa të Verifikuara',
    'feature2.desc': 'Ngarko dëshmi pagese — sistemi e vlerëson automatikisht ose ia kalon qeradhënësit për shqyrtim.',
    'feature3.title': 'Kërkim i Avancuar',
    'feature3.desc': 'Filtro sipas qytetit, çmimit, madhësisë, komoditeteve dhe afërsisë me pika interesi, kudo në Kosovë.',
    'feature4.title': 'Njoftime në Kohë Reale',
    'feature4.desc': 'Qeradhënësi njoftohet menjëherë për çdo kërkesë kontrate ose dëshmi pagese.',
    'feature5.title': 'Siguri e Fortë',
    'feature5.desc': 'Fjalëkalime të enkriptuara, verifikim dyfaktorial (2FA) dhe kontroll rolesh (qeradhënës, qeramarrës, admin).',
    'feature6.title': 'Raporte PDF',
    'feature6.desc': 'Shkarko raporte financiare të dizajnuara profesionalisht për çdo periudhë kohore.',
    'cta.title': 'Gati të fillosh?',
    'cta.sub': 'Regjistrohu falas dhe bëhu pjesë e platformës më të thjeshtë për qera, aktive kudo në Kosovë.',
    'cta.button': 'Hyr në Platformë →',
    'footer.tagline': 'Platforma digjitale për menaxhimin e qerasë, aktive në të gjithë Kosovën.',
    'footer.platformHeading': 'Platforma',
    'footer.login': 'Hyr / Regjistrohu',
    'footer.contactHeading': 'Kontakt',
    'footer.emailLabel': 'Email:',
    'footer.rightsPrefix': '©',
    'footer.rightsSuffix': 'Të gjitha të drejtat e rezervuara.',
  },
  en: {
    'meta.title': 'Banesë për ty — Digital Rental Platform in Kosovo',
    'meta.description': 'Banesë për ty is the digital platform in Kosovo connecting landlords and tenants nationwide: advanced property search, electronic contracts with digital signatures, verified payments, and complete online rental management.',
    'meta.ogTitle': 'Banesë për ty — Digital Rental Platform in Kosovo',
    'meta.ogDescription': 'Find or list the perfect rental anywhere in Kosovo. Electronic contracts, verified payments, and advanced search — all in one platform.',
    'nav.how': 'How It Works',
    'nav.forWhom': "Who It's For",
    'nav.features': 'Features',
    'nav.contact': 'Contact',
    'header.cta': 'Enter Platform',
    'hero.eyebrow': "Kosovo's #1 Rental Platform",
    'hero.title': 'Find or list the perfect rental, <span class="accent">hassle-free.</span>',
    'hero.sub': 'Advanced property search, electronic contracts with digital signatures, automatically verified payments, and complete rental management — anywhere in Kosovo, all in one place.',
    'hero.ctaSearch': 'Search Properties →',
    'hero.ctaPublish': 'List Your Property',
    'hero.trust1': 'Properties Listed',
    'hero.trust2': 'Active Users',
    'hero.trust3': 'Municipalities Covered',
    'heroCard.signed': 'Contract Signed',
    'heroCard.perMonth': '€280 / month',
    'heroCard.verified': 'Payment Verified by System',
    'heroCard.rentJune': 'June 2026 — Rent',
    'heroCard.paid': 'Paid',
    'heroCard.newNotif': 'New Notification',
    'heroCard.newRequest': 'New contract request',
    'steps.eyebrow': 'The Process',
    'steps.title': 'How Banesë për ty Works',
    'steps.subtitle': 'From search to signed contract — four simple steps.',
    'step1.title': 'Search & Filter',
    'step1.desc': 'Filter properties by city, price, room count, and amenities, anywhere in Kosovo, to find the perfect match.',
    'step2.title': 'Request a Contract',
    'step2.desc': 'Send a request directly to the landlord. They get an instant notification and respond within the platform.',
    'step3.title': 'Sign Digitally',
    'step3.desc': 'The contract is automatically generated as a PDF, clearly states both parties, and requires an electronic signature to activate.',
    'step4.title': 'Manage Payments',
    'step4.desc': 'Upload proof of payment — the system verifies it automatically or sends it to the landlord for approval.',
    'perKend.eyebrow': 'For Everyone',
    'perKend.title': 'One Platform, Two Benefits',
    'tenant.title': 'For Tenants',
    'tenant.li1': 'Search properties anywhere in Kosovo with advanced filters (location, price, size)',
    'tenant.li2': 'Save favorite properties and compare them easily',
    'tenant.li3': 'Sign contracts electronically, no paperwork or trips required',
    'tenant.li4': 'Hold multiple active contracts at the same time',
    'tenant.li5': 'Upload payment proof and get fast confirmation',
    'tenant.cta': 'Find Your Home',
    'landlord.title': 'For Landlords',
    'landlord.li1': 'List properties anywhere in Kosovo, with photos and all necessary details',
    'landlord.li2': 'Get instant notifications for every contract request',
    'landlord.li3': 'Generate professional contracts with automatic PDFs',
    'landlord.li4': 'Manage additional expenses (electricity, water, heating, etc.)',
    'landlord.li5': 'Review payment proofs and approve them in one click',
    'landlord.cta': 'List Your Property',
    'features.eyebrow': 'Features',
    'features.title': 'Everything you need for renting',
    'feature1.title': 'Contracts & Digital Signature',
    'feature1.desc': 'Contracts clearly state both parties and require an electronic signature to activate.',
    'feature2.title': 'Verified Payments',
    'feature2.desc': 'Upload payment proof — the system evaluates it automatically or passes it to the landlord for review.',
    'feature3.title': 'Advanced Search',
    'feature3.desc': 'Filter by city, price, size, amenities, and proximity to points of interest, anywhere in Kosovo.',
    'feature4.title': 'Real-Time Notifications',
    'feature4.desc': 'Landlords are notified instantly of every contract request or payment proof.',
    'feature5.title': 'Strong Security',
    'feature5.desc': 'Encrypted passwords, two-factor verification (2FA), and role-based access control (landlord, tenant, admin).',
    'feature6.title': 'PDF Reports',
    'feature6.desc': 'Download professionally designed financial reports for any time period.',
    'cta.title': 'Ready to get started?',
    'cta.sub': 'Sign up for free and join the simplest rental platform in Kosovo, active nationwide.',
    'cta.button': 'Enter Platform →',
    'footer.tagline': 'The digital platform for rental management, active across all of Kosovo.',
    'footer.platformHeading': 'Platform',
    'footer.login': 'Log In / Sign Up',
    'footer.contactHeading': 'Contact',
    'footer.emailLabel': 'Email:',
    'footer.rightsPrefix': '©',
    'footer.rightsSuffix': 'All rights reserved.',
  },
};

const LANG_KEY = 'banesaperty_lang';

function detectDefaultLang() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && translations[urlLang]) return urlLang;
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && translations[saved]) return saved;
  const browserLang = (navigator.language || 'sq').slice(0, 2).toLowerCase();
  return translations[browserLang] ? browserLang : 'sq';
}

function applyLang(lang) {
  if (!translations[lang]) lang = 'sq';
  const dict = translations[lang];

  document.documentElement.setAttribute('lang', lang);

  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute('content', lang === 'en' ? 'en_US' : 'sq_AL');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] === undefined) return;
    el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key] === undefined) return;
    el.innerHTML = dict[key];
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const attr = el.getAttribute('data-i18n-attr');
    const key = el.getAttribute('data-i18n');
    if (!attr || dict[key] === undefined) return;
    el.setAttribute(attr, dict[key]);
  });

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  localStorage.setItem(LANG_KEY, lang);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-btn');
  if (!btn) return;
  applyLang(btn.getAttribute('data-lang'));
  if (mainNav?.classList.contains('nav-open')) setNavOpen(false);
});

applyLang(detectDefaultLang());
