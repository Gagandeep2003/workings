import type { CategoryId, EngineModule, ToolDefinition } from "./types";

type Defaults = {
  category: CategoryId;
  engineModule: EngineModule;
} & Partial<Omit<ToolDefinition, "id" | "category" | "engineModule">>;

type ToolInput = Omit<ToolDefinition, "slug" | "category" | "engineModule" | "mode" | "requiresDynamicData" | "shareable" | "reviewal" | "commercialIntent" | "adProfile" | "tags"> &
  Partial<Pick<ToolDefinition, "slug" | "category" | "engineModule" | "mode" | "requiresDynamicData" | "shareable" | "reviewal" | "commercialIntent" | "adProfile" | "tags">>;

/** Define several tools that share an engine module and defaults. */
export function group(defaults: Defaults, tools: ToolInput[]): ToolDefinition[] {
  return tools.map((t) => ({
    mode: "submit",
    requiresDynamicData: false,
    shareable: true,
    reviewal: "evergreen",
    commercialIntent: "low",
    adProfile: "standard",
    ...defaults,
    ...t,
    slug: t.slug ?? t.id,
    tags: [...new Set([...(defaults.tags ?? []), ...(t.tags ?? [])])],
  })) as ToolDefinition[];
}
