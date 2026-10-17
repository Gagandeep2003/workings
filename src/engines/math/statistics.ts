import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { parseNumberList } from "@/lib/lists";
import { fail, num, ok, str } from "../helpers";

const f = (n: number) => formatNumber(clean(n), { maxDecimals: 8 });

export const engines: EngineMap = {
  "standard-deviation-calculator": (v) => {
    const list = parseNumberList(str(v, "values"), { min: 2, max: 5000, label: "values" });
    if (!list.ok) return fail(list.message, "values");
    const xs = list.values, n = xs.length;
    const mean = xs.reduce((a, x) => a + x, 0) / n;
    const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0); // sum of squared deviations (two-pass: numerically stable)
    const popVar = ss / n, sampVar = ss / (n - 1);
    const popSd = Math.sqrt(popVar), sampSd = Math.sqrt(sampVar);
    const sample = str(v, "kind") !== "population";
    const sd = sample ? sampSd : popSd;
    return ok({
      primary: { label: sample ? "Sample standard deviation (s)" : "Population standard deviation (σ)", value: N(clean(sd), undefined, 8) },
      secondary: [
        { label: sample ? "Sample variance (s²)" : "Population variance (σ²)", value: N(clean(sample ? sampVar : popVar), undefined, 8) },
        { label: sample ? "Population standard deviation (σ)" : "Sample standard deviation (s)", value: N(clean(sample ? popSd : sampSd), undefined, 8) },
        { label: "Mean", value: N(clean(mean), undefined, 8) },
        { label: "Count", value: N(n) },
        { label: "Sum of squared deviations", value: N(clean(ss), undefined, 8) },
        { label: "Standard error of the mean", value: N(clean(sampSd / Math.sqrt(n)), undefined, 8) },
        ...(mean !== 0 ? [{ label: "Coefficient of variation", value: T(`${f((sd / Math.abs(mean)) * 100)}%`) }] : []),
      ],
      ...(n <= 20 ? { table: { caption: "Deviations from the mean", columns: ["Value", "Deviation (x − mean)", "Squared deviation"], rows: xs.map((x) => [f(x), f(x - mean), f((x - mean) ** 2)]) } } : {}),
      steps: [`Mean = ${f(mean)}`, `Sum of squared deviations = ${f(ss)}`, sample ? `Sample variance = ${f(ss)} ÷ (n − 1) = ${f(ss)} ÷ ${n - 1} = ${f(sampVar)}` : `Population variance = ${f(ss)} ÷ n = ${f(ss)} ÷ ${n} = ${f(popVar)}`, `Standard deviation = √variance = ${f(sd)}`],
      notes: [sample ? "Sample standard deviation divides by n − 1 (Bessel's correction). Use the population version if your numbers are the whole group, not a sample from it." : "Population standard deviation divides by n. If your numbers are a sample from a larger group, choose the sample version."],
    });
  },

  "percentage-error-calculator": (v) => {
    const measured = num(v, "measured"), truth = num(v, "true_value");
    if (truth === 0) return fail("The true (accepted) value can't be zero — percentage error divides by it.", "true_value");
    const abs = Math.abs(measured - truth);
    const pct = (abs / Math.abs(truth)) * 100;
    const signed = ((measured - truth) / Math.abs(truth)) * 100;
    return ok({
      primary: { label: "Percentage error", value: { kind: "percent", value: clean(pct), maxDecimals: 6 } },
      secondary: [
        { label: "Signed error", value: { kind: "percent", value: clean(signed), maxDecimals: 6 }, hint: "Negative means your measurement was below the true value." },
        { label: "Absolute error", value: N(clean(abs), undefined, 8) },
        { label: "Direction", value: T(measured === truth ? "Exactly equal to the true value" : measured > truth ? "Over the true value" : "Under the true value") },
      ],
      steps: [`Absolute error = |measured − true| = |${f(measured)} − ${f(truth)}| = ${f(abs)}`, `Percentage error = absolute error ÷ |true value| × 100 = ${f(abs)} ÷ ${f(Math.abs(truth))} × 100 = ${f(pct)}%`],
      notes: ["Some textbooks keep the sign (the signed error shown above); others always report a positive percentage error. Check which one your course expects."],
    });
  },
};
