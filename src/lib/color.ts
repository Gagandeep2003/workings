export type RGBA = { r: number; g: number; b: number; a: number };

const NAMED: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", lime: "#00ff00", blue: "#0000ff", yellow: "#ffff00", cyan: "#00ffff", aqua: "#00ffff",
  magenta: "#ff00ff", fuchsia: "#ff00ff", silver: "#c0c0c0", gray: "#808080", grey: "#808080", maroon: "#800000", olive: "#808000",
  green: "#008000", purple: "#800080", teal: "#008080", navy: "#000080", orange: "#ffa500", pink: "#ffc0cb", brown: "#a52a2a",
  gold: "#ffd700", indigo: "#4b0082", violet: "#ee82ee", coral: "#ff7f50", crimson: "#dc143c", turquoise: "#40e0d0", transparent: "#00000000",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type ColorParse = { ok: true; color: RGBA } | { ok: false; message: string };

function parseChannel(token: string, max: number, name: string): number | string {
  const t = token.trim();
  const isPct = t.endsWith("%");
  const n = Number(isPct ? t.slice(0, -1) : t);
  if (!Number.isFinite(n)) return `${name} "${token.trim()}" isn't a number.`;
  const value = isPct ? (n / 100) * max : n;
  if (value < 0 || value > max + 1e-9) return `${name} must be between 0 and ${isPct ? "100%" : max}.`;
  return value;
}

export function parseColor(input: string): ColorParse {
  const text = input.trim().toLowerCase();
  if (!text) return { ok: false, message: "Enter a colour such as #3b82f6, rgb(59, 130, 246) or hsl(217, 91%, 60%)." };
  const named = NAMED[text];
  const candidate = named ?? text;
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(candidate);
  if (hex && (candidate.startsWith("#") || /^[0-9a-f]{6}$/.test(candidate) || /^[0-9a-f]{3}$/.test(candidate) || candidate.length === 8)) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { ok: true, color: { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 } };
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(text);
  if (fn) {
    const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return { ok: false, message: `${fn[1]}() needs 3 values (and an optional alpha), but you gave ${parts.length}.` };
    let a = 1;
    if (parts[3] !== undefined) {
      const av = parseChannel(parts[3], 1, "Alpha");
      if (typeof av === "string") return { ok: false, message: av };
      a = av;
    }
    if (fn[1].startsWith("rgb")) {
      const ch = parts.slice(0, 3).map((p, i) => parseChannel(p, 255, ["Red", "Green", "Blue"][i]));
      const err = ch.find((c) => typeof c === "string");
      if (err) return { ok: false, message: err as string };
      const [r, g, b] = ch as number[];
      return { ok: true, color: { r: Math.round(r), g: Math.round(g), b: Math.round(b), a } };
    }
    const h = Number(parts[0].replace(/deg$/, ""));
    const s = parseChannel(parts[1].includes("%") ? parts[1] : parts[1] + "%", 100, "Saturation");
    const l = parseChannel(parts[2].includes("%") ? parts[2] : parts[2] + "%", 100, "Lightness");
    if (!Number.isFinite(h)) return { ok: false, message: `Hue "${parts[0]}" isn't a number of degrees.` };
    if (typeof s === "string") return { ok: false, message: s };
    if (typeof l === "string") return { ok: false, message: l };
    return { ok: true, color: { ...hslToRgb(((h % 360) + 360) % 360, s, l), a } };
  }
  return { ok: false, message: `Couldn't read "${input.trim().slice(0, 30)}" as a colour. Use a hex code (#3b82f6), rgb(59, 130, 246), hsl(217, 91%, 60%) or a basic colour name.` };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsl({ r, g, b }: RGBA): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function rgbToHsv({ r, g, b }: RGBA): { h: number; s: number; v: number } {
  const { h } = rgbToHsl({ r, g, b, a: 1 });
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  return { h, s: max === 0 ? 0 : ((max - min) / max) * 100, v: max * 100 };
}

export const toHex = ({ r, g, b, a }: RGBA, withAlpha = a < 1): string =>
  "#" + [r, g, b, ...(withAlpha ? [Math.round(clamp(a, 0, 1) * 255)] : [])].map((x) => x.toString(16).padStart(2, "0")).join("");

/** WCAG 2.x relative luminance and contrast ratio. */
export function luminance({ r, g, b }: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrastRatio(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
