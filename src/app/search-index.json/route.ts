import { TOOLS, toolPath, POPULAR_TOOL_IDS } from "@/tools/registry";

/** Compact, static search index. Fetched on demand by the search box (not bundled into page JavaScript). */
export const dynamic = "force-static";

export function GET() {
  const body = TOOLS.map((t) => ({
    i: t.id, t: t.title, c: t.category, p: toolPath(t), d: t.shortDescription, a: t.aliases, k: t.keywords, h: t.phrases ?? [],
    ...(POPULAR_TOOL_IDS.includes(t.id) ? { pop: 1 } : {}),
  }));
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
