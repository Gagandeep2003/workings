import type { EngineMap, FieldError } from "@/tools/types";
import { N, P, T } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { fail, failMany, num, ok, str } from "../helpers";
import { accuracyPct, f, net, r4 } from "./common";

// SSC MTS (2025 notification): Session I has no negative marking; Session II deducts 1 mark per wrong answer. 3 marks per question.
export const MTS_SECTIONS = [
  { id: "math", label: "Numerical and Mathematical Ability", session: 1, questions: 20 },
  { id: "reason", label: "Reasoning Ability and Problem Solving", session: 1, questions: 20 },
  { id: "ga", label: "General Awareness", session: 2, questions: 25 },
  { id: "eng", label: "English Language and Comprehension", session: 2, questions: 25 },
] as const;

// IBPS PO Prelims pattern (2025 cycle): English 30, Quantitative Aptitude 35, Reasoning 35 — 100 questions.
export const BANK_SECTIONS = [
  { id: "eng", label: "English Language", questions: 30 },
  { id: "quant", label: "Quantitative Aptitude", questions: 35 },
  { id: "reason", label: "Reasoning Ability", questions: 35 },
] as const;

export const RRB_EXAMS: Record<string, { label: string; questions: number }> = {
  "ntpc-cbt1": { label: "RRB NTPC — CBT-1", questions: 100 },
  "ntpc-cbt2": { label: "RRB NTPC — CBT-2", questions: 120 },
  "group-d": { label: "RRB Group D — CBT", questions: 100 },
};

export const engines: EngineMap = {
  "ssc-mts-score-calculator": (v) => {
    const errors: FieldError[] = [];
    const rows = MTS_SECTIONS.map((s) => {
      const c = num(v, `${s.id}_c`);
      const w = s.session === 2 ? num(v, `${s.id}_w`) : 0;
      if (c + w > s.questions) errors.push({ field: s.session === 2 ? `${s.id}_w` : `${s.id}_c`, message: `${s.label}: answers can't exceed ${s.questions} questions (you entered ${c + w}).` });
      return { ...s, c, w, score: net(c, w, 3, s.session === 2 ? 1 : 0) };
    });
    if (errors.length) return failMany(errors);
    const s1 = clean(rows.filter((r) => r.session === 1).reduce((a, r) => a + r.score, 0));
    const s2 = clean(rows.filter((r) => r.session === 2).reduce((a, r) => a + r.score, 0));
    const total = clean(s1 + s2);
    const wrong = rows.reduce((a, r) => a + r.w, 0);
    return ok({
      primary: { label: "Raw score", value: N(total, "/ 270") },
      secondary: [
        { label: "Session I (no negative marking)", value: N(s1, "/ 120") },
        { label: "Session II (−1 per wrong answer)", value: N(s2, "/ 150") },
        { label: "Marks lost to wrong answers", value: N(wrong) },
        { label: "Percentage of 270", value: P(r4((total / 270) * 100), 2) },
      ],
      table: { caption: "Score by section", columns: ["Session", "Section", "Correct", "Wrong", "Score"], rows: rows.map((r) => [`Session ${r.session === 1 ? "I" : "II"}`, r.label, r.c, r.session === 2 ? r.w : "—", r.score]) },
      steps: rows.map((r) => `${r.label}: ${r.c} × 3${r.session === 2 ? ` − ${r.w} × 1` : ""} = ${f(r.score)}`),
      notes: ["Raw marks only. Shortlisting rules, session-wise requirements and cut-offs are set by the Commission and are not modelled here."],
    });
  },

  "banking-prelims-score-calculator": (v) => {
    const perQ = num(v, "marks_per_q"), penaltyFraction = num(v, "penalty");
    if (perQ <= 0) return fail("Marks per question must be greater than zero.", "marks_per_q");
    if (penaltyFraction < 0 || penaltyFraction > 1) return fail("Enter the penalty as a fraction of a question's marks between 0 and 1 (for example 0.25 for one-fourth).", "penalty");
    const errors: FieldError[] = [];
    const rows = BANK_SECTIONS.map((s) => {
      const c = num(v, `${s.id}_c`), w = num(v, `${s.id}_w`);
      if (c + w > s.questions) errors.push({ field: `${s.id}_w`, message: `${s.label}: correct plus wrong can't exceed ${s.questions} (you entered ${c + w}).` });
      return { ...s, c, w, score: net(c, w, perQ, perQ * penaltyFraction) };
    });
    if (errors.length) return failMany(errors);
    const total = clean(rows.reduce((a, r) => a + r.score, 0));
    const max = 100 * perQ;
    const c = rows.reduce((a, r) => a + r.c, 0), w = rows.reduce((a, r) => a + r.w, 0);
    const acc = accuracyPct(c, w);
    return ok({
      primary: { label: "Total score", value: N(r4(total), `/ ${f(max)}`, 4) },
      secondary: [
        { label: "Questions attempted", value: N(c + w, "of 100") },
        { label: "Penalty per wrong answer", value: N(r4(perQ * penaltyFraction), "marks", 4) },
        ...(acc === null ? [] : [{ label: "Accuracy", value: P(r4(acc), 1) }]),
      ],
      table: { caption: "Score by section", columns: ["Section", "Correct", "Wrong", "Score"], rows: rows.map((r) => [r.label, r.c, r.w, r.score]) },
      steps: rows.map((r) => `${r.label}: ${r.c} × ${f(perQ)} − ${r.w} × ${f(r4(perQ * penaltyFraction))} = ${f(r4(r.score))}`),
      notes: [
        "Most banking prelims have sectional timing and sectional cut-offs as well as an overall cut-off. Those are published after each exam and are not predicted here.",
        "Change the marks per question and the penalty to match other exams with the same three-section shape — check the official notice for your exam and year.",
      ],
    });
  },

  "upsc-prelims-score-calculator": (v) => {
    const paper = str(v, "paper"); // gs | csat | both
    const gs = paper !== "csat", csat = paper !== "gs";
    const gsC = gs ? num(v, "gs_c") : 0, gsW = gs ? num(v, "gs_w") : 0, csC = csat ? num(v, "csat_c") : 0, csW = csat ? num(v, "csat_w") : 0;
    const errors: FieldError[] = [];
    if (gsC + gsW > 100) errors.push({ field: "gs_w", message: `General Studies Paper I has 100 questions; you entered ${gsC + gsW} answers.` });
    if (csC + csW > 80) errors.push({ field: "csat_w", message: `CSAT (Paper II) has 80 questions; you entered ${csC + csW} answers.` });
    if (errors.length) return failMany(errors);
    const gsScore = clean(gsC * 2 - gsW * (2 / 3));
    const csScore = clean(csC * 2.5 - csW * (2.5 / 3));
    const qualifyingMarks = 66;
    const secondary = [
      ...(gs && csat ? [{ label: "CSAT (Paper II) score", value: N(r4(csScore), "/ 200", 4) }] : []),
      ...(csat ? [{ label: "CSAT qualifying (33% = 66 marks)", value: T(csScore >= qualifyingMarks ? `Meets ${qualifyingMarks} marks` : `Below ${qualifyingMarks} marks (short by ${f(r4(qualifyingMarks - csScore))})`) }] : []),
      ...(gs ? [{ label: "Marks lost to wrong answers (Paper I)", value: N(r4(gsW * (2 / 3)), undefined, 4) }] : []),
    ];
    const primary = gs ? { label: "General Studies Paper I score", value: N(r4(gsScore), "/ 200", 4) } : { label: "CSAT (Paper II) score", value: N(r4(csScore), "/ 200", 4) };
    return ok({
      primary,
      secondary,
      steps: [
        ...(gs ? [`Paper I: ${gsC} × 2 − ${gsW} × ⅔ = ${f(r4(gsScore))}`] : []),
        ...(csat ? [`CSAT: ${csC} × 2.5 − ${csW} × 0.8333 = ${f(r4(csScore))}`] : []),
      ],
      notes: [
        "Paper I decides merit for the Mains; the cut-off is set each year after the exam and is not predicted here. CSAT is qualifying only — its marks are not added to the Paper I score.",
        "If UPSC cancels or accepts alternative answers to a question, the official marks can differ from this calculation.",
      ],
    });
  },

  "rrb-ntpc-group-d-score-calculator": (v) => {
    const exam = RRB_EXAMS[str(v, "exam")];
    if (!exam) return fail("Choose the exam and stage.", "exam");
    const c = num(v, "correct"), w = num(v, "wrong");
    if (c + w > exam.questions) return fail(`${exam.label} has ${exam.questions} questions; you entered ${c + w} answers.`, "wrong");
    const score = clean(c - w / 3);
    const acc = accuracyPct(c, w);
    return ok({
      primary: { label: "Raw score", value: N(r4(score), `/ ${exam.questions}`, 4) },
      secondary: [
        { label: "Percentage", value: P(r4((score / exam.questions) * 100), 2) },
        { label: "Marks lost to wrong answers", value: N(r4(w / 3), undefined, 4) },
        { label: "Questions attempted", value: N(c + w, `of ${exam.questions}`) },
        ...(acc === null ? [] : [{ label: "Accuracy", value: P(r4(acc), 1) }]),
      ],
      steps: [`${exam.label}: ${c} × 1 − ${w} × ⅓ = ${f(r4(score))}`],
      notes: ["Raw marks only. When a CBT runs in several shifts the Boards normalise marks, and category-wise qualifying marks are applied to the normalised score — neither is modelled here."],
    });
  },
};
