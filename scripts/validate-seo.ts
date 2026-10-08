/**
 * SEO validation over the *built* HTML (what search engines actually receive).
 * Reports: missing/duplicate titles and descriptions, missing/invalid canonicals, missing or multiple H1s,
 * sitemap gaps, orphan pages, broken internal links, missing breadcrumbs, malformed structured data,
 * missing Open Graph tags, tool pages without related tools, accidental noindex, and near-duplicate content.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { APP_DIR, Report, builtPages, requireBuild } from "./lib";
import { TOOLS, toolPath } from "../src/tools/registry";
import { CATEGORIES } from "../src/tools/categories";
import { SITE, STATIC_PAGES } from "../src/lib/site";

requireBuild();
const r = new Report();
const pages = builtPages();
const expected = new Set<string>(["/", ...CATEGORIES.map((c) => `/${c.id}`), ...TOOLS.map(toolPath), ...STATIC_PAGES.map((p) => p.path), "/search"]);
const known = new Set(pages.map((p) => p.route));
const NOINDEX = new Set(["/search"]);

for (const route of expected) if (!known.has(route)) r.error(route, "route is expected but no built HTML was found");
for (const route of known) if (!expected.has(route)) r.warn(route, "built page is not in the registry/static page list");

const titles = new Map<string, string>();
const descriptions = new Map<string, string>();
const inbound = new Map<string, Set<string>>();
const shingleSets = new Map<string, Set<string>>();
const prodUrl = SITE.url.startsWith("https://");
if (!prodUrl) r.warn("site", `NEXT_PUBLIC_SITE_URL is "${SITE.url}". Canonical URLs, Open Graph URLs and the sitemap use it — set your https domain before launch.`);

for (const { route, html } of pages) {
  const $ = cheerio.load(html);
  const title = $("head > title").first().text().trim();
  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const canonical = $('link[rel="canonical"]').attr("href") ?? "";
  const robots = $('meta[name="robots"]').attr("content") ?? "";
  const noindex = /noindex/i.test(robots);

  if (!title) r.error(route, "missing <title>");
  else {
    if (title.length > 70) r.warn(route, `title is ${title.length} chars (may be truncated in results)`);
    if (titles.has(title) && route !== "/") r.error(route, `duplicate title with ${titles.get(title)}: "${title}"`);
    titles.set(title, route);
  }
  if (!desc) r.error(route, "missing meta description");
  else {
    if (desc.length < 70 || desc.length > 170) r.warn(route, `meta description is ${desc.length} chars (aim for 70–160)`);
    if (descriptions.has(desc)) r.error(route, `duplicate meta description with ${descriptions.get(desc)}`);
    descriptions.set(desc, route);
  }
  const expectedCanonical = `${SITE.url}${route === "/" ? "" : route}`;
  if (!canonical) r.error(route, "missing canonical link");
  else if (canonical !== expectedCanonical) r.error(route, `canonical is ${canonical}, expected ${expectedCanonical}`);
  else if (canonical !== canonical.toLowerCase() && !/[A-Z]/.test(route)) r.error(route, "canonical contains upper-case characters");
  if (canonical.endsWith("/") && canonical !== `${SITE.url}/`) r.error(route, "canonical has a trailing slash");
  if (/[?#]/.test(canonical)) r.error(route, "canonical contains a query string or fragment");

  const h1 = $("h1").length;
  if (h1 === 0) r.error(route, "missing <h1>");
  if (h1 > 1) r.error(route, `${h1} <h1> elements`);
  if (!$("html").attr("lang")) r.error(route, "missing <html lang>");
  if (!$('meta[name="viewport"]').length) r.error(route, "missing viewport meta");

  for (const p of ["og:title", "og:description", "og:url", "og:image", "og:site_name", "og:type"]) if (!$(`meta[property="${p}"]`).attr("content")) r.error(route, `missing Open Graph tag ${p}`);
  if (!$('meta[name="twitter:card"]').attr("content")) r.error(route, "missing twitter:card");
  if ($('meta[property="og:url"]').attr("content") !== expectedCanonical) r.error(route, "og:url doesn't match the canonical URL");

  if (noindex !== NOINDEX.has(route)) r.error(route, noindex ? "has an unexpected noindex directive" : "should be noindex but isn't");

  // structured data
  const isTool = TOOLS.some((t) => toolPath(t) === route);
  const isCategory = CATEGORIES.some((c) => `/${c.id}` === route);
  const ld = $('script[type="application/ld+json"]').toArray().map((el) => $(el).text());
  const kinds: string[] = [];
  for (const raw of ld) {
    try {
      const data = JSON.parse(raw);
      if (data["@context"] !== "https://schema.org") r.error(route, "JSON-LD missing @context https://schema.org");
      kinds.push(data["@type"]);
      if (data["@type"] === "BreadcrumbList") {
        const items = data.itemListElement as { position: number; name: string; item: string }[];
        if (!Array.isArray(items) || items.length < 2) r.error(route, "BreadcrumbList needs at least 2 items");
        else {
          items.forEach((it, i) => {
            if (it.position !== i + 1) r.error(route, "BreadcrumbList positions aren't sequential");
            if (!it.name || !/^https?:\/\//.test(it.item)) r.error(route, "BreadcrumbList item missing name or absolute URL");
          });
          if (items[items.length - 1].item !== expectedCanonical) r.error(route, "last BreadcrumbList item isn't the page itself");
        }
      }
      if (/aggregateRating|"review"|offers/i.test(raw)) r.error(route, "structured data contains rating/review/offer markup, which this site must never invent");
    } catch (e) {
      r.error(route, `malformed JSON-LD: ${(e as Error).message}`);
    }
  }
  if ((isTool || isCategory) && !kinds.includes("BreadcrumbList")) r.error(route, "missing BreadcrumbList structured data");
  if ((isTool || isCategory) && !$('nav[aria-label="Breadcrumb"] li').length) r.error(route, "missing visible breadcrumb navigation");

  // related tools
  if (isTool) {
    const related = $("#related-title").closest("section").find("a[href^='/']").length;
    if (related < 3) r.error(route, `only ${related} related-tool links`);
    if (!$("#calculator").length) r.error(route, "no calculator section");
    for (const id of ["formula-title", "how-title", "example-title", "assump-title"]) if (!$(`#${id}`).length) r.error(route, `missing content section #${id}`);
    const body = $('[data-content="tool-body"] .content').text().toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i + 5 <= body.length; i++) set.add(body.slice(i, i + 5).join(" "));
    shingleSets.set(route, set);
  }

  // links
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//")) return;
    const target = href.split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
    if (/^\/(_next|icon\.svg|search-index\.json|sitemap\.xml|robots\.txt)/.test(target)) return;
    if (!known.has(target) && !expected.has(target)) r.error(route, `broken internal link ${href}`);
    else if (target !== route) (inbound.get(target) ?? inbound.set(target, new Set()).get(target)!).add(route);
  });
}

for (const route of expected) {
  if (route === "/" || route === "/search") continue;
  if (!(inbound.get(route)?.size)) r.error(route, "orphan page: no other page links to it");
}

// near-duplicate detection among tool pages
const ids = [...shingleSets.keys()];
let worst = { a: "", b: "", sim: 0 };
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const A = shingleSets.get(ids[i])!, B = shingleSets.get(ids[j])!;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  const sim = inter / (A.size + B.size - inter || 1);
  if (sim > worst.sim) worst = { a: ids[i], b: ids[j], sim };
  if (sim >= 0.35) r.error(ids[i], `content is ${(sim * 100).toFixed(0)}% similar to ${ids[j]} (near-duplicate risk)`);
  else if (sim >= 0.2) r.warn(ids[i], `content is ${(sim * 100).toFixed(0)}% similar to ${ids[j]}`);
}

// sitemap
const sitemapFile = path.join(APP_DIR, "sitemap.xml.body");
if (!fs.existsSync(sitemapFile)) r.error("/sitemap.xml", "no sitemap was generated");
else {
  const xml = fs.readFileSync(sitemapFile, "utf8");
  const $s = cheerio.load(xml, { xmlMode: true });
  const urls = $s("url").toArray().map((u) => ({ loc: $s(u).find("loc").text(), lastmod: $s(u).find("lastmod").text() }));
  const locs = new Set(urls.map((u) => u.loc));
  if (locs.size !== urls.length) r.error("/sitemap.xml", "duplicate URLs in sitemap");
  const want = new Set([...expected].filter((e) => !NOINDEX.has(e)).map((e) => `${SITE.url}${e === "/" ? "" : e}`));
  for (const w of want) if (!locs.has(w)) r.error("/sitemap.xml", `missing entry ${w}`);
  for (const l of locs) {
    if (!want.has(l)) r.error("/sitemap.xml", `unexpected entry ${l}`);
    if (/[?#]|\/$/.test(l.replace(SITE.url, "")) || l !== l.toLowerCase()) r.error("/sitemap.xml", `non-canonical URL ${l}`);
  }
  for (const u of urls) {
    if (!u.lastmod) continue;
    if (!/^\d{4}-\d{2}-\d{2}/.test(u.lastmod)) r.error("/sitemap.xml", `bad lastmod ${u.lastmod}`);
    const tool = TOOLS.find((t) => `${SITE.url}${toolPath(t)}` === u.loc);
    if (tool && !(tool.lastModified || tool.regulatory)) r.error("/sitemap.xml", `lastmod on ${u.loc} without a real review/modification date (fake freshness)`);
    if (u.lastmod.slice(0, 10) > new Date().toISOString().slice(0, 10)) r.error("/sitemap.xml", `lastmod ${u.lastmod} is in the future`);
  }
}

// robots
const robotsFile = path.join(APP_DIR, "robots.txt.body");
if (!fs.existsSync(robotsFile)) r.error("/robots.txt", "no robots.txt was generated");
else {
  const txt = fs.readFileSync(robotsFile, "utf8");
  const preview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
  if (!preview) {
    if (!/^Allow: \/$/m.test(txt)) r.error("/robots.txt", "doesn't allow crawling");
    if (!/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(txt)) r.error("/robots.txt", "missing Sitemap line");
    if (/^Disallow:\s*\/(_next|static|assets|css|js)?\s*$/m.test(txt)) r.error("/robots.txt", "blocks the site or its rendering resources (/_next etc.)");
  }
}

r.finish("SEO validation", `${pages.length} pages checked — titles, descriptions, canonicals, H1s, Open Graph, structured data, links, orphans, sitemap and robots all OK (most-similar tool pair: ${worst.a} / ${worst.b} at ${(worst.sim * 100).toFixed(0)}%)`);
