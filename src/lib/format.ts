/** Result value model + formatting. Values are plain data (serialisable) and formatted at render time. */
import { clean, groupDigits } from "./numeric";
import { formatDateLong } from "./dates";

export type DurationParts = {
  years?: number; months?: number; weeks?: number; days?: number;
  hours?: number; minutes?: number; seconds?: number;
};

export type Value =
  | { kind: "number"; value: number; unit?: string; maxDecimals?: number; minDecimals?: number }
  | { kind: "money"; value: number; currency?: string }
  | { kind: "percent"; value: number; maxDecimals?: number }
  | { kind: "text"; value: string }
  | { kind: "date"; value: string }
  | { kind: "duration"; parts: DurationParts }
  | { kind: "fraction"; num: string; den: string };

export const CURRENCIES = [
  { code: "", label: "No symbol" },
  { code: "INR", label: "₹ Rupee (INR)" },
  { code: "USD", label: "$ Dollar (USD)" },
  { code: "EUR", label: "€ Euro (EUR)" },
  { code: "GBP", label: "£ Pound (GBP)" },
  { code: "AUD", label: "A$ Dollar (AUD)" },
  { code: "CAD", label: "C$ Dollar (CAD)" },
  { code: "AED", label: "AED Dirham" },
  { code: "SGD", label: "S$ Dollar (SGD)" },
] as const;

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const toSuperscript = (n: number): string =>
  String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => SUPERSCRIPT[Number(d)]);

export type NumberFormatOptions = {
  minDecimals?: number;
  maxDecimals?: number;
  locale?: string;
  grouping?: boolean;
};

/** Format a plain number: 12-significant-digit clean-up, grouping, scientific notation for extremes. */
export function formatNumber(value: number, opts: NumberFormatOptions = {}): string {
  if (Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  const v = clean(value);
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e15 || abs < 1e-8) {
    const [mantissa, exp] = v.toExponential(6).split("e");
    const m = mantissa.replace(/\.?0+$/, "");
    return `${m.replace(/^-/, "−")} × 10${toSuperscript(Number(exp))}`;
  }
  const maxDecimals = opts.maxDecimals ?? 6;
  const minDecimals = Math.min(opts.minDecimals ?? 0, maxDecimals);
  const grouping = opts.grouping ?? true;
  const locale = opts.locale ?? "en-US";
  let out: string;
  if (abs < 10 ** -maxDecimals) {
    out = new Intl.NumberFormat(locale, { maximumSignificantDigits: 6, useGrouping: grouping }).format(v);
  } else {
    out = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals, useGrouping: grouping,
    }).format(v);
  }
  return out === "-0" ? "0" : out.replace(/^-/, "−");
}

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN", USD: "en-US", EUR: "en-IE", GBP: "en-GB", AUD: "en-AU", CAD: "en-CA", AED: "en-AE", SGD: "en-SG",
};

export function formatMoney(value: number, currency = ""): string {
  if (!Number.isFinite(value)) return "—";
  const v = Math.abs(value) < 0.005 ? 0 : value;
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    const nf = currency
      ? new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return nf.format(v).replace(/^-/, "−");
  } catch {
    return formatNumber(v, { minDecimals: 2, maxDecimals: 2 });
  }
}

const plural = (n: number, word: string): string => `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;

export function formatDuration(parts: DurationParts): string {
  const order: [keyof DurationParts, string][] = [
    ["years", "year"], ["months", "month"], ["weeks", "week"], ["days", "day"],
    ["hours", "hour"], ["minutes", "minute"], ["seconds", "second"],
  ];
  const chunks = order
    .filter(([key]) => parts[key] !== undefined && parts[key] !== 0)
    .map(([key, word]) => plural(parts[key] as number, word));
  if (chunks.length === 0) {
    const last = [...order].reverse().find(([key]) => parts[key] !== undefined);
    return `0 ${last ? last[1] + "s" : "days"}`;
  }
  return chunks.join(", ");
}

export function formatValue(v: Value): string {
  switch (v.kind) {
    case "number": {
      const n = formatNumber(v.value, { maxDecimals: v.maxDecimals, minDecimals: v.minDecimals });
      if (!v.unit) return n;
      return /^[°%′″]/.test(v.unit) ? `${n}${v.unit}` : `${n} ${v.unit}`;
    }
    case "money": return formatMoney(v.value, v.currency);
    case "percent": return `${formatNumber(v.value, { maxDecimals: v.maxDecimals ?? 2 })}%`;
    case "text": return v.value;
    case "date": return formatDateLong(v.value);
    case "duration": return formatDuration(v.parts);
    case "fraction": return v.den === "1" ? v.num : `${v.num}/${v.den}`;
  }
}

/** Format a big integer given as a string: grouped digits; very long numbers are shown in scientific form. */
export function formatBigInt(digits: string): string {
  const neg = digits.startsWith("-");
  const body = neg ? digits.slice(1) : digits;
  const mantissa = `${body[0]}.${body.slice(1, 7)}`.replace(/\.?0+$/, "");
  const sci = `${neg ? "−" : ""}${mantissa} × 10${toSuperscript(body.length - 1)}`;
  if (body.length <= 21) return groupDigits(digits);
  if (body.length <= 40) return `${groupDigits(digits)}  (≈ ${sci})`;
  return `≈ ${sci}  (${body.length} digits)`;
}

// ---- Constructors used by engines -------------------------------------------------------------
export const N = (value: number, unit?: string, maxDecimals?: number): Value => ({ kind: "number", value, unit, maxDecimals });
export const M = (value: number, currency?: string): Value => ({ kind: "money", value, currency });
export const P = (value: number, maxDecimals?: number): Value => ({ kind: "percent", value, maxDecimals });
export const T = (value: string): Value => ({ kind: "text", value });
export const D = (value: string): Value => ({ kind: "date", value });
export const DUR = (parts: DurationParts): Value => ({ kind: "duration", parts });
