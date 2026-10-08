import { mathTools } from "./defs/math";
import { everydayTools } from "./defs/everyday";
import { studentTools } from "./defs/student";
import { careerTools } from "./defs/career";
import { moneyTools } from "./defs/money";
import { developerTools } from "./defs/developer";
import { examTools } from "./defs/exams";
import { CATEGORIES } from "./categories";
import type { CategoryId, ToolDefinition, ToolRuntime } from "./types";
import { defaultValues } from "@/lib/form";

/** Every published tool. Add a new tool by adding one entry to the relevant file in ./defs and one engine function. */
export const TOOLS: ToolDefinition[] = [...mathTools, ...everydayTools, ...studentTools, ...careerTools, ...moneyTools, ...developerTools, ...examTools];

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
    examples: t.examples.map((e) => ({ title: e.title, inputs: { ...defaultValues(t.inputs), ...e.inputs } })),
    primaryLabel: t.output.primary[0],
  };
}

/** Curated for the home page. */
export const POPULAR_TOOL_IDS = [
  "percentage-calculator", "emi-calculator", "age-calculator", "cgpa-to-percentage-calculator",
  "unit-converter", "json-formatter", "gst-calculator", "days-between-dates-calculator", "sip-calculator",
];

export { CATEGORIES };
