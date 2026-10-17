# Redesign, SEO/GEO and tool expansion — October 2026

What was found in the audit, what changed, what was decided and why, and what was deliberately **not** done.

## Audit findings (before any change)

The codebase was already in good shape: a single data-driven registry, build-time validators, 448 passing tests, a light-first token system, server-rendered tool pages, an automatic sitemap, per-tool metadata.
So this was an evolution, not a rewrite. The real gaps were:

| Gap | Resolution |
| --- | --- |
| No manual theme switch (the site followed the OS only — a dark-mode visitor saw a dark site with no way back) | Light / dark / system toggle, persisted, applied before first paint (no flash) |
| Tool cards had no per-tool icon; Math shared the primary action blue | 110 Lucide icons (ISC licence) copied in as data, one per tool; Math gets its own accent; all pairs re-checked for WCAG contrast |
| Home page: no *Recently added*, nothing for Exams or conversions, "Loading tools…" leaked into the server HTML | New home page, real `addedOn` dates, no leaked status text |
| No directory page / sitemap link in the footer | `/tools` directory, footer link |
| Exams had 2 tools | 17 (see below) |
| Missing Math/Everyday/Developer/Money tools from the brief | 46 new tools, after checking for duplicates (see below) |
| Structured data: breadcrumbs only | `WebApplication`, `FAQPage` (visible FAQs only), `CollectionPage`, `WebSite` + `SearchAction`; publisher only if configured |
| No AI-search layer | `llms.txt`, `llms-full.txt`, explicit AI-crawler policy |

**Pre-existing bug found by the new tests:** typing a tool's exact title in search could open a *different* tool (e.g. "Percentage Calculator" opened "Marks Percentage Calculator"), because every title that merely contained the words got the same bonus. Fixed (exact title match wins) and covered by a test over all tools.

## Decisions

* **URLs kept as `/[category]/[slug]`.** They are descriptive, stable, already live, and the brief says to preserve working URLs. No `/tools/<slug>` prefix and therefore no redirects were needed. (`/tools` is the directory page.)
* **No duplicates added.** Mean/median/mode, "resignation date", cooking measures, CSS minify and "MB to GB" were already covered by existing tools and are reachable through aliases. HTML and JavaScript minifiers were *not* built: a correct one needs a real parser and a regex version can silently break pages.
* **Exam rules are verified, and disagreements are shown rather than hidden** — see the next section.
* **FAQ markup is kept** although Google no longer shows FAQ rich results for most sites; it is accurate, describes visible content, and is a one-line removal (`docs/SEO.md`).

## Exam tools — how the rules were checked

The official bulletins could not be opened from the build environment, so each rule was cross-checked against several independent published summaries (and, where a site quotes the notification, that quote). Every exam page states this in its "Sources and review" box.

| Tool(s) | Rule modelled | Confidence / what is left to the owner |
| --- | --- | --- |
| NEET UG marks, qualifying checker | 180 compulsory questions, +4/−1, 720; qualifying percentiles 50 / 45 / 40 | All sources agree. Cut-off *marks* are deliberately not stored (they change yearly): the visitor enters them |
| GATE marks, GATE score | ⅓ / ⅔ MCQ penalty, none for MSQ/NAT; `S = Sq + (St − Sq)(M − Mq)/(Mt − Mq)`, Sq 350, St 900 | Sources agree. Mq and Mt are inputs (published per paper and year) |
| CAT score | 24/22/22 questions, +3/−1 MCQ, no TITA penalty, 204 | Sources agree for the 2025 pattern |
| JEE Main percentile; CAT percentile | percentile = % of candidates at or below you (NTA: per session, 7 decimals) | NTA definition confirmed; CAT uses the same standard definition. **Needs your real rank/counts — no marks→percentile table exists, by design** |
| UPSC Prelims | GS 100×2, CSAT 80×2.5, ⅓ penalty, CSAT 33% qualifying | Sources agree |
| SSC MTS | Session I no penalty, Session II −1, 3 marks, 270 | One source quotes the notification |
| RRB NTPC / Group D | 1 mark, ⅓ penalty, 100/120/100 questions | Sources agree |
| **JEE Main marks** | +4/−1 MCQ (agreed) — **Section B penalty: sources disagree** | Tool shows **both totals**. Confirm in the official bulletin and set the default |
| **JEE Advanced marks** | Rule *types* only (partial marking, penalties) | Section counts and marks differ by source and year, so the marks are **editable inputs** |
| **Banking prelims** | 100 Q, ¼ penalty (agreed) — **per-section marks disagree** | Equal marks per question by default, editable |

**Not built, deliberately:** XAT, MAT, CMAT score tools and any **rank estimator**. No verifiable scheme or defensible dataset was found, and the brief forbids fabricated precision.

## What was built

* **Design system** — tokens (light, dark, system), category accents, compact header, theme toggle, cards and rows, hero, `/tools`, category pages with one-sentence intro and collapsible detail, tool-page template (icon, concise intro, rule badge, calculator first; formula and worked example before the long explanation).
* **46 new tools** — Math 16, Everyday 3, Money 3, Career 1, Developer 8, Exams 15.
* **Engines are pure and tested**: expression parser (no `eval`), prime library (deterministic Miller–Rabin), cron parser, safe Markdown parser (typed tree → React, never raw HTML).
* **Infrastructure** — async-capable engines, opt-in local persistence, `ruleFree`, `addedOn`, `alsoToolIds`, validators extended (8–18-word descriptions, graph-aware and key-based structured-data checks, FAQ-must-be-visible).

## Bugs the new tests found in the new code (all fixed)

`sin(180)` returned `1.2e-16`; `2x3` and `sin30` gave misleading errors; cron treated `*/2` + a weekday as "either" instead of Vixie's "both"; slug truncation dropped a whole word when the limit fell on a boundary;
the hash tool counted UTF-16 units as "characters"; a result table overflowed phone screens (a grid track without `minmax(0, …)`); one long formula string overflowed too.

## Not done / limitations

* **No guarantee of rankings, indexing, traffic, or AI citations** — nothing can provide one. The work makes every tool independently crawlable, uniquely described, structured and fast; results depend on links, content quality and time.
* **No per-tool Open Graph images** (all pages share one social image).
* **Only Chromium was tested** (no Safari/iOS, Firefox, real devices or screen readers). Core Web Vitals were not measured in the field; only a static first-load JavaScript budget is enforced.
* The exam tools are **estimates from published definitions, not official results**, and say so.

## Owner actions

1. Set `NEXT_PUBLIC_SITE_URL` and `CONTACT_EMAIL` before launch (`npm run validate:env -- --production` lists what is missing). Optionally `SITE_OPERATOR_NAME` + `SITE_OPERATOR_TYPE`, and `AI_CRAWLERS`.
2. Open the official sources linked on the exam pages and confirm the three disputed items above; update `regulatory.reviewedOn` only after a real check.
3. After deploying, submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
