# Banesë për ty

Platformë web për menaxhimin e qerasë në Kosovë — lidh **qeradhënësit**, **qeramarrësit** dhe **administratorin** në një sistem të vetëm: publikim pronash, miratim nga admini, kërkim banesash, kontrata elektronike, pagesa dhe njoftime.

**Demo live:** https://banese-per-ty.netlify.app  
**Repository:** https://github.com/agonmustafaj/banese-per-ty

---

## Teknologjitë

| Shtresa | Teknologji |
|--------|------------|
| Frontend | HTML5, CSS3, JavaScript (ES modules) |
| Backend / DB | [Supabase](https://supabase.com) — PostgreSQL, Auth, Storage, RLS |
| Deploy | Netlify (statik) |
| PDF | Gjenerim kontratash në shfletues (`pdf.js`) |

Nuk ka Node.js runtime për aplikacionin — vetëm skedarë statikë + API Supabase.

---

## Struktura e projektit

```
BANES_PER_TY/
├── index.html              # Faqja kryesore (landing) — prezantim i platformës
├── css/
│   └── landing.css         # Stilet e landing page
├── js/
│   ├── landing.js          # Tekstet dygjuhëshe (SQ/EN) për landing
│   └── landing-nav.js      # Lidhje inteligjente landing → webapp (me rol)
├── favicon.svg
│
├── Website/                # Aplikacioni kryesor (SPA)
│   ├── index.html          # Hyrja e webapp-it
│   ├── css/
│   │   └── styles.css      # Stilet e panelit
│   └── js/
│       ├── app.js          # Inicializim, routing, event handlers
│       ├── auth.js         # Login, regjistrim, Google OAuth, profil
│       ├── auth-rate-limit.js
│       ├── data.js         # Cache lokale + ngarkim/ruajtje Supabase
│       ├── services.js     # Logjika e biznesit (prona, kontrata, pagesa…)
│       ├── services-core.js# Njoftime dhe audit log
│       ├── nav.js          # URL routing (?page=), lejet sipas rolit
│       ├── i18n.js         # Përkthime shqip / anglisht
│       ├── pdf.js          # Eksport PDF kontratash dhe raportesh
│       ├── icons.js        # Ikona SVG inline
│       ├── crypto.js       # Nënshkrim digjital (canvas)
│       ├── config.js       # Lexon window.__BANESE_CONFIG__
│       ├── config.deploy.js# Kredencialet Supabase (publishable key)
│       ├── config.example.js
│       ├── supabase/
│       │   ├── client.js       # Klienti Supabase
│       │   ├── auth-storage.js # Sesion i pavarur për çdo tab shfletuesi
│       │   ├── sync.js         # load/sync të dhënash + upload skedarësh
│       │   └── mappers.js      # Konvertim rresht DB ↔ objekte JS
│       └── views/
│           ├── layout.js   # Shell, login, navigim
│           └── pages.js    # Faqet: home, kërkim, profil, admin…
│
└── supabase/
    ├── schema.sql          # Skema e plotë (tabela, RLS, storage, RPC)
    └── migrations/         # Patch-e SQL (mos ekzekutoni schema.sql dy herë)
        ├── 002_delete_account.sql
        ├── 003_clear_audit_log.sql
        ├── 004_patch_only_new_functions.sql
        └── 005_admin_delete_user.sql
```

---

## Rolet dhe funksionalitetet

| Roli | Përshkrim |
|------|-----------|
| **Qeradhënës** | Shton / modifikon prona, menaxhon kontrata dhe pagesa, shikon kërkesa për kontratë |
| **Qeramarrës** | Kërkon banesa (sipas qytetit + filtra të avancuar), favoritet, kërkon kontratë, ngarkon dëshmi pagese |
| **Administrator** | Miraton ose refuzon prona (me foto dhe detaje), menaxhon përdoruesit, shikon audit log |

**Rrjedha e pronës:** qeradhënësi dërgon → status `në pritje` → admin miraton → status `publikuar` → shfaqet te qeramarrësi në kërkim.

---

## Arkitektura (shkurt)

1. **Landing** (`index.html`) — faqe marketingu; butonat çojnë te `Website/index.html` me parametra URL (`?page=search`, etj.).
2. **Webapp** — SPA me `app.js` që renderon faqe në `#app` sipas `?page=` dhe rolit të përdoruesit.
3. **Të dhënat** — `loadDataAsync()` ngarkon nga Supabase; `saveData()` / `saveDataAsync()` sinkronizon ndryshimet.
4. **Siguria** — Row Level Security (RLS) në PostgreSQL; çdo përdorues sheh vetëm të dhënat e lejuara.
5. **Skedarët** — foto pronash, dëshmi pagese dhe nënshkrime ruhen në Supabase Storage.

---

## Si ta hapni lokalisht

1. Klono ose shpaketoni projektin.
2. Vendosni kredencialet Supabase në `Website/js/config.deploy.js` (ose kopjoni `config.example.js` → `config.deploy.js`):

```javascript
window.__BANESE_CONFIG__ = {
  supabaseUrl: 'https://PROJEKTI-JUAJ.supabase.co',
  supabaseAnonKey: 'ANON_KEY_KETU',
};
```

3. Në Supabase SQL Editor ekzekutoni `supabase/schema.sql` (vetëm herën e parë), pastaj migrimet në `supabase/migrations/` sipas nevojës.
4. Nisni një server lokal (**jo** `file://`):

```bash
cd Website
npx serve .
```

5. Hapni `http://localhost:3000` (ose portin që tregon `serve`).

**Administrator:** regjistrohuni, pastaj në Supabase SQL:

```sql
UPDATE public.profiles SET role = 'administrator' WHERE email = 'emaili-juaj@example.com';
```

---

## Konfigurim Supabase (përmbledhje)

- **Auth:** Email + (opsionale) Google OAuth  
- **URL redirect:** `https://banese-per-ty.netlify.app/Website/index.html`  
- **Storage:** `property-photos`, `payment-proofs`, `contract-signatures`  
- **Mos** vendosni `service_role` key në frontend — vetëm `anon` / publishable key

---

## Autor

Agon Mustafaj — projekt akademik / platformë për menaxhimin e qerasë në Kosovë.
