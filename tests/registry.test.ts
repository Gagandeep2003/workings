import { describe, it, expect } from "vitest";
import { TOOLS, TOOL_BY_ID, toRuntime } from "@/tools/registry";
import { validateRegistry } from "@/tools/validate";
import { loadEngine } from "@/engines/loaders";
import { defaultValues, validateInputs } from "@/lib/form";
import { makeContext, outputToText } from "@/engines/helpers";
import { formatValue } from "@/lib/format";

const labelMatches = (label: string, allowed: string[]) =>
  allowed.some((a) => (a === "…" ? true : a.endsWith("…") ? label.startsWith(a.slice(0, -1)) : a.startsWith("…") ? label.endsWith(a.slice(1)) : a === label));

describe("tool registry", () => {
  it("passes every structural check", () => {
    expect(validateRegistry()).toEqual([]);
  });

  it("ships a library of 100–200 tools across all seven categories", () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(100);
    expect(TOOLS.length).toBeLessThanOrEqual(200);
    expect(new Set(TOOLS.map((t) => t.category)).size).toBe(7);
  });

  it("no tool needs an external API in this release", () => {
    expect(TOOLS.filter((t) => t.requiresDynamicData)).toEqual([]);
  });

  it("developer tools never offer share links (inputs may be secrets)", () => {
    for (const t of TOOLS.filter((x) => x.category === "developer")) expect(t.shareable, t.id).toBe(false);
  });

  it("serialisable runtime objects contain no functions", () => {
    for (const t of TOOLS) expect(() => JSON.stringify(toRuntime(t))).not.toThrow();
    const text = JSON.stringify(toRuntime(TOOLS[0]));
    expect(text).not.toContain("=>");
  });
});

describe.each(TOOLS.map((t) => [t.id, t] as const))("%s", (_id, tool) => {
  it("has an engine that returns a successful, correctly labelled result for every worked example", async () => {
    const engine = await loadEngine(tool.engineModule, tool.id);
    for (const ex of tool.examples) {
      const raw = { ...defaultValues(tool.inputs), ...ex.inputs };
      const { errors, values } = validateInputs(tool.inputs, raw);
      expect(errors, `${ex.title} validation`).toEqual({});
      const res = await engine(values, makeContext({ today: ex.today ?? "2026-01-01", nowMs: Date.UTC(2026, 0, 1, 12), timeZone: "UTC" }));
      if (!res.ok) throw new Error(`${ex.title}: ${res.errors.map((e) => e.message).join("; ")}`);
      expect(labelMatches(res.output.primary.label, tool.output.primary), `label "${res.output.primary.label}" not in ${JSON.stringify(tool.output.primary)}`).toBe(true);
      expect(formatValue(res.output.primary.value).length).toBeGreaterThan(0);
      expect(outputToText(tool.title, res.output).length).toBeGreaterThan(10);
    }
  });

  it("rejects empty required inputs before calculating", () => {
    const required = tool.inputs.filter((i) => i.required !== false && !i.showIf && i.default === undefined && i.type !== "select");
    if (required.length === 0) return;
    const { errors } = validateInputs(tool.inputs, defaultValues(tool.inputs));
    for (const i of required) expect(errors[i.id], `${i.id} should be required`).toBeTruthy();
  });
});

describe("related-tool graph", () => {
  it("every tool is reachable from at least two other tools", () => {
    const inbound = new Map<string, Set<string>>();
    for (const t of TOOLS) for (const r of t.relatedTools) (inbound.get(r) ?? inbound.set(r, new Set()).get(r)!).add(t.id);
    for (const t of TOOLS) expect(inbound.get(t.id)?.size ?? 0, t.id).toBeGreaterThanOrEqual(1);
  });
  it("every tool keeps at least one related tool in its own category (no random cross-category linking)", () => {
    for (const t of TOOLS) {
      const same = t.relatedTools.filter((r) => TOOL_BY_ID.get(r)!.category === t.category).length;
      expect(same, `${t.id} has only ${same} same-category related tools`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("content quality guards", () => {
  const copy = (t: (typeof TOOLS)[number]) => [t.title, t.h1, t.shortDescription, t.seoTitle, t.seoDescription, t.intro, ...t.howItWorks, ...t.assumptions, ...(t.faqs ?? []).flatMap((f) => [f.q, f.a]), t.formula.plain].join("\n");
  const BANNED = /\b(trusted by|millions of|award[- ]winning|best[- ]in[- ]class|world[- ]class|#1\b|testimonial|100% accurate|unlock|seamless|game[- ]chang|delve|in today's fast|cutting[- ]edge|revolutionary|ultimate guide)\b/i;
  it("contains no fake claims, hype or generic filler", () => {
    for (const t of TOOLS) expect(copy(t), t.id).not.toMatch(BANNED);
  });
  it("never repeats a long sentence across different tools", () => {
    const seen = new Map<string, string>();
    for (const t of TOOLS) {
      for (const sentence of t.howItWorks.join(" ").split(/(?<=[.!?])\s+/)) {
        const s = sentence.trim();
        if (s.length < 70) continue;
        const owner = seen.get(s);
        expect(owner === undefined || owner === t.id, `"${s.slice(0, 60)}…" repeated on ${t.id} and ${owner}`).toBe(true);
        seen.set(s, t.id);
      }
    }
  });
  it("shows a review date only where a rule is actually tied to a source", () => {
    for (const t of TOOLS) {
      if (t.regulatory) {
        expect(t.reviewal, t.id).not.toBe("evergreen");
        expect(t.regulatory.sources.length, t.id).toBeGreaterThan(0);
      }
      if (!t.regulatory) expect(t.lastModified, `${t.id} has lastModified without a real revision`).toBeUndefined();
    }
  });
  it("every periodically reviewed tool is listed in MAINTENANCE.md", async () => {
    const fs = await import("node:fs");
    const doc = fs.readFileSync(new URL("../MAINTENANCE.md", import.meta.url), "utf8");
    for (const t of TOOLS.filter((x) => x.reviewal === "periodic")) expect(doc, t.id).toContain(t.id);
  });
});
