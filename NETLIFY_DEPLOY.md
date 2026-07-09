# Deploy në Netlify — Banesë për ty

## Para deploy-it (Supabase)

1. Ekzekuto `supabase/schema.sql` në SQL Editor (nëse nuk e ke bërë).
2. Në [Auth → Providers → Email](https://supabase.com/dashboard/project/efhupcsheopwldvubrit/auth/providers): fikse **Confirm email** (për testim).

---

## Hapi 1 — Ngarko projektin në GitHub

Nëse nuk e ke në GitHub:

```powershell
cd "C:\Users\hp\OneDrive - Kosovo Research and Education Network (KREN)\Desktop\BANES_PER_TY"
git add .
git commit -m "Deploy Netlify"
git push
```

---

## Hapi 2 — Lidhe me Netlify

1. Hyr në [netlify.com](https://www.netlify.com) → **Add new site** → **Import an existing project**
2. Zgjidh **GitHub** dhe repozitorin tënd
3. Netlify lexon automatikisht `netlify.toml` — **mos ndrysho asgjë** te Build settings:
   - **Build command:** `node scripts/generate-config.js`
   - **Publish directory:** `.` (rrënja e projektit)

---

## Hapi 3 — Variablat e mjedisit (SHUMË E RËNDËSISHME)

Në Netlify: **Site configuration → Environment variables → Add a variable**

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | `https://efhupcsheopwldvubrit.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_Le9AH7vZhVOCVqN8QnmFvA_TXSxlCv7` |

Kliko **Save** → pastaj **Deploys → Trigger deploy → Deploy site**.

---

## Hapi 4 — Supabase: lejo URL-në e Netlify

Pas deploy-it, URL-ja e projektit:

**https://banese-per-ty.netlify.app**

| Faqe | URL |
|------|-----|
| Landing | https://banese-per-ty.netlify.app/ |
| Webapp | https://banese-per-ty.netlify.app/Website/ |

Në Supabase:

1. [Auth → URL Configuration](https://supabase.com/dashboard/project/efhupcsheopwldvubrit/auth/url-configuration)

2. **Site URL:**
   ```
   https://banese-per-ty.netlify.app
   ```

3. **Redirect URLs** (shto të dyja):
   ```
   https://banese-per-ty.netlify.app/**
   https://banese-per-ty.netlify.app/Website/index.html
   ```

4. Kliko **Save**

---

## Hapi 5 — Testo

| Faqe | URL |
|------|-----|
| Landing (marketing) | `https://EMRI-YT.netlify.app/` |
| Webapp (login) | `https://EMRI-YT.netlify.app/Website/` |

1. Hap webapp-in → **Regjistrohu**
2. Bëhu admin (SQL në Supabase):
   ```sql
   update public.profiles set role = 'administrator' where email = 'emaili-yte@gmail.com';
   ```

---

## Struktura e deploy-it

```
/                    → index.html (landing)
/Website/            → aplikacioni (login, prona, kontrata)
/favicon.svg
/css/                → landing styles
```

---

## Probleme të zakonshme

| Problem | Zgjidhje |
|---------|----------|
| Login nuk punon | Shto URL-në Netlify te Supabase Redirect URLs |
| "Invalid API key" | Kontrollo `SUPABASE_ANON_KEY` në Netlify env vars |
| Faqe bosh / 404 | Publish directory duhet të jetë `.` jo `Website` |
| Supabase demo mode | Variablat e mjedisit mungojnë — rindeploy pas shtimit |
| CORS error | Përdor HTTPS të Netlify, jo file:// |

---

## Domain custom (opsionale)

Në Netlify: **Domain management → Add custom domain**

Pastaj përditëso të njëjtat URL në Supabase Auth me domain-in tënd të ri.
