import type { EngineMap } from "@/tools/types";
import { N, P, T, formatBigInt, formatNumber, toSuperscript } from "@/lib/format";
import { clean, decimalPlaces, gcdBig, lcmBig, sumExact } from "@/lib/numeric";
import { parseNumberList, lines } from "@/lib/lists";
import { fail, failMany, num, ok, optNum, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 6 });

function factorize(n: number): [number, number][] {
  const out: [number, number][] = [];
  let x = n;
  for (let p = 2; p * p <= x; p += p === 2 ? 1 : 2) {
    if (x % p === 0) {
      let e = 0;
      while (x % p === 0) {
        x /= p;
        e++;
      }
      out.push([p, e]);
    }
  }
  if (x > 1) out.push([x, 1]);
  return out;
}
const factorText = (fs: [number, number][], n: number): string =>
  n === 1 ? "1" : fs.map(([p, e]) => (e > 1 ? `${p}${toSuperscript(e)}` : `${p}`)).join(" × ");

function nCr(n: number, r: number): bigint {
  const k = BigInt(Math.min(r, n - r));
  const N0 = BigInt(n);
  let res = 1n;
  for (let i = 1n; i <= k; i++) res = (res * (N0 - k + i)) / i;
  return res;
}
function nPr(n: number, r: number): bigint {
  let res = 1n;
  for (let i = 0; i < r; i++) res *= BigInt(n - i);
  return res;
}

const lnFact = (() => {
  const t = [0];
  return (n: number) => {
    while (t.length <= n) t.push(t[t.length - 1] + Math.log(t.length));
    return t[n];
  };
})();

function binomPmf(n: number, k: number, p: number): number {
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

export const engines: EngineMap = {
  "ratio-calculator": (v) => {
    const raw = str(v, "terms");
    const tokens = raw.split(/[:,;\s]+|\bto\b/i).filter(Boolean);
    const parsed = parseNumberList(tokens.join(" "), { min: 2, max: 10, label: "ratio terms" });
    if (!parsed.ok) return fail(parsed.message, "terms");
    const terms = parsed.values;
    if (terms.some((t) => t < 0)) return fail("Ratio terms can't be negative.", "terms");
    if (terms.every((t) => t === 0)) return fail("At least one term must be greater than zero.", "terms");
    if (str(v, "mode") === "split") {
      const total = num(v, "total");
      const sum = sumExact(terms);
      const shares = terms.map((t) => clean((total * t) / sum));
      return ok({
        primary: { label: "Shares", value: T(shares.map((s) => formatNumber(s, { maxDecimals: 4 })).join(" : ")) },
        secondary: [{ label: "Total parts", value: N(sum) }, { label: "Value of one part", value: N(clean(total / sum)) }],
        table: {
          columns: ["Term", "Parts", "Share of total", "Amount"],
          rows: terms.map((t, i) => [`${i + 1}`, N(t), P(clean((t / sum) * 100), 4), N(shares[i], undefined, 4)]),
        },
        steps: [`Total parts = ${terms.map(f).join(" + ")} = ${f(sum)}`, `One part = ${f(total)} ÷ ${f(sum)} = ${f(clean(total / sum))}`, `Each share = its parts × ${f(clean(total / sum))}`],
      });
    }
    const dp = Math.min(6, Math.max(...terms.map(decimalPlaces)));
    const scaled = terms.map((t) => BigInt(Math.round(t * 10 ** dp)));
    const g = scaled.reduce((a, b) => gcdBig(a, b));
    const simple = scaled.map((s) => s / g);
    return ok({
      primary: { label: "Simplified ratio", value: T(simple.join(" : ")) },
      secondary: [
        { label: "Greatest common factor", value: T(String(g)) },
        ...(terms.length === 2 && terms[1] !== 0 ? [{ label: "First ÷ second", value: N(clean(terms[0] / terms[1]), undefined, 6) }] : []),
      ],
      steps: [
        ...(dp > 0 ? [`Multiply every term by 10${toSuperscript(dp)} to remove decimals → ${scaled.join(" : ")}`] : []),
        `Divide every term by their greatest common factor (${g}) → ${simple.join(" : ")}`,
      ],
    });
  },

  "proportion-calculator": (v) => {
    const names = ["a", "b", "c", "d"] as const;
    const vals = names.map((k) => optNum(v, k));
    const missing = names.filter((_, i) => vals[i] === undefined);
    if (missing.length !== 1) {
      return failMany([{ field: missing[0] ?? "a", message: missing.length === 0 ? "Leave exactly one of the four boxes empty — that's the value to find." : `Fill in three of the four boxes and leave only one empty (${missing.length} are empty).` }]);
    }
    const [a, b, c, d] = vals;
    const inverse = str(v, "kind") === "inverse";
    const lhs = inverse ? "A × B = C × D" : "A ÷ B = C ÷ D";
    const zero = (label: string, field: string) => fail(`${label} can't be zero here — that would require dividing by zero.`, field);
    let x: number;
    let formulaText: string;
    const m = missing[0];
    if (!inverse) {
      if (m === "a") { if (d === 0) return zero("D", "d"); x = (b! * c!) / d!; formulaText = `A = B × C ÷ D = ${f(b!)} × ${f(c!)} ÷ ${f(d!)}`; }
      else if (m === "b") { if (c === 0) return zero("C", "c"); x = (a! * d!) / c!; formulaText = `B = A × D ÷ C = ${f(a!)} × ${f(d!)} ÷ ${f(c!)}`; }
      else if (m === "c") { if (b === 0) return zero("B", "b"); x = (a! * d!) / b!; formulaText = `C = A × D ÷ B = ${f(a!)} × ${f(d!)} ÷ ${f(b!)}`; }
      else { if (a === 0) return zero("A", "a"); x = (b! * c!) / a!; formulaText = `D = B × C ÷ A = ${f(b!)} × ${f(c!)} ÷ ${f(a!)}`; }
    } else {
      if (m === "a") { if (b === 0) return zero("B", "b"); x = (c! * d!) / b!; formulaText = `A = C × D ÷ B = ${f(c!)} × ${f(d!)} ÷ ${f(b!)}`; }
      else if (m === "b") { if (a === 0) return zero("A", "a"); x = (c! * d!) / a!; formulaText = `B = C × D ÷ A = ${f(c!)} × ${f(d!)} ÷ ${f(a!)}`; }
      else if (m === "c") { if (d === 0) return zero("D", "d"); x = (a! * b!) / d!; formulaText = `C = A × B ÷ D = ${f(a!)} × ${f(b!)} ÷ ${f(d!)}`; }
      else { if (c === 0) return zero("C", "c"); x = (a! * b!) / c!; formulaText = `D = A × B ÷ C = ${f(a!)} × ${f(b!)} ÷ ${f(c!)}`; }
    }
    x = clean(x);
    if (!Number.isFinite(x)) return fail("That result is too large to show reliably.");
    return ok({
      primary: { label: `Missing value (${m.toUpperCase()})`, value: N(x) },
      steps: [`${inverse ? "Inverse" : "Direct"} proportion: ${lhs}`, `${formulaText} = ${f(x)}`],
    });
  },

  "average-calculator": (v) => {
    const parsed = parseNumberList(str(v, "numbers"), { min: 1, max: 100000 });
    if (!parsed.ok) return fail(parsed.message, "numbers");
    const xs = parsed.values;
    const sum = sumExact(xs);
    const mean = clean(sum / xs.length);
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : clean((sorted[mid - 1] + sorted[mid]) / 2);
    const counts = new Map<number, number>();
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
    const top = Math.max(...counts.values());
    const modes = top === 1 ? [] : [...counts].filter(([, c]) => c === top).map(([x]) => x).sort((a, b) => a - b);
    return ok({
      primary: { label: "Average (mean)", value: N(mean, undefined, 8) },
      secondary: [
        { label: "Count", value: N(xs.length) },
        { label: "Sum", value: N(sum) },
        { label: "Median", value: N(median) },
        { label: "Mode", value: T(modes.length ? modes.map((m) => formatNumber(m)).join(", ") + (top > 1 ? ` (×${top})` : "") : "No mode — every value is different") },
        { label: "Smallest", value: N(sorted[0]) },
        { label: "Largest", value: N(sorted[sorted.length - 1]) },
        { label: "Range", value: N(clean(sorted[sorted.length - 1] - sorted[0])) },
      ],
      steps: [`Mean = sum ÷ count = ${f(sum)} ÷ ${xs.length} = ${formatNumber(mean, { maxDecimals: 8 })}`],
    });
  },

  "weighted-average-calculator": (v) => {
    const rows = lines(str(v, "rows"));
    if (rows.length < 1) return fail("Enter at least one line in the form: value, weight", "rows");
    if (rows.length > 500) return fail("Too many lines — the limit is 500.", "rows");
    const items: { value: number; weight: number }[] = [];
    for (const row of rows) {
      const parsed = parseNumberList(row.text.replace(/[:]/g, " "), { label: "values" });
      if (!parsed.ok) return fail(`Line ${row.line}: ${parsed.message}`, "rows");
      if (parsed.values.length !== 2) return fail(`Line ${row.line} needs exactly two numbers — a value and its weight, like "85, 30".`, "rows");
      const [value, weight] = parsed.values;
      if (weight < 0) return fail(`Line ${row.line}: a weight can't be negative.`, "rows");
      items.push({ value, weight });
    }
    const totalWeight = sumExact(items.map((i) => i.weight));
    if (totalWeight === 0) return fail("The weights add up to zero, so no weighted average can be calculated.", "rows");
    const weightedSum = clean(items.reduce((s, i) => s + i.value * i.weight, 0));
    const result = clean(weightedSum / totalWeight);
    return ok({
      primary: { label: "Weighted average", value: N(result, undefined, 6) },
      secondary: [
        { label: "Total weight", value: N(totalWeight) },
        { label: "Sum of value × weight", value: N(weightedSum) },
        { label: "Simple (unweighted) average", value: N(clean(sumExact(items.map((i) => i.value)) / items.length), undefined, 6) },
      ],
      table: {
        columns: ["Value", "Weight", "Weight %", "Value × weight"],
        rows: items.map((i) => [N(i.value), N(i.weight), P(clean((i.weight / totalWeight) * 100), 2), N(clean(i.value * i.weight))]),
      },
      steps: [`Weighted average = Σ(value × weight) ÷ Σ(weight) = ${f(weightedSum)} ÷ ${f(totalWeight)} = ${formatNumber(result, { maxDecimals: 6 })}`],
    });
  },

  "hcf-lcm-calculator": (v) => {
    const parsed = parseNumberList(str(v, "numbers"), { min: 2, max: 20, integer: true, positive: true, label: "whole numbers" });
    if (!parsed.ok) return fail(parsed.message, "numbers");
    const xs = parsed.values;
    if (xs.some((x) => x > 1e12)) return fail("Numbers above 1,000,000,000,000 aren't supported.", "numbers");
    const big = xs.map((x) => BigInt(x));
    const hcf = big.reduce((a, b) => gcdBig(a, b));
    const lcm = big.reduce((a, b) => lcmBig(a, b));
    const rows = xs.map((x) => [formatNumber(x), factorText(factorize(x), x)]);
    const notes: string[] = [];
    if (hcf === 1n) notes.push("The HCF is 1, so these numbers are co-prime (they share no common factor other than 1).");
    return ok({
      primary: { label: "HCF (GCD)", value: T(formatBigInt(String(hcf))) },
      secondary: [{ label: "LCM", value: T(formatBigInt(String(lcm))) }],
      table: { columns: ["Number", "Prime factors"], rows },
      steps: [
        `HCF: repeatedly take the greatest common divisor of pairs (Euclid's algorithm) → ${hcf}`,
        `LCM: for two numbers, LCM = a × b ÷ HCF; for more, combine pairwise → ${lcm}`,
        ...(xs.length === 2 ? [`Check: ${xs[0]} × ${xs[1]} = ${hcf} × ${lcm}`] : []),
      ],
      notes,
    });
  },

  "permutation-combination-calculator": (v) => {
    const n = num(v, "n");
    const r = num(v, "r");
    if (r > n) return fail("r can't be larger than n — you can't choose more items than you have.", "r");
    const c = nCr(n, r);
    const p = nPr(n, r);
    const pRep = BigInt(n) ** BigInt(r);
    const cRep = nCr(n + r - 1, r);
    const texts = String(c).length > 40 ? [{ label: "Exact value of nCr", value: String(c), copyable: true }] : undefined;
    return ok({
      primary: { label: "Combinations (nCr)", value: T(formatBigInt(String(c))) },
      secondary: [
        { label: "Permutations (nPr)", value: T(formatBigInt(String(p))) },
        { label: "Permutations with repetition (nʳ)", value: T(formatBigInt(String(pRep))) },
        { label: "Combinations with repetition", value: T(formatBigInt(String(cRep))) },
      ],
      texts,
      steps: [
        `nPr = n! ÷ (n − r)! = ${n}! ÷ ${n - r}!`,
        `nCr = n! ÷ (r! × (n − r)!) = nPr ÷ r!`,
        `With repetition: permutations = n^r = ${n}^${r}; combinations = C(n + r − 1, r) = C(${n + r - 1}, ${r})`,
      ],
    });
  },

  "probability-calculator": (v) => {
    const mode = str(v, "mode");
    if (mode === "single") {
      const fav = num(v, "favorable");
      const total = num(v, "total");
      if (total === 0) return fail("The total number of outcomes must be at least 1.", "total");
      if (fav > total) return fail("Favourable outcomes can't be more than the total outcomes.", "favorable");
      const p = clean(fav / total);
      return ok({
        primary: { label: "Probability", value: N(p, undefined, 6) },
        secondary: [
          { label: "As a percentage", value: P(clean(p * 100), 4) },
          { label: "Probability it does not happen", value: N(clean(1 - p), undefined, 6) },
          { label: "Odds in favour", value: T(`${formatNumber(fav)} : ${formatNumber(clean(total - fav))}`) },
        ],
        steps: [`P = favourable ÷ total = ${f(fav)} ÷ ${f(total)} = ${formatNumber(p, { maxDecimals: 6 })}`],
      });
    }
    if (mode === "two") {
      const a = num(v, "pa") / 100;
      const b = num(v, "pb") / 100;
      const exclusive = str(v, "relation") === "exclusive";
      if (exclusive && a + b > 1 + 1e-12) return fail("Mutually exclusive events can't have probabilities that add up to more than 100%.", "pb");
      const and = exclusive ? 0 : a * b;
      const or = exclusive ? a + b : a + b - a * b;
      const neither = exclusive ? 1 - a - b : (1 - a) * (1 - b);
      const exactlyOne = exclusive ? a + b : a + b - 2 * a * b;
      const pct = (x: number) => P(clean(x * 100), 4);
      return ok({
        primary: { label: "P(A or B)", value: pct(or) },
        secondary: [
          { label: "P(A and B)", value: pct(and) },
          { label: "P(neither)", value: pct(neither) },
          { label: "P(exactly one)", value: pct(exactlyOne) },
        ],
        steps: exclusive
          ? ["Mutually exclusive: P(A and B) = 0, P(A or B) = P(A) + P(B)"]
          : ["Independent: P(A and B) = P(A) × P(B)", "P(A or B) = P(A) + P(B) − P(A and B)", "P(neither) = (1 − P(A)) × (1 − P(B))"],
      });
    }
    const n = num(v, "n");
    const k = num(v, "k");
    const p = num(v, "p") / 100;
    if (k > n) return fail("The number of successes can't be larger than the number of trials.", "k");
    let atMost = 0;
    let atLeast = 0;
    for (let i = 0; i <= n; i++) {
      const pm = binomPmf(n, i, p);
      if (i <= k) atMost += pm;
      if (i >= k) atLeast += pm;
    }
    const exact = binomPmf(n, k, p);
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    return ok({
      primary: { label: "P(X = k)", value: N(clean(clamp(exact)), undefined, 8) },
      secondary: [
        { label: "P(X ≤ k)", value: N(clean(clamp(atMost)), undefined, 8) },
        { label: "P(X ≥ k)", value: N(clean(clamp(atLeast)), undefined, 8) },
        { label: "Expected successes (n × p)", value: N(clean(n * p)) },
        { label: "Standard deviation", value: N(clean(Math.sqrt(n * p * (1 - p))), undefined, 6) },
      ],
      steps: [`P(X = k) = C(n, k) × p^k × (1 − p)^(n − k) with n = ${n}, k = ${k}, p = ${formatNumber(p, { maxDecimals: 6 })}`, "Cumulative values add up the exact probabilities for each count."],
    });
  },
};
