import json, sys
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"
AXE=open("node_modules/axe-core/axe.min.js").read()
PAGES=["/","/math","/math/percentage-calculator","/money/emi-calculator","/student/cgpa-calculator","/developer/json-formatter","/developer/color-converter","/everyday/unit-converter","/everyday/timezone-converter","/career/ctc-to-take-home-calculator","/exams/ssc-cgl-tier-1-score-calculator","/about","/privacy-policy","/contact","/search?q=loan","/everyday/working-days-calculator","/math/fraction-calculator","/developer/qr-code-generator","/developer/regex-tester"]
summary={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for scheme in ["light","dark"]:
        for w in [390,1280]:
            ctx=b.new_context(viewport={"width":w,"height":900},color_scheme=scheme); pg=ctx.new_page()
            for path in PAGES:
                pg.goto(BASE+path,wait_until="networkidle"); pg.add_script_tag(content=AXE)
                # populate a result so the result panel is checked too
                r=pg.evaluate("""async()=>{const res=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});return res.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,help:v.help,ex:v.nodes.slice(0,2).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\\n').slice(0,2).join(' | '))}))}""")
                for v in r: summary.setdefault((v['id'],v['impact'],v['help']),[]).append((scheme,w,path,v['n'],v['ex']))
            ctx.close()
    b.close()
for k,v in summary.items():
    print(k, len(v)); 
    for x in v[:3]: print("   ",x)
print("TOTAL distinct violations:",len(summary))
