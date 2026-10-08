import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { formatCss, minifyCss } from "@/lib/css-format";
import { formatHtml } from "@/lib/html-format";
import { contrastRatio, parseColor, rgbToHsl, rgbToHsv, toHex } from "@/lib/color";
import { fail, ok, str } from "../helpers";

const MAX = 1_000_000;
const indentOf = (id: string) => (id === "tab" ? "\t" : id === "4" ? "    " : "  ");
const bytes = (s: string) => new TextEncoder().encode(s).length;

export const engines: EngineMap = {
  "html-formatter": (v) => {
    const src = str(v, "html");
    if (src.trim() === "") return fail("Paste some HTML first — the box is empty.", "html");
    if (src.length > MAX) return fail("That's more than 1 MB of HTML — too large to format in the browser reliably.", "html");
    const r = formatHtml(src, indentOf(str(v, "indent")));
    return ok({
      primary: { label: "Result", value: T("Formatted — see below") },
      secondary: [{ label: "Lines", value: N(r.output.split("\n").length) }, { label: "Size", value: N(bytes(r.output), "bytes") }],
      texts: [{ label: "Formatted HTML", value: r.output, language: "html", copyable: true }],
      notes: [...r.warnings.map((w) => `Structure warning: ${w}`), "Only whitespace between tags is changed. Whitespace inside <pre>, <textarea>, <script> and <style> is kept, and runs of spaces in normal text are collapsed to one, as browsers do."],
    });
  },

  "css-formatter": (v) => {
    const src = str(v, "css");
    if (src.trim() === "") return fail("Paste some CSS first — the box is empty.", "css");
    if (src.length > MAX) return fail("That's more than 1 MB of CSS — too large to format in the browser reliably.", "css");
    const minify = str(v, "mode") === "minify";
    const r = minify ? minifyCss(src) : formatCss(src, indentOf(str(v, "indent")));
    if (!r.ok) return fail(`Line ${r.line}: ${r.message}`, "css");
    const before = bytes(src);
    const after = bytes(r.output);
    return ok({
      primary: { label: minify ? "Bytes saved" : "Result", value: minify ? N(before - after, "bytes") : T("Formatted — see below") },
      secondary: [{ label: "Before", value: N(before, "bytes") }, { label: "After", value: N(after, "bytes") }, ...(minify ? [{ label: "Reduction", value: T(before ? `${formatNumber(((before - after) / before) * 100, { maxDecimals: 1 })}%` : "0%") }] : [])],
      texts: [{ label: minify ? "Minified CSS" : "Formatted CSS", value: r.output, language: "css", copyable: true }],
      notes: ["Formatting changes layout only — selectors, properties and values are not rewritten. This doesn't check that property names or values are valid CSS."],
    });
  },

  "color-converter": (v) => {
    const parsed = parseColor(str(v, "color"));
    if (!parsed.ok) return fail(parsed.message, "color");
    const c = parsed.color;
    const hsl = rgbToHsl(c);
    const hsv = rgbToHsv(c);
    const r1 = (x: number) => formatNumber(Math.round(x * 10) / 10, { maxDecimals: 1 });
    const alpha = c.a < 1;
    const white = contrastRatio(c, { r: 255, g: 255, b: 255, a: 1 });
    const black = contrastRatio(c, { r: 0, g: 0, b: 0, a: 1 });
    const verdict = (ratio: number) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large text only" : "Fails");
    const hex = toHex(c);
    const rgbText = alpha ? `rgba(${c.r}, ${c.g}, ${c.b}, ${formatNumber(c.a, { maxDecimals: 3 })})` : `rgb(${c.r}, ${c.g}, ${c.b})`;
    const hslText = `hsl${alpha ? "a" : ""}(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%${alpha ? `, ${formatNumber(c.a, { maxDecimals: 3 })}` : ""})`;
    return ok({
      primary: { label: "HEX", value: T(hex.toUpperCase()) },
      secondary: [
        { label: "RGB", value: T(rgbText) },
        { label: "HSL", value: T(hslText) },
        { label: "HSV / HSB", value: T(`${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`) },
        { label: "Contrast on white", value: T(`${formatNumber(Math.round(white * 100) / 100)}:1 — ${verdict(white)}`) },
        { label: "Contrast on black", value: T(`${formatNumber(Math.round(black * 100) / 100)}:1 — ${verdict(black)}`) },
      ],
      swatch: hex,
      steps: [`HEX pairs → decimal: R = ${c.r}, G = ${c.g}, B = ${c.b}`, `HSL: hue ${r1(hsl.h)}°, saturation ${r1(hsl.s)}%, lightness ${r1(hsl.l)}%`],
      notes: ["Contrast ratios follow WCAG 2.x: 4.5:1 is the minimum for normal text (AA), 3:1 for large text, 7:1 for AAA."],
    });
  },
};
