import type { Engine, EngineMap } from "@/tools/types";
import { N, P, T, formatNumber } from "@/lib/format";
import { clean, round } from "@/lib/numeric";
import { num, ok } from "../helpers";

/**
 * Marking scheme constants. These mirror the `regulatory` block of each tool definition
 * (year, source and effective date live there) and are tested against it.
 */
export const SSC_TIER1_SCHEME = {
  questionsPerSection: 25,
  marksPerCorrect: 2,
  negativePerWrong: 0.5,
} as const;

export const CGL_TIER1_SECTIONS = [
  { id: "reasoning", label: "General Intelligence & Reasoning" },
  { id: "ga", label: "General Awareness" },
  { id: "quant", label: "Quantitative Aptitude" },
  { id: "english", label: "English Comprehension" },
] as const;

export const CHSL_TIER1_SECTIONS = [
  { id: "english", label: "English Language" },
  { id: "reasoning", label: "General Intelligence" },
  { id: "quant", label: "Quantitative Aptitude" },
  { id: "ga", label: "General Awareness" },
] as const;

function tier1(examName: string, sections: readonly { id: string; label: string }[]): Engine {
  const { questionsPerSection: q, marksPerCorrect: plus, negativePerWrong: minus } = SSC_TIER1_SCHEME;
  return (v) => {
    const rows = sections.map((s) => ({ ...s, correct: num(v, `${s.id}_c`), wrong: num(v, `${s.id}_w`) }));
    const errors = rows.flatMap((r) => {
      const out = [];
      if (!Number.isInteger(r.correct)) out.push({ field: `${r.id}_c`, message: "Correct answers must be a whole number." });
      if (!Number.isInteger(r.wrong)) out.push({ field: `${r.id}_w`, message: "Wrong answers must be a whole number." });
      if (r.correct + r.wrong > q) out.push({ field: `${r.id}_w`, message: `${r.label} has only ${q} questions, but correct (${r.correct}) + wrong (${r.wrong}) is ${r.correct + r.wrong}.` });
      return out;
    });
    if (errors.length) return { ok: false, errors };
    const score = (c: number, w: number) => clean(c * plus - w * minus);
    const totalC = rows.reduce((s, r) => s + r.correct, 0);
    const totalW = rows.reduce((s, r) => s + r.wrong, 0);
    const total = score(totalC, totalW);
    const max = sections.length * q * plus;
    const attempted = totalC + totalW;
    return ok({
      primary: { label: "Raw score", value: N(total, undefined, 2) },
      secondary: [
        { label: `Out of`, value: N(max) },
        { label: "Questions attempted", value: N(attempted) },
        { label: "Accuracy (correct ÷ attempted)", value: attempted ? P(round((totalC / attempted) * 100, 2), 2) : T("—") },
        { label: "Marks lost to negative marking", value: N(clean(totalW * minus)) },
      ],
      table: {
        caption: `${examName} Tier-I section scores`,
        columns: ["Section", "Correct", "Wrong", "Unattempted", "Marks"],
        rows: rows.map((r) => [r.label, r.correct, r.wrong, q - r.correct - r.wrong, N(score(r.correct, r.wrong), undefined, 2)]),
      },
      steps: [`Each correct answer earns ${plus} marks; each wrong answer loses ${formatNumber(minus)} mark; unattempted questions score 0.`, `Raw score = ${totalC} × ${plus} − ${totalW} × ${formatNumber(minus)} = ${formatNumber(total, { maxDecimals: 2 })}`],
      notes: [
        "This is the raw score from your own answer count. For exams held in several shifts SSC may publish normalised scores, which can differ from this raw score.",
        "Cut-offs change every cycle and are not included. Always check the official notice for your exam year.",
      ],
    });
  };
}

export const engines: EngineMap = {
  "ssc-cgl-tier-1-score-calculator": tier1("SSC CGL", CGL_TIER1_SECTIONS),
  "ssc-chsl-tier-1-score-calculator": tier1("SSC CHSL", CHSL_TIER1_SECTIONS),
};
