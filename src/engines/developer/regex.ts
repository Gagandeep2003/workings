import type { EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { fail, ok, str } from "../helpers";

const MAX_TEXT = 100_000;
const MAX_MATCHES = 1000;
const FLAGS = "dgimsuvy";

export const engines: EngineMap = {
  "regex-tester": (v) => {
    const pattern = str(v, "pattern");
    const flags = str(v, "flags");
    const text = str(v, "text");
    const replacement = v.replacement === undefined ? undefined : str(v, "replacement");
    if (text.length > MAX_TEXT) return fail(`The test text is longer than ${MAX_TEXT.toLocaleString("en-US")} characters.`, "text");
    const badFlag = [...flags].find((f, i) => !FLAGS.includes(f) || flags.indexOf(f) !== i);
    if (badFlag) return fail(`Flag "${badFlag}" isn't valid or is repeated. Allowed flags: d g i m s u v y (each at most once).`, "flags");
    if (flags.includes("u") && flags.includes("v")) return fail("The u and v flags can't be used together.", "flags");
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch (e) {
      return fail(`Invalid pattern: ${(e as Error).message.replace(/^Invalid regular expression: /, "")}`, "pattern");
    }
    const matches: { index: number; text: string; groups: (string | undefined)[]; named?: Record<string, string | undefined> }[] = [];
    const global = re.global || re.sticky;
    let truncated = false;
    if (global) {
      const scan = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      for (const m of text.matchAll(scan)) {
        if (matches.length >= MAX_MATCHES) { truncated = true; break; }
        matches.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : undefined });
      }
    } else {
      const m = re.exec(text);
      if (m) matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : undefined });
    }
    const ranges: [number, number][] = matches.filter((m) => m.text.length > 0).map((m) => [m.index, m.index + m.text.length]);
    const notes: string[] = [];
    if (!re.global) notes.push("Without the g flag only the first match is reported. Add g to find all matches.");
    if (truncated) notes.push(`Showing the first ${MAX_MATCHES.toLocaleString("en-US")} matches only.`);
    if (matches.some((m) => m.text === "")) notes.push("Some matches are empty (zero-length) — for example from patterns like a* — so they aren't highlighted.");
    const groupCount = Math.max(0, ...matches.map((m) => m.groups.length));
    const texts = [];
    if (replacement !== undefined && replacement !== "") {
      try {
        texts.push({ label: "Text after replacement", value: text.replace(re, replacement), copyable: true });
      } catch (e) {
        return fail(`Couldn't apply the replacement: ${(e as Error).message}`, "replacement");
      }
    }
    return ok({
      primary: { label: "Matches", value: N(matches.length) },
      secondary: [{ label: "Flags used", value: T(flags || "none") }, { label: "Capture groups", value: N(groupCount) }],
      highlight: text ? { text, ranges } : undefined,
      table: matches.length
        ? {
            caption: "Matches",
            columns: ["#", "Position", "Match", ...Array.from({ length: groupCount }, (_, i) => `Group ${i + 1}`)],
            rows: matches.slice(0, 200).map((m, i) => [`${i + 1}`, `${m.index}`, JSON.stringify(m.text).slice(1, -1) || "(empty)", ...Array.from({ length: groupCount }, (_, k) => (m.groups[k] === undefined ? "—" : JSON.stringify(m.groups[k]).slice(1, -1) || "(empty)"))]),
            maxHeight: true,
          }
        : undefined,
      texts,
      notes: [...notes, "Runs the same regular-expression engine as JavaScript in your browser. Other languages (Python, PCRE, Java) differ in some syntax. Patterns with nested repetition can be very slow on some inputs."],
    });
  },
};
