import type { EngineMap } from "@/tools/types";
import { N, P, T } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { lines, parseNumberList } from "@/lib/lists";
import { fail, num, ok, str } from "../helpers";
import { f, r4 } from "./common";

export const engines: EngineMap = {
  "target-score-planner": (v) => {
    const target = num(v, "target"), attempts = num(v, "attempts"), m = num(v, "marks_correct"), p = num(v, "penalty");
    if (m <= 0) return fail("Marks per correct answer must be greater than zero.", "marks_correct");
    if (attempts < 1) return fail("Enter how many questions you plan to attempt (at least 1).", "attempts");
    const maxScore = attempts * m;
    if (target > maxScore) return fail(`Attempting ${f(attempts)} questions can give at most ${f(maxScore)} marks, so ${f(target)} is out of reach. Plan to attempt more questions or lower the target.`, "target");
    // c·m − (a − c)·p ≥ T  →  c ≥ (T + a·p) / (m + p)
    const needed = Math.max(0, Math.ceil((target + attempts * p) / (m + p) - 1e-9));
    const wrong = attempts - needed;
    const achieved = clean(needed * m - wrong * p);
    const accuracy = (needed / attempts) * 100;
    const breakEven = p === 0 ? 0 : (p / (m + p)) * 100;
    return ok({
      primary: { label: "Correct answers needed", value: N(needed, `of ${f(attempts)} attempted`) },
      secondary: [
        { label: "Accuracy needed", value: P(r4(accuracy), 1) },
        { label: "Wrong answers you can afford", value: N(wrong) },
        { label: "Score at that accuracy", value: N(r4(achieved), undefined, 4) },
        { label: "Guessing breaks even at", value: P(r4(breakEven), 1), hint: "Above this chance of being right, an educated guess has a positive expected value; below it, it costs marks on average." },
      ],
      steps: [
        `Need c × ${f(m)} − (${f(attempts)} − c) × ${f(p)} ≥ ${f(target)}`,
        `c ≥ (${f(target)} + ${f(attempts)} × ${f(p)}) ÷ (${f(m)} + ${f(p)}) = ${f(r4((target + attempts * p) / (m + p)))}  →  ${f(needed)}`,
      ],
      notes: ["This assumes every attempted question is either right or wrong at the marks you entered, and that you skip the rest. It does not predict how hard a paper will be."],
    });
  },

  "mock-test-tracker": (v) => {
    const rows = lines(str(v, "tests"));
    if (rows.length < 1) return fail("Add at least one mock test, one per line, like: Mock 1, 124, 200", "tests");
    if (rows.length > 500) return fail("That's more than 500 tests — please trim the list.", "tests");
    const tests: { name: string; score: number; max: number; pct: number }[] = [];
    for (const row of rows) {
      const parts = row.text.split(",").map((x) => x.trim());
      if (parts.length < 3) return fail(`Line ${row.line} needs a name, your score and the maximum marks, separated by commas — for example "Mock 4, 132, 200".`, "tests");
      const max = parseNumberList(parts[parts.length - 1], { min: 1, max: 1, label: "maximum marks" });
      const score = parseNumberList(parts[parts.length - 2], { min: 1, max: 1, label: "score" });
      if (!score.ok) return fail(`Line ${row.line}: ${score.message}`, "tests");
      if (!max.ok) return fail(`Line ${row.line}: ${max.message}`, "tests");
      const name = parts.slice(0, -2).join(", ") || `Test ${tests.length + 1}`;
      if (max.values[0] <= 0) return fail(`Line ${row.line}: maximum marks must be greater than zero.`, "tests");
      if (score.values[0] > max.values[0]) return fail(`Line ${row.line}: the score (${f(score.values[0])}) is higher than the maximum marks (${f(max.values[0])}).`, "tests");
      tests.push({ name, score: score.values[0], max: max.values[0], pct: (score.values[0] / max.values[0]) * 100 });
    }
    const n = tests.length;
    const avg = tests.reduce((a, t) => a + t.pct, 0) / n;
    const best = tests.reduce((a, t) => (t.pct > a.pct ? t : a));
    const worst = tests.reduce((a, t) => (t.pct < a.pct ? t : a));
    // least-squares slope of percentage against test order
    let slope: number | null = null;
    if (n >= 3) {
      const xm = (n - 1) / 2;
      const num_ = tests.reduce((a, t, i) => a + (i - xm) * (t.pct - avg), 0);
      const den = tests.reduce((a, _t, i) => a + (i - xm) ** 2, 0);
      slope = num_ / den;
    }
    const last3 = tests.slice(-3);
    const recent = last3.reduce((a, t) => a + t.pct, 0) / last3.length;
    return ok({
      primary: { label: "Average score", value: P(r4(avg), 1) },
      secondary: [
        { label: "Tests logged", value: N(n) },
        { label: "Best", value: T(`${best.name} — ${f(r4(best.pct))}%`) },
        { label: "Lowest", value: T(`${worst.name} — ${f(r4(worst.pct))}%`) },
        ...(n >= 2 ? [{ label: `Average of the latest ${last3.length}`, value: P(r4(recent), 1) }] : []),
        ...(slope !== null ? [{ label: "Trend across tests", value: T(`${slope >= 0 ? "+" : "−"}${f(r4(Math.abs(slope)))} percentage points per test`), hint: "A straight-line fit through your results in the order entered. With few tests it is only a rough guide." }] : []),
      ],
      table: { caption: "Your tests", columns: ["Test", "Score", "Out of", "Percentage", "vs your average"], rows: tests.map((t) => [t.name, t.score, t.max, P(r4(t.pct), 1), T(`${t.pct - avg >= 0 ? "+" : "−"}${f(r4(Math.abs(t.pct - avg)))}`)]) },
      steps: [`Average = mean of each test's score ÷ maximum marks × 100 = ${f(r4(avg))}%`],
      notes: ["Everything is calculated in your browser and kept only on this device. Tests are listed in the order you typed them, so put the oldest first for the trend to make sense."],
    });
  },
};
