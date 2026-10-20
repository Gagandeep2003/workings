import type { EngineContext, EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { fail, ok, str } from "../helpers";

const MAX = 2_000_000;
const splitLines = (text: string): string[] => text.replace(/\r\n?/g, "\n").split("\n");
const dropTrailingEmpty = (lines: string[]): string[] => (lines.length > 1 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines);

/** Uniform integer in [0, max) from the context's random bytes (rejection sampling, so there is no modulo bias). */
export function randomBelow(ctx: EngineContext, max: number): number {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  for (;;) {
    const b = ctx.random(4);
    const x = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (x < limit) return x % max;
  }
}

export function removeDuplicateLines(text: string, o: { caseSensitive: boolean; trim: boolean; dropBlank: boolean; keep: "first" | "last"; mode: "unique" | "only-unique" | "only-duplicates" }) {
  let lines = dropTrailingEmpty(splitLines(text));
  const originalCount = lines.length;
  if (o.trim) lines = lines.map((l) => l.trim());
  if (o.dropBlank) lines = lines.filter((l) => l.trim() !== "");
  const key = (l: string) => (o.caseSensitive ? l : l.toLowerCase());
  const counts = new Map<string, number>();
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  lines.forEach((l, i) => { const k = key(l); counts.set(k, (counts.get(k) ?? 0) + 1); if (!first.has(k)) first.set(k, i); last.set(k, i); });
  let out: string[];
  if (o.mode === "unique") out = lines.filter((l, i) => (o.keep === "first" ? first : last).get(key(l)) === i);
  else if (o.mode === "only-unique") out = lines.filter((l) => counts.get(key(l)) === 1);
  else out = lines.filter((l, i) => counts.get(key(l))! > 1 && first.get(key(l)) === i);
  const distinct = counts.size;
  return { out, originalCount, considered: lines.length, distinct, duplicatesRemoved: lines.length - distinct };
}

type SortOrder = "az" | "za" | "length-asc" | "length-desc" | "number-asc" | "number-desc" | "reverse" | "shuffle";

export function sortLines(text: string, o: { order: SortOrder; caseSensitive: boolean; dropBlank: boolean; dedupe: boolean }, ctx: EngineContext) {
  let lines = dropTrailingEmpty(splitLines(text));
  if (o.dropBlank) lines = lines.filter((l) => l.trim() !== "");
  if (o.dedupe) { const seen = new Set<string>(); lines = lines.filter((l) => { const k = o.caseSensitive ? l : l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); }
  const notes: string[] = [];
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: o.caseSensitive ? "variant" : "base" });
  switch (o.order) {
    case "az": lines.sort((a, b) => collator.compare(a, b)); break;
    case "za": lines.sort((a, b) => collator.compare(b, a)); break;
    case "length-asc": lines.sort((a, b) => [...a].length - [...b].length || collator.compare(a, b)); break;
    case "length-desc": lines.sort((a, b) => [...b].length - [...a].length || collator.compare(a, b)); break;
    case "number-asc":
    case "number-desc": {
      const num = (l: string) => { const m = /^\s*([-+]?(?:\d[\d,]*)?\.?\d+(?:[eE][-+]?\d+)?)/.exec(l); if (!m) return null; const v = Number(m[1].replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
      const withNum = lines.map((l) => ({ l, n: num(l) }));
      const missing = withNum.filter((x) => x.n === null).length;
      const dir = o.order === "number-asc" ? 1 : -1;
      withNum.sort((a, b) => (a.n === null ? (b.n === null ? 0 : 1) : b.n === null ? -1 : (a.n - b.n) * dir));
      lines = withNum.map((x) => x.l);
      if (missing) notes.push(`${missing} line${missing === 1 ? " doesn't" : "s don't"} start with a number, so ${missing === 1 ? "it was" : "they were"} placed at the end.`);
      break;
    }
    case "reverse": lines.reverse(); break;
    case "shuffle": for (let i = lines.length - 1; i > 0; i--) { const j = randomBelow(ctx, i + 1); [lines[i], lines[j]] = [lines[j], lines[i]]; } break;
  }
  return { out: lines, notes };
}

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function findReplace(text: string, o: { find: string; replace: string; regex: boolean; caseSensitive: boolean; wholeWord: boolean; all: boolean }): { out: string; count: number } {
  let source = o.regex ? o.find : escapeRegExp(o.find);
  if (o.wholeWord && !o.regex) source = `(?<![\\p{L}\\p{N}_])${source}(?![\\p{L}\\p{N}_])`;
  const flags = `${o.all ? "g" : ""}${o.caseSensitive ? "" : "i"}mu`;
  const re = new RegExp(source, flags);
  const count = o.all ? [...text.matchAll(re)].length : re.test(text) ? 1 : 0;
  if (!o.all) re.lastIndex = 0;
  // plain text: the replacement is literal; regex: $1, $<name>, $& and $$ work as in String.replace
  const out = o.regex ? text.replace(re, o.replace) : text.replace(re, () => o.replace);
  return { out, count };
}

const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

export function cleanWhitespace(text: string, o: { collapse: boolean; trimLines: boolean; blank: "keep" | "single" | "remove"; unicodeSpaces: boolean; zeroWidth: boolean; join: boolean }): string {
  let t = text.replace(/\r\n?/g, "\n");
  if (o.zeroWidth) t = t.replace(ZERO_WIDTH, "");
  if (o.unicodeSpaces) t = t.replace(UNICODE_SPACES, " ");
  if (o.collapse) t = t.replace(/[ \t]{2,}/g, " ");
  if (o.trimLines) t = t.split("\n").map((l) => l.replace(/^[ \t]+|[ \t]+$/g, "")).join("\n");
  if (o.blank === "remove") t = t.split("\n").filter((l) => l.trim() !== "").join("\n");
  else if (o.blank === "single") t = t.replace(/\n{3,}/g, "\n\n");
  if (o.join) t = t.split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
  if (o.trimLines || o.collapse) t = t.replace(/^\s+|\s+$/g, "");
  return t;
}

const yes = (v: string) => v === "yes";

export const engines: EngineMap = {
  "remove-duplicate-lines": (v) => {
    const text = str(v, "text");
    if (text.length > MAX) return fail("That text is longer than 2 million characters. Split it into parts.", "text");
    if (text.trim() === "") return fail("Paste the lines you want to check.", "text");
    const mode = str(v, "mode") as "unique" | "only-unique" | "only-duplicates";
    const r = removeDuplicateLines(text, { caseSensitive: str(v, "case") === "sensitive", trim: yes(str(v, "trim")), dropBlank: yes(str(v, "blank")), keep: str(v, "keep") as "first" | "last", mode });
    const label = mode === "unique" ? "Lines kept" : mode === "only-unique" ? "Lines that appear once" : "Lines that repeat";
    return ok({
      primary: { label, value: N(r.out.length) },
      secondary: [{ label: "Lines checked", value: N(r.considered) }, { label: "Different lines", value: N(r.distinct) }, { label: "Duplicate lines removed", value: N(mode === "unique" ? r.duplicatesRemoved : 0) }],
      texts: [{ label: "Result (copy this)", value: r.out.join("\n"), copyable: true }],
      notes: r.originalCount !== r.considered ? [`${r.originalCount - r.considered} blank line${r.originalCount - r.considered === 1 ? " was" : "s were"} ignored.`] : undefined,
    });
  },
  "sort-lines": (v, ctx) => {
    const text = str(v, "text");
    if (text.length > MAX) return fail("That text is longer than 2 million characters. Split it into parts.", "text");
    if (text.trim() === "") return fail("Paste the lines you want to sort.", "text");
    const order = str(v, "order") as SortOrder;
    const r = sortLines(text, { order, caseSensitive: str(v, "case") === "sensitive", dropBlank: yes(str(v, "blank")), dedupe: yes(str(v, "dedupe")) }, ctx);
    const label = { az: "Sorted A to Z", za: "Sorted Z to A", "length-asc": "Sorted shortest first", "length-desc": "Sorted longest first", "number-asc": "Sorted by number, lowest first", "number-desc": "Sorted by number, highest first", reverse: "Order reversed", shuffle: "Shuffled" }[order];
    return ok({ primary: { label: "Lines", value: N(r.out.length) }, secondary: [{ label: "Order", value: T(label) }], texts: [{ label: "Result (copy this)", value: r.out.join("\n"), copyable: true }], notes: r.notes.length ? r.notes : undefined });
  },
  "find-and-replace-text": (v) => {
    const text = str(v, "text");
    if (text.length > MAX) return fail("That text is longer than 2 million characters. Split it into parts.", "text");
    const find = str(v, "find");
    if (find === "") return fail("Enter the text to find.", "find");
    const regex = str(v, "mode") === "regex";
    if (regex && find.length > 500) return fail("Keep the pattern under 500 characters.", "find");
    try {
      const r = findReplace(text, { find, replace: str(v, "replace"), regex, caseSensitive: str(v, "case") === "sensitive", wholeWord: yes(str(v, "whole")), all: str(v, "scope") === "all" });
      return ok({
        primary: { label: "Replacements made", value: N(r.count) },
        texts: [{ label: "Result (copy this)", value: r.out, copyable: true }],
        notes: r.count === 0 ? ["Nothing matched. Check spelling and the case-sensitivity setting."] : undefined,
      });
    } catch {
      return fail("That pattern isn't a valid regular expression. Check brackets, parentheses and escapes, or switch to plain text.", "find");
    }
  },
  "remove-extra-spaces": (v) => {
    const text = str(v, "text");
    if (text.length > MAX) return fail("That text is longer than 2 million characters. Split it into parts.", "text");
    if (text === "") return fail("Paste the text you want to clean.", "text");
    const out = cleanWhitespace(text, { collapse: yes(str(v, "collapse")), trimLines: yes(str(v, "trim")), blank: str(v, "blank") as "keep" | "single" | "remove", unicodeSpaces: yes(str(v, "unicode")), zeroWidth: yes(str(v, "zerowidth")), join: yes(str(v, "join")) });
    const removed = [...text].length - [...out].length;
    return ok({
      primary: { label: "Characters removed", value: N(removed) },
      secondary: [{ label: "Characters before", value: N([...text].length) }, { label: "Characters after", value: N([...out].length) }, { label: "Lines after", value: N(out === "" ? 0 : out.split("\n").length) }],
      texts: [{ label: "Cleaned text (copy this)", value: out, copyable: true }],
    });
  },
};
