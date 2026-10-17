"""Redesign QA: theme toggle, global search → every tool, overflow on narrow screens, screenshots.
Run against a production server:  npm run build && npm start -- -p 3100   then   python3 qa/redesign.py
"""
import json, re, sys, os
from playwright.sync_api import sync_playwright
BASE = "http://localhost:3100"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots"
os.makedirs(OUT, exist_ok=True)
sitemap = open(".next/server/app/sitemap.xml.body").read()
tool_paths = [p for p in re.findall(r"<loc>https?://[^<]*?(/[a-z]+/[a-z0-9-]+)</loc>", sitemap) if p.split("/")[1] in ("math","everyday","student","career","money","developer","exams")]
index = json.load(open(".next/server/app/search-index.json.body"))
tools = index["tools"] if isinstance(index, dict) and "tools" in index else index
problems, errors = [], []

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------------------------------------------------------- theme toggle
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)[:120]))
    pg.goto(BASE + "/", wait_until="networkidle")
    root = lambda: pg.evaluate("document.documentElement.getAttribute('data-theme')")
    bg = lambda: pg.evaluate("getComputedStyle(document.body).backgroundColor")
    light_bg = bg()
    if root() is not None: problems.append(("theme", "default should follow the system (no data-theme attribute)", root()))
    btn = pg.locator("button.theme-toggle")
    seen = [btn.get_attribute("aria-label")]
    btn.click(); t1 = (root(), bg()); seen.append(btn.get_attribute("aria-label"))
    btn.click(); t2 = (root(), bg()); seen.append(btn.get_attribute("aria-label"))
    btn.click(); t3 = (root(), bg())
    if t1[0] != "light": problems.append(("theme", "first click should select light", t1))
    if t2[0] != "dark" or t2[1] == light_bg: problems.append(("theme", "second click should select dark with a different background", t2))
    if t3[0] is not None: problems.append(("theme", "third click should return to system", t3))
    btn.click(); btn.click()                     # → dark
    pg.reload(wait_until="domcontentloaded")
    if root() != "dark": problems.append(("theme", "dark choice did not survive a reload (flash risk)", root()))
    pg.screenshot(path=f"{OUT}/home-dark-desktop.png")
    # dark system + explicit light choice must win
    ctx2 = b.new_context(viewport={"width": 1280, "height": 800}, color_scheme="dark")
    pg2 = ctx2.new_page(); pg2.goto(BASE + "/", wait_until="networkidle")
    sys_dark_bg = pg2.evaluate("getComputedStyle(document.body).backgroundColor")
    if sys_dark_bg == light_bg: problems.append(("theme", "system dark preference not honoured", sys_dark_bg))
    pg2.evaluate("localStorage.setItem('workings-theme','light')"); pg2.reload(wait_until="networkidle")
    if pg2.evaluate("getComputedStyle(document.body).backgroundColor") != light_bg: problems.append(("theme", "explicit light must override a dark system", ""))
    pg2.evaluate("localStorage.setItem('workings-theme','garbage')"); pg2.reload(wait_until="networkidle")
    if pg2.evaluate("document.documentElement.getAttribute('data-theme')") is not None: problems.append(("theme", "an invalid stored value must be ignored", ""))
    ctx2.close(); ctx.close()

    # ---------------------------------------------------------------- global search finds and opens every tool
    ctx = b.new_context(viewport={"width": 1280, "height": 800}); pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)[:120]))
    wrong = []
    for t in tools:
        title = t.get("title") or t.get("t")
        pg.goto(BASE + "/", wait_until="domcontentloaded")
        box = pg.locator("#hero-search-input")
        box.fill(title)
        pg.wait_for_selector('[role="option"]', timeout=5000)
        pg.keyboard.press("Enter")
        try:
            pg.wait_for_url(re.compile(r".*/[a-z]+/[a-z0-9-]+$"), timeout=6000)
        except Exception:
            wrong.append((title, "no navigation", pg.url)); continue
        expected = t.get("p")
        if expected and not pg.url.endswith(expected): wrong.append((title, expected, pg.url))
    print(len(tools), "tools searched by name;", len(wrong), "did not open their own page")
    if wrong: problems.append(("search", "wrong destination", wrong[:8]))
    ctx.close()

    # ---------------------------------------------------------------- overflow on narrow screens for every new/changed page type
    pages = ["/", "/tools", "/exams", "/math", "/developer", "/money", "/search", "/exams/jee-main-marks-calculator", "/exams/mock-test-tracker", "/math/scientific-calculator", "/math/triangle-calculator", "/math/area-volume-calculator", "/developer/cron-expression-explainer", "/developer/text-diff-checker", "/developer/hash-generator", "/money/loan-prepayment-calculator", "/everyday/pace-calculator", "/exams/cat-score-calculator"] + [x for x in tool_paths]
    for w in (320, 375, 768):
        ctx = b.new_context(viewport={"width": w, "height": 800}); pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append((w, str(e)[:100])))
        overflow = []
        for path in (pages if w == 320 else pages[:18]):
            pg.goto(BASE + path, wait_until="domcontentloaded")
            if "/" in path[1:]:
                try: pg.get_by_role("button", name="Try this example").first.click(timeout=2500); pg.wait_for_selector(".result__value", timeout=4000)
                except Exception: pass
            sw = pg.evaluate("document.documentElement.scrollWidth")
            if sw > w + 1: overflow.append((path, sw))
        if overflow: problems.append((f"overflow@{w}", overflow[:10]))
        ctx.close()

    # ---------------------------------------------------------------- screenshots to inspect by eye
    shots = [("home", "/", 1280, 900, "light"), ("home", "/", 390, 844, "light"), ("home", "/", 1280, 900, "dark"), ("exams", "/exams", 1280, 900, "light"), ("tool-neet", "/exams/neet-ug-marks-calculator", 1280, 900, "light"),
             ("tool-neet", "/exams/neet-ug-marks-calculator", 390, 844, "dark"), ("tools-dir", "/tools", 1280, 900, "light"), ("math", "/math", 1280, 900, "light")]
    for name, path, w, h, scheme in shots:
        ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme); pg = ctx.new_page()
        pg.goto(BASE + path, wait_until="networkidle")
        if name == "tool-neet":
            pg.get_by_role("button", name="Try this example").first.click(); pg.wait_for_selector(".result__value")
        pg.screenshot(path=f"{OUT}/{name}-{w}-{scheme}.png"); ctx.close()
    b.close()

print("PROBLEMS:", json.dumps(problems, indent=1, ensure_ascii=False)[:2500])
print("PAGE ERRORS:", errors[:5])
