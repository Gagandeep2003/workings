/**
 * Numeric helpers with explicit precision rules.
 *
 * Rules used across the whole project (see docs/PRECISION.md):
 *  1. Display values are cleaned to 12 significant digits to remove binary floating-point noise.
 *  2. Rounding is "half away from zero" and is done on the decimal string, not on the binary value,
 *     so round(1.005, 2) === 1.01 (a naive Math.round(1.005 * 100) / 100 gives 1).
 *  3. Money is rounded to 2 decimal places and, where a schedule is produced, held as integer minor units.
 */

/** Remove floating-point noise (0.1 + 0.2 -> 0.3) by keeping 12 significant digits. */
export function clean(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toPrecision(12));
}

/** Round half away from zero to `dp` decimal places, working on the decimal representation. */
export function round(value: number, dp = 0): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (abs * 10 ** dp > 1e15) return value; // already beyond double precision for this many places
  const text = String(abs);
  let result: number;
  if (text.includes("e")) {
    const factor = 10 ** dp;
    result = Math.round(abs * factor) / factor;
  } else {
    const shifted = Number(`${text}e${dp}`);
    result = Number(`${Math.round(shifted)}e${-dp}`);
  }
  const out = sign * result;
  return out === 0 ? 0 : out;
}

export const roundMoney = (value: number): number => round(value, 2);

/** Convert a money amount to integer minor units (cents/paise). */
export function toMinor(amount: number): number {
  return Math.round(round(amount, 2) * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Number of digits after the decimal point in the plain (non-exponent) representation. */
export function decimalPlaces(value: number): number {
  const text = String(value);
  if (text.includes("e-")) {
    const [mantissa, exp] = text.split("e-");
    const frac = mantissa.split(".")[1]?.length ?? 0;
    return frac + Number(exp);
  }
  return text.split(".")[1]?.length ?? 0;
}

/** Sum a list of numbers without accumulating binary rounding error (uses scaled integers). */
export function sumExact(values: number[]): number {
  if (values.length === 0) return 0;
  const k = Math.min(9, Math.max(...values.map(decimalPlaces)));
  const scale = 10 ** k;
  let total = 0n;
  for (const v of values) {
    const scaled = Math.round(v * scale);
    if (!Number.isSafeInteger(scaled)) return clean(values.reduce((a, b) => a + b, 0));
    total += BigInt(scaled);
  }
  return Number(total) / scale;
}

export function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export function lcmBig(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const g = gcdBig(a, b);
  const r = (a / g) * b;
  return r < 0n ? -r : r;
}

/** Group the digits of an integer string: "1234567" -> "1,234,567". */
export function groupDigits(digits: string, sep = ","): string {
  const neg = digits.startsWith("-");
  const body = neg ? digits.slice(1) : digits;
  return (neg ? "-" : "") + body.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function approxEqual(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}
