import type { EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { fail, num, ok } from "../helpers";
import { f, r4 } from "./common";

/** Fixed constants of the GATE score formula: Sq is the score given to the qualifying marks, St the score given to the top-0.1% average. */
export const GATE_SQ = 350;
export const GATE_ST = 900;

export const engines: EngineMap = {
  "gate-marks-calculator": (v) => {
    const m1c = num(v, "mcq1_c"), m1w = num(v, "mcq1_w"), m2c = num(v, "mcq2_c"), m2w = num(v, "mcq2_w"), n1 = num(v, "nat1_c"), n2 = num(v, "nat2_c");
    const gained = clean(m1c + 2 * m2c + n1 + 2 * n2);
    if (gained > 100) return fail(`Your correct answers add up to ${f(gained)} marks, but a GATE paper is out of 100. Check the counts.`, "mcq1_c");
    const lost = clean(m1w / 3 + (2 * m2w) / 3);
    const total = clean(gained - lost);
    return ok({
      primary: { label: "Raw marks", value: N(r4(total), "/ 100", 4) },
      secondary: [
        { label: "Marks gained", value: N(gained) },
        { label: "Marks lost to wrong MCQs", value: N(r4(lost), undefined, 4) },
        { label: "Multiple-choice net", value: N(r4(m1c + 2 * m2c - lost), undefined, 4) },
        { label: "MSQ / numerical marks", value: N(n1 + 2 * n2) },
      ],
      steps: [
        `Gained = ${m1c} × 1 + ${m2c} × 2 + ${n1} × 1 + ${n2} × 2 = ${f(gained)}`,
        `Lost = ${m1w} × ⅓ + ${m2w} × ⅔ = ${f(r4(lost))}`,
        `Raw marks = ${f(gained)} − ${f(r4(lost))} = ${f(r4(total))}`,
      ],
      notes: [
        "These are raw marks. For papers held in several sessions the marks are normalised before the score is computed, so normalised marks can differ from raw marks.",
        "Raw marks are not the GATE score (out of 1000). Use the GATE score calculator with the paper's published figures.",
      ],
    });
  },

  "gate-score-calculator": (v) => {
    const marks = num(v, "marks"), mq = num(v, "mq"), mt = num(v, "mt");
    if (mt <= mq) return fail("The top-0.1% average (Mt) must be higher than the qualifying marks (Mq) — otherwise the formula can't be applied. Check the figures in your paper's score notes.", "mt");
    const raw = GATE_SQ + ((GATE_ST - GATE_SQ) * (marks - mq)) / (mt - mq);
    const score = Math.min(1000, raw);
    const qualified = marks >= mq;
    return ok({
      primary: { label: "GATE score (out of 1000)", value: N(Math.round(score * 100) / 100, undefined, 2) },
      secondary: [
        { label: "Marks used", value: N(marks) },
        { label: "Status against the qualifying marks", value: T(qualified ? `Qualifying marks met (${f(marks)} ≥ ${f(mq)})` : `Below the qualifying marks (${f(marks)} < ${f(mq)})`) },
        ...(raw > 1000 ? [{ label: "Uncapped formula value", value: N(Math.round(raw * 100) / 100, undefined, 2) }] : []),
      ],
      steps: [
        `Score = Sq + (St − Sq) × (M − Mq) ÷ (Mt − Mq)`,
        `= ${GATE_SQ} + (${GATE_ST} − ${GATE_SQ}) × (${f(marks)} − ${f(mq)}) ÷ (${f(mt)} − ${f(mq)})`,
        `= ${GATE_SQ} + ${GATE_ST - GATE_SQ} × ${f(r4((marks - mq) / (mt - mq)))} = ${f(Math.round(raw * 100) / 100)}`,
      ],
      notes: [
        ...(qualified ? [] : ["Below the qualifying marks the formula gives a score under 350, and a GATE scorecard is issued to qualified candidates."]),
        ...(raw > 1000 ? ["GATE scores are reported out of 1000, so the result is capped at 1000."] : []),
        "Use the normalised marks M if your paper was held in more than one session, and the Mq and Mt published for your own paper and year. This tool estimates the score; it is not an official result.",
      ],
    });
  },
};
