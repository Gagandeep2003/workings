# Maintenance guide

The site is static: no server, database or queue to keep alive. What needs occasional attention is **content that depends on outside rules**, **dependencies**,
and the **optional** revenue integrations. Everything below is a periodic review, not an on-call duty.

## Tool classification

**Evergreen — 75 tools.** Pure maths, unit definitions, calendar arithmetic, text/format utilities. They don't change unless there's a bug.
Review only if a bug is reported. (Percentages, fractions, ratios, averages, probability, speed/work, all converters, age/date tools, time zones,
marks/attendance/GPA/CGPA/SGPA tools, salary arithmetic, notice/leave/experience, EMI/amortization/interest/SIP/FD/RD/CAGR/inflation, and all developer tools.)

**Periodically reviewed — 6 tools.** They embed an external rule. Re-check the rule and update `regulatory.reviewedOn` **only** when you have really re-checked it.

| Tool | Rule | Review when | Where |
| --- | --- | --- | --- |
| `ctc-to-take-home-calculator` | India new-regime slabs, ₹75,000 standard deduction, 87A rebate to ₹12 lakh, 4 % cess, PF ceiling | Every Union Budget (Feb) and when the Income-tax Act 2025 rules are notified; each April | `src/engines/career/ctc.ts` (`NEW_REGIME_FY2026_27`), tool `regulatory` block |
| `gst-calculator` | GST slab description (5 / 18 / 40 %; special rates) used in the copy | After any GST Council rate change | `src/tools/defs/money.ts` |
| `ssc-cgl-tier-1-score-calculator` | Tier-I scheme (4 × 25 questions, +2 / −0.5, 200 marks) | When SSC publishes each new CGL notification | `src/engines/exams/ssc.ts` + `defs/exams.ts` |
| `ssc-chsl-tier-1-score-calculator` | Same, for CHSL | Each new CHSL notification | same |
| `cgpa-to-percentage-calculator`, `percentage-to-cgpa-calculator` | CBSE multiplier 9.5 | If CBSE publishes a different rule | `src/engines/student/grades.ts` + `defs/student.ts` |

If a rule is uncertain or changes and you can't update it promptly: **make the tool year-specific, or remove it from `TOOLS`** (and from its category page). Never leave stale rules live.
`tests/engines.exams.test.ts` and `tests/engines.career.test.ts` pin the current rule values — update them together with the rule.

**Dynamic — 0 tools.** Nothing in this release needs an external API. If you later add one (e.g. exchange rates), isolate it in one small server-side module with a timeout and
fallback, set `requiresDynamicData: true` and `reviewal: "dynamic"` (the validator enforces the pairing), cache with `fetch(..., { next: { revalidate } })`, and document its env var in `.env.example`.

## Verification record (what was checked, and against what)

Checked on **2026-10-03** against *published secondary summaries* (the official portals were not directly retrievable when the tools were written):
income-tax new-regime slabs and 87A rebate (Tata Capital explainer), GST 56th Council rate structure (TaxGuru, news reports), SSC CGL 2025 / CHSL 2025 Tier-I schemes
(IIT Kanpur SATHEE, Careers360, Mahendras), CBSE ×9.5 (several explainers). **Action for the owner:** confirm each against the official source (links are on each page), replace
secondary links with the official PDFs/circulars, and then update `reviewedOn`. See RELEASE_CHECKLIST.md.

## Routine tasks

| When | Task |
| --- | --- |
| Monthly | `npm outdated`; `npm audit --omit=dev`; Vercel build log warnings; Search Console → Pages (indexing errors), Core Web Vitals, Performance (which tools get impressions). |
| Quarterly | Update dependencies in a branch (`npm update`, then `npm run verify`). Treat **Next.js, React and TypeScript majors** deliberately (TypeScript is pinned to 5.9). Click through source links on rule-dependent pages. |
| Each Union Budget / GST Council meeting / SSC notification | Review the periodic tools above. |
| Yearly | Re-read the legal pages against how the site actually behaves; review the CSP against any new third-party script; update `SITE.legalUpdated` only if their text changed. |
| When you enable a revenue feature | Re-run `npm run validate:env -- --production`, `npm run monetization:check`, load a page in a browser and confirm there are no CSP violations in the console. |

## Integrations

* **Analytics** (`ANALYTICS_*`): off unless provider + id are set. Only the events in `lib/analytics.ts` with the allow-listed property keys are ever sent. Check the provider's dashboard for tool/category events.
* **AdSense** (`ADS_ENABLED`, `ADSENSE_*`): needs an approved account. Before enabling: set up Google's consent message (AdSense → Privacy & messaging) for EEA/UK/Switzerland traffic, add `public/ads.txt`
  with the line AdSense gives you, and review the ad-heavy pages for accidental-click risk. The CSP in `next.config.ts` is a starting point — confirm in the browser console that ads load without violations.
* **Affiliates** (`src/config/affiliates.ts`, `AFFILIATES_ENABLED`): ships empty. Add only real, relevant offers; keep `disclosureRequired: true`; re-check links quarterly (merchants retire campaigns).
* **Sponsors** (`src/config/sponsors.ts`, `DIRECT_ADS_ENABLED`): ships empty. Images go in `public/sponsors/`. Expired sponsors disappear automatically; remove stale entries when convenient.
* **Search Console / Bing Webmaster**: verify the domain, submit `/sitemap.xml`, watch for "Duplicate, Google chose different canonical" on sibling tools (percentage increase/decrease/change, SSC CGL/CHSL).
