# Release checklist

Only the actions that genuinely remain. The code is complete and verified; these items need information or access that only the site owner has, or testing this environment couldn't do.

## Must fix before launch

1. **Set the identity variables in Vercel** (Production): `NEXT_PUBLIC_SITE_URL` (https domain, no trailing slash), `CONTACT_EMAIL`, and `SITE_OPERATOR_NAME`.
   Then redeploy and run `npm run validate:env -- --production` (it fails if any launch value is missing). Until `CONTACT_EMAIL` is set the Contact page honestly says no address is published.
2. **Confirm the rule-dependent tools against official sources, then update `reviewedOn`.** They were checked on 2026-10-03 against published *secondary* summaries only:
   income-tax new-regime slabs / ₹75,000 standard deduction / 87A rebate / PF ceiling (`ctc-to-take-home-calculator`, constants in `src/engines/career/ctc.ts`),
   GST slab description (`gst-calculator`), SSC CGL and CHSL 2025 Tier-I schemes (read the notices on ssc.gov.in), CBSE ×9.5 (`cgpa-to-percentage-calculator`, `percentage-to-cgpa-calculator`).
   Replace the secondary links in each tool's `regulatory.sources` with the official PDFs/circulars. If you can't confirm one, remove that tool from `TOOLS` and its category page rather than ship it.
3. **Have the legal pages reviewed for your jurisdiction and real operator details.** Privacy Policy, Terms, Disclaimer and Advertising Disclosure are written to match exactly how the site behaves (and adapt to the enabled
   integrations), but they are templates, not legal advice, and they don't name a legal entity, postal address or governing law.
4. **Test on Safari (iOS and macOS) and Firefox.** Only Chromium was available during development. Check: date/time inputs, native selects, copy and share buttons, the search combobox, the time-zone converter,
   word counter on non-Latin text, and the QR PNG download.
5. **Run `npm run verify` on the Vercel preview deployment, then check PageSpeed Insights** for a tool page on mobile (field Core Web Vitals don't exist yet for a new domain).
6. **Verify the domain in Google Search Console (and Bing Webmaster Tools), submit `/sitemap.xml`, and confirm the Production robots.txt allows crawling** (Preview deployments intentionally disallow everything).

## Only if you enable ads, affiliates, sponsors or analytics

7. **AdSense:** after approval set the `ADSENSE_*` variables, add `public/ads.txt` with the exact line AdSense provides, configure Google's consent message (Privacy & messaging) for EEA/UK/Switzerland, then load a page with the browser console open and confirm
   there are no Content-Security-Policy violations. The Privacy Policy and Advertising Disclosure update themselves from the flags.
8. **Affiliates / sponsors:** add real, relevant entries to `src/config/affiliates.ts` / `sponsors.ts` (see docs/MONETIZATION.md) and run `npm run monetization:check`.
9. **Analytics:** set `ANALYTICS_*`, redeploy, confirm events arrive carrying only `toolId`/`category`-style properties.

## Optional future improvements (none block launch)

* Run the regex tester in a Web Worker with a time limit so a catastrophic pattern can't freeze the tab (today: input caps plus an on-page warning).
* Exchange-rate converter using a cached, server-side API module (would be the first "Dynamic" tool; architecture is ready, see MAINTENANCE.md).
* Old-tax-regime and HRA modelling for the CTC calculator; state-wise professional tax presets.
* Per-tool Open Graph images (one shared image is used now); a visible dark/light toggle (the site follows the system setting); remembering a preferred currency.
* A row-by-row input UI for the list-style tools (weighted marks, GPA, SGPA) instead of one line per entry in a text box.
* Hindi/other-language versions with `hreflang`; Playwright specs inside the repo (the `qa/` scripts are Python); real-user performance monitoring.
