# Lidhja me Supabase — Banesë për ty

Ky udhëzues ju ndihmon të kaloni nga demo (localStorage) në **të dhëna reale** me Supabase.

## 1. Krijoni projektin Supabase

Projekti juaj: [efhupcsheopwldvubrit](https://supabase.com/dashboard/project/efhupcsheopwldvubrit)

1. Shkoni te [supabase.com](https://supabase.com) dhe hyni në projektin tuaj.
2. Në **Project Settings → API** ([link direkt](https://supabase.com/dashboard/project/efhupcsheopwldvubrit/settings/api)), kopjoni:
   - **Project URL** → `https://efhupcsheopwldvubrit.supabase.co` (tashmë i vendosur)
   - **anon public** key

## 2. Ekzekutoni skemën e databazës

1. Hapni **SQL Editor** në Supabase Dashboard.
2. Kopjoni dhe ekzekutoni të gjithë përmbajtjen e skedarit:

   `supabase/schema.sql`

3. Verifikoni që u krijuan tabelat: `profiles`, `properties`, `contracts`, `payments`, etj.

## 3. Konfiguroni aplikacionin

Hapni `Website/js/config.local.js` dhe vendosni kredencialet:

```javascript
window.__BANESE_CONFIG__ = {
  supabaseUrl: 'https://efhupcsheopwldvubrit.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};
```

> **Mos** vendosni `service_role` key në frontend — vetëm `anon` key.

## 4. Cilësimet e Auth

Në Supabase Dashboard → **Authentication → Providers**:

- Aktivizoni **Email**
- Për testim të shpejtë: çaktivizoni **Confirm email** (Settings → Auth → Email)

Në **Authentication → URL Configuration**, shtoni URL-të tuaja:

- `http://localhost:5500` (ose porti juaj lokal)
- URL-ja e deploy-it (p.sh. `https://banesa-per-ty.netlify.app`)

## 5. Storage buckets

Skema SQL krijon automatikisht:

| Bucket | Qëllimi |
|--------|---------|
| `property-photos` | Foto të pronave (publike) |
| `payment-proofs` | Dëshmi pagese (private) |
| `contract-signatures` | Nënshkrime digjitale (private) |

Nëse bucket-et nuk u krijuan, krijojini manualisht në **Storage** me të njëjtat emra.

## 6. Krijoni llogarinë e administratorit

1. Regjistrohuni në aplikacion si përdorues i ri.
2. Në Supabase **SQL Editor**, ekzekutoni:

```sql
update public.profiles
set role = 'administrator'
where email = 'emaili-juaj@example.com';
```

3. Çkyçuni dhe kyçuni përsëri.

## 7. Testoni

1. Hapni `Website/index.html` përmes një serveri lokal (jo `file://`):

```bash
cd Website
npx serve .
```

2. Regjistrohuni si **Qeradhënës** ose **Qeramarrës**.
3. Publikoni një pronë → miratoni si admin.
4. Kërkoni kontratë → nënshkruani → ngarkoni dëshmi pagese.

## Si funksionon në kod

| Pa Supabase (demo) | Me Supabase |
|--------------------|-------------|
| `localStorage` | PostgreSQL + RLS |
| Auth custom | Supabase Auth |
| Foto base64 | Supabase Storage |
| Njoftime lokale | Tabela `notifications` (+ Realtime opsional) |

Aplikacioni zbulon automatikisht Supabase kur `config.local.js` ka URL dhe key të vlefshme. Pa konfigurim, vazhdon të punojë në modalitet demo.

## Realtime për njoftime (opsionale)

Në Supabase Dashboard → **Database → Replication**, aktivizoni tabelën `notifications` për njoftime live.

## Deploy në prodhim

- Vendosni `config.local.js` me kredencialet (ose përdorni variabla mjedisi nëse shtoni build step).
- Shtoni domain-in live në Supabase Auth → Redirect URLs.
- Përdorni HTTPS.

## Probleme të zakonshme

| Problem | Zgjidhje |
|---------|----------|
| "Invalid API key" | Kontrolloni `supabaseAnonKey` në `config.local.js` |
| Regjistrimi kërkon konfirmim email | Çaktivizoni "Confirm email" ose konfirmoni inbox-in |
| Nuk shfaqen prona | Kontrolloni RLS — pronat duhet miratuar nga admin |
| Foto nuk ngarkohen | Verifikoni bucket `property-photos` dhe storage policies |
| CORS / network error | Përdorni server lokal, jo `file://` |

---

**Powered by Agon Mustafaj** — integrimi Supabase u shtua për të mbështetur përdorues dhe të dhëna reale.
