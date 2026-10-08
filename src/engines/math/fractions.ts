import type { EngineMap, Values } from "@/tools/types";
import { N, P, T, formatNumber } from "@/lib/format";
import { clean, gcdBig, lcmBig } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

type Frac = { n: bigint; d: bigint };

export function simplify(n: bigint, d: bigint): Frac {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcdBig(n, d);
  return g === 0n ? { n, d } : { n: n / g, d: d / g };
}

export function mixedText({ n, d }: Frac): string {
  const neg = n < 0n;
  const abs = neg ? -n : n;
  if (d === 1n) return `${neg ? "-" : ""}${abs}`;
  const whole = abs / d;
  const rem = abs % d;
  if (whole === 0n) return `${neg ? "-" : ""}${rem}/${d}`;
  return `${neg ? "-" : ""}${whole} ${rem}/${d}`;
}

const fracText = ({ n, d }: Frac): string => (d === 1n ? `${n}` : `${n}/${d}`);
const toNumber = ({ n, d }: Frac): number => Number(n) / Number(d);
const big = (x: number): bigint => BigInt(Math.trunc(x));

/** Read a (possibly mixed) fraction from the form: optional whole part, numerator, denominator. */
function readFraction(v: Values, w: string, n: string, d: string): Frac | { error: string; field: string } {
  const whole = optNum(v, w) ?? 0;
  const numerator = num(v, n);
  const denominator = num(v, d);
  if (denominator === 0) return { error: "The denominator can't be zero.", field: d };
  if (whole !== 0 && numerator < 0) {
    return { error: "In a mixed number the fraction part can't be negative — put the minus sign on the whole number.", field: n };
  }
  const base = big(whole) * big(denominator);
  const sign = whole < 0 ? -1n : 1n;
  const total = whole !== 0 ? sign * (sign * base + big(numerator)) : big(numerator);
  return simplify(total, big(denominator));
}

/** Decimal expansion of n/d with repeat detection. */
export function expandDecimal(n: bigint, d: bigint, maxDigits = 60) {
  const neg = n < 0n !== d < 0n && n !== 0n;
  let r = (n < 0n ? -n : n) % (d < 0n ? -d : d);
  const dd = d < 0n ? -d : d;
  const integer = (n < 0n ? -n : n) / dd;
  const digits: number[] = [];
  const seen = new Map<bigint, number>();
  while (r !== 0n && !seen.has(r) && digits.length < maxDigits) {
    seen.set(r, digits.length);
    r *= 10n;
    digits.push(Number(r / dd));
    r %= dd;
  }
  const sign = neg ? "-" : "";
  if (r === 0n) {
    return { text: `${sign}${integer}${digits.length ? "." + digits.join("") : ""}`, kind: "terminating" as const, period: 0 };
  }
  const start = seen.get(r);
  if (start === undefined) return { text: `${sign}${integer}.${digits.join("")}…`, kind: "long" as const, period: 0 };
  return {
    text: `${sign}${integer}.${digits.slice(0, start).join("")}(${digits.slice(start).join("")})`,
    kind: "repeating" as const,
    period: digits.length - start,
  };
}

const OPS: Record<string, string> = { add: "+", sub: "−", mul: "×", div: "÷" };

export const engines: EngineMap = {
  "fraction-calculator": (v) => {
    const a = readFraction(v, "w1", "n1", "d1");
    if ("error" in a) return fail(a.error, a.field);
    const b = readFraction(v, "w2", "n2", "d2");
    if ("error" in b) return fail(b.error, b.field);
    const op = str(v, "op");
    const steps: string[] = [`${mixedText(a)} ${OPS[op]} ${mixedText(b)}`];
    let r: Frac;
    if (op === "add" || op === "sub") {
      const L = lcmBig(a.d, b.d);
      const an = a.n * (L / a.d);
      const bn = b.n * (L / b.d);
      steps.push(`Common denominator: ${L}  →  ${an}/${L} ${OPS[op]} ${bn}/${L}`);
      r = simplify(op === "add" ? an + bn : an - bn, L);
    } else if (op === "mul") {
      steps.push(`Multiply across: (${a.n} × ${b.n}) ÷ (${a.d} × ${b.d})`);
      r = simplify(a.n * b.n, a.d * b.d);
    } else {
      if (b.n === 0n) return fail("You can't divide by zero — the second fraction equals 0.", "n2");
      steps.push(`Multiply by the reciprocal: ${a.n}/${a.d} × ${b.d}/${b.n}`);
      r = simplify(a.n * b.d, a.d * b.n);
    }
    steps.push(`Simplify by the greatest common divisor → ${fracText(r)}`);
    const value = toNumber(r);
    return ok({
      primary: { label: "Result", value: { kind: "fraction", num: String(r.n), den: String(r.d) } },
      secondary: [
        { label: "Mixed number", value: T(mixedText(r)) },
        { label: "Decimal", value: N(value, undefined, 10) },
        { label: "Percentage", value: P(clean(value * 100), 6) },
      ],
      steps,
    });
  },

  "fraction-to-decimal-calculator": (v) => {
    const n = num(v, "n");
    const d = num(v, "d");
    if (d === 0) return fail("The denominator can't be zero.", "d");
    const fr = simplify(big(n), big(d));
    const e = expandDecimal(fr.n, fr.d);
    const notes: string[] = [];
    if (e.kind === "repeating") notes.push(`The digits in brackets repeat forever (a ${e.period}-digit cycle).`);
    if (e.kind === "long") notes.push("The repeating cycle is longer than 60 digits, so the expansion is cut off here.");
    return ok({
      primary: { label: "Decimal", value: N(toNumber(fr), undefined, 10) },
      secondary: [
        { label: "Exact decimal expansion", value: T(e.text) },
        { label: "Simplified fraction", value: T(fracText(fr)) },
        { label: "Percentage", value: P(clean(toNumber(fr) * 100), 6) },
      ],
      steps: [`${n} ÷ ${d} by long division = ${e.text}`],
      notes,
    });
  },

  "decimal-to-fraction-calculator": (v) => {
    const text = str(v, "decimal").replace(/\s/g, "");
    const m = /^([+-]?)(\d*)\.?(\d*)$/.exec(text);
    if (!m || (m[2] === "" && m[3] === "")) return fail("Enter a decimal such as 0.75, -1.25 or .5.", "decimal");
    if (m[2].length + m[3].length > 30) return fail("That has too many digits — keep it to 30 digits or fewer.", "decimal");
    const rep = str(v, "repeating").replace(/\s/g, "");
    if (rep && !/^\d{1,12}$/.test(rep)) return fail("Repeating digits must be digits only (up to 12), for example 3 or 142857.", "repeating");
    if (rep && !text.includes(".")) return fail("Add a decimal point before using repeating digits (for example 0.1 with repeating 6 means 0.1666…).", "decimal");
    const [sign, ip, fp] = [m[1] === "-" ? -1n : 1n, BigInt(m[2] || "0"), m[3]];
    const k = BigInt(fp.length);
    let n: bigint;
    let d: bigint;
    const steps: string[] = [];
    if (rep) {
      const mm = BigInt(rep.length);
      const nines = 10n ** mm - 1n;
      n = (ip * 10n ** k + BigInt(fp || "0")) * nines + BigInt(rep);
      d = 10n ** k * nines;
      steps.push(`Repeating decimal: ${text}(${rep}) = ((${ip * 10n ** k + BigInt(fp || "0")} × ${nines}) + ${rep}) ÷ (${10n ** k} × ${nines})`);
    } else {
      n = ip * 10n ** k + BigInt(fp || "0");
      d = 10n ** k;
      steps.push(`${text} = ${n}/${d} (write the digits over a power of ten)`);
    }
    const r = simplify(sign * n, d);
    steps.push(`Simplify by the greatest common divisor → ${fracText(r)}`);
    const secondary = [
      { label: "Mixed number", value: T(mixedText(r)) },
      { label: "Percentage", value: P(clean(toNumber(r) * 100), 8) },
    ];
    const notes: string[] = [];
    if (r.d > 1000n && !rep) {
      const x = Math.abs(toNumber(r));
      let best = { n: 0, d: 1, err: Infinity };
      for (let den = 1; den <= 1000; den++) {
        const nn = Math.round(x * den);
        const err = Math.abs(x - nn / den);
        if (err < best.err - 1e-15) best = { n: nn, d: den, err };
      }
      const s = r.n < 0n ? -1 : 1;
      secondary.push({ label: "Closest simple fraction (denominator ≤ 1,000)", value: T(`${s * best.n}/${best.d}`) });
      notes.push("The exact fraction has a large denominator. If your decimal is a rounded value (like 0.333), the closest simple fraction is probably what you meant.");
    }
    return ok({
      primary: { label: "Fraction", value: { kind: "fraction", num: String(r.n), den: String(r.d) } },
      secondary,
      steps,
      notes,
    });
  },

  "fraction-to-percentage-calculator": (v) => {
    const n = num(v, "n");
    const d = num(v, "d");
    if (d === 0) return fail("The denominator can't be zero.", "d");
    const r = clean((n / d) * 100);
    return ok({
      primary: { label: "Percentage", value: P(r, 6) },
      secondary: [{ label: "Decimal", value: N(clean(n / d), undefined, 10) }],
      steps: [`${formatNumber(n)} ÷ ${formatNumber(d)} = ${formatNumber(clean(n / d), { maxDecimals: 10 })}, then × 100 = ${formatNumber(r, { maxDecimals: 6 })}%`],
      notes: n > d ? ["The numerator is larger than the denominator, so the percentage is above 100%."] : [],
    });
  },
};
