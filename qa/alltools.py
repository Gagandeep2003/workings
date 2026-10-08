import re
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"
paths=re.findall(r'<loc>https?://[^<]*?(/[a-z]+/[a-z0-9-]+)</loc>',open('.next/server/app/sitemap.xml.body').read())
bad=[]; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1280,"height":900}); pg=ctx.new_page()
    pg.on("console", lambda m: errs.append((pg.url,m.text[:120])) if m.type=="error" else None); pg.on("pageerror", lambda e: errs.append((pg.url,str(e)[:120])))
    for path in paths:
        if path.count('/')!=2 or path.split('/')[1] not in ("math","everyday","student","career","money","developer","exams"): continue
        pg.goto(BASE+path,wait_until="domcontentloaded")
        pg.wait_for_load_state("networkidle")
        btn=pg.get_by_role("button",name="Try this example").first
        btn.click()
        try:
            pg.wait_for_selector(".result__value",timeout=6000)
            txt=pg.inner_text(".result__value").strip()
            if not txt or txt in("—","NaN"): bad.append((path,"empty result",txt))
            if pg.locator(".form-errors").count(): bad.append((path,"form error",pg.inner_text(".form-errors")[:100]))
        except Exception as e:
            bad.append((path,"no result",str(e)[:80]))
    b.close()
print(len(paths),"tool pages exercised")
print("BAD:",bad)
print("CONSOLE ERRORS:",errs[:5])
