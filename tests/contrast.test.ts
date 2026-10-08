import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { contrastRatio, parseColor } from "@/lib/color";

const css = fs.readFileSync(path.join(import.meta.dirname, "../src/styles/tokens.css"), "utf8");
const lightBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)"));
const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("[data-cat="));

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}
const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };
const ratio = (t: Record<string, string>, fg: string, bg: string) => {
  const a = parseColor(t[fg]), b = parseColor(t[bg]);
  if (!a.ok || !b.ok) throw new Error(`bad colour ${fg}/${bg}`);
  return contrastRatio(a.color, b.color);
};

// [foreground, background, minimum ratio] — 4.5 for text, 3 for large text / UI components.
const PAIRS: [string, string, number][] = [
  ["text", "bg", 7], ["text", "surface", 7], ["text-2", "bg", 7], ["text-2", "surface", 4.5], ["text-3", "bg", 4.5], ["text-3", "surface", 4.5], ["text-3", "surface-sunken", 4.5],
  ["accent-text", "bg", 4.5], ["accent-text", "surface", 4.5], ["accent-text", "accent-soft", 4.5], ["on-accent", "accent", 4.5], ["on-accent", "accent-hover", 4.5],
  ["success", "success-soft", 4.5], ["warning", "warning-soft", 4.5], ["danger", "danger-soft", 4.5], ["danger", "surface", 4.5], ["info", "info-soft", 4.5],
  ["text", "warning-soft", 4.5], ["text", "info-soft", 4.5], ["text", "accent-soft", 4.5],
  ["border-strong", "surface", 1.4], ["accent", "bg", 3], ["accent", "surface", 3],
  ...["math", "everyday", "student", "career", "money", "developer", "exams"].map((c): [string, string, number] => [`cat-${c}-fg`, `cat-${c}-bg`, 4.5]),
];

describe.each([["light", light], ["dark", dark]] as const)("design tokens meet WCAG contrast — %s theme", (_name, t) => {
  it.each(PAIRS)("%s on %s ≥ %f:1", (fg, bg, min) => {
    expect(t[fg], `${fg} token`).toBeTruthy();
    expect(t[bg], `${bg} token`).toBeTruthy();
    expect(ratio(t, fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
