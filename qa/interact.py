import re, json
from playwright.sync_api import sync_playwright, expect
BASE="http://localhost:3100"
results=[]
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ")+name+(" — "+str(detail) if detail and not cond else ""))
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={"width":1280,"height":900}, permissions=["clipboard-read","clipboard-write"]); pg=ctx.new_page()
    errs=[]; pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
    # 1 validation
    pg.goto(BASE+"/money/emi-calculator", wait_until="networkidle")
    pg.get_by_role("button", name="Calculate").click()
    alert=pg.get_by_role("alert").first
    check("empty submit shows error summary", alert.is_visible() and "Loan amount" in alert.inner_text(), alert.inner_text() if alert.count() else "")
    check("first invalid field focused", pg.evaluate("document.activeElement && document.activeElement.id").endswith("principal"))
    check("inline error linked via aria-describedby", pg.evaluate("(()=>{const e=document.activeElement;return !!e.getAttribute('aria-describedby') && e.getAttribute('aria-invalid')==='true'})()"))
    # 2 fill and EMI
    pg.fill("[id$=principal]","1000000")
    pg.locator("[id$=principal]").blur()
    check("grouped on blur", pg.input_value("[id$=principal]")=="1,000,000", pg.input_value("[id$=principal]"))
    pg.fill("[id$=rate]","8.5"); pg.fill("[id$=tenure]","20")
    pg.press("[id$=tenure]","Enter")
    pg.wait_for_selector(".result__value")
    check("EMI result", "8,678.23" in pg.inner_text(".result__value"), pg.inner_text(".result__value"))
    check("yearly table present", pg.locator(".data-table tbody tr").count()==20)
    check("steps shown", pg.locator(".steps li").count()>=2)
    # stale indicator
    pg.fill("[id$=rate]","9")
    check("stale notice on edit", pg.locator("text=Inputs changed").is_visible())
    # reset
    pg.get_by_role("button", name="Reset").click()
    check("reset clears result", pg.locator(".result__value").count()==0 and pg.input_value("[id$=principal]")=="")
    # 3 inline error on blur for bad input
    pg.fill("[id$=rate]","abc"); pg.locator("[id$=rate]").blur()
    check("blur shows inline error", pg.locator(".field__error").count()==1 and "number" in pg.inner_text(".field__error").lower(), pg.inner_text(".field__error") if pg.locator(".field__error").count() else "none")
    # 4 copy
    pg.goto(BASE+"/math/percentage-calculator", wait_until="networkidle")
    pg.locator("input.input").nth(0).fill("15"); pg.locator("input.input").nth(1).fill("200"); pg.keyboard.press("Enter")
    pg.get_by_role("button", name="Copy result").click(); pg.wait_for_timeout(200)
    clip=pg.evaluate("navigator.clipboard.readText()")
    check("copy result text", "Result: 30" in clip, clip[:80])
    # share link and restore
    pg.get_by_role("button", name="Share link").click(); pg.wait_for_timeout(300)
    link=pg.evaluate("navigator.clipboard.readText()")
    check("share link has fragment inputs", "#" in link and "mode=of" in link and "x=200" in link, link)
    pg2=ctx.new_page(); pg2.goto(link, wait_until="networkidle"); pg2.wait_for_selector(".result__value", timeout=5000)
    check("share link restores result", pg2.inner_text(".result__value").strip()=="30")
    pg2.close()
    # untrusted hash: bad select option ignored
    pg3=ctx.new_page(); pg3.goto(BASE+"/math/percentage-calculator#mode=<script>alert(1)</script>&p=15&x=200", wait_until="networkidle")
    check("malicious hash select ignored", pg3.locator("select").first.input_value()=="of")
    pg3.close()
    # try example
    pg.goto(BASE+"/money/emi-calculator", wait_until="networkidle")
    pg.get_by_role("button", name="Try this example").first.click(); pg.wait_for_selector(".result__value")
    check("try example runs", "8,678.23" in pg.inner_text(".result__value"))
    # 5 search keyboard
    pg.goto(BASE+"/", wait_until="networkidle")
    s=pg.locator("#hero-search-input"); s.click(); s.type("emi")
    pg.wait_for_selector("[role=option]")
    check("search lists emi first", "EMI Calculator" in pg.locator("[role=option]").first.inner_text())
    check("combobox aria", s.get_attribute("role")=="combobox" and s.get_attribute("aria-expanded")=="true" and s.get_attribute("aria-activedescendant"))
    pg.keyboard.press("ArrowDown")
    pg.keyboard.press("Escape")
    check("escape closes list", s.get_attribute("aria-expanded")=="false")
    s.fill(""); s.type("percent"); pg.wait_for_selector("[role=option]"); pg.keyboard.press("Enter"); pg.wait_for_url("**/math/percentage-calculator")
    check("enter opens top result", "percentage-calculator" in pg.url)
    pg.goto(BASE+"/", wait_until="networkidle"); s=pg.locator("#hero-search-input"); s.click(); s.type("zzzqq"); pg.wait_for_timeout(400)
    check("empty state suggests categories", pg.locator("text=No tools match").is_visible() and pg.locator(".search__panel .chip").count()>=7)
    s.fill(""); pg.wait_for_timeout(200)
    check("popular tools shown when empty", pg.locator("[role=option]").count()>=5)
    # 6 dev: JSON
    pg.goto(BASE+"/developer/json-formatter", wait_until="networkidle")
    ta=pg.locator("textarea").first; ta.fill('{"a":1,"b":[1.0,2],}'); pg.keyboard.press("Control+Enter")
    pg.wait_for_selector(".form-errors")
    txt=pg.inner_text(".form-errors")
    check("json error has line/col", "Line 1, column 20" in txt and "trailing comma" in txt, txt[:200])
    ta.fill('{"b":1.0,"a":[1,2]}'); pg.get_by_role("button", name="Format JSON").click(); pg.wait_for_selector(".textblock pre")
    check("json formatted", '"b": 1.0' in pg.inner_text(".textblock pre"))
    check("no share button on dev tool", pg.get_by_role("button", name="Share link").count()==0)
    # 7 unit converter dependent selects + swap
    pg.goto(BASE+"/everyday/unit-converter", wait_until="networkidle")
    pg.select_option("[id$=category]","data")
    opts=pg.locator("[id$=-from] option").all_inner_texts()
    check("category switch changes unit options", any("Gibibyte" in o for o in opts) and not any("Kilometre" in o for o in opts))
    check("'to' defaults to second unit", pg.input_value("[id$=-to]")!=pg.input_value("[id$=-from]"))
    pg.select_option("[id$=-from]","GiB"); pg.select_option("[id$=-to]","MB"); pg.fill("[id$=value]","1"); pg.wait_for_selector(".result__value")
    check("live convert GiB→MB", "1,073.741824" in pg.inner_text(".result__value"), pg.inner_text(".result__value"))
    pg.get_by_role("button", name="Swap").click(); pg.wait_for_timeout(400)
    check("swap works", pg.input_value("[id$=-from]")=="MB" and pg.input_value("[id$=-to]")=="GiB")
    # 8 QR
    pg.goto(BASE+"/developer/qr-code-generator", wait_until="networkidle")
    pg.locator("textarea").fill("https://example.com"); pg.wait_for_selector(".qr svg")
    with pg.expect_download() as d: pg.get_by_role("button", name="SVG").click()
    check("QR svg download", d.value.suggested_filename=="qr-code.svg")
    # 9 date tool
    pg.goto(BASE+"/everyday/age-calculator", wait_until="networkidle")
    pg.fill("[id$=dob]","1990-05-15"); pg.fill("[id$=asof]","2024-05-14"); pg.keyboard.press("Enter"); pg.wait_for_selector(".result__value")
    check("age result", "33 years, 11 months, 29 days" in pg.inner_text(".result__value"), pg.inner_text(".result__value"))
    # 10 mobile nav
    m=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True); mp=m.new_page(); mp.goto(BASE+"/", wait_until="networkidle")
    mp.get_by_role("button", name="Browse categories").click()
    check("mobile menu lists categories", mp.locator(".mobile-panel a").count()==7)
    mp.locator(".mobile-panel a").first.click(); mp.wait_for_url("**/math")
    check("mobile menu closes on navigation", mp.locator(".mobile-panel").count()==0)
    mp.get_by_role("button", name="Search tools").click(); mp.keyboard.type("gst"); mp.wait_for_selector("[role=option]")
    check("mobile search works", "GST" in mp.locator("[role=option]").first.inner_text())
    m.close()
    # 11 skip link & focus
    pg.goto(BASE+"/", wait_until="networkidle"); pg.keyboard.press("Tab")
    check("skip link first tab stop", pg.evaluate("document.activeElement.className")=="skip-link")
    check("no console errors", not errs, errs[:3])
    b.close()
fails=[r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
