import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { fail, ok, str } from "../helpers";

const MAX = 2_000_000;

const NO_SPACE_SCRIPTS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/**
 * Words are runs of letters/digits, keeping apostrophes, hyphens and decimal/thousand separators inside
 * a word (don't, stop-gap, 3.5, 1,000) — the same convention word processors use. Scripts written
 * without spaces (Chinese, Japanese, Thai…) need a dictionary, so those use the browser's segmenter.
 */
function segmentWords(text: string): string[] {
  if (NO_SPACE_SCRIPTS.test(text)) {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;
    if (Seg) return [...new Seg(undefined, { granularity: "word" }).segment(text)].filter((s) => s.isWordLike).map((s) => s.segment);
  }
  return text.match(/[\p{L}\p{N}\p{M}]+(?:['’\-.,][\p{L}\p{N}\p{M}]+)*/gu) ?? [];
}

function countGraphemes(text: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter;
  if (Seg) {
    let n = 0;
    for (const _ of new Seg(undefined, { granularity: "grapheme" }).segment(text)) { void _; n++; }
    return n;
  }
  return [...text].length;
}

const STOP = new Set("the a an and or but of to in on at for with is are was were be been it this that as by from not you i we they he she his her their our your its so if then than".split(" "));

export function splitWords(text: string): string[] {
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-.\/\\]+/g, " ");
  return spaced.match(/[\p{L}\p{N}]+/gu) ?? [];
}
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export const engines: EngineMap = {
  "word-counter": (v) => {
    const text = str(v, "text");
    if (text.length > MAX) return fail("That text is longer than 2 million characters. Split it into parts.", "text");
    const words = segmentWords(text);
    const sentences = (text.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…\s][^.!?…]*$/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
    const lines = text === "" ? 0 : text.split(/\r?\n/).length;
    const chars = countGraphemes(text);
    const noSpaces = countGraphemes(text.replace(/\s/g, ""));
    const freq = new Map<string, number>();
    for (const w of words) {
      const k = w.toLowerCase();
      if (k.length > 2 && !STOP.has(k) && !/^\d+$/.test(k)) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    const top = [...freq].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
    const minutes = (n: number, wpm: number) => {
      const m = n / wpm;
      return m < 1 ? "under 1 minute" : `${formatNumber(Math.round(m * 10) / 10)} min`;
    };
    return ok({
      primary: { label: "Words", value: N(words.length) },
      secondary: [
        { label: "Characters", value: N(chars) },
        { label: "Characters (no spaces)", value: N(noSpaces) },
        { label: "Sentences", value: N(sentences) },
        { label: "Paragraphs", value: N(paragraphs) },
        { label: "Lines", value: N(lines) },
        { label: "Reading time (about 238 words/min)", value: T(words.length ? minutes(words.length, 238) : "—") },
        { label: "Speaking time (about 150 words/min)", value: T(words.length ? minutes(words.length, 150) : "—") },
      ],
      table: top.length ? { caption: "Most frequent words (common words skipped)", columns: ["Word", "Times used"], rows: top.map(([w, n]) => [w, n]) } : undefined,
      notes: ["Counted in your browser using the language-aware word boundaries built into your browser, so results can differ by a few from other tools that simply split on spaces."],
    });
  },

  "case-converter": (v) => {
    const text = str(v, "text");
    if (text.length > MAX) return fail("That text is longer than 2 million characters. Split it into parts.", "text");
    if (text.trim() === "") return fail("Type or paste some text to convert.", "text");
    const words = splitWords(text);
    const sentence = text.toLowerCase().replace(/(^\s*[\p{L}\p{N}]|[.!?]\s+[\p{L}\p{N}])/gu, (m) => m.toUpperCase());
    const title = text.toLowerCase().replace(/(^|[\s\-_([{"'“])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
    const formats: [string, string][] = [
      ["UPPER CASE", text.toUpperCase()],
      ["lower case", text.toLowerCase()],
      ["Title Case", title],
      ["Sentence case", sentence],
      ["camelCase", words.length ? words[0].toLowerCase() + words.slice(1).map(cap).join("") : ""],
      ["PascalCase", words.map(cap).join("")],
      ["snake_case", words.map((w) => w.toLowerCase()).join("_")],
      ["CONSTANT_CASE", words.map((w) => w.toUpperCase()).join("_")],
      ["kebab-case", words.map((w) => w.toLowerCase()).join("-")],
      ["dot.case", words.map((w) => w.toLowerCase()).join(".")],
    ];
    return ok({
      primary: { label: "Words found", value: N(words.length) },
      secondary: [{ label: "Characters", value: N([...text].length) }],
      texts: formats.map(([label, value]) => ({ label, value, copyable: true })),
      notes: ["Title Case here capitalises every word — it doesn't skip small words like 'of' or 'the' as some style guides do. Code styles (camelCase, snake_case…) split words on spaces, punctuation and existing capitals."],
    });
  },
};
