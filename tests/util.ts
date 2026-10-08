import type { EngineMap, ToolOutput, ToolResult, Values } from "@/tools/types";
import type { Value } from "@/lib/format";
import { makeContext } from "@/engines/helpers";

export const ctx = makeContext({ today: "2026-01-01", nowMs: Date.UTC(2026, 0, 1, 12, 0, 0), timeZone: "UTC" });

export function run(engines: EngineMap, id: string, values: Values, c = ctx): ToolResult {
  const engine = engines[id];
  if (!engine) throw new Error(`No engine for ${id}`);
  return engine(values, c);
}

export function out(res: ToolResult): ToolOutput {
  if (!res.ok) throw new Error("Expected success but got: " + res.errors.map((e) => e.message).join("; "));
  return res.output;
}

export function errs(res: ToolResult): string {
  if (res.ok) throw new Error("Expected an error but the calculation succeeded");
  return res.errors.map((e) => `${e.field ?? "*"}: ${e.message}`).join(" | ");
}

export const raw = (v: Value): number | string => {
  switch (v.kind) {
    case "number": case "money": case "percent": return v.value;
    case "fraction": return v.den === "1" ? v.num : `${v.num}/${v.den}`;
    case "text": case "date": return v.value;
    case "duration": return JSON.stringify(v.parts);
  }
};

export const primary = (res: ToolResult) => raw(out(res).primary.value);
export const label = (res: ToolResult) => out(res).primary.label;
export function sec(res: ToolResult, name: string): number | string {
  const s = out(res).secondary?.find((x) => x.label === name);
  if (!s) throw new Error(`No secondary "${name}" in: ${out(res).secondary?.map((x) => x.label).join(", ")}`);
  return raw(s.value);
}
