# Udhëzues i thjeshtë — Supabase (hap pas hapi)

Projekti yt: **efhupcsheopwldvubrit**

Bëhen vetëm **2 gjëra**. Zgjat ~5 minuta.

---

## PJESA 1 — Merr çelësin (API Key)

1. Hap këtë link në Chrome/Edge:
   **https://supabase.com/dashboard/project/efhupcsheopwldvubrit/settings/api**

2. Nëse të kërkon login → hyr me llogarinë Supabase (Google/GitHub/email).

3. Në faqe, gjej seksionin **Project API keys**.

4. Te **anon** **public** (JO "service_role"!) kliko ikonën **Copy** pranë çelësit.
   - Çelësi fillon me `eyJhbGciOiJIUzI1NiIs...` dhe është shumë i gjatë.

5. Hap në Cursor skedarin:
   `Website/js/config.local.js`

6. Zëvendëso `YOUR_ANON_PUBLIC_KEY` me çelësin që kopjove:

```javascript
window.__BANESE_CONFIG__ = {
  supabaseUrl: 'https://efhupcsheopwldvubrit.supabase.co',
  supabaseAnonKey: 'KOLLO KETU ÇELËSIN E GJATË',
};
```

7. Ruaj skedarin (Ctrl+S).

---

## PJESA 2 — Krijo tabelat në databazë (SQL)

1. Hap:
   **https://supabase.com/dashboard/project/efhupcsheopwldvubrit/sql/new**

2. Në Cursor, hap skedarin `supabase/schema.sql` nga projekti yt.

3. Selekto **GJITHÇKA** (Ctrl+A) dhe kopjo (Ctrl+C).

4. Kthehu te Supabase SQL Editor dhe ngjit (Ctrl+V).

5. Kliko butonin **Run** (ose Ctrl+Enter).

6. Duhet të shfaqet mesazh i gjelbër **Success** (ose "Success. No rows returned").

---

## PJESA 3 — Çaktivizo konfirmimin e email-it (për testim)

1. Hap:
   **https://supabase.com/dashboard/project/efhupcsheopwldvubrit/auth/providers**

2. Kliko **Email**.

3. Fikse (OFF) opsionin **Confirm email**.

4. Kliko **Save**.

---

## PJESA 4 — Testo aplikacionin

1. Hap PowerShell në folderin `Website`:

```powershell
cd "C:\Users\hp\OneDrive - Kosovo Research and Education Network (KREN)\Desktop\BANES_PER_TY\Website"
npx serve .
```

2. Hap në shfletues adresën që shfaqet (zakonisht `http://localhost:3000`).

3. Kliko **Regjistrohu** dhe krijo një llogari.

4. Për t'u bërë **administrator**, pas regjistrimit:
   - Shko te **https://supabase.com/dashboard/project/efhupcsheopwldvubrit/sql/new**
   - Shkruaj (ndërro email-in me tëndin):

```sql
update public.profiles
set role = 'administrator'
where email = 'emaili-yte@gmail.com';
```

   - Kliko **Run**, pastaj çkyçu dhe hyr përsëri në app.

---

## Nëse diçka nuk punon

| Problem | Çfarë të bësh |
|---------|----------------|
| Nuk gjej anon key | Vetëm **anon public**, jo service_role |
| SQL error | Kopjo përsëri të gjithë `schema.sql` dhe Run |
| Regjistrimi nuk punon | Fikse Confirm email (Pjesa 3) |
| Faqja nuk hapet | Përdor `npx serve .`, mos e hap `index.html` direkt |

---

## Më e lehta: më dërgo çelësin

Nëse nuk dëshiron ta vendosësh vetë, kopjo **anon public key** nga Supabase dhe më dërgo këtu në chat — unë e vendos në `config.local.js` për ty.

**Mos më dërgo** `service_role` key — ai është sekret!
