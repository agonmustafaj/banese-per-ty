# SEO — Banesë për ty

Platforma: **https://banese-per-ty.netlify.app/**  
Gjuha kryesore: **shqip (sq)**  
Webapp (`/Website/`) **nuk indeksohet** — vetëm faqja kryesore (landing).

---

## ✅ E bërë në kod (teknik)

| # | Detyrë | Status |
|---|--------|--------|
| 1 | `<title>` dhe `<meta description>` në `index.html` | ✅ |
| 2 | `canonical` URL | ✅ |
| 3 | Open Graph + Twitter cards | ✅ |
| 4 | `robots.txt` (bllokon `/Website/`) | ✅ |
| 5 | `sitemap.xml` | ✅ |
| 6 | Schema.org (`Organization`) | ✅ |
| 7 | `lang="sq"` në HTML | ✅ |
| 8 | Webapp me `noindex` (login nuk shfaqet në Google) | ✅ |
| 9 | Favicon | ✅ |
| 10 | Strukturë titujsh: një `<h1>`, seksione me `<h2>` | ✅ |

---

## 📋 Ti duhet ta bësh (jashtë kodit)

### Google Search Console (prioritet i lartë)
1. Hyr në [Google Search Console](https://search.google.com/search-console)
2. Shto pronën: `https://banese-per-ty.netlify.app`
3. Verifiko pronën (HTML tag ose DNS)
4. Dërgo sitemap: `https://banese-per-ty.netlify.app/sitemap.xml`
5. Kërko indeksim manual për faqen kryesore (URL Inspection → Request indexing)

### Google Business / lokal (nëse ke entitet)
- Krijo ose përditëso profilin në Google (emri, përshkrim, Kosovë, kategori: shërbim qeraje / softuer)

### Bing Webmaster Tools (opsional)
- [Bing Webmaster](https://www.bing.com/webmasters) — shto sajtin dhe sitemap-in

### Përmbajtje (mbi kohe)
- Përdor fjalë kyçe natyrale: *banesa me qera Kosovë*, *qera Prishtinë*, *kontratë qeraje online*
- Shto tekst unik në seksionet (mos kopjo nga konkurrentët)
- Përditëso statistikat në hero vetëm nëse janë reale
- Shto FAQ në fund të faqes (pyetje + përgjigje) — ndihmon SEO

### Shpejtësia & mobile
- Testo në [PageSpeed Insights](https://pagespeed.web.dev/)
- Sigurohu që faqja kalon testin “Mobile-friendly” në Search Console

### Linke (backlinks)
- Listo platformën në direktoriume lokale / startup Kosovë
- Lidhje nga rrjetet sociale (Facebook, Instagram, LinkedIn) te faqja kryesore
- Partnerë / KREN / universitete — link te `banese-per-ty.netlify.app`

### Rrjetet sociale
- Kur ndan linkun, kontrollo që shfaqet titulli dhe përshkrimi (Open Graph)
- Shto një imazh social `og:image` (1200×630 px) kur të kesh logo/banner

### Domain custom (rekomandohet për SEO afatgjatë)
- P.sh. `baneseperty.com` ose `banese-per-ty.com` → redirect 301 nga Netlify
- Përditëso `canonical`, sitemap dhe Search Console me domain-in e ri

---

## 🔧 Përmirësime të ardhshme (në kod, kur të duash)

| # | Detyrë | Përfitimi |
|---|--------|-----------|
| 1 | `og:image` + `twitter:image` | Pamje më e mirë kur ndahet linku |
| 2 | Seksion FAQ + schema `FAQPage` | Rich results në Google |
| 3 | Schema `WebApplication` | Përshkrim më i mirë si platformë |
| 4 | Domain custom + HTTPS | Besueshmëri & SEO |
| 5 | Blog / artikuj (`/blog/...`) | Trafik organik afatgjatë (pa WordPress mund të bëhen faqe statike) |
| 6 | `hreflang` vetëm `sq` (tashmë vetëm shqip) | — |

---

## ❌ Mos e bëj

- Mos indekso webapp-in (`/Website/`) — është aplikacion, jo faqe marketingu
- Mos përdor WordPress për migrim të plotë (prish webapp + Supabase)
- Mos mbush `keywords` me spam — Google e injoron
- Mos bli backlink-e të falsifikuara

---

## Kontroll i shpejtë pas çdo deploy

```
https://banese-per-ty.netlify.app/robots.txt
https://banese-per-ty.netlify.app/sitemap.xml
https://banese-per-ty.netlify.app/
```

Në browser: View Page Source → kontrollo `<title>`, `description`, `canonical`.

---

*Përditësuar: korrik 2026*
