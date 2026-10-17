import { mathTools } from "./defs/math";
import { everydayTools } from "./defs/everyday";
import { studentTools } from "./defs/student";
import { careerTools } from "./defs/career";
import { moneyTools } from "./defs/money";
import { developerTools } from "./defs/developer";
import { examTools } from "./defs/exams";
import { mathMoreTools } from "./defs/math-more";
import { lifeMoreTools } from "./defs/life-more";
import { developerMoreTools } from "./defs/developer-more";
import { CATEGORIES } from "./categories";
import { HOME } from "./home";
import type { CategoryId, ToolDefinition, ToolRuntime } from "./types";
import { defaultValues } from "@/lib/form";

/** Every published tool. Add a new tool by adding one entry to the relevant file in ./defs and one engine function. */
export const TOOLS: ToolDefinition[] = [
  ...mathTools, ...mathMoreTools,
  ...everydayTools, ...lifeMoreTools.everyday,
  ...studentTools,
  ...careerTools, ...lifeMoreTools.career,
  ...moneyTools, ...lifeMoreTools.money,
  ...developerTools, ...developerMoreTools,
  ...examTools,
];

export const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));
export const toolPath = (t: Pick<ToolDefinition, "category" | "slug">): string => `/${t.category}/${t.slug}`;
export const getTool = (category: string, slug: string): ToolDefinition | undefined => TOOLS.find((t) => t.category === category && t.slug === slug);

export const toolsInCategory = (category: CategoryId): ToolDefinition[] => TOOLS.filter((t) => t.category === category);

export function toRuntime(t: ToolDefinition): ToolRuntime {
  return {
    id: t.id,
    category: t.category,
    title: t.title,
    engineModule: t.engineModule,
    inputs: t.inputs,
    mode: t.mode,
    submitLabel: t.submitLabel ?? (t.mode === "live" ? "Convert" : "Calculate"),
    swapFields: t.swapFields,
    shareable: t.shareable,
    persist: t.persist ?? false,
    examples: t.examples.map((e) => ({ title: e.title, inputs: { ...defaultValues(t.inputs), ...e.inputs } })),
    primaryLabel: t.output.primary[0],
  };
}

/** Curated for the home page (see ./home.ts). */
export const POPULAR_TOOL_IDS = HOME.popular;

/**
 * Newest tools first, using only real `addedOn` dates. Tools without a recorded date are never listed as new.
 * Tools added on the same day are interleaved across categories, so a big batch doesn't show as one long run of the same kind of tool.
 */
export function recentlyAdded(limit = 8): ToolDefinition[] {
  const dated = TOOLS.filter((t): t is ToolDefinition & { addedOn: string } => !!t.addedOn);
  const out: ToolDefinition[] = [];
  for (const day of [...new Set(dated.map((t) => t.addedOn))].sort().reverse()) {
    const queues = CATEGORIES.map((c) => dated.filter((t) => t.addedOn === day && t.category === c.id)).filter((q) => q.length);
    for (let round = 0; queues.some((q) => round < q.length); round++) for (const q of queues) if (round < q.length) out.push(q[round]);
  }
  return out.slice(0, limit);
}

export { CATEGORIES };
