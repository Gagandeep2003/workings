import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { gcd, simplifyRoot } from "@/lib/primes";
import { fail, num, ok, str } from "../helpers";

const f = (n: number) => formatNumber(clean(n), { maxDecimals: 10 });
const sgn = (n: number) => (n < 0 ? "−" : "");

const SUPS: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** 12345.678 → "1.2345678 × 10⁴" */
export function sci(x: number): string {
  if (x === 0) return "0";
  const [mantissa, exp] = x.toExponential(8).split("e");
  return `${Number(mantissa)} × 10${String(Number(exp)).split("").map((c) => SUPS[c]).join("")}`;
}

/** "(−3 ± √5) / 2"-style exact roots for integer coefficients, or null when not applicable. */
function exactRoots(a: number, b: number, c: number): string | null {
  if (![a, b, c].every(Number.isInteger) || [a, b, c].some((x) => Math.abs(x) > 1e7)) return null;
  const d = b * b - 4 * a * c;
  if (d < 0) return null;
  const { coefficient: k, radicand: r } = simplifyRoot(d, 2);
  const den = 2 * a;
  if (r === 1) {
    const roots = [(-b + k), (-b - k)].map((n) => { const g = gcd(n, den) || 1; const nn = n / g, dd = den / g; const sign = dd < 0 ? -1 : 1; return dd * sign === 1 ? String(nn * sign) : `${nn * sign}/${dd * sign}`; });
    return (d === 0 ? `x = ${roots[0]}` : `x = ${roots[0]} or x = ${roots[1]}`).replace(/-/g, "−");
  }
  const g = gcd(gcd(b, k), den) || 1;
  const bb = -b / g, kk = k / g, dd = den / g;
  const radical = `${kk === 1 ? "" : kk}√${r}`;
  const sign = dd < 0 ? -1 : 1;
  const numer = `${bb * sign === 0 ? "" : bb * sign} ± ${radical}`.trim();
  return `x = (${numer}) / ${dd * sign}`.replace(/-/g, "−");
}

export const engines: EngineMap = {
  "quadratic-equation-solver": (v) => {
    const a = num(v, "a"), b = num(v, "b"), c = num(v, "c");
    if (a === 0) return fail("The coefficient a can't be zero — that would make it a linear equation. Use the linear equation solver instead.", "a");
    const d = clean(b * b - 4 * a * c);
    const vx = -b / (2 * a), vy = clean(a * vx * vx + b * vx + c);
    const eq = `${f(a)}x² ${b < 0 ? "−" : "+"} ${f(Math.abs(b))}x ${c < 0 ? "−" : "+"} ${f(Math.abs(c))} = 0`;
    const common = [
      { label: "Discriminant (b² − 4ac)", value: N(d, undefined, 10) },
      { label: "Vertex", value: T(`(${f(vx)}, ${f(vy)})`) },
      { label: "y-intercept", value: N(c) },
    ];
    const steps = [`Equation: ${eq}`, `Discriminant D = b² − 4ac = ${f(b)}² − 4 × ${f(a)} × ${f(c)} = ${f(d)}`];
    if (d > 0) {
      const q = -(b + Math.sign(b || 1) * Math.sqrt(d)) / 2; // avoids cancellation
      const x1 = clean(q / a), x2 = clean(c / q);
      const [lo, hi] = x1 <= x2 ? [x1, x2] : [x2, x1];
      const exact = exactRoots(a, b, c);
      return ok({
        primary: { label: "Roots", value: T(`x₁ = ${f(lo)},  x₂ = ${f(hi)}`) },
        secondary: [{ label: "Nature of roots", value: T("Two distinct real roots") }, ...(exact ? [{ label: "Exact form", value: T(exact) }] : []), ...common, { label: "Factored form", value: T(`${f(a)}(x ${lo < 0 ? "+" : "−"} ${f(Math.abs(lo))})(x ${hi < 0 ? "+" : "−"} ${f(Math.abs(hi))})`) }],
        steps: [...steps, "D > 0, so x = (−b ± √D) ÷ 2a gives two real roots", `x = (${f(-b)} ± √${f(d)}) ÷ ${f(2 * a)}`],
      });
    }
    if (d === 0) {
      const x = clean(vx);
      return ok({
        primary: { label: "Root", value: T(`x = ${f(x)}  (repeated)`) },
        secondary: [{ label: "Nature of roots", value: T("One repeated real root") }, ...common],
        steps: [...steps, "D = 0, so there is one repeated root: x = −b ÷ 2a", `x = ${f(-b)} ÷ ${f(2 * a)} = ${f(x)}`],
      });
    }
    const re = clean(vx), im = clean(Math.sqrt(-d) / (2 * Math.abs(a)));
    return ok({
      primary: { label: "Roots", value: T(`x = ${f(re)} ± ${f(im)}i`) },
      secondary: [{ label: "Nature of roots", value: T("Two complex conjugate roots (no real roots)") }, ...common],
      steps: [...steps, "D < 0, so there are no real roots; the roots are complex: x = (−b ± i√(−D)) ÷ 2a", `x = ${f(re)} ± ${f(im)}i`],
      notes: ["The parabola does not cross the x-axis."],
    });
  },

  "linear-equation-solver": (v) => {
    if (str(v, "mode") === "one") {
      const a = num(v, "a"), b = num(v, "b"), c = num(v, "c");
      if (a === 0) return b === c ? ok({ primary: { label: "Solution", value: T("Every real x is a solution") }, steps: ["a = 0 and b = c, so the equation reads 0 = 0 for any x."] }) : fail("With a = 0 the equation has no solution unless b equals c. Check your numbers.", "a");
      const x = clean((c - b) / a);
      return ok({
        primary: { label: "x", value: N(x, undefined, 10) },
        steps: [`${f(a)}x ${b < 0 ? "−" : "+"} ${f(Math.abs(b))} = ${f(c)}`, `Subtract ${f(b)} from both sides: ${f(a)}x = ${f(clean(c - b))}`, `Divide both sides by ${f(a)}: x = ${f(x)}`],
        secondary: [{ label: "Check", value: T(`${f(a)} × ${f(x)} ${b < 0 ? "−" : "+"} ${f(Math.abs(b))} = ${f(clean(a * x + b))}`) }],
      });
    }
    const a1 = num(v, "a1"), b1 = num(v, "b1"), c1 = num(v, "c1"), a2 = num(v, "a2"), b2 = num(v, "b2"), c2 = num(v, "c2");
    const det = clean(a1 * b2 - a2 * b1);
    if (det === 0) {
      const consistent = clean(a1 * c2 - a2 * c1) === 0 && clean(b1 * c2 - b2 * c1) === 0 && (a1 !== 0 || b1 !== 0 || c1 === 0) && (a2 !== 0 || b2 !== 0 || c2 === 0);
      return ok({
        primary: { label: "Solution", value: T(consistent ? "Infinitely many solutions" : "No solution") },
        steps: [`Determinant a₁b₂ − a₂b₁ = ${f(a1)}×${f(b2)} − ${f(a2)}×${f(b1)} = 0`, consistent ? "The two equations describe the same line." : "The two lines are parallel and never meet."],
      });
    }
    const x = clean((c1 * b2 - c2 * b1) / det), y = clean((a1 * c2 - a2 * c1) / det);
    return ok({
      primary: { label: "Solution", value: T(`x = ${f(x)},  y = ${f(y)}`) },
      secondary: [{ label: "Determinant", value: N(det) }, { label: "Check, equation 1", value: T(`${f(a1)}×${f(x)} + ${f(b1)}×${f(y)} = ${f(clean(a1 * x + b1 * y))}`) }, { label: "Check, equation 2", value: T(`${f(a2)}×${f(x)} + ${f(b2)}×${f(y)} = ${f(clean(a2 * x + b2 * y))}`) }],
      steps: ["Cramer's rule: D = a₁b₂ − a₂b₁", `D = ${f(a1)}×${f(b2)} − ${f(a2)}×${f(b1)} = ${f(det)}`, `x = (c₁b₂ − c₂b₁) ÷ D = ${f(clean(c1 * b2 - c2 * b1))} ÷ ${f(det)} = ${f(x)}`, `y = (a₁c₂ − a₂c₁) ÷ D = ${f(clean(a1 * c2 - a2 * c1))} ÷ ${f(det)} = ${f(y)}`],
    });
  },

  "logarithm-calculator": (v) => {
    const base = num(v, "base");
    if (base <= 0 || base === 1) return fail("A logarithm base must be positive and not equal to 1.", "base");
    if (str(v, "mode") === "antilog") {
      const y = num(v, "y");
      const r = Math.pow(base, y);
      if (!Number.isFinite(r)) return fail("That result is too large to display.", "y");
      return ok({
        primary: { label: "Antilogarithm", value: N(clean(r), undefined, 10) },
        steps: [`The antilogarithm undoes the log: if log_${f(base)}(x) = ${f(y)} then x = ${f(base)}^${f(y)} = ${f(clean(r))}`],
      });
    }
    const x = num(v, "x");
    if (x <= 0) return fail("Logarithms of zero and negative numbers are not defined for real numbers. Enter a value greater than 0.", "x");
    const r = Math.log(x) / Math.log(base);
    return ok({
      primary: { label: `log base ${f(base)} of ${f(x)}`, value: N(clean(r), undefined, 10) },
      secondary: [{ label: "Natural log, ln(x)", value: N(clean(Math.log(x)), undefined, 10) }, { label: "Common log, log₁₀(x)", value: N(clean(Math.log10(x)), undefined, 10) }, { label: "Binary log, log₂(x)", value: N(clean(Math.log2(x)), undefined, 10) }],
      steps: [`Change of base: log_b(x) = ln(x) ÷ ln(b)`, `= ${f(Math.log(x))} ÷ ${f(Math.log(base))} = ${f(clean(r))}`, `Check: ${f(base)}^${f(clean(r))} = ${f(clean(Math.pow(base, r)))}`],
    });
  },

  "exponent-calculator": (v) => {
    const b = num(v, "base"), e = num(v, "exponent");
    if (b < 0 && !Number.isInteger(e)) return fail("A negative base with a fractional exponent has no real result (it is a complex number). Use a whole-number exponent or a positive base.", "exponent");
    if (b === 0 && e < 0) return fail("Zero raised to a negative power would mean dividing by zero, which is undefined.", "exponent");
    const result = Math.pow(b, e);
    if (!Number.isFinite(result)) return fail("The result is too large to represent.", "exponent");
    const secondary: { label: string; value: ReturnType<typeof T> | ReturnType<typeof N> }[] = [];
    let exactBig: string | null = null;
    if (Number.isInteger(b) && Number.isInteger(e) && Math.abs(b) <= 1e9) {
      if (e >= 0 && e <= 2000) {
        const big = BigInt(b) ** BigInt(e);
        const s = big.toString();
        if (s.replace("-", "").length <= 400) exactBig = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      } else if (e < 0 && e >= -60 && b !== 0) {
        secondary.push({ label: "As a fraction", value: T(`${(b < 0 && e % 2 !== 0) ? "−" : ""}1 / ${(BigInt(Math.abs(b)) ** BigInt(-e)).toString()}`) });
      }
    }
    if (exactBig) secondary.unshift({ label: "Exact integer", value: T(exactBig) });
    secondary.push({ label: "Scientific notation", value: T(sci(result)) });
    return ok({
      primary: { label: "Result", value: N(clean(result), undefined, 12) },
      secondary,
      steps: e === 0 ? [`${f(b)}^${f(e)}: any non-zero number to the power 0 is 1`] : e < 0 ? [`${f(b)}^${f(e)}: a negative exponent means a reciprocal, 1 ÷ ${f(b)}^${f(-e)}`] : [`${f(b)}^${f(e)} means ${f(b)} multiplied by itself ${Number.isInteger(e) ? f(e) : "(fractional)"} times`],
      notes: e === 0 && b === 0 ? ["0⁰ is treated as 1 here, the common convention in calculators and programming."] : undefined,
    });
  },

  "square-root-calculator": (v) => {
    const x = num(v, "number"), n = num(v, "index");
    if (x < 0 && n % 2 === 0) {
      if (n === 2) {
        const r = Math.sqrt(-x);
        return ok({ primary: { label: `√${f(x)}`, value: T(`${f(clean(r))}i`) }, steps: ["The square root of a negative number is not real; it is the imaginary number i × √|x|."], notes: ["i is the imaginary unit, i² = −1."] });
      }
      return fail("An even root of a negative number is not a real number.", "number");
    }
    const r = x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n);
    const rounded = Math.round(r);
    const exactRoot = Math.abs(rounded ** n - x) < 1e-9 * Math.max(1, Math.abs(x)) ? rounded : null;
    const secondary = [];
    if (exactRoot !== null) secondary.push({ label: "Perfect power?", value: T(`Yes — ${f(exactRoot)}^${n} = ${f(x)}`) });
    else if (Number.isInteger(x) && Math.abs(x) <= 1e12) {
      const { coefficient, radicand } = simplifyRoot(x, n);
      if (coefficient > 1) secondary.push({ label: "Simplified radical form", value: T(`${sgn(x)}${f(coefficient)}${n === 2 ? "√" : `${n === 3 ? "∛" : `${n}√`}`}${radicand}`) });
      else secondary.push({ label: "Perfect power?", value: T("No — the root is irrational and the radical can't be simplified") });
    }
    return ok({
      primary: { label: n === 2 ? `√${f(x)}` : n === 3 ? `∛${f(x)}` : `Root: ${n}th root of ${f(x)}`, value: N(clean(r), undefined, 12) },
      secondary,
      steps: [`The ${n === 2 ? "square" : n === 3 ? "cube" : `${n}th`} root of ${f(x)} is the number that, raised to the power ${n}, gives ${f(x)}`, `${f(clean(r))}^${n} = ${f(clean(Math.pow(r, n)))}`],
    });
  },
};
