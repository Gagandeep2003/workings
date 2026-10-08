# SEO architecture

* **URLs** — `/<category>/<slug>` (lowercase, no trailing slash, no query strings). `dynamicParams = false` means every other casing/path is a 404; Next.js
  redirects a trailing slash to the canonical form. One URL per tool (enforced: `slug === id`).
* **Metadata** — generated from the registry (`lib/seo.ts`): unique title/description, self-canonical, Open Graph + Twitter card (one shared 1200×630 image), `robots: index,follow`.
  `/search` is `noindex,follow` (internal search results). Preview deployments get `Disallow: /` from `robots.ts` via `VERCEL_ENV`.
* **Sitemap** — `app/sitemap.ts`, built from the registry. `lastmod` appears **only** where a real date exists (`regulatory.reviewedOn`, `lastModified`, legal-page revision date).
* **robots.txt** — allows everything including `/_next/` assets; points to the sitemap.
* **Structured data** — `BreadcrumbList` on tool and category pages and `WebSite` on the home page. Nothing else: no ratings, reviews, prices, authors, Organization or FAQ markup
  (FAQ rich results aren't available for this kind of site and fabricating them is a policy violation).
* **Rendering** — tool pages, calculator inputs, formula, explanation, example result, FAQ and related links are all in the static HTML. Only results are computed client-side.
* **Internal linking** — breadcrumbs, category hubs, 3–7 related tools per tool (user-journey based), contextual `[[links]]` inside the copy, a "More in <category>" sidebar.
* **Validation** — `npm run validate:seo` inspects the built HTML (see README). Search Console tasks are in MAINTENANCE.md.
