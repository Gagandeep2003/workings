/**
 * Accessibility validation over the built HTML using axe-core inside jsdom (structure, names, roles, labels,
 * landmarks, ARIA validity, link/button names, language, headings). Colour contrast needs real rendering, so it is
 * covered separately by tests/contrast.test.ts (design-token pairs) and by running axe in a real browser (see docs/QA.md).
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { Report, builtPages, requireBuild, ROOT } from "./lib";

requireBuild();
const axeSource = fs.readFileSync(path.join(ROOT, "node_modules", "axe-core", "axe.min.js"), "utf8");
const r = new Report();
const pages = builtPages();

async function main() {
  let checked = 0;
  for (const { route, html } of pages) {
    const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: `https://example.test${route}` });
    const { window } = dom;
    window.eval(axeSource);
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const res = await axe.run(window.document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      rules: { "color-contrast": { enabled: false }, "scrollable-region-focusable": { enabled: false }, region: { enabled: false } },
    });
    for (const v of res.violations) r.error(route, `${v.impact}: ${v.help} (${v.id}) — ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join("; ")}`);

    // extra static checks axe doesn't make
    const doc = window.document;
    if (!doc.querySelector("main#main")) r.error(route, "missing <main id=main> landmark");
    if (!doc.querySelector('a.skip-link[href="#main"]')) r.error(route, "missing skip link");
    doc.querySelectorAll("img").forEach((img) => { if (!img.hasAttribute("alt")) r.error(route, "<img> without alt text"); });
    doc.querySelectorAll("input, select, textarea").forEach((el) => {
      const id = el.getAttribute("id");
      const labelled = (id && doc.querySelector(`label[for="${id}"]`)) || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label");
      if (!labelled) r.error(route, `form control #${id ?? "?"} has no label`);
      if (el.getAttribute("placeholder") && !labelled) r.error(route, "placeholder used as the only label");
    });
    doc.querySelectorAll("a[target=_blank]").forEach((a) => { if (!/noopener/.test(a.getAttribute("rel") ?? "")) r.error(route, "target=_blank link without rel=noopener"); });
    const icons = doc.querySelectorAll("svg:not([aria-hidden])");
    icons.forEach((svg) => { if (!svg.getAttribute("role") && !svg.getAttribute("aria-label") && !svg.querySelector("title")) r.warn(route, "inline <svg> is neither hidden nor labelled"); });
    window.close();
    checked++;
  }
  r.finish("Accessibility validation", `${checked} pages passed axe-core structural rules (WCAG 2.0/2.1/2.2 A and AA, best practice) plus label, landmark, alt and link checks`);
}
main();
