import type { EngineMap } from "@/tools/types";
import { N, P, T, formatNumber } from "@/lib/format";
import { clean, round, sumExact } from "@/lib/numeric";
import { lines } from "@/lib/lists";
import { fail, fixed, num, ok, optNum, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 4 });
const pc = (n: number) => formatNumber(round(n, 2), { maxDecimals: 2 });

function usLetter(pct: number): string {
  return pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
}

export const engines: EngineMap = {
  "marks-percentage-calculator": (v) => {
    const mode = str(v, "mode");
    if (mode === "percentage") {
      const got = num(v, "obtained");
      const total = num(v, "total");
      if (total <= 0) return fail("Total marks must be greater than zero.", "total");
      if (got > total) return fail("Marks obtained can't be more than the total marks.", "obtained");
      const r = clean((got / total) * 100);
      return ok({
        primary: { label: "Percentage", value: fixed(round(r, 2), 2, "%") },
        secondary: [{ label: "Marks missed", value: N(clean(total - got)) }],
        steps: [`Percentage = marks obtained ÷ total marks × 100 = ${f(got)} ÷ ${f(total)} × 100 = ${f(r)}%`],
      });
    }
    if (mode === "marks") {
      const pct = num(v, "percentage");
      const total = num(v, "total2");
      if (total <= 0) return fail("Total marks must be greater than zero.", "total2");
      if (pct > 100) return fail("A percentage above 100 isn't possible for marks out of a total.", "percentage");
      const r = clean((pct * total) / 100);
      return ok({
        primary: { label: "Marks obtained", value: N(r, undefined, 4) },
        steps: [`Marks = percentage ÷ 100 × total = ${f(pct)} ÷ 100 × ${f(total)} = ${f(r)}`],
      });
    }
    const rows = lines(str(v, "subjects"));
    if (rows.length === 0) return fail("Enter at least one subject, like 78/100.", "subjects");
    if (rows.length > 100) return fail("Too many subjects — the limit is 100 lines.", "subjects");
    const items: { got: number; total: number }[] = [];
    for (const row of rows) {
      const m = /^(\d+(?:\.\d+)?)\s*(?:\/|,|\bout of\b|\bof\b)\s*(\d+(?:\.\d+)?)$/i.exec(row.text);
      if (!m) return fail(`Line ${row.line} ("${row.text.slice(0, 30)}") should look like 78/100 — marks obtained, a slash, then the maximum.`, "subjects");
      const [got, total] = [Number(m[1]), Number(m[2])];
      if (total <= 0) return fail(`Line ${row.line}: the maximum marks must be greater than zero.`, "subjects");
      if (got > total) return fail(`Line ${row.line}: ${f(got)} is more than the maximum of ${f(total)}.`, "subjects");
      items.push({ got, total });
    }
    const sumGot = sumExact(items.map((i) => i.got));
    const sumTotal = sumExact(items.map((i) => i.total));
    const r = clean((sumGot / sumTotal) * 100);
    return ok({
      primary: { label: "Overall percentage", value: fixed(round(r, 2), 2, "%") },
      secondary: [{ label: "Total marks obtained", value: N(sumGot) }, { label: "Total maximum marks", value: N(sumTotal) }, { label: "Subjects", value: N(items.length) }],
      table: { columns: ["Subject", "Marks", "Out of", "Percentage"], rows: items.map((i, n) => [`${n + 1}`, N(i.got), N(i.total), P(round((i.got / i.total) * 100, 2), 2)]) },
      steps: [`Overall % = total obtained ÷ total maximum × 100 = ${f(sumGot)} ÷ ${f(sumTotal)} × 100 = ${f(r)}%`],
      notes: ["Each subject counts in proportion to its maximum marks, which is how most boards and universities total marks."],
    });
  },

  "attendance-percentage-calculator": (v) => {
    const attended = num(v, "attended");
    const total = num(v, "total");
    const target = num(v, "target");
    if (total < 1) return fail("Total classes must be at least 1.", "total");
    if (attended > total) return fail("Classes attended can't be more than the total classes held.", "attended");
    const r = clean((attended / total) * 100);
    const meets = r >= target;
    return ok({
      primary: { label: "Attendance", value: fixed(round(r, 2), 2, "%") },
      secondary: [
        { label: `Against the ${f(target)}% requirement`, value: T(meets ? "Meets the requirement" : `Short by ${formatNumber(round(target - r, 2))} percentage points`) },
        { label: "Classes missed", value: N(total - attended) },
      ],
      steps: [`Attendance = attended ÷ held × 100 = ${f(attended)} ÷ ${f(total)} × 100 = ${f(r)}%`],
      notes: ["Some institutions round attendance up or exclude approved leave. Use the Required Attendance Calculator to plan how many classes you can still miss."],
    });
  },

  "required-attendance-calculator": (v) => {
    const target = num(v, "target");
    const held = num(v, "held");
    const attended = num(v, "attended");
    const left = optNum(v, "left");
    if (held < 1) return fail("Classes held so far must be at least 1.", "held");
    if (attended > held) return fail("Classes attended can't be more than the classes held.", "attended");
    if (target <= 0 || target > 100) return fail("The required attendance must be between 0 and 100%.", "target");
    const current = clean((attended / held) * 100);
    const notes: string[] = [];
    if (current >= target) {
      const canMiss = Math.max(0, Math.floor(clean((100 * attended) / target - held)));
      const secondary = [{ label: "Current attendance", value: P(round(current, 2), 2) }];
      if (left !== undefined) secondary.push({ label: "Classes you must still attend (of those left)", value: P(0) });
      return ok({
        primary: { label: "Classes you can still miss", value: N(canMiss) },
        secondary,
        steps: [`You need attended ÷ (held + more) ≥ ${f(target)}%`, `Maximum total classes = attended × 100 ÷ target = ${f(attended)} × 100 ÷ ${f(target)} = ${f(clean((100 * attended) / target))}`, `So you can miss ⌊${f(clean((100 * attended) / target))} − ${f(held)}⌋ = ${canMiss} more classes if you attend none of the extra ones`],
        notes: ["This counts missed classes added to the total. If the term has a fixed number of classes left, you can miss fewer than shown only if you attend the rest."],
      });
    }
    if (target === 100) return fail("100% attendance can't be reached once a class has been missed.", "target");
    const need = Math.ceil(clean((target * held - 100 * attended) / (100 - target)));
    if (left !== undefined && need > left) notes.push(`You'd need ${need} more classes in a row but only ${f(left)} are left, so ${f(target)}% isn't reachable this term.`);
    return ok({
      primary: { label: "Classes to attend in a row", value: N(need) },
      secondary: [
        { label: "Current attendance", value: P(round(current, 2), 2) },
        { label: "Attendance after those classes", value: P(round(((attended + need) / (held + need)) * 100, 2), 2) },
      ],
      steps: [`Solve (attended + x) ÷ (held + x) ≥ ${f(target)}% for x`, `x ≥ (${f(target)} × ${f(held)} − 100 × ${f(attended)}) ÷ (100 − ${f(target)}) = ${f(clean((target * held - 100 * attended) / (100 - target)))}`, `Round up to the next whole class → ${need}`],
      notes,
    });
  },

  "exam-score-calculator": (v) => {
    const total = num(v, "total");
    const correct = num(v, "correct");
    const wrong = num(v, "wrong");
    const plus = num(v, "plus");
    const minus = num(v, "minus");
    if (correct + wrong > total) return fail(`Correct (${f(correct)}) plus wrong (${f(wrong)}) is more than the ${f(total)} questions in the paper.`, "wrong");
    const net = clean(correct * plus - wrong * minus);
    const max = clean(total * plus);
    const attempted = correct + wrong;
    return ok({
      primary: { label: "Net score", value: N(net, undefined, 4) },
      secondary: [
        { label: "Maximum marks", value: N(max) },
        { label: "Score as a percentage", value: P(round((net / max) * 100, 2), 2) },
        { label: "Accuracy (correct ÷ attempted)", value: attempted === 0 ? T("—") : P(round((correct / attempted) * 100, 2), 2) },
        { label: "Unattempted", value: N(total - attempted) },
        { label: "Marks lost to negative marking", value: N(clean(wrong * minus)) },
      ],
      steps: [`Net score = correct × ${f(plus)} − wrong × ${f(minus)} = ${f(correct * plus)} − ${f(clean(wrong * minus))} = ${f(net)}`],
      notes: net < 0 ? ["Negative net score: the penalty for wrong answers is larger than the marks earned."] : [],
    });
  },

  "required-marks-calculator": (v) => {
    const target = num(v, "target");
    const current = num(v, "current");
    const done = num(v, "done");
    const maxMarks = optNum(v, "max");
    if (done >= 100) return fail("100% of the grade is already complete, so there is nothing left to score.", "done");
    const need = clean(((target - (current * done) / 100) / (100 - done)) * 100);
    const notes: string[] = [];
    if (need > 100) notes.push("That's above 100%, so the target isn't reachable with the remaining work alone (unless extra credit exists).");
    if (need <= 0) notes.push("You've already secured this target — even a score of 0% on the remaining work is enough.");
    const secondary = [{ label: "Points already banked", value: P(round((current * done) / 100, 2), 2) }];
    if (maxMarks !== undefined && need > 0) secondary.push({ label: `Marks needed out of ${f(maxMarks)}`, value: N(round((need / 100) * maxMarks, 2)) });
    return ok({
      primary: { label: "Score needed on the remaining work", value: P(round(Math.max(need, 0), 2), 2) },
      secondary,
      steps: [`Banked = ${f(current)}% × ${f(done)}% weight = ${f(clean((current * done) / 100))} points`, `Needed on the remaining ${f(clean(100 - done))}% = (${f(target)} − ${f(clean((current * done) / 100))}) ÷ ${f(clean(100 - done))} × 100 = ${f(need)}%`],
      notes,
    });
  },

  "weighted-marks-calculator": (v) => {
    const rows = lines(str(v, "items"));
    if (rows.length === 0) return fail("Enter at least one line: score, maximum, weight.", "items");
    if (rows.length > 100) return fail("Too many lines — the limit is 100.", "items");
    const items: { score: number; max: number; weight: number }[] = [];
    for (const row of rows) {
      const tokens = row.text.split(/[\s,;]+/).filter(Boolean).map(Number);
      if (tokens.length !== 3 || tokens.some((x) => !Number.isFinite(x))) {
        return fail(`Line ${row.line} ("${row.text.slice(0, 30)}") needs three numbers: score, maximum score, weight % — for example 42, 50, 30.`, "items");
      }
      const [score, max, weight] = tokens;
      if (max <= 0) return fail(`Line ${row.line}: the maximum score must be greater than zero.`, "items");
      if (score < 0 || weight < 0) return fail(`Line ${row.line}: scores and weights can't be negative.`, "items");
      if (score > max) return fail(`Line ${row.line}: the score ${f(score)} is more than the maximum ${f(max)}.`, "items");
      items.push({ score, max, weight });
    }
    const totalWeight = sumExact(items.map((i) => i.weight));
    if (totalWeight === 0) return fail("The weights add up to zero. Give at least one item a weight above 0.", "items");
    const result = clean(items.reduce((s, i) => s + (i.score / i.max) * i.weight, 0) / totalWeight * 100);
    const notes = totalWeight !== 100 ? [`The weights add up to ${f(totalWeight)}%, not 100%. The result is scaled to the weight you entered.`] : [];
    notes.push("The letter grade uses the common US cut-offs (90/80/70/60). Your institution may use different ones.");
    return ok({
      primary: { label: "Weighted percentage", value: fixed(round(result, 2), 2, "%") },
      secondary: [{ label: "Letter grade (US 90/80/70/60 scale)", value: T(usLetter(result)) }, { label: "Total weight entered", value: P(totalWeight) }],
      table: { columns: ["Score", "Out of", "Weight", "Contribution"], rows: items.map((i) => [N(i.score), N(i.max), P(i.weight), P(round(((i.score / i.max) * i.weight * 100) / totalWeight, 3), 3)]) },
      steps: [`Each item: score ÷ maximum × weight. Added together and divided by the total weight: ${pc(result)}%`],
      notes,
    });
  },
};
