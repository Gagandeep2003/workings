"""Markdown previewer safety: hostile input must not execute, create elements, or trigger requests to other hosts.
Run against a production server: npm start -- -p 3100   then   python3 qa/markdown_safety.py"""
from playwright.sync_api import sync_playwright
HOSTILE = """# Title <img src=x onerror="window.__pwned=1">

<script>window.__pwned=1</script>

[click me](javascript:window.__pwned=1) and [safe](https://example.com)

![tracker](https://evil.example/pixel.gif?x=1)

<a href="javascript:window.__pwned=1">raw html link</a>

**bold** `<b>code</b>`
"""
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width":1100,"height":900}); pg = ctx.new_page()
    dialogs, requests, errors = [], [], []
    pg.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    pg.on("request", lambda r: requests.append(r.url)); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("http://localhost:3100/developer/markdown-previewer", wait_until="networkidle")
    pg.locator("textarea").fill(HOSTILE); pg.wait_for_selector(".md-preview", timeout=5000); pg.wait_for_timeout(600)
    prev = pg.locator(".md-preview")
    print("pwned flag:", pg.evaluate("window.__pwned"), "| dialogs:", dialogs, "| page errors:", errors)
    print("script/img/iframe elements inside preview:", prev.locator("script, img, iframe, object, embed, [onerror], [onclick]").count())
    print("links in preview:", [(a.get_attribute("href"), a.get_attribute("rel"), a.get_attribute("target")) for a in prev.locator("a").all()])
    print("requests to other hosts:", [u for u in requests if "localhost" not in u and not u.startswith("data:")])
    txt = prev.inner_text(); print("literal text shown:", "<script>" in txt, "|", "[image: tracker]" in txt, "|", "<b>code</b>" in txt)
    print("preview text:", txt.replace("\n"," / ")[:230])
    pass
    failures = [pg.evaluate("window.__pwned") is not None, bool(dialogs), bool(errors), prev.locator("script, img, iframe, object, embed, [onerror], [onclick]").count() > 0,
                any(a.get_attribute("href") != "https://example.com" for a in prev.locator("a").all()), any("localhost" not in u and not u.startswith("data:") for u in requests)]
    print("RESULT:", "FAIL" if any(failures) else "PASS")
    b.close()
    raise SystemExit(1 if any(failures) else 0)
