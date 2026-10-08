import sys, json
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"
WIDTHS=[320,375,390,430,768,1024,1280,1536]
PAGES=["/","/math","/math/percentage-calculator","/money/emi-calculator","/student/cgpa-to-percentage-calculator","/developer/json-formatter","/everyday/unit-converter","/everyday/timezone-converter","/career/ctc-to-take-home-calculator","/exams/ssc-cgl-tier-1-score-calculator","/about","/privacy-policy","/search?q=loan","/money/amortization-schedule-calculator"]
bad=[]; errors=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in WIDTHS:
        ctx=b.new_context(viewport={"width":w,"height":800})
        page=ctx.new_page()
        page.on("console", lambda m: errors.append((page.url,m.type,m.text)) if m.type in("error","warning") else None)
        page.on("pageerror", lambda e: errors.append((page.url,"pageerror",str(e))))
        for path in PAGES:
            page.goto(BASE+path, wait_until="networkidle")
            sw=page.evaluate("document.documentElement.scrollWidth"); cw=page.evaluate("document.documentElement.clientWidth")
            if sw>cw+1:
                # find offender
                off=page.evaluate("""()=>{const out=[];const W=document.documentElement.clientWidth;document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0){out.push(e.tagName+'.'+(e.className&&e.className.toString().slice(0,40))+' '+Math.round(r.right))}});return out.slice(0,4)}""")
                bad.append((w,path,sw,cw,off))
        ctx.close()
    b.close()
print("OVERFLOW:",json.dumps(bad,indent=1))
print("ERRORS:",json.dumps(errors[:15],indent=1))
