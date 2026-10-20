# Browser QA scripts

These Python + Playwright scripts were used to test the production build in a real Chromium browser. They are not part of
`npm run verify` because they need Python and a Playwright browser; run them before a release.

```bash
pip install playwright && playwright install chromium
npm run build && npm start -- -p 3100      # in one terminal
python3 qa/overflow.py     # horizontal overflow at 320/375/390/430/768/1024/1280/1536 px + console errors
python3 qa/interact.py     # 35 interaction checks: validation, copy, share/restore, search keyboard, converters, QR, mobile menu
python3 qa/axe.py          # axe-core (incl. colour contrast) in light and dark, mobile and desktop
python3 qa/alltools.py     # opens every tool page, runs its first worked example, checks the result and the console
```

`mon.py` expects a build made with the monetization variables enabled (see docs/MONETIZATION.md) on port 3200.
`overflow.py` and the others read `BASE` at the top of the file — change it to test a preview URL.

* `redesign.py` — theme toggle (cycle, persistence, system-vs-explicit precedence, invalid stored value), global search finds and opens **every** tool by name, no horizontal overflow on every new page at 320/375/768 px, screenshots.
* `markdown_safety.py` — pastes hostile Markdown into the previewer and fails if anything executes, becomes an element, or causes a request to another host.



## file_tools.py — image, PDF and QR tools in a real browser

`file_tools.py` drives every file tool in Chromium and checks the **downloaded files** independently of the site's own code: images with Pillow, PDFs with pypdf and poppler (`pdftoppm`), ZIPs with `zipfile`, and QR codes with the `jsqr` decoder (`decode_qr.mjs`). It generates its own sample files (`file_fixtures.py`) and keeps the site's real Content-Security-Policy active.

```bash
pip install playwright numpy pillow reportlab pypdf && playwright install chromium
npm run build && npm start -- -p 3111
BASE=http://localhost:3111 python3 qa/file_tools.py            # everything (about 77 checks)
BASE=http://localhost:3111 python3 qa/file_tools.py photo qr   # selected groups: compressor converter resizer photo jpg_to_pdf merge split pdf_compress qr text_tools layout
```
