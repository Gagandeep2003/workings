/**
 * Registry validation. Used by `npm run validate:registry` (which runs before every build, so an
 * incomplete tool fails the build) and by the unit tests.
 */
import { TOOLS } from "./registry";
import { CATEGORIES } from "./categories";
import type { InputDef, ToolDefinition } from "./types";
import { CATEGORY_IDS } from "./types";
import { engineModules } from "@/engines/loaders";

export type Issue = { tool: string; message: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SITE_NAME_SUFFIX_LENGTH = " | Workings".length;
const LINK_RE = /\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g;

export function linkedIds(text: string): string[] {
  return [...text.matchAll(LINK_RE)].map((m) => m[1]);
}

export function validateTool(t: ToolDefinition, all: Map<string, ToolDefinition>): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ tool: t.id, message });
  const need = (cond: unknown, message: string) => { if (!cond) add(message); };

  need(SLUG_RE.test(t.id), "id must be lowercase-kebab-case");
  need(SLUG_RE.test(t.slug), "slug must be lowercase-kebab-case");
  need(t.slug === t.id, "slug should equal id so there is only ever one URL per tool");
  need(CATEGORY_IDS.includes(t.category), `unknown category ${t.category}`);
  need(t.engineModule in engineModules, `unknown engine module ${t.engineModule}`);
  need(!!t.client === (t.engineModule === "client"), 'client tools must use engineModule "client" (and only they may)');
  need(t.title.trim().length >= 3, "title missing");
  need(t.h1.trim().length >= 3, "h1 missing");
  need(t.shortDescription.length >= 30 && t.shortDescription.length <= 140, `shortDescription should be 30–140 chars (is ${t.shortDescription.length})`);
  { const words = t.shortDescription.trim().split(/\s+/).length; need(words >= 8 && words <= 18, `shortDescription should be 8–18 words so it fits a card (is ${words})`); }
  need(t.seoTitle.length >= 20 && t.seoTitle.length + SITE_NAME_SUFFIX_LENGTH <= 68, `seoTitle should be 20–${68 - SITE_NAME_SUFFIX_LENGTH} chars (is ${t.seoTitle.length})`);
  need(t.seoDescription.length >= 100 && t.seoDescription.length <= 165, `seoDescription should be 100–165 chars (is ${t.seoDescription.length})`);
  need(t.keywords.length >= 3, "needs at least 3 keywords");
  need(t.aliases.length >= 2, "needs at least 2 aliases");
  need(t.tags.length >= 1, "needs at least 1 tag");
  need(t.intro.length >= 30 && t.intro.length <= 260, `intro should be one clear sentence (30–260 chars; is ${t.intro.length})`);
  need(t.formula.expression.length >= 1 && t.formula.plain.length > 10, "formula needs an expression and a plain-language line");
  need(t.howItWorks.length >= 2, "howItWorks needs at least 2 paragraphs");
  need(t.howItWorks.join(" ").length >= 450, "howItWorks is too thin to be genuinely useful (min 450 chars)");
  if (t.client) {
    need(t.inputs.length === 0 && t.examples.length === 0, "client tools have no engine inputs or engine-computed examples");
    need((t.specs?.length ?? 0) >= 4, "client tools need at least 4 specs (formats, limits)");
    need((t.practicalExamples?.length ?? 0) >= 2, "client tools need at least 2 practical examples");
    for (const e of t.practicalExamples ?? []) need(e.title.length > 3 && e.scenario.length > 30 && e.result.length > 20, `practical example \"${e.title}\" is too thin`);
    need(t.faqs && t.faqs.length >= 4, "client tools need at least 4 FAQs");
    need(!t.shareable, "client tools handle files and must not offer share links");
  } else {
    need(t.examples.length >= 1, "needs at least one worked example");
  }
  need(t.assumptions.length >= 1, "needs at least one assumption or limitation");
  if (!t.client) {
    need(t.output.primary.length >= 1, "output.primary must list the label(s) the engine returns");
    need(t.inputs.length >= 1, "needs inputs");
  }
  need(t.relatedTools.length >= 3, "needs at least 3 related tools");
  need(typeof t.requiresDynamicData === "boolean", "requiresDynamicData must be set");
  need(!t.requiresDynamicData || t.reviewal === "dynamic", "tools that need dynamic data must be marked reviewal: dynamic");
  need(["low", "medium", "high"].includes(t.commercialIntent), "commercialIntent invalid");

  need(new Set(t.relatedTools).size === t.relatedTools.length, "relatedTools has duplicates");
  for (const r of t.relatedTools) {
    need(all.has(r), `relatedTools references unknown tool "${r}"`);
    need(r !== t.id, "a tool can't list itself as related");
  }
  const bodyText = [t.intro, ...t.howItWorks, ...(t.faqs?.map((f) => f.a) ?? [])].join(" ");
  for (const id of linkedIds(bodyText)) need(all.has(id), `content links to unknown tool "[[${id}]]"`);
  need(linkedIds(t.howItWorks.join(" ")).length >= 1, "howItWorks should link to at least one related tool in context");

  // inputs
  const ids = new Set<string>();
  const check = (i: InputDef) => {
    need(!ids.has(i.id), `duplicate input id "${i.id}"`);
    ids.add(i.id);
    need(i.label.length > 0, `input "${i.id}" needs a label`);
    if (i.type === "select") {
      need(i.options.length >= 2, `select "${i.id}" needs at least 2 options`);
      const scoped = i.options.map((o) => `${o.when ? JSON.stringify(o.when) : ""}|${o.value}`);
      need(new Set(scoped).size === i.options.length, `select "${i.id}" has duplicate option values`);
      if (i.default !== undefined && !i.options.some((o) => o.value === i.default)) add(`select "${i.id}" default "${i.default}" is not an option`);
    }
  };
  t.inputs.forEach(check);
  for (const i of t.inputs) {
    if (i.showIf) {
      const controller = t.inputs.find((x) => x.id === i.showIf!.field);
      need(controller && controller.type === "select", `input "${i.id}" showIf refers to "${i.showIf.field}", which isn't a select`);
      if (controller?.type === "select") {
        const values = Array.isArray(i.showIf.equals) ? i.showIf.equals : [i.showIf.equals];
        for (const v of values) need(controller.options.some((o) => o.value === v), `input "${i.id}" showIf value "${v}" isn't an option of "${controller.id}"`);
      }
    }
    if (i.type === "select") for (const o of i.options) if (o.when) need(t.inputs.some((x) => x.id === o.when!.field), `option "${o.value}" of "${i.id}" has a bad "when" field`);
  }
  if (t.swapFields) for (const f of t.swapFields) need(ids.has(f), `swapFields references unknown input "${f}"`);

  // examples
  for (const ex of t.examples) {
    for (const key of Object.keys(ex.inputs)) need(ids.has(key), `example "${ex.title}" uses unknown input "${key}"`);
    need(ex.title.length > 0, "example needs a title");
  }

  // regulatory / exam rules
  if (t.category === "exams" && !t.ruleFree) need(t.regulatory, "exam tools must store their rule's year, source and effective date (regulatory)");
  if (t.regulatory) {
    const r = t.regulatory;
    need(/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom) || /^\d{4} cycle$/.test(r.effectiveFrom), "regulatory.effectiveFrom must be YYYY-MM-DD, or \"YYYY cycle\" when no exact date has been verified");
    need(/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedOn), "regulatory.reviewedOn must be YYYY-MM-DD");
    need(r.sources.length >= 1 && r.sources.every((s) => /^https:\/\//.test(s.url)), "regulatory needs at least one https source");
    need(r.region.length > 0 && r.appliesTo.length > 0, "regulatory needs region and appliesTo");
    need(t.reviewal !== "evergreen", "tools with regulatory data must be marked reviewal: periodic or dynamic");
  }
  if (t.lastModified) need(/^\d{4}-\d{2}-\d{2}$/.test(t.lastModified), "lastModified must be YYYY-MM-DD");
  if (!t.shareable) need(t.category === "developer" || t.category === "image-pdf", "only developer and file tools should disable sharing");
  return issues;
}

export function validateRegistry(tools: ToolDefinition[] = TOOLS): Issue[] {
  const issues: Issue[] = [];
  const all = new Map(tools.map((t) => [t.id, t]));
  if (all.size !== tools.length) {
    const seen = new Set<string>();
    for (const t of tools) {
      if (seen.has(t.id)) issues.push({ tool: t.id, message: "duplicate tool id" });
      seen.add(t.id);
    }
  }
  const paths = new Set<string>();
  for (const t of tools) {
    const p = `${t.category}/${t.slug}`;
    if (paths.has(p)) issues.push({ tool: t.id, message: `duplicate route /${p}` });
    paths.add(p);
    issues.push(...validateTool(t, all));
  }
  // uniqueness of metadata
  for (const field of ["title", "h1", "seoTitle", "seoDescription"] as const) {
    const seen = new Map<string, string>();
    for (const t of tools) {
      const key = t[field].trim().toLowerCase();
      if (seen.has(key)) issues.push({ tool: t.id, message: `${field} duplicates the one on ${seen.get(key)}` });
      seen.set(key, t.id);
    }
  }
  // categories
  const inGroups = new Set<string>();
  for (const c of CATEGORIES) {
    for (const g of c.groups) {
      for (const id of g.toolIds) {
        const t = all.get(id);
        if (!t) issues.push({ tool: id, message: `category ${c.id} lists unknown tool` });
        else if (t.category !== c.id) issues.push({ tool: id, message: `listed in category ${c.id} but belongs to ${t.category}` });
        inGroups.add(id);
      }
    }
    if (c.seoDescription.length < 100 || c.seoDescription.length > 165) issues.push({ tool: `category:${c.id}`, message: `seoDescription should be 100–165 chars (is ${c.seoDescription.length})` });
  }
  for (const t of tools) if (!inGroups.has(t.id)) issues.push({ tool: t.id, message: "orphan: not listed on its category page" });

  // inbound links: every tool must be linked from at least one other tool (related) or category page
  const inbound = new Map<string, number>(tools.map((t) => [t.id, 0]));
  for (const t of tools) for (const r of t.relatedTools) inbound.set(r, (inbound.get(r) ?? 0) + 1);
  for (const [id, n] of inbound) if (n === 0) issues.push({ tool: id, message: "no other tool links to this one via relatedTools" });
  return issues;
}
