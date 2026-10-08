# QA record

Automated, run by `npm run verify`: type check, ESLint, **448 unit tests** (every engine: normal, decimal, zero, boundary, rounding, invalid input; dates across leap years, month/year ends and DST; units against exact
factors; money against independent `Decimal` calculations; JSON/regex/colour/QR (QR codes are decoded back with a real decoder); search ranking; monetization rules; analytics privacy; WCAG contrast of every
design-token pair in light and dark), the registry validator, a production build and the validators (SEO, a11y, env, secrets, bundle).

Real-browser checks (Chromium via Playwright, scripts in `qa/`): no horizontal overflow at 320/375/390/430/768/1024/1280/1536 px on 14 representative pages; 35 interaction checks (validation and focus, grouping on blur, copy,
share-link restore and untrusted-hash handling, search keyboard behaviour, dependent selects and swap, QR download, mobile menu, skip link); axe-core (including colour contrast) with **0 violations** across 19 pages in light and dark at
390 px and 1280 px; every one of the 81 tool pages opened and its first worked example run with no console errors; a build with all monetization enabled (ad boxes reserve space, CLS < 0.1, sponsor/affiliate rel attributes, calculator still works when ad/analytics hosts are unreachable).

**Not covered:** Safari/iOS and Firefox (only Chromium was available), real-device keyboards/screen readers, field Core Web Vitals, and a legal review. See RELEASE_CHECKLIST.md.
