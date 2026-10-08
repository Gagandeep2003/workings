import type { EngineMap } from "@/tools/types";
import { N, P, T, formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { fail, num, ok, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 6 });
const pc = (n: number) => formatNumber(n, { maxDecimals: 2 });
const TOO_BIG = "That result is too large to show reliably. Try smaller numbers.";

export const engines: EngineMap = {
  "percentage-calculator": (v) => {
    const mode = str(v, "mode");
    if (mode === "of") {
      const p = num(v, "p");
      const x = num(v, "x");
      const r = clean((p * x) / 100);
      if (!Number.isFinite(r)) return fail(TOO_BIG);
      return ok({
        primary: { label: "Result", value: N(r) },
        secondary: [{ label: "As a fraction of the whole", value: N(clean(p / 100)) }],
        steps: [`${f(p)}% of ${f(x)} = (${f(p)} ÷ 100) × ${f(x)} = ${f(r)}`],
      });
    }
    if (mode === "is") {
      const part = num(v, "part");
      const total = num(v, "total");
      if (total === 0) return fail("The total can't be zero — a percentage of zero isn't defined.", "total");
      const r = clean((part / total) * 100);
      if (!Number.isFinite(r)) return fail(TOO_BIG);
      return ok({
        primary: { label: "Percentage", value: P(r, 4) },
        secondary: [{ label: "As a decimal", value: N(clean(part / total)) }],
        steps: [`${f(part)} ÷ ${f(total)} × 100 = ${formatNumber(r, { maxDecimals: 4 })}%`],
      });
    }
    const part = num(v, "part2");
    const pct = num(v, "pct2");
    if (pct === 0) return fail("The percentage can't be zero — no number is 0% of something and still equals a non-zero value.", "pct2");
    const whole = clean((part * 100) / pct);
    if (!Number.isFinite(whole)) return fail(TOO_BIG);
    return ok({
      primary: { label: "The whole is", value: N(whole) },
      steps: [`${f(part)} is ${f(pct)}% of the whole, so whole = ${f(part)} ÷ ${f(pct)} × 100 = ${f(whole)}`],
    });
  },

  "percentage-increase-calculator": (v) => {
    if (str(v, "mode") === "between") {
      const from = num(v, "from");
      const to = num(v, "to");
      if (from === 0) return fail("The original value can't be zero — a percentage increase from zero is undefined.", "from");
      const r = clean(((to - from) / Math.abs(from)) * 100);
      const notes: string[] = [];
      if (to < from) notes.push(`The value went down, so this is a decrease of ${pc(-r)}%. The Percentage Decrease Calculator shows it as a positive number.`);
      if (from < 0) notes.push("The original value is negative, so the sign can look counter-intuitive. The percentage is measured against the size of the original value.");
      return ok({
        primary: { label: "Percentage increase", value: P(r, 4) },
        secondary: [{ label: "Absolute change", value: N(clean(to - from)) }],
        steps: [`(${f(to)} − ${f(from)}) ÷ |${f(from)}| × 100 = ${formatNumber(r, { maxDecimals: 4 })}%`],
        notes,
      });
    }
    const value = num(v, "value");
    const pct = num(v, "pct");
    const added = clean((value * pct) / 100);
    const result = clean(value + added);
    if (!Number.isFinite(result)) return fail(TOO_BIG);
    return ok({
      primary: { label: "New value", value: N(result) },
      secondary: [{ label: "Amount added", value: N(added) }, { label: "Multiplier", value: N(clean(1 + pct / 100)) }],
      steps: [`${f(value)} × (1 + ${f(pct)} ÷ 100) = ${f(value)} × ${f(clean(1 + pct / 100))} = ${f(result)}`],
    });
  },

  "percentage-decrease-calculator": (v) => {
    if (str(v, "mode") === "between") {
      const from = num(v, "from");
      const to = num(v, "to");
      if (from === 0) return fail("The original value can't be zero — a percentage decrease from zero is undefined.", "from");
      const r = clean(((from - to) / Math.abs(from)) * 100);
      const notes: string[] = [];
      if (to > from) notes.push(`The value went up, so this is an increase of ${pc(-r)}%. The Percentage Increase Calculator shows it as a positive number.`);
      return ok({
        primary: { label: "Percentage decrease", value: P(r, 4) },
        secondary: [{ label: "Amount of decrease", value: N(clean(from - to)) }],
        steps: [`(${f(from)} − ${f(to)}) ÷ |${f(from)}| × 100 = ${formatNumber(r, { maxDecimals: 4 })}%`],
        notes,
      });
    }
    const value = num(v, "value");
    const pct = num(v, "pct");
    const removed = clean((value * pct) / 100);
    const result = clean(value - removed);
    return ok({
      primary: { label: "New value", value: N(result) },
      secondary: [{ label: "Amount taken off", value: N(removed) }, { label: "Multiplier", value: N(clean(1 - pct / 100)) }],
      steps: [`${f(value)} × (1 − ${f(pct)} ÷ 100) = ${f(value)} × ${f(clean(1 - pct / 100))} = ${f(result)}`],
      notes: pct > 100 ? ["A decrease of more than 100% takes the value below zero."] : [],
    });
  },

  "percentage-change-calculator": (v) => {
    const from = num(v, "from");
    const to = num(v, "to");
    if (from === 0) return fail("The starting value can't be zero — percentage change is measured relative to where you started.", "from");
    const r = clean(((to - from) / Math.abs(from)) * 100);
    const direction = r > 0 ? "Increase" : r < 0 ? "Decrease" : "No change";
    return ok({
      primary: { label: "Percentage change", value: P(r, 4) },
      secondary: [
        { label: "Direction", value: T(direction) },
        { label: "Absolute change", value: N(clean(to - from)) },
        { label: "Ratio (new ÷ old)", value: N(clean(to / from)) },
      ],
      steps: [`(${f(to)} − ${f(from)}) ÷ |${f(from)}| × 100 = ${formatNumber(r, { maxDecimals: 4 })}%`],
      notes: from < 0 ? ["The starting value is negative, so the sign can look counter-intuitive. The change is measured against the size of the starting value."] : [],
    });
  },

  "percentage-difference-calculator": (v) => {
    const a = num(v, "a");
    const b = num(v, "b");
    const mean = (a + b) / 2;
    if (mean === 0) return fail("Both values are zero, so there is no average to compare against.", "a");
    const r = clean((Math.abs(a - b) / mean) * 100);
    return ok({
      primary: { label: "Percentage difference", value: P(r, 4) },
      secondary: [
        { label: "Absolute difference", value: N(clean(Math.abs(a - b))) },
        { label: "Average of the two values", value: N(clean(mean)) },
      ],
      steps: [`|${f(a)} − ${f(b)}| ÷ ((${f(a)} + ${f(b)}) ÷ 2) × 100 = ${f(clean(Math.abs(a - b)))} ÷ ${f(clean(mean))} × 100 = ${formatNumber(r, { maxDecimals: 4 })}%`],
      notes: ["Percentage difference treats both values equally. Use Percentage Change when one value is clearly the starting point."],
    });
  },
};
