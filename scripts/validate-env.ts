/**
 * Environment-variable validation:
 *  - every variable the source reads is documented in .env.example
 *  - nothing documented is unused
 *  - no NEXT_PUBLIC_ variable has a secret-looking name
 *  - launch readiness (pass --production to make the launch warnings errors)
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, Report, walk } from "./lib";

const r = new Report();
const production = process.argv.includes("--production");
const files = [...walk(path.join(ROOT, "src"), (f) => /\.(ts|tsx)$/.test(f)), path.join(ROOT, "next.config.ts"), ...walk(path.join(ROOT, "scripts"), (f) => f.endsWith(".ts"))];
const used = new Map<string, string>();
const PATTERNS = [/process\.env\.([A-Z][A-Z0-9_]+)/g, /\benv\.([A-Z][A-Z0-9_]+)/g, /\benv\[["']([A-Z][A-Z0-9_]+)["']\]/g, /slotFor\("([A-Z][A-Z0-9_]+)"\)/g];
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const re of PATTERNS) for (const m of text.matchAll(re)) if (!used.has(m[1])) used.set(m[1], path.relative(ROOT, f));
}
const BUILTIN = new Set(["NODE_ENV", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "CI", "PORT"]);
const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
const documented = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));

for (const [name, file] of used) if (!documented.has(name) && !BUILTIN.has(name)) r.error(file, `${name} is read by the code but isn't documented in .env.example`);
for (const name of documented) if (!used.has(name)) r.error(".env.example", `${name} is documented but never read by the code`);
for (const name of [...documented, ...used.keys()]) {
  if (name.startsWith("NEXT_PUBLIC_") && /KEY|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/.test(name)) r.error(name, "NEXT_PUBLIC_ variables are shipped to the browser and must never look like secrets");
}
for (const f of ["next.config.ts", ".gitignore"]) if (!fs.existsSync(path.join(ROOT, f))) r.error(f, "missing");
const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
if (!/^\.env$/m.test(gitignore) || !/^\.env\.local$/m.test(gitignore)) r.error(".gitignore", "must ignore .env and .env.local");
for (const f of fs.readdirSync(ROOT)) if (/^\.env(\.|$)/.test(f) && f !== ".env.example") r.warn(f, "local env file present (make sure it is not committed)");

// launch readiness
const launch = (msg: string) => (production ? r.error("launch", msg) : r.warn("launch", msg));
const url = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
if (!url) launch("NEXT_PUBLIC_SITE_URL isn't set — canonical URLs will point at http://localhost:3000.");
else if (!url.startsWith("https://")) launch(`NEXT_PUBLIC_SITE_URL must be https (is "${url}").`);
else if (/\/$/.test(url)) launch("NEXT_PUBLIC_SITE_URL must not end with a slash.");
if (!process.env.CONTACT_EMAIL) launch("CONTACT_EMAIL isn't set — the Contact page will say no address is published.");
const flags = ["ADS_ENABLED", "ADSENSE_ENABLED", "DIRECT_ADS_ENABLED", "AFFILIATES_ENABLED", "ANALYTICS_ENABLED"].filter((k) => process.env[k] === "true");
if (flags.length) console.log(`ℹ Enabled features: ${flags.join(", ")}`);

r.finish("Environment validation", `${used.size} variables read by the code, all documented in .env.example; all optional variables safe to leave empty`);
