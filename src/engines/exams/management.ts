import type { EngineMap, FieldError } from "@/tools/types";
import { N, P } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { failMany, num, ok } from "../helpers";
import { accuracyPct, f, r4 } from "./common";

/** CAT 2025 pattern: questions per section. Each correct answer is +3; a wrong MCQ is −1; TITA (typed) answers have no penalty. */
export const CAT_SECTIONS = [
  { id: "varc", label: "VARC", questions: 24 },
  { id: "dilr", label: "DILR", questions: 22 },
  { id: "qa", label: "QA", questions: 22 },
] as const;

export const engines: EngineMap = {
  "cat-score-calculator": (v) => {
    const errors: FieldError[] = [];
    const rows = CAT_SECTIONS.map((s) => {
      const mc = num(v, `${s.id}_mcq_c`), mw = num(v, `${s.id}_mcq_w`), tc = num(v, `${s.id}_tita_c`);
      if (mc + mw + tc > s.questions) errors.push({ field: `${s.id}_tita_c`, message: `${s.label}: correct MCQs + wrong MCQs + correct TITA can't exceed ${s.questions} questions (you entered ${mc + mw + tc}).` });
      return { ...s, mc, mw, tc, score: clean(3 * (mc + tc) - mw) };
    });
    if (errors.length) return failMany(errors);
    const total = clean(rows.reduce((a, r) => a + r.score, 0));
    const correct = rows.reduce((a, r) => a + r.mc + r.tc, 0), wrongMcq = rows.reduce((a, r) => a + r.mw, 0);
    const attempted = correct + wrongMcq;
    const acc = accuracyPct(correct, wrongMcq);
    return ok({
      primary: { label: "Raw score", value: N(total, "/ 204") },
      secondary: [
        { label: "Percentage of 204", value: P(r4((total / 204) * 100), 2) },
        { label: "Questions attempted (MCQ + TITA)", value: N(attempted) },
        { label: "Marks lost to wrong MCQs", value: N(wrongMcq) },
        ...(acc === null ? [] : [{ label: "Accuracy on attempted MCQs and TITA", value: P(r4(acc), 1), hint: "Wrong TITA answers are not entered, so this counts only MCQ errors." }]),
      ],
      table: { caption: "Score by section", columns: ["Section", "Correct MCQ", "Wrong MCQ", "Correct TITA", "Score"], rows: rows.map((r) => [r.label, r.mc, r.mw, r.tc, r.score]) },
      steps: rows.map((r) => `${r.label}: 3 × (${r.mc} + ${r.tc}) − ${r.mw} = ${f(r.score)}`),
      notes: [
        "This is the raw score. The IIMs scale scores across the sessions (slots) to make them comparable and then report a percentile — neither can be computed from your raw score alone.",
        "Wrong TITA answers cost nothing, so there is no field for them.",
      ],
    });
  },
};
