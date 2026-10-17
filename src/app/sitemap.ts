import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/tools/categories";
import { TOOLS, toolPath } from "@/tools/registry";
import { SITE, STATIC_PAGES, absoluteUrl } from "@/lib/site";

const LEGAL = new Set(["/privacy-policy", "/terms", "/disclaimer", "/advertising-disclosure"]);

/**
 * Built from the real registry. `lastModified` is only included when a page has a genuine review/modification date —
 * never a fake "today". Noindex pages (search, dev diagnostics) are not listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [{ url: absoluteUrl("/") }];
  for (const c of CATEGORIES) entries.push({ url: absoluteUrl(`/${c.id}`) });
  for (const t of TOOLS) {
    const last = t.lastModified ?? t.regulatory?.reviewedOn ?? t.addedOn; // only real dates: modified, reviewed, or first published
    entries.push(last ? { url: absoluteUrl(toolPath(t)), lastModified: last } : { url: absoluteUrl(toolPath(t)) });
  }
  for (const p of STATIC_PAGES) entries.push(LEGAL.has(p.path) ? { url: absoluteUrl(p.path), lastModified: SITE.legalUpdated } : { url: absoluteUrl(p.path) });
  return entries;
}
