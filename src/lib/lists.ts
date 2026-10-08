import { parseNumberText } from "./form";

export type NumberList = { ok: true; values: number[] } | { ok: false; message: string };

/** Parse numbers separated by spaces, commas, semicolons or new lines (no thousands separators). */
export function parseNumberList(text: string, opts: { min?: number; max?: number; label?: string; integer?: boolean; positive?: boolean } = {}): NumberList {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const label = opts.label ?? "numbers";
  const values: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.includes("%")) return { ok: false, message: `Item ${i + 1} ("${t}") has a % sign — enter plain numbers only.` };
    const parsed = parseNumberText(t);
    if (!parsed.ok) return { ok: false, message: `Couldn't read "${t.slice(0, 20)}" (item ${i + 1}) as a number. Separate ${label} with spaces, commas or new lines, and don't use thousands separators.` };
    if (opts.integer && !Number.isInteger(parsed.value)) return { ok: false, message: `Item ${i + 1} ("${t}") must be a whole number.` };
    if (opts.positive && parsed.value <= 0) return { ok: false, message: `Item ${i + 1} ("${t}") must be greater than zero.` };
    if (Math.abs(parsed.value) > 1e15) return { ok: false, message: `Item ${i + 1} is too large to calculate reliably.` };
    values.push(parsed.value);
  }
  if (opts.min !== undefined && values.length < opts.min) {
    return { ok: false, message: `Enter at least ${opts.min} ${label}${values.length ? ` (you entered ${values.length})` : ""}.` };
  }
  if (opts.max !== undefined && values.length > opts.max) return { ok: false, message: `Too many ${label} — the limit is ${opts.max.toLocaleString("en-US")}.` };
  return { ok: true, values };
}

/** Split text into non-empty trimmed lines, remembering the original line numbers. */
export function lines(text: string): { text: string; line: number }[] {
  return text
    .split(/\r?\n/)
    .map((t, i) => ({ text: t.trim(), line: i + 1 }))
    .filter((l) => l.text !== "");
}
