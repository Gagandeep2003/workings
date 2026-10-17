# SEO architecture

* **URLs** — `/<category>/<slug>` (lowercase, no trailing slash, no query strings). `dynamicParams = false` means every other casing/path is a 404; Next.js
  redirects a trailing slash to the canonical form. One URL per tool (enforced: `slug === id`).
* **Metadata** — generated from the registry (`lib/seo.ts`): unique title/description, self-canonical, Open Graph + Twitter card (one shared 1200×630 image), `robots: index,follow`.
  `/search` is `noindex,follow` (internal search results). Preview deployments get `Disallow: /` from `robots.ts` via `VERCEL_ENV`.
* **Sitemap** — `app/sitemap.ts`, built from the registry. `lastmod` appears **only** where a real date exists (`regulatory.reviewedOn`, `lastModified`, legal-page revision date).
* **robots.txt** — allows everything including `/_next/` assets (and, by default, names AI crawlers explicitly); points to the sitemap. Preview deployments get `Disallow: /`.
* **Structured data** (`lib/seo.ts`, all JSON-LD `@graph`s, validated against the built HTML by `validate:seo`):
  tool pages — `WebApplication` (free, in-browser, canonical URL, real `datePublished`/`dateModified` only), `BreadcrumbList`, and `FAQPage` **only when the page visibly shows those questions**;
  category pages and `/tools` — `CollectionPage` + `ItemList` + `BreadcrumbList`; home — `WebSite` with a working on-site `SearchAction`.
  A publisher entity (`Organization` or `Person`) is emitted only if **both** `SITE_OPERATOR_NAME` and `SITE_OPERATOR_TYPE` are set. Never emitted: ratings, reviews, prices, offers, authors — the validator checks for those *keys*.
  Honest note on FAQ markup: it is valid and describes visible content, but since 2023 Google shows FAQ rich results only for a small set of authoritative sites, so don't expect a Google result enhancement from it.
  It stays because it is accurate and other consumers (other search engines, assistants) can read it; to remove it, delete the `FAQPage` push in `toolJsonLd`.
* **Directory and discovery** — `/tools` lists every tool in plain HTML links, the header search and hero search read the same registry, category pages link every tool, related links and contextual `[[links]]` connect tools.
* **Sitemap** — includes `/tools`. `lastmod` appears only where a real date exists (`lastModified`, `regulatory.reviewedOn`, or `addedOn`).
* **AI search / GEO** — what is implemented, and what is not claimed:
  `/llms.txt` (curated index) and `/llms-full.txt` (every tool's formula, assumptions, a worked example computed by the real engine, source and review date, FAQs) are generated from the registry by `lib/llms.ts`.
  `robots.txt` names the AI crawlers explicitly; `AI_CRAWLERS=allow|search-only|block` (see `.env.example`) sets the policy (default `allow`; `search-only` keeps assistants that fetch pages to answer a question and blocks crawlers that collect training data).
  The pages themselves are answer-first: one-sentence intro, formula, worked example, assumptions and dated sources are in the static HTML.
  **No major search or AI product has promised to read `llms.txt`, and no markup or file can guarantee citations, rankings or traffic.** The durable levers are the same as for search: accurate, specific, well-structured pages that other sites link to.
* **Rendering** — tool pages, calculator inputs, formula, explanation, example result, FAQ and related links are all in the static HTML. Only results are computed client-side.
* **Internal linking** — breadcrumbs, category hubs, 3–7 related tools per tool (user-journey based), contextual `[[links]]` inside the copy, a "More in <category>" sidebar.
* **Validation** — `npm run validate:seo` inspects the built HTML (see README). Search Console tasks are in MAINTENANCE.md.
