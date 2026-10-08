/** Scans the repository and the production build output for secrets and for leakage of server-only environment values. */
import fs from "node:fs";
import path from "node:path";
import { ROOT, Report, walk } from "./lib";

const r = new Report();
const SKIP = /(^|\/)(node_modules|\.git|\.next|coverage|\.vercel)(\/|$)/;
const textFiles = walk(ROOT, (f) => !SKIP.test(path.relative(ROOT, f)) && /\.(ts|tsx|js|mjs|json|md|css|svg|env|example|yml|yaml|txt)$/.test(f) && !f.endsWith("package-lock.json"));
const SECRET_PATTERNS: [string, RegExp][] = [
  ["private key block", /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["OpenAI/Stripe-style secret key", /\bsk[-_](live|test|proj)?[-_]?[A-Za-z0-9]{20,}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["hard-coded credential", /\b(api[_-]?key|secret|password|passwd|token)\b["']?\s*[:=]\s*["'][A-Za-z0-9/+_-]{16,}["']/i],
];
for (const f of textFiles) {
  const rel = path.relative(ROOT, f);
  if (/^tests\//.test(rel) || rel === "scripts/check-secrets.ts") continue;
  const text = fs.readFileSync(f, "utf8");
  for (const [label, re] of SECRET_PATTERNS) if (re.test(text)) r.error(rel, `looks like a ${label}`);
}
for (const f of fs.readdirSync(ROOT)) if (/^\.env(\.|$)/.test(f) && f !== ".env.example" && fs.existsSync(path.join(ROOT, ".git"))) {
  try { if (fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").includes(f) === false && !/^\.env(\.local)?$/.test(f)) r.warn(f, "env file may not be git-ignored"); } catch { /* no gitignore */ }
}

// build output
const next = path.join(ROOT, ".next");
if (fs.existsSync(next)) {
  const outputs = walk(next, (f) => /\.(js|html|json|body|rsc|txt|css|map)$/.test(f) && !/(cache|trace|diagnostics|\.next\/build|types)/.test(f));
  const SERVER_ONLY = ["CONTACT_EMAIL", "SITE_OPERATOR_NAME", "ADSENSE_PUBLISHER_ID", "ANALYTICS_DOMAIN", "ANALYTICS_WEBSITE_ID"];
  const clientFiles = walk(path.join(next, "static"), (f) => f.endsWith(".js"));
  for (const f of clientFiles) {
    const text = fs.readFileSync(f, "utf8");
    for (const [label, re] of SECRET_PATTERNS.slice(0, 6)) if (re.test(text)) r.error(path.relative(ROOT, f), `client bundle contains a ${label}`);
    for (const name of SERVER_ONLY) {
      if (text.includes(`process.env.${name}`)) r.error(path.relative(ROOT, f), `client bundle references server-only variable ${name}`);
      const value = process.env[name];
      if (value && value.length >= 6 && text.includes(value) && name !== "ADSENSE_PUBLISHER_ID" && name !== "ANALYTICS_DOMAIN" && name !== "ANALYTICS_WEBSITE_ID") r.error(path.relative(ROOT, f), `client bundle contains the value of ${name}`);
    }
  }
  for (const f of outputs) {
    const text = fs.readFileSync(f, "utf8");
    for (const [label, re] of SECRET_PATTERNS.slice(0, 6)) if (re.test(text)) r.error(path.relative(ROOT, f), `build output contains a ${label}`);
  }
  r.warnings = r.warnings.filter(Boolean);
  console.log(`ℹ Scanned ${textFiles.length} source files, ${clientFiles.length} client chunks and ${outputs.length} build artifacts.`);
} else r.warn("build", "no .next directory — only source files were scanned");

r.finish("Secret scan", "no secrets, private keys or server-only values found in the source tree or the browser bundle");
