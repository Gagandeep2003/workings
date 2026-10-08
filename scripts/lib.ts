import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const APP_DIR = path.join(ROOT, ".next", "server", "app");

export function requireBuild(): void {
  if (!fs.existsSync(APP_DIR)) {
    console.error("✖ No production build found. Run `npm run build` first.");
    process.exit(1);
  }
}

export function walk(dir: string, filter: (f: string) => boolean = () => true): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

/** Map a built HTML file to its route: .next/server/app/math/foo.html → /math/foo, index.html → / */
export function routeOf(file: string): string {
  const rel = path.relative(APP_DIR, file).replace(/\\/g, "/").replace(/\.html$/, "");
  return rel === "index" ? "/" : `/${rel}`;
}

export function builtPages(): { route: string; file: string; html: string }[] {
  return walk(APP_DIR, (f) => f.endsWith(".html"))
    .map((file) => ({ route: routeOf(file), file, html: fs.readFileSync(file, "utf8") }))
    .filter((p) => !["/_not-found", "/_global-error"].includes(p.route) && !p.route.startsWith("/dev/"))
    .sort((a, b) => a.route.localeCompare(b.route));
}

export class Report {
  errors: string[] = [];
  warnings: string[] = [];
  error(page: string, msg: string) { this.errors.push(`[${page}] ${msg}`); }
  warn(page: string, msg: string) { this.warnings.push(`[${page}] ${msg}`); }
  finish(title: string, okMessage: string): never {
    if (this.warnings.length) { console.warn(`\n⚠ ${this.warnings.length} warning(s):`); this.warnings.forEach((w) => console.warn("  " + w)); }
    if (this.errors.length) {
      console.error(`\n✖ ${title} failed — ${this.errors.length} problem(s):`);
      this.errors.forEach((e) => console.error("  " + e));
      process.exit(1);
    }
    console.log(`\n✔ ${title}: ${okMessage}`);
    process.exit(0);
  }
}
