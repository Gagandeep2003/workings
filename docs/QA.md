# QA record

Automated, run by `npm run verify`: type check, ESLint, **839 unit tests** (every engine: normal, decimal, zero, boundary, rounding, invalid input; dates across leap years, month/year ends and DST; units against exact
factors; money against independent `Decimal` calculations; JSON/regex/colour/QR (QR codes are decoded back with a real decoder); search ranking; monetization rules; analytics privacy; WCAG contrast of every
design-token pair in light and dark), the registry validator, a production build and the validators (SEO, a11y, env, secrets, bundle).

Real-browser checks (Chromium via Playwright, scripts in `qa/`): no horizontal overflow at 320/375/390/430/768/1024/1280/1536 px on 14 representative pages; 35 interaction checks (validation and focus, grouping on blur, copy,
share-link restore and untrusted-hash handling, search keyboard behaviour, dependent selects and swap, QR download, mobile menu, skip link); axe-core (including colour contrast) with **0 violations** across 19 pages in light and dark at
390 px and 1280 px; every one of the 146 tool pages opened and its first worked example run with no console errors; a build with all monetization enabled (ad boxes reserve space, CLS < 0.1, sponsor/affiliate rel attributes, calculator still works when ad/analytics hosts are unreachable).

**Not covered:** Safari/iOS and Firefox (only Chromium was available), real-device keyboards/screen readers, field Core Web Vitals, and a legal review. See RELEASE_CHECKLIST.md.

## October 2026 redesign — results of the final run (Chromium, production build)

* `npm run verify`: typecheck and lint clean; **839 tests in 21 files**; registry (146 tools); SEO validation over **164 pages** (maximum content similarity between any two tool pages 28%); accessibility validation over 144 pages; env (23 variables documented); secrets; bundle budget.
* `qa/redesign.py`: theme toggle behaves (system default, light, dark, back to system; survives reload with no flash; explicit choice beats the OS setting; garbage in storage ignored); **all 127 tools found by typing their exact name and opened the right page**; no horizontal overflow on every new/changed page at 320, 375 and 768 px.
* `qa/overflow.py` (8 widths, no overflow, no console errors) · `qa/interact.py` (35/35) · `qa/axe.py` (**0 violations**, colour contrast included, light and dark) · `qa/alltools.py` (all 127 tool pages, worked examples run, no console errors) · `qa/markdown_safety.py` (hostile input neutralised).
* How the tests are independent of the code under test: expected values for the new exam, finance, geometry and number-theory tools were computed by hand or by a separate implementation (Node's `crypto` for hashes, a plain floating-point loan simulation for prepayment, a sieve for primes, brute-force LCS for the diff, the Project Euler #3 factorisation).
  Writing them found 8 genuine bugs in the new code and 1 in the existing search; see `docs/REDESIGN-2026-10.md`.

**Still not covered:** Safari/iOS and Firefox, real devices and screen readers, field Core Web Vitals, and the official exam bulletins (not reachable from the build environment).



## October 2026 file-tools expansion

* `qa/file_tools.py`: **77 browser checks, all passing** (Chromium, real downloads verified with Pillow, pypdf, poppler and the jsqr decoder): compress (quality, target KB, batch ZIP, PNG alpha, bad files), convert (JPG/PNG/WebP, transparency), resize (px, %, cm at DPI), passport photo and signature (exact pixels, KB window, padding validity), JPG→PDF (EXIF orientation by rendering, lossless JPEG embedding), merge (order, password flow), split (all five modes), PDF compress (both methods, target KB, text-only honesty), QR (Wi-Fi, UPI, URL, vCard decoded back), text/data tools, and no horizontal overflow on every new page at 320/375/768/1280 px.
* `qa/interact.py` 35/35 · `qa/axe.py` 0 violations (new pages included) · `qa/overflow.py` clean · `qa/alltools.py` clean.
* Not verified: Safari and Firefox, very large files on low-memory phones, any specific exam portal.
