# Snapsold

> AI-powered resale pricing. Upload a photo, scan a barcode, or type a name —
> get quick-sale, recommended, and max-profit prices based on real eBay
> sold-listing data.

## Tech stack

| Layer            | Choice                                          |
| ---------------- | ----------------------------------------------- |
| Framework        | Next.js 16 (App Router) + React 19              |
| Language         | TypeScript                                      |
| Styling          | Tailwind CSS v4 + shadcn/ui                     |
| Animation        | Motion (Framer Motion successor)                |
| Icons            | lucide-react                                    |
| Auth + DB        | Supabase  *(Phase 1.5)*                         |
| Marketplace data | eBay Browse / Finding APIs  *(Phase 2)*         |
| AI               | OpenRouter (free models first)  *(Phase 4)*     |
| OCR              | OCR.space (free tier) or Tesseract.js           |
| Barcode          | ZXing-js  *(Phase 2)*                           |
| Charts           | Recharts  *(Phase 3)*                           |
| Hosting          | Vercel                                          |

## Getting started

```bash
# 1. Install
npm install

# 2. Copy the env template and fill in keys as you reach each phase
cp .env.example .env.local

# 3. Dev server
npm run dev
# → http://localhost:3000
```

## Project layout

```
src/
  app/
    layout.tsx          ← root layout, dark by default
    page.tsx            ← landing page
    globals.css         ← Tailwind v4 + custom theme tokens
    dashboard/          ← search / upload UI (Phase 2)
  components/
    ui/                 ← shadcn primitives (button, card, badge, …)
    common/             ← project-wide bits (logo, gradient bg)
    nav/                ← site nav + footer
    landing/            ← landing-page sections
  lib/
    utils.ts            ← cn() helper
    (ebay/)             ← Phase 2: eBay client + sold-listing fetcher
    (pricing/)          ← Phase 3: outlier removal, medians, demand scoring
    (ai/)               ← Phase 4: OpenRouter wrapper + prompt builders
    (supabase/)         ← Phase 1.5: typed Supabase client
  types/                ← shared TS types
```

## Roadmap

- [x] **Phase 1** — Next.js scaffold, dark theme, landing page
- [ ] **Phase 1.5** — Supabase auth + protected `/dashboard`
- [ ] **Phase 2** — image upload, OCR, product-name search, eBay client
- [ ] **Phase 3** — pricing analysis engine, histogram chart, recommendations
- [ ] **Phase 4** — AI listing titles, confidence summaries, history page

## Deploy

1. Push to GitHub.
2. Import the repo on [vercel.com/new](https://vercel.com/new).
3. Paste the same vars from `.env.local` into Vercel's project settings.
4. Vercel auto-deploys on every push to `main`.

## License

MIT. Not affiliated with eBay Inc.
