# Final audit (14 areas) and product critique

Scope: the code as shipped, tested in this environment (Node 22, Chromium). Severity: **critical** = would block launch, **high** = fix soon, **medium/low** = monitor.
No critical or high-severity code defects remain open; the *launch* actions that remain are in RELEASE_CHECKLIST.md.

| # | Area | Result |
| --- | --- | --- |
| 1 | Product | Clear purpose in the hero ("Get the answer. See the working."), no login/popup/chatbot/dashboard/database. Features that add upkeep without user value were left out (currency API, accounts, history). |
| 2 | Tool correctness | 448 unit tests; money checked against independent `Decimal` runs, units against exact definitions, QR codes decoded back. Real bugs found and fixed during testing: select values passed as numbers (CGPA scale), word-counter hyphen handling, timestamp expectations, missing `top` ad placement. Merged near-duplicate tools instead of shipping filler (see below). |
| 3 | SEO | `validate:seo` over 97 built pages: unique titles/descriptions, self-canonicals, one H1, Open Graph, valid BreadcrumbList, no orphans or broken links, sitemap/robots verified, no fake `lastmod`. Closest sibling pair (SSC CGL/CHSL) shares 27 % of its text. |
| 4 | Search intent | Calculator sits directly under the H1 and one-line intro; formula, how-it-works, computed example, assumptions, FAQ (only where useful) and related tools follow. |
| 5 | Internal linking | Every tool is on its category page, in the sidebar list and linked from ≥ 3 other tools; contextual `[[links]]` in copy; no footer link farm. |
| 6 | Performance | Fully static; engines load lazily per tool; self-hosted fonts; no third-party requests by default. First-load JS ≈ 180–192 kB gzipped on every page — about 150 kB of that is the Next.js + React runtime. |
| 7 | Mobile / UX | No overflow at 8 widths; dropdown (not overlay) mobile menu; 48 px controls with ≥ 16 px text; results scroll into view; stale-result notice; reduced-motion respected. |
| 8 | Accessibility | axe-core 0 violations in real Chromium (light/dark × mobile/desktop) incl. contrast; token contrast tested; labels, error association, live regions, keyboard combobox, skip link. Screen readers weren't tested by a human. |
| 9 | Security / privacy | No secrets anywhere (scanned); no server-side data; analytics allow-list; strict CSP built from the enabled features; JSON-LD escaped; untrusted URL fragments validated; `rel` attributes on paid links. |
| 10 | Monetization | All off by default; placements in shared layout only; reserved heights; calculator works when ad hosts fail; disclosures and policy pages follow the flags. |
| 11 | Maintainability | New tool = one metadata entry + one function (docs/ADDING_A_TOOL.md); validator fails the build on gaps; env vars documented and checked; no dynamic services to manage. |
| 12 | Deployment | Clean install builds; zero required env vars; production URL/CSP/HSTS configured; preview deployments blocked from indexing. |
| 13 | Content quality | Banned-phrase and repeated-sentence tests; examples computed from engines; assumptions on every page; rule-dependent pages show region, year, sources and review date. |
| 14 | Critique | Below. |

## Deliberate merges (to avoid thin or duplicate pages)
Date difference + days between dates → one tool; countdown + days until → one tool; working-day / business-day calculators → one; HEX↔RGB → one colour converter; semester GPA → GPA calculator;
grade calculator → weighted marks; marks-from-percentage → marks percentage; permutation + combination → one; HCF + LCM → one; Base64 and URL encode/decode → one tool each; loan payment / loan interest → EMI + rate finder. Aliases keep those search phrases working.

## Five biggest reasons a visitor might leave
1. A new, unknown domain competing with established calculator sites — trust has to be earned by accuracy and speed, and there's no social proof by design.
2. No currency/exchange-rate converter, a very common need (it would require a live data source).
3. List-style tools (weighted marks, GPA, SGPA, experience) use "one entry per line" text boxes, which is less friendly than a row-by-row editor.
4. The CTC take-home tool covers only the new regime for salaried individuals in India — users on the old regime or with HRA/NPS get an estimate that may not fit.
5. No saved preferences (currency, units) between visits, and no manual dark/light switch.

## Five biggest SEO weaknesses
1. Zero domain authority and backlinks; nothing in code can fix this.
2. Generic calculators are a commodity; differentiation rests on the shown working, worked examples and speed.
3. Sibling pages (percentage increase/decrease/change; SSC CGL/CHSL) could cannibalise or be canonicalised together by Google — monitor Search Console.
4. One shared Open Graph image; no rich-result eligibility (deliberately no FAQ/rating markup).
5. Core Web Vitals are lab-only until real-user data exists.

## Five biggest technical risks
1. The regex tester runs on the main thread: a catastrophic pattern can freeze that tab (mitigated by caps and a warning, not eliminated).
2. Browser coverage: tested in Chromium only; `Intl.Segmenter`, time-zone data, `color-mix()` and `<input type=date>` behave slightly differently elsewhere.
3. CSP needs `'unsafe-inline'` for scripts because Next.js emits inline bootstrap data and a per-request nonce would make every page dynamic; there is no user-supplied HTML in the app, which limits the exposure. The AdSense part of the CSP is a starting point to confirm with real ads.
4. Monetization flags are read at build time: a typo or forgotten redeploy silently leaves a feature off (`npm run monetization:check` shows the state).
5. Date tools that say "today" trust the visitor's device clock.

## Five biggest maintenance risks
1. Six tools embed rules that change (income tax, GST wording, SSC schemes, CBSE multiplier) and the sources used so far are secondary — someone must own the review calendar in MAINTENANCE.md.
2. Framework churn: Next.js 16 / React 19 / ESLint / TypeScript upgrades (TypeScript is pinned to 5.9 on purpose).
3. 81 pages of prose can't be fact-checked by machine; the tests catch structure, not truth.
4. Source links rot, and affiliate/sponsor links expire.
5. The legal pages are templates that need a one-off professional review and a re-read whenever behaviour changes.
