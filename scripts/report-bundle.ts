/** Reports the JavaScript a visitor downloads for key pages (compressed) and fails on budget overruns. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { APP_DIR, ROOT, Report, requireBuild } from "./lib";

requireBuild();
const r = new Report();
// Next.js + React runtime alone is roughly 150 kB gzipped, so budgets are set relative to that baseline.
const BUDGET_WARN = 215 * 1024;
const BUDGET_FAIL = 280 * 1024;
const gz = (file: string) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`;

function scriptsFor(route: string): string[] {
  const file = path.join(APP_DIR, route === "/" ? "index.html" : `${route.slice(1)}.html`);
  const html = fs.readFileSync(file, "utf8");
  return [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
}

const routes = ["/", "/math", "/math/percentage-calculator", "/money/emi-calculator", "/developer/json-formatter", "/developer/qr-code-generator", "/everyday/unit-converter", "/about"];
console.log("Compressed JavaScript loaded on first visit (shared framework chunks included):\n");
for (const route of routes) {
  const files = scriptsFor(route);
  const total = files.reduce((s, f) => s + gz(path.join(ROOT, ".next", f.replace(/^\/_next\//, ""))), 0);
  console.log(`  ${route.padEnd(36)} ${String(files.length).padStart(2)} scripts  ${kb(total).padStart(9)}`);
  if (total > BUDGET_FAIL) r.error(route, `first-load JS ${kb(total)} exceeds ${kb(BUDGET_FAIL)}`);
  else if (total > BUDGET_WARN) r.warn(route, `first-load JS ${kb(total)} is above ${kb(BUDGET_WARN)}`);
}
const chunks = fs.readdirSync(path.join(ROOT, ".next", "static", "chunks")).filter((f) => f.endsWith(".js")).map((f) => ({ f, size: gz(path.join(ROOT, ".next", "static", "chunks", f)) })).sort((a, b) => b.size - a.size);
console.log(`\n  ${chunks.length} chunks; largest:`);
for (const c of chunks.slice(0, 6)) console.log(`    ${c.f.padEnd(34)} ${kb(c.size)}`);
const fonts = fs.existsSync(path.join(ROOT, ".next", "static", "media")) ? fs.readdirSync(path.join(ROOT, ".next", "static", "media")) : [];
console.log(`\n  ${fonts.length} font/media files emitted (self-hosted, no third-party font requests).`);
r.finish("Bundle report", "first-load JavaScript is within budget on all key pages");
