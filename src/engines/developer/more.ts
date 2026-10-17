import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { parseColor, contrastRatio, toHex, type RGBA } from "@/lib/color";
import { fail, ok, optNum, str } from "../helpers";

// ---------------------------------------------------------------- HTML entities
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", deg: "°", plusmn: "±",
  times: "×", divide: "÷", frac12: "½", frac14: "¼", frac34: "¾", hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  bull: "•", middot: "·", larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔", hearts: "♥", infin: "∞", ne: "≠", le: "≤", ge: "≥", micro: "µ", para: "¶", iexcl: "¡", iquest: "¿",
  eacute: "é", egrave: "è", agrave: "à", aacute: "á", ntilde: "ñ", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß", ccedil: "ç",
};

const isValidCodePoint = (cp: number) => cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);

export function decodeEntities(text: string): { out: string; decoded: number; unknown: string[] } {
  const unknown = new Set<string>();
  let decoded = 0;
  const out = text.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const cp = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!isValidCodePoint(cp)) { unknown.add(whole); return whole; }
      decoded++;
      return String.fromCodePoint(cp);
    }
    if (body in NAMED) { decoded++; return NAMED[body]; }
    unknown.add(whole);
    return whole;
  });
  return { out, decoded, unknown: [...unknown] };
}

export function encodeEntities(text: string, nonAscii: boolean): string {
  let out = "";
  for (const ch of text) {
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === '"') out += "&quot;";
    else if (ch === "'") out += "&#39;";
    else if (nonAscii && ch.codePointAt(0)! > 126) out += `&#${ch.codePointAt(0)};`;
    else out += ch;
  }
  return out;
}

// ---------------------------------------------------------------- slug
const SPECIAL: Record<string, string> = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "đ": "d", "ł": "l", "þ": "th", "ð": "d", "&": " and " };

export function slugify(text: string, opts: { separator: string; lowercase: boolean; maxLength?: number }): string {
  let s = text.replace(/[ßæœøđłþð&]|[ÆŒØĐŁÞÐ]/g, (c) => SPECIAL[c.toLowerCase()] ?? c).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  if (opts.lowercase) s = s.toLowerCase();
  s = s.replace(/['’]/g, "").replace(/[^A-Za-z0-9]+/g, opts.separator);
  const sep = opts.separator.replace(/[-_]/g, "\\$&");
  s = s.replace(new RegExp(`^${sep}+|${sep}+$`, "g"), "");
  if (opts.maxLength && s.length > opts.maxLength) {
    const max = opts.maxLength;
    let cut = s.slice(0, max);
    if (s[max] !== opts.separator) {
      // the limit falls inside a word: prefer ending on the previous whole word
      const k = cut.lastIndexOf(opts.separator);
      if (k > max * 0.6) cut = cut.slice(0, k);
    }
    s = cut.replace(new RegExp(`${sep}+$`), "");
  }
  return s;
}

// ---------------------------------------------------------------- contrast
const over = (fg: RGBA, bg: RGBA): RGBA => ({ r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)), g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)), b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)), a: 1 });

export const engines: EngineMap = {
  "html-entity-encoder-decoder": (v) => {
    const text = str(v, "text");
    if (text.length > 500_000) return fail("That text is over 500,000 characters. Please shorten it.", "text");
    if (str(v, "mode") === "decode") {
      const { out, decoded, unknown } = decodeEntities(text);
      return ok({
        primary: { label: "Decoded text", value: T(out === "" ? "(empty)" : out.length > 300 ? `${out.slice(0, 300)}…` : out) },
        texts: [{ label: "Full decoded text (copy this)", value: out }],
        secondary: [{ label: "Entities decoded", value: N(decoded) }, ...(unknown.length ? [{ label: "Left unchanged (not recognised)", value: T([...unknown].slice(0, 12).join("  ")) }] : [])],
        notes: ["Decodes numeric entities (&#169; and &#xA9;) and about sixty of the most common named entities such as &amp; &lt; &nbsp; &copy; and &euro;. Anything not recognised is left exactly as typed. The result is plain text, never rendered as HTML."],
      });
    }
    const out = encodeEntities(text, str(v, "scope") === "ascii");
    return ok({
      primary: { label: "Encoded text", value: T(out === "" ? "(empty)" : out.length > 300 ? `${out.slice(0, 300)}…` : out) },
      texts: [{ label: "Full encoded text (copy this)", value: out }],
      secondary: [{ label: "Characters escaped", value: N([...text].filter((ch) => ch === "&" || ch === "<" || ch === ">" || ch === '"' || ch === "'" || (str(v, "scope") === "ascii" && ch.codePointAt(0)! > 126)).length) }],
      notes: ["Always escapes & < > \" and '. These five are the ones that matter for putting text safely inside HTML content and attribute values. Escaping is not a substitute for a sanitiser when handling untrusted HTML."],
    });
  },

  "slug-generator": (v) => {
    const text = str(v, "text");
    const sep = str(v, "separator") === "_" ? "_" : "-";
    const maxLength = optNum(v, "max_length");
    const slug = slugify(text, { separator: sep, lowercase: str(v, "case") !== "keep", maxLength });
    if (!slug) return fail("No letters or digits are left to build a slug from. This tool keeps Latin letters and digits (accents are removed); text written only in other scripts is dropped.", "text");
    return ok({
      primary: { label: "Slug", value: T(slug) },
      secondary: [{ label: "Length", value: N(slug.length, "characters") }, { label: "Example URL", value: T(`https://example.com/blog/${slug}`) }],
      steps: ["Accents are removed (é → e) and ß, æ, œ, ø, đ, ł, þ, ð are transliterated.", `Every run of other characters becomes a single "${sep}", and any at the start or end is trimmed.`],
      notes: ["Characters from non-Latin scripts (Devanagari, Arabic, Chinese and so on) are dropped. If your site needs those in URLs, they are valid when percent-encoded, but this generator keeps slugs to plain ASCII."],
    });
  },

  "url-parser": (v) => {
    let raw = str(v, "url").trim();
    if (!raw) return fail("Enter a URL to break down.", "url");
    let assumed = false;
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) && /^[^\s/]+\.[^\s/]+/.test(raw)) { raw = `https://${raw}`; assumed = true; }
    let u: URL;
    try { u = new URL(raw); } catch { return fail("That doesn't look like a valid URL. Include the scheme, for example https://example.com/path?x=1", "url"); }
    const defaultPorts: Record<string, string> = { "http:": "80", "https:": "443", "ftp:": "21", "ws:": "80", "wss:": "443" };
    const port = u.port || defaultPorts[u.protocol] || "";
    const params = [...u.searchParams.entries()];
    const keys = params.map(([k]) => k);
    const dupes = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
    const rows: [string, string][] = [
      ["Scheme", u.protocol.replace(":", "")], ["Username", u.username || "—"], ["Password", u.password ? "(present)" : "—"], ["Host", u.hostname || "—"],
      ["Port", u.port ? u.port : port ? `${port} (default)` : "—"], ["Origin", u.origin === "null" ? "—" : u.origin], ["Path", u.pathname || "/"], ["Query string", u.search || "—"], ["Fragment", u.hash || "—"],
    ];
    return ok({
      primary: { label: "Host", value: T(u.hostname || "(none)") },
      secondary: [{ label: "Scheme", value: T(u.protocol.replace(":", "")) }, { label: "Path", value: T(u.pathname || "/") }, { label: "Query parameters", value: N(params.length) }, ...(assumed ? [{ label: "Note", value: T("No scheme was given, so https:// was assumed") }] : [])],
      table: { caption: "URL components", columns: ["Part", "Value"], rows },
      texts: params.length ? [{ label: "Query parameters (decoded)", value: params.map(([k, val]) => `${k} = ${val}`).join("\n") }] : [],
      notes: [...(dupes.length ? [`Repeated parameter${dupes.length > 1 ? "s" : ""}: ${dupes.join(", ")}. Servers differ in whether they use the first, the last or all values.`] : []), ...(u.username || u.password ? ["This URL contains credentials. Passwords in URLs are visible to anyone who sees the link and are discouraged."] : []), "Parsed with the browser's standard URL parser, entirely on your device."],
    });
  },

  "contrast-checker": (v) => {
    const fg = parseColor(str(v, "foreground")), bg = parseColor(str(v, "background"));
    if (!fg.ok) return fail(`Text colour: ${fg.message}`, "foreground");
    if (!bg.ok) return fail(`Background colour: ${bg.message}`, "background");
    const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    const bgSolid = bg.color.a < 1 ? over(bg.color, white) : bg.color;
    const fgSolid = fg.color.a < 1 ? over(fg.color, bgSolid) : fg.color;
    const ratio = contrastRatio(fgSolid, bgSolid);
    const r = Math.floor(ratio * 100) / 100; // never round up past a threshold
    const pass = (min: number) => (ratio >= min ? "Pass" : "Fail");
    return ok({
      primary: { label: "Contrast ratio", value: T(`${formatNumber(r, { maxDecimals: 2, minDecimals: 2 })}:1`) },
      secondary: [
        { label: "Normal text — AA (4.5:1)", value: T(pass(4.5)) },
        { label: "Large text — AA (3:1)", value: T(pass(3)) },
        { label: "Normal text — AAA (7:1)", value: T(pass(7)) },
        { label: "Large text — AAA (4.5:1)", value: T(pass(4.5)) },
        { label: "Graphics and UI components — AA (3:1)", value: T(pass(3)) },
      ],
      swatch: toHex(bgSolid, false),
      steps: ["Relative luminance L = 0.2126 R + 0.7152 G + 0.0722 B, after converting each channel from sRGB to linear light", `Ratio = (L₁ + 0.05) ÷ (L₂ + 0.05), lighter colour first = ${formatNumber(ratio, { maxDecimals: 4 })}`],
      notes: ["Large text means at least 24 px regular or 18.66 px bold (18 pt / 14 pt). Ratios are truncated, not rounded up, so a ratio just under a threshold is never shown as a pass.", ...(fg.color.a < 1 || bg.color.a < 1 ? ["A translucent colour was blended onto its background (a translucent background is blended onto white) before measuring."] : [])],
    });
  },
};
