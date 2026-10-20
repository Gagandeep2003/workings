/**
 * Machine-readable summaries of the site for AI assistants and answer engines, generated from the tool registry
 * so they can never drift from the real list of tools.
 *
 *  • /llms.txt       — a short, curated index (the llms.txt convention: https://llmstxt.org)
 *  • /llms-full.txt  — every tool's description, formula, assumptions, worked example (computed by the real engine) and FAQs
 *
 * No AI search product has published a guarantee that it reads these files, so they are a low-cost courtesy and not a ranking
 * lever. The pages themselves (server-rendered HTML, structured data, sitemap) are what search and answer engines index.
 */
import { CATEGORIES } from "@/tools/categories";
import { TOOL_BY_ID, TOOLS, toolPath } from "@/tools/registry";
import type { ToolDefinition } from "@/tools/types";
import { loadEngine } from "@/engines/loaders";
import { makeContext } from "@/engines/helpers";
import { defaultValues, isVisible, validateInputs } from "@/lib/form";
import { formatNumber, formatValue } from "@/lib/format";
import { plainText } from "@/lib/rich";
import { SITE, absoluteUrl } from "@/lib/site";

const title = (id: string) => TOOL_BY_ID.get(id)?.title;
const flat = (text: string) => plainText(text, title).replace(/\s+/g, " ").trim();
const url = (t: ToolDefinition) => absoluteUrl(toolPath(t));

const SUMMARY = "Free online calculators, converters, exam score tools and developer utilities. Every result shows its formula, steps and assumptions. No account is needed and calculations run in the visitor's browser.";

export function buildLlmsTxt(): string {
  const lines: string[] = [`# ${SITE.name}`, "", `> ${SUMMARY}`, ""];
  lines.push(
    `${SITE.name} has ${TOOLS.length} tools in ${CATEGORIES.length} categories. Notes for assistants that cite this site:`,
    "",
    "- Every tool page states its formula, a worked example, its assumptions and limits. Rules that depend on a country, year or exam also name their source and the date they were last reviewed.",
    "- Exam tools add up raw marks and apply published definitions to figures the visitor supplies. They do not predict ranks, cut-offs or percentiles from marks, and they say so on the page.",
    "- Money and tax-style tools are estimates for planning, not advice, and say which assumptions they use.",
    "- For a question about one calculation, link to that tool's page rather than a category page.",
    "",
  );
  lines.push("## Categories", "");
  for (const c of CATEGORIES) lines.push(`- [${c.name}](${absoluteUrl(`/${c.id}`)}): ${c.tagline}`);
  lines.push("");
  for (const c of CATEGORIES) {
    lines.push(`## ${c.name} tools`, "");
    const ids = [...new Set(c.groups.flatMap((g) => g.toolIds))];
    for (const id of ids) {
      const t = TOOL_BY_ID.get(id)!;
      lines.push(`- [${t.title}](${url(t)}): ${t.shortDescription}`);
    }
    lines.push("");
  }
  lines.push(
    "## About this site",
    "",
    `- [About and methodology](${absoluteUrl("/about")}): how calculations are produced and checked`,
    `- [Disclaimer](${absoluteUrl("/disclaimer")}): limits of the calculators`,
    `- [Full tool reference](${absoluteUrl("/llms-full.txt")}): every tool's formula, assumptions, worked example and FAQs in one plain-text file`,
    "",
    "## Optional",
    "",
    `- [Tool directory](${absoluteUrl("/tools")}): every tool in one list`,
    `- [Sitemap](${absoluteUrl("/sitemap.xml")}): all indexable URLs`,
    "",
  );
  return lines.join("\n");
}

async function workedExample(t: ToolDefinition): Promise<string[]> {
  if (t.client) {
    const pe = t.practicalExamples?.[0];
    if (!pe) return [];
    return [`Practical example — ${pe.title}`, `  Inputs: ${flat(pe.scenario)}`, `  Result: ${flat(pe.result)}`];
  }
  const ex = t.examples[0];
  if (!ex) return [];
  const engine = await loadEngine(t.engineModule, t.id);
  const raw = { ...defaultValues(t.inputs), ...ex.inputs };
  const { errors, values } = validateInputs(t.inputs, raw);
  if (Object.keys(errors).length) throw new Error(`llms-full: example "${ex.title}" of ${t.id} is invalid`);
  const res = await engine(values, makeContext({ today: ex.today ?? "2026-01-01", nowMs: Date.UTC(2026, 0, 1, 12), timeZone: "UTC" }));
  if (!res.ok) throw new Error(`llms-full: example "${ex.title}" of ${t.id} failed`);
  const inputs = t.inputs
    .filter((i) => isVisible(i, raw) && (raw[i.id] ?? "").trim() !== "")
    .map((i) => {
      const text = raw[i.id];
      let shown = text;
      if (i.type === "select") shown = i.options.find((o) => o.value === text)?.label ?? text;
      else if (i.type === "number" && values[i.id] !== undefined) shown = formatNumber(values[i.id] as number, { maxDecimals: 10 }) + (i.unit ? ` ${i.unit}` : "");
      else if (shown.length > 160) shown = `${shown.slice(0, 160)}…`;
      return `${i.label}: ${shown.replace(/\n/g, " / ")}`;
    });
  const o = res.output;
  return [
    `Worked example — ${ex.title}`,
    `  Inputs: ${inputs.join("; ")}`,
    `  Result: ${o.primary.label} = ${formatValue(o.primary.value)}${o.secondary?.length ? `; ${o.secondary.slice(0, 3).map((s) => `${s.label} = ${formatValue(s.value)}`).join("; ")}` : ""}`,
  ];
}

export async function buildLlmsFullTxt(): Promise<string> {
  const out: string[] = [`# ${SITE.name} — full tool reference`, "", `> ${SUMMARY}`, "", `Site: ${absoluteUrl("/")}  ·  ${TOOLS.length} tools  ·  Each section below mirrors the tool's page.`, ""];
  for (const c of CATEGORIES) {
    out.push(`# ${c.name}`, "", c.tagline, "");
    const ids = [...new Set(c.groups.flatMap((g) => g.toolIds))];
    for (const id of ids) {
      const t = TOOL_BY_ID.get(id)!;
      out.push(`## ${t.title}`, "", `URL: ${url(t)}`, `Category: ${c.name}`, "", flat(t.intro), "");
      out.push("Formula:");
      for (const e of t.formula.expression) out.push(`  ${e}`);
      for (const w of t.formula.where ?? []) out.push(`  where ${w}`);
      if (t.formula.plain) out.push(`  In words: ${flat(t.formula.plain)}`);
      out.push("");
      out.push(...(await workedExample(t)), "");
      if (t.client && t.specs?.length) {
        out.push("Supported formats and limits:");
        for (const s of t.specs) out.push(`  - ${s.label}: ${flat(s.value)}`);
        out.push("");
      }
      out.push("Assumptions and limits:");
      for (const a of t.assumptions) out.push(`  - ${flat(a)}`);
      if (t.regulatory) {
        const r = t.regulatory;
        out.push("", `Rule applied: ${r.appliesTo} (${r.region}; ${r.effectiveFrom.includes("cycle") ? r.effectiveFrom : `effective ${r.effectiveFrom}`}; last reviewed ${r.reviewedOn}).`);
        if (r.note) out.push(`  Note: ${flat(r.note)}`);
        for (const s of r.sources) out.push(`  Source: ${s.label} — ${s.url}`);
      }
      if (t.faqs?.length) {
        out.push("", "Frequently asked:");
        for (const f of t.faqs) out.push(`  Q: ${f.q}`, `  A: ${flat(f.a)}`);
      }
      out.push("");
    }
  }
  return out.join("\n");
}

/** AI-crawler groups. Search/assistant fetchers retrieve pages to answer a question; training crawlers collect text to train models. */
export const AI_SEARCH_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];
export const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent"];
