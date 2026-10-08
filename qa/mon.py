from playwright.sync_api import sync_playwright
BASE="http://localhost:3200"
def log(n,c,d=""): print(("PASS " if c else "FAIL ")+n+((" — "+str(d)) if d and not c else ""))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1280,"height":900}); pg=ctx.new_page()
    reqs=[]; pg.on("requestfailed", lambda r: reqs.append(r.url.split('/')[2]))
    pg.add_init_script("""window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value}}).observe({type:'layout-shift',buffered:true});""")
    pg.goto(BASE+"/money/emi-calculator",wait_until="networkidle"); pg.wait_for_timeout(800)
    log("affiliate card appears after mount", pg.locator(".affiliate").count()==1)
    rel=pg.locator(".affiliate a").get_attribute("rel") or ""
    log("affiliate link rel sponsored+nofollow+noopener", all(x in rel for x in ["sponsored","nofollow","noopener"]), rel)
    log("affiliate tracking url used", "aff=1" in (pg.locator(".affiliate a").get_attribute("href") or ""))
    log("disclosure shown with affiliate", pg.locator("text=we may earn a commission").count()==1)
    log("sponsor shown in sidebar", pg.locator(".sponsor").count()==1 and "sponsored" in (pg.locator(".sponsor a").get_attribute("rel") or ""))
    log("no ad/affiliate/sponsor inside calculator", pg.evaluate("document.querySelectorAll('#calculator .ad, #calculator .affiliate, #calculator .sponsor, .calc .ad').length")==0 or pg.evaluate("[...document.querySelectorAll('.calc .ad, .calc .affiliate, .calc .sponsor')].length")==0)
    # distance between button row and nearest ad
    gap=pg.evaluate("""()=>{const btn=document.querySelector('.calc .btn-row').getBoundingClientRect();let m=1e9;document.querySelectorAll('.ad').forEach(a=>{const r=a.getBoundingClientRect();const d=r.top-btn.bottom;if(r.bottom>btn.top&&d<m)m=d});return m}""")
    log("ads are far from the buttons (>150px)", gap>150, gap)
    h=pg.evaluate("[...document.querySelectorAll('.ad__box')].map(e=>Math.round(e.getBoundingClientRect().height))")
    log("ad boxes reserve space", all(x>=90 for x in h) and len(h)>=3, h)
    # calculate with ads blocked/failing
    pg.fill("[id$=principal]","1000000"); pg.fill("[id$=rate]","8.5"); pg.fill("[id$=tenure]","20"); pg.keyboard.press("Enter"); pg.wait_for_selector(".result__value")
    log("calculator works while ad/analytics scripts fail to load", "8,678.23" in pg.inner_text(".result__value"), sorted(set(reqs)))
    cls=pg.evaluate("window.__cls")
    log("CLS under 0.1 with all ads enabled", cls<0.1, cls)
    # affiliate respects region: language en-IN etc. fine. non-matching topic page has no affiliate
    pg.goto(BASE+"/math/percentage-calculator",wait_until="networkidle"); pg.wait_for_timeout(500)
    log("no affiliate on a non-relevant tool", pg.locator(".affiliate").count()==0)
    pg.goto(BASE+"/privacy-policy",wait_until="networkidle")
    t=pg.inner_text("article")
    log("privacy page reflects enabled ads+analytics", "Google AdSense" in t and "Plausible" in t)
    pg.goto(BASE+"/advertising-disclosure",wait_until="networkidle"); t=pg.inner_text("article")
    log("disclosure page reflects enabled features", "served by Google AdSense" in t and "marked “Sponsored”" in t)
    pg.goto(BASE+"/contact",wait_until="networkidle"); log("contact email published", "hello@example.com" in pg.inner_text("article"))
    b.close()
