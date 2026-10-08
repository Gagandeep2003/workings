import type { EngineMap, TextBlock } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { errorExcerpt, parseJson, printJson } from "@/lib/json";
import { failMany, ok, str } from "../helpers";

const MAX_BYTES = 5_000_000;

type ParseOk = Extract<ReturnType<typeof parseJson>, { ok: true }>;
type Parsed = { ok: false; error: { message: string; detail: string } } | { ok: true; parsed: ParseOk };

function parse(text: string): Parsed {
  if (text.trim() === "") return { ok: false, error: { message: "Paste some JSON first — the box is empty.", detail: "" } };
  if (text.length > MAX_BYTES) return { ok: false, error: { message: "That's more than 5 MB. Large files are better handled with a command-line tool such as jq.", detail: "" } };
  const r = parseJson(text);
  if (!r.ok) {
    return { ok: false, error: { message: `Line ${r.error.line}, column ${r.error.column}: ${r.error.message}`, detail: errorExcerpt(text, r.error) } };
  }
  return { ok: true, parsed: r };
}

const bytes = (s: string) => new TextEncoder().encode(s).length;
const indentOf = (id: string) => (id === "tab" ? "\t" : id === "4" ? "    " : "  ");

export const engines: EngineMap = {
  "json-formatter": (v) => {
    const text = str(v, "json");
    const r = parse(text);
    if (!r.ok) return failMany([{ field: "json", message: r.error.message + (r.error.detail ? `\n${r.error.detail}` : "") }]);
    const out = printJson(r.parsed.node, { indent: indentOf(str(v, "indent")), sortKeys: str(v, "sort") === "yes" });
    const notes: string[] = [];
    if (r.parsed.stats.duplicateKeys.length) notes.push(`Duplicate keys found: ${r.parsed.stats.duplicateKeys.slice(0, 5).join(", ")}. Most parsers keep only the last value.`);
    if (r.parsed.stats.unsafeNumbers) notes.push("Some whole numbers are larger than 9,007,199,254,740,991. They were kept exactly as written here, but JavaScript would round them.");
    return ok({
      primary: { label: "Formatted JSON", value: T("Valid — formatted below") },
      secondary: [{ label: "Size", value: N(bytes(out), "bytes") }, { label: "Lines", value: N(out.split("\n").length) }],
      texts: [{ label: "Formatted JSON", value: out, language: "json", copyable: true }],
      notes,
    });
  },

  "json-validator": (v) => {
    const text = str(v, "json");
    const r = parse(text);
    if (!r.ok) return failMany([{ field: "json", message: r.error.message + (r.error.detail ? `\n${r.error.detail}` : "") }]);
    const s = r.parsed.stats;
    const notes: string[] = [];
    if (s.duplicateKeys.length) notes.push(`Valid syntax, but these keys appear more than once in the same object: ${s.duplicateKeys.slice(0, 8).join(", ")}. Duplicate keys are legal JSON but usually a mistake.`);
    if (s.unsafeNumbers) notes.push(`${s.unsafeNumbers} whole number${s.unsafeNumbers > 1 ? "s are" : " is"} outside JavaScript's safe integer range, so JavaScript-based tools will round ${s.unsafeNumbers > 1 ? "them" : "it"}. Store such values as strings.`);
    return ok({
      primary: { label: "Result", value: T("Valid JSON ✓") },
      secondary: [
        { label: "Top-level type", value: T(s.rootType) },
        { label: "Nesting depth", value: N(s.depth) },
        { label: "Objects", value: N(s.objects) },
        { label: "Arrays", value: N(s.arrays) },
        { label: "Keys", value: N(s.keys) },
        { label: "Strings / numbers", value: T(`${formatNumber(s.strings)} / ${formatNumber(s.numbers)}`) },
        { label: "Booleans / nulls", value: T(`${formatNumber(s.booleans)} / ${formatNumber(s.nulls)}`) },
        { label: "Size", value: N(bytes(text), "bytes") },
      ],
      notes,
    });
  },

  "json-minifier": (v) => {
    const text = str(v, "json");
    const r = parse(text);
    if (!r.ok) return failMany([{ field: "json", message: r.error.message + (r.error.detail ? `\n${r.error.detail}` : "") }]);
    const out = printJson(r.parsed.node, { indent: "" });
    const before = bytes(text);
    const after = bytes(out);
    const block: TextBlock = { label: "Minified JSON", value: out, language: "json", copyable: true };
    return ok({
      primary: { label: "Bytes saved", value: N(before - after, "bytes") },
      secondary: [
        { label: "Before", value: N(before, "bytes") },
        { label: "After", value: N(after, "bytes") },
        { label: "Reduction", value: T(before === 0 ? "0%" : `${formatNumber(((before - after) / before) * 100, { maxDecimals: 1 })}%`) },
      ],
      texts: [block],
      notes: ["Only whitespace outside strings is removed. Numbers, strings and key order are unchanged."],
    });
  },
};
