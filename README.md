# Workings

Calculators, converters and developer tools that show the formula behind every answer — no sign-up, no database, no backend.
Built with Next.js (App Router) + TypeScript, statically generated, deployable to Vercel as-is.

* **81 tools** in 7 categories (Math 20 · Everyday 14 · Student 11 · Career 8 · Money 11 · Developer 15 · Exams 2).
* Every result comes from a **deterministic, unit-tested TypeScript function**. No LLM, no API, no runtime lookups.
* Worked examples on each page are **computed from the real engine at build time**, so they can't go stale.
* Developer tools process everything **in the browser**; share links are disabled for them.
* Monetization (AdSense, affiliates, direct sponsors, analytics) is **off by default** and configured only through environment variables and two small config files.

## Quick start

```bash
npm install            # Node 20.9+ (Vercel default works)
npm run dev            # http://localhost:3000
npm run verify         # typecheck + lint + unit tests + production build + every validator
```

Deploy: import the repo into Vercel — no environment variables are required to build. Before launch set `NEXT_PUBLIC_SITE_URL`
(your https domain) and `CONTACT_EMAIL`; see `.env.example` and `RELEASE_CHECKLIST.md`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Standard Next.js. `build` first runs the registry validator and **fails if any tool is incomplete**. |
| `npm run typecheck` · `lint` · `test` | TypeScript, ESLint, Vitest (448 tests). |
| `npm run validate:registry` | Every tool has all metadata, a valid route, working examples, related links, unique SEO text. |
| `npm run validate:seo` | Post-build: titles, descriptions, canonicals, H1, Open Graph, JSON-LD, links, orphans, sitemap, robots, near-duplicate content. |
| `npm run validate:a11y` | Post-build: axe-core (WCAG 2.x A/AA + best practice) over every built page. |
| `npm run validate:env` | Every env variable is documented; no secret-looking `NEXT_PUBLIC_` names. Add `-- --production` to make launch warnings errors. |
| `npm run validate:secrets` | Scans source, build output and the client bundle for secrets and server-only values. |
| `npm run validate:bundle` | First-load JavaScript per key page, with budgets. |
| `npm run monetization:check` | Prints the monetization readiness report (the page `/dev/monetization` shows the same in development only). |

## Project layout

```
src/
  tools/        registry.ts, categories.ts, validate.ts, defs/<category>.ts   ← all tool metadata and content
  engines/      <category>/*.ts, loaders.ts                                    ← pure calculation functions (no UI)
  lib/          numeric, dates, tz, units, format, form, search, seo, analytics, monetization/
  components/   layout/, tool/ (ToolRunner, ResultView, Fields…), monetization/
  config/       monetization.ts, affiliates.ts, sponsors.ts
  app/          pages: / · /[category] · /[category]/[slug] · /search · legal pages · sitemap · robots
  styles/       tokens.css (design tokens), base.css, components.css
scripts/        validation scripts      tests/  Vitest      qa/  Playwright browser checks      docs/  guides
```

More: `docs/ADDING_A_TOOL.md` · `docs/PRECISION.md` · `docs/SEO.md` · `docs/MONETIZATION.md` · `docs/CONTENT_CHECKLIST.md` · `docs/QA.md` · `docs/AUDIT.md` · `MAINTENANCE.md`.
