import { describe, it, expect } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, AI_SEARCH_BOTS, AI_TRAINING_BOTS } from "@/lib/llms";
import { robotsConfig } from "@/app/robots";
import { collectionJsonLd, toolJsonLd, websiteJsonLd } from "@/lib/seo";
import { CATEGORIES } from "@/tools/categories";
import { TOOLS, TOOL_BY_ID, recentlyAdded, toolPath } from "@/tools/registry";
import { HOME_TOOL_IDS } from "@/tools/home";
import { SITE, absoluteUrl } from "@/lib/site";

describe("llms.txt", () => {
  const txt = buildLlmsTxt();
  it("follows the llms.txt shape: H1, summary blockquote, H2 sections of links", () => {
    expect(txt.startsWith(`# ${SITE.name}\n\n> `)).toBe(true);
    expect(txt).toMatch(/^## Categories$/m);
    expect(txt).toMatch(/^## Optional$/m);
  });
  it("lists every tool exactly once, with an absolute canonical URL", () => {
    for (const t of TOOLS) {
      const link = `](${absoluteUrl(toolPath(t))}):`;
      expect(txt.split(link).length - 1, t.id).toBe(1);
    }
    for (const m of txt.matchAll(/\]\((https?:[^)]+)\)/g)) expect(m[1].startsWith(SITE.url), m[1]).toBe(true);
  });
  it("states the real counts and the honesty notes", () => {
    expect(txt).toContain(`${TOOLS.length} tools in ${CATEGORIES.length} categories`);
    expect(txt).toMatch(/do not predict ranks, cut-offs or percentiles from marks/);
  });
  it("contains no template debris", () => {
    for (const bad of ["[[", "undefined", "NaN", "[object", "null"]) expect(txt, bad).not.toContain(bad);
  });
});

describe("llms-full.txt", async () => {
  const full = await buildLlmsFullTxt();
  it("has a section with formula, worked example (computed) and assumptions for every tool", () => {
    for (const t of TOOLS) expect(full, t.id).toContain(`## ${t.title}\n\nURL: ${absoluteUrl(toolPath(t))}`);
    expect(full.split("\nFormula:\n").length - 1).toBe(TOOLS.length);
    expect(full.split("  Result: ").length - 1).toBe(TOOLS.length);
    expect(full.split("\nAssumptions and limits:\n").length - 1).toBe(TOOLS.length);
  });
  it("includes the rule, review date and sources for rule-based tools", () => {
    const section = full.slice(full.indexOf("## NEET UG Marks Calculator"));
    expect(section).toMatch(/Rule applied: NEET \(UG\): 180 compulsory questions, \+4 correct, −1 wrong, 720 marks \(India \(National Testing Agency\); 2026 cycle; last reviewed 2026-10-13\)/);
    expect(section).toMatch(/Source: NTA — NEET \(UG\) official site/);
  });
  it("worked examples carry real computed numbers", () => {
    const sec = full.slice(full.indexOf("## Percentage Calculator"), full.indexOf("## Percentage Increase Calculator"));
    expect(sec).toMatch(/Result: .*= /);
    const neet = full.slice(full.indexOf("## NEET UG Marks Calculator"));
    expect(neet).toContain("Total marks = 527 / 720");
  });
  it("contains no template debris and no leftover link markup", () => {
    for (const bad of ["[[", "NaN", "[object", "Infinity"]) expect(full, bad).not.toContain(bad);
    // "undefined" is legitimate maths prose ("a percentage change from zero is undefined"); a leaked JavaScript value looks different
    expect(full.replace(/\b(is|are|be|becomes|would be)\s+undefined\b/g, "")).not.toMatch(/undefined/);
    expect(full.length).toBeGreaterThan(100_000);
  });
});

describe("robots policy", () => {
  const base = { siteUrl: "https://example.com" };
  const rulesOf = (r: ReturnType<typeof robotsConfig>) => (Array.isArray(r.rules) ? r.rules : [r.rules]);
  it("blocks every preview deployment", () => {
    expect(robotsConfig({ ...base, vercelEnv: "preview" })).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
  it("allows everything by default, names the AI crawlers explicitly and points to the sitemap", () => {
    const r = robotsConfig({ ...base, vercelEnv: "production" });
    expect(r.sitemap).toBe("https://example.com/sitemap.xml");
    const rules = rulesOf(r);
    expect(rules[0]).toEqual({ userAgent: "*", allow: "/" });
    const ai = rules.find((x) => Array.isArray(x.userAgent))!;
    expect(ai.allow).toBe("/");
    expect(ai.userAgent).toEqual(expect.arrayContaining(["GPTBot", "OAI-SearchBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended"]));
    expect(JSON.stringify(rules)).not.toContain("disallow");
  });
  it("search-only keeps assistants and blocks training crawlers", () => {
    const rules = rulesOf(robotsConfig({ ...base, aiPolicy: "search-only" }));
    expect(rules.find((x) => x.allow === "/" && Array.isArray(x.userAgent))!.userAgent).toEqual(AI_SEARCH_BOTS);
    expect(rules.find((x) => x.disallow === "/")!.userAgent).toEqual(AI_TRAINING_BOTS);
  });
  it("block refuses all AI crawlers but still serves normal search engines", () => {
    const rules = rulesOf(robotsConfig({ ...base, aiPolicy: "block" }));
    expect(rules[0]).toEqual({ userAgent: "*", allow: "/" });
    expect(rules.find((x) => x.disallow === "/")!.userAgent).toEqual([...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS]);
  });
  it("an unrecognised policy value falls back to the default (allow)", () => {
    expect(JSON.stringify(robotsConfig({ ...base, aiPolicy: "typo" }))).not.toContain("disallow");
  });
});

describe("structured data tells the truth", () => {
  const graph = (t = TOOL_BY_ID.get("emi-calculator")!) => (toolJsonLd(t, [{ name: "Home", path: "/" }, { name: "Money", path: "/money" }, { name: t.title, path: toolPath(t) }]) as { "@graph": Record<string, unknown>[] })["@graph"];
  it("describes each tool as a free web application with breadcrumbs, and nothing invented", () => {
    for (const t of TOOLS) {
      const g = graph(t);
      const app = g.find((n) => n["@type"] === "WebApplication")!;
      expect(app.url).toBe(absoluteUrl(toolPath(t)));
      expect(app.isAccessibleForFree).toBe(true);
      expect(app.name).toBe(t.title);
      expect(app.description).toBe(t.seoDescription);
      const crumbs = g.find((n) => n["@type"] === "BreadcrumbList")!.itemListElement as { position: number }[];
      expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3]);
      const text = JSON.stringify(g);
      for (const forbidden of ["aggregateRating", "ratingValue", "reviewCount", "\"review\"", "\"offers\"", "\"price\"", "\"author\"", "ratingCount"]) expect(text, `${t.id} ${forbidden}`).not.toContain(forbidden);
    }
  });
  it("only publishes FAQPage markup for questions that are shown on the page", () => {
    for (const t of TOOLS) {
      const faq = graph(t).find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] } | undefined;
      if (!t.faqs?.length) expect(faq, t.id).toBeUndefined();
      else {
        expect(faq!.mainEntity.map((q) => q.name)).toEqual(t.faqs.map((f) => f.q));
        for (const q of faq!.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/\[\[|`/); // link markup flattened to plain text
      }
    }
  });
  it("omits dates it does not know and uses real ones where it does", () => {
    const old = graph(TOOL_BY_ID.get("percentage-calculator")!).find((n) => n["@type"] === "WebApplication")!;
    expect(old.datePublished).toBeUndefined();
    const fresh = graph(TOOL_BY_ID.get("neet-ug-marks-calculator")!).find((n) => n["@type"] === "WebApplication")!;
    expect(fresh.datePublished).toBe("2026-10-13");
    expect(fresh.dateModified).toBe("2026-10-13");
  });
  it("publishes a publisher entity only when the owner has configured one", () => {
    expect(SITE.operatorName).toBe(""); // test environment has none configured
    expect(JSON.stringify(websiteJsonLd())).not.toMatch(/Organization|"Person"|publisher/);
    expect(JSON.stringify(graph())).not.toMatch(/Organization|"Person"|publisher/);
  });
  it("the WebSite search action points at a route that exists and reads q", () => {
    const site = (websiteJsonLd() as { "@graph": { potentialAction: { target: { urlTemplate: string } } }[] })["@graph"][0];
    expect(site.potentialAction.target.urlTemplate).toBe(`${SITE.url}/search?q={search_term_string}`);
  });
  it("collection pages list real, linked tools", () => {
    const g = (collectionJsonLd("Exams", "/exams", "d", TOOLS.filter((t) => t.category === "exams"), [{ name: "Home", path: "/" }]) as { "@graph": { mainEntity?: { numberOfItems: number; itemListElement: { url: string }[] } }[] })["@graph"][1];
    expect(g.mainEntity!.numberOfItems).toBe(TOOLS.filter((t) => t.category === "exams").length);
    for (const item of g.mainEntity!.itemListElement) expect(item.url.startsWith(SITE.url + "/exams/")).toBe(true);
  });
});

describe("home page data", () => {
  it("every curated id exists, and 'recently added' only uses real dates", () => {
    for (const id of HOME_TOOL_IDS) expect(TOOL_BY_ID.has(id), id).toBe(true);
    const recent = recentlyAdded(200);
    expect(recent.length).toBe(TOOLS.filter((t) => t.addedOn).length);
    for (const t of recent) expect(t.addedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < recent.length; i++) expect(recent[i - 1].addedOn! >= recent[i].addedOn!).toBe(true);
    expect(TOOL_BY_ID.get("percentage-calculator")!.addedOn).toBeUndefined(); // pre-existing tools have no known date and are never called "new"
    // a batch added on one day is interleaved across categories, not listed as one long run of Math tools
    const top = recentlyAdded(6).map((t) => t.category);
    expect(new Set(top).size).toBe(6);
    expect(recentlyAdded(3).length).toBe(3);
  });
});
