import type { Engine, EngineContext, FieldError, Labeled, ToolOutput, ToolResult, Values } from "@/tools/types";
import { formatValue } from "@/lib/format";

export const ok = (output: ToolOutput): ToolResult => ({ ok: true, output });
export const fail = (message: string, field?: string): ToolResult => ({ ok: false, errors: [{ field, message }] });
export const failMany = (errors: FieldError[]): ToolResult => ({ ok: false, errors });

/** Programmer-error-safe accessors: the runtime validator has already parsed these. */
export function num(v: Values, id: string): number {
  const x = v[id];
  if (typeof x !== "number") throw new Error(`Engine expected a number for "${id}"`);
  return x;
}
export const optNum = (v: Values, id: string): number | undefined => (typeof v[id] === "number" ? (v[id] as number) : undefined);
export const str = (v: Values, id: string): string => (v[id] === undefined ? "" : String(v[id]));

export const isDefined = <T,>(x: T | undefined): x is T => x !== undefined;

/** Plain-text rendering of a result, used by "Copy result". */
export function outputToText(title: string, output: ToolOutput): string {
  const lines: string[] = [title, `${output.primary.label}: ${formatValue(output.primary.value)}`];
  for (const s of output.secondary ?? []) lines.push(`${s.label}: ${formatValue(s.value)}`);
  if (output.steps?.length) lines.push("", "How this was calculated:", ...output.steps.map((s) => `• ${s}`));
  if (output.table) {
    lines.push("");
    lines.push(output.table.columns.join("\t"));
    for (const row of output.table.rows) {
      lines.push(row.map((c) => (typeof c === "object" ? formatValue(c) : String(c))).join("\t"));
    }
  }
  for (const t of output.texts ?? []) lines.push("", `${t.label}:`, t.value);
  if (output.notes?.length) lines.push("", ...output.notes.map((n) => `Note: ${n}`));
  return lines.join("\n");
}

export const labeled = (label: string, value: Labeled["value"], hint?: string): Labeled => ({ label, value, hint });

export function makeContext(overrides: Partial<EngineContext> = {}): EngineContext {
  const now = overrides.nowMs ?? Date.now();
  return {
    today: overrides.today ?? "2026-01-01",
    nowMs: now,
    timeZone: overrides.timeZone ?? "UTC",
    random: overrides.random ?? ((n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))),
  };
}

export type { Engine };

import type { Value } from "@/lib/format";
/** A number always shown with exactly `dp` decimal places (GPA, money-like scores). */
export const fixed = (value: number, dp = 2, unit?: string): Value => ({ kind: "number", value, unit, minDecimals: dp, maxDecimals: dp });
