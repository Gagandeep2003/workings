# Maintenance guide

The site is static: no server, database or queue to keep alive. What needs occasional attention is **content that depends on outside rules**, **dependencies**,
and the **optional** revenue integrations. Everything below is a periodic review, not an on-call duty.

## File tools: dependencies to watch

The image, PDF and QR tools (`src/components/files`, `src/lib/files`) depend on a few packages. None adds a server cost, but they are worth a look a few times a year:

| Package | Used for | Notes |
| --- | --- | --- |
| `@cantoo/pdf-lib` | Building, merging, splitting and re-writing PDFs; password handling | Maintained fork of `pdf-lib` (MIT). The original `pdf-lib` has had no release since 2022. |
| `pdfjs-dist` | Drawing PDF pages (previews and "maximum" compression) | Apache-2.0. Loaded only on PDF pages; its worker file is about 1 MB. Always import from `pdfjs-dist/legacy/build/…` for wider browser support. |
| `upng-js` (+ `pako`) | Lossy PNG (colour reduction) | MIT. Not updated since 2022 but small and stable; only loaded when a PNG is compressed. |
| `qrcode-generator` | QR module matrix | MIT, tiny. |

After upgrading any of them run `npm run build`, then `python3 qa/file_tools.py` (see `qa/README.md`) — it exercises every file tool in a real browser and verifies the downloaded files independently. The first-load JavaScript budget (`npm run validate:bundle`) should not change, because these libraries are loaded on demand.

The photo and signature **presets** (`PRESETS` in `src/components/files/PhotoResizer.tsx`) are commonly published values, not rules. Exam bodies change them between notifications; review them when you notice a change, and never present them as mandatory.

## Tool classification

**Evergreen — 108 tools.** Pure maths, unit definitions, calendar arithmetic, text/format utilities. They don't change unless there's a bug.
Review only if a bug is reported. (Percentages, fractions, ratios, averages, probability, speed/work, all converters, age/date tools, time zones,
marks/attendance/GPA/CGPA/SGPA tools, salary arithmetic, notice/leave/experience, EMI/amortization/interest/SIP/FD/RD/CAGR/inflation, and all developer tools.)

**Periodically reviewed — 19 tools.** They embed an external rule. Re-check the rule and update `regulatory.reviewedOn` **only** when you have really re-checked it.

| Tool | Rule | Review when | Where |
| --- | --- | --- | --- |
| `ctc-to-take-home-calculator` | India new-regime slabs, ₹75,000 standard deduction, 87A rebate to ₹12 lakh, 4 % cess, PF ceiling | Every Union Budget (Feb) and when the Income-tax Act 2025 rules are notified; each April | `src/engines/career/ctc.ts` (`NEW_REGIME_FY2026_27`), tool `regulatory` block |
| `gst-calculator` | GST slab description (5 / 18 / 40 %; special rates) used in the copy | After any GST Council rate change | `src/tools/defs/money.ts` |
| `ssc-cgl-tier-1-score-calculator` | Tier-I scheme (4 × 25 questions, +2 / −0.5, 200 marks) | When SSC publishes each new CGL notification | `src/engines/exams/ssc.ts` + `defs/exams.ts` |
| `ssc-chsl-tier-1-score-calculator` | Same, for CHSL | Each new CHSL notification | same |
| `cgpa-to-percentage-calculator`, `percentage-to-cgpa-calculator` | CBSE multiplier 9.5 | If CBSE publishes a different rule | `src/engines/student/grades.ts` + `defs/student.ts` |
| `jee-main-marks-calculator` | Paper 1 pattern (25 questions per subject: 20 MCQ + 5 numerical), +4 / −1 MCQ, Section B penalty shown both ways | Each JEE Main bulletin (twice a year) | `src/engines/exams/entrance.ts` + `defs/exams-entrance.ts` |
| `jee-main-percentile-calculator` | NTA percentile definition (candidates at or below you ÷ candidates in the session; 7 decimals) | If NTA changes its normalisation | `src/engines/exams/percentile.ts` |
| `jee-advanced-marks-calculator` | Rule types (partial marking, penalties); marks per type are user-editable | Each JEE Advanced brochure (yearly) | `src/engines/exams/entrance.ts` |
| `neet-ug-marks-calculator`, `neet-qualifying-cutoff-checker` | 180 compulsory questions, +4 / −1, 720 marks; qualifying percentiles 50 / 45 / 40 | Each NEET (UG) bulletin | `src/engines/exams/entrance.ts` |
| `gate-marks-calculator`, `gate-score-calculator` | ⅓ / ⅔ MCQ penalty; score formula `Sq + (St − Sq)(M − Mq)/(Mt − Mq)` with Sq = 350, St = 900 | Each GATE brochure (yearly, new organising IIT) | `src/engines/exams/gate.ts` |
| `cat-score-calculator`, `cat-percentile-calculator` | CAT 2025 pattern: 24 / 22 / 22 questions, +3 / −1 MCQ, no TITA penalty, 204 marks | Each CAT notification (yearly) | `src/engines/exams/management.ts` |
| `ssc-mts-score-calculator` | 2025 notification: Session I 40 Q (no penalty), Session II 50 Q (−1), 3 marks per question | Each SSC MTS notification | `src/engines/exams/government.ts` |
| `banking-prelims-score-calculator` | IBPS PO Prelims 100 Q (30 / 35 / 35), ¼ penalty, equal marks per question | Each IBPS PO / Clerk notification | same |
| `upsc-prelims-score-calculator` | GS Paper I 100 × 2, CSAT 80 × 2.5, ⅓ penalty, CSAT 33 % qualifying | If UPSC changes the Prelims scheme | same |
| `rrb-ntpc-group-d-score-calculator` | NTPC CBT-1 (100), CBT-2 (120), Group D (100): 1 mark, ⅓ penalty | Each RRB notification | same |

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


## Exam tools added in October 2026 — what to confirm yourself

The exam rules were cross-checked against several independent published summaries on 2026-10-13. **The official bulletins and notifications could not be opened during that review**,
so each tool says so in its "Sources and review" box. Before relying on them for a new cycle, open the official source linked on the tool's page and confirm:

* **JEE Main Section B penalty.** Sources disagreed (zero penalty vs −1 for a wrong numerical answer), so the tool shows both totals. If you confirm the rule, set the select's default and
  simplify the copy in `defs/exams-entrance.ts`.
* **JEE Advanced marks per question type.** Section counts and marks differ between summaries and between years, so the marks are editable inputs. Only the rule *types* are modelled.
* **IBPS PO prelims per-section marks.** Sources disagree (30/30/40 vs equal marks). The tool treats every question as equal marks and lets the user edit it.
* **CAT percentile / GATE Mq and Mt.** The tools apply the standard percentile definition and the published GATE formula to figures the visitor supplies. No cut-off, Mq, Mt or rank table is embedded, deliberately.

**Deliberately not built** because no reliable, verifiable scheme was found: XAT, MAT and CMAT score tools, and any rank estimator (a rank needs every candidate's marks).
