import type { EngineMap, Values } from "@/tools/types";
import { N, P, formatNumber } from "@/lib/format";
import { clean, round, sumExact } from "@/lib/numeric";
import { lines, parseNumberList } from "@/lib/lists";
import { fail, fixed, num, ok, optNum, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 4 });

export const GPA_LETTERS = (aPlus: number): Record<string, number> => ({
  "A+": aPlus, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, "D-": 0.7, F: 0,
});
export const SGPA_LETTERS: Record<string, number> = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, P: 4, F: 0 };

type CourseRow = { label: string; points: number; credits: number };

function readCourses(text: string, letters: Record<string, number>, maxPoints: number, field: string): CourseRow[] | { error: string; field: string } {
  const rows = lines(text);
  if (rows.length === 0) return { error: "Enter at least one course on its own line, like  A, 3  (grade, credits).", field };
  if (rows.length > 100) return { error: "Too many courses — the limit is 100 lines.", field };
  const out: CourseRow[] = [];
  for (const row of rows) {
    const tokens = row.text.split(/[\s,;]+/).filter(Boolean);
    if (tokens.length !== 2) return { error: `Line ${row.line} ("${row.text.slice(0, 30)}") needs two parts: a grade and the credits, for example  A, 3.`, field };
    const [gradeText, creditText] = tokens;
    const upper = gradeText.toUpperCase();
    let points: number;
    if (upper in letters) points = letters[upper];
    else if (/^\d+(\.\d+)?$/.test(gradeText)) points = Number(gradeText);
    else return { error: `Line ${row.line}: "${gradeText}" isn't a grade I know. Use ${Object.keys(letters).join(", ")} or a number from 0 to ${maxPoints}.`, field };
    if (points > maxPoints) return { error: `Line ${row.line}: grade points ${f(points)} are above the maximum of ${maxPoints} for this scale.`, field };
    if (!/^\d+(\.\d+)?$/.test(creditText) || Number(creditText) <= 0) return { error: `Line ${row.line}: credits must be a number greater than zero (you wrote "${creditText}").`, field };
    out.push({ label: gradeText.toUpperCase(), points, credits: Number(creditText) });
  }
  return out;
}

function percentFromCgpa(method: string, cgpa: number, v: Values): { pct: number; formula: string } {
  if (method === "cbse") return { pct: clean(cgpa * 9.5), formula: `${f(cgpa)} × 9.5` };
  if (method === "x10") return { pct: clean(cgpa * 10), formula: `${f(cgpa)} × 10` };
  const mult = optNum(v, "multiplier") ?? 10;
  const offset = optNum(v, "offset") ?? 0;
  return { pct: clean((cgpa - offset) * mult), formula: `(${f(cgpa)} − ${f(offset)}) × ${f(mult)}` };
}

export const engines: EngineMap = {
  "cgpa-calculator": (v) => {
    const scale = Number(str(v, "scale"));
    const parsed = parseNumberList(str(v, "sgpas"), { min: 1, max: 20, label: "semester grades" });
    if (!parsed.ok) return fail(parsed.message, "sgpas");
    const sg = parsed.values;
    const bad = sg.findIndex((x) => x < 0 || x > scale);
    if (bad >= 0) return fail(`Semester ${bad + 1} (${f(sg[bad])}) must be between 0 and ${scale} on this scale.`, "sgpas");
    const creditText = str(v, "credits").trim();
    const simple = clean(sumExact(sg) / sg.length);
    let weighted: number | undefined;
    if (creditText) {
      const c = parseNumberList(creditText, { label: "credit values", positive: true });
      if (!c.ok) return fail(c.message, "credits");
      if (c.values.length !== sg.length) return fail(`You entered ${sg.length} semester grade${sg.length === 1 ? "" : "s"} but ${c.values.length} credit value${c.values.length === 1 ? "" : "s"} — they need to match one-to-one.`, "credits");
      weighted = clean(sg.reduce((s, x, i) => s + x * c.values[i], 0) / sumExact(c.values));
    }
    const main = weighted ?? simple;
    return ok({
      primary: { label: "CGPA", value: fixed(round(main, 2), 2) },
      secondary: weighted !== undefined
        ? [{ label: "Simple average of the semester grades", value: fixed(round(simple, 2), 2) }, { label: "Semesters counted", value: N(sg.length) }]
        : [{ label: "Semesters counted", value: N(sg.length) }, { label: "Highest semester", value: fixed(Math.max(...sg), 2) }, { label: "Lowest semester", value: fixed(Math.min(...sg), 2) }],
      steps: weighted !== undefined ? ["CGPA = Σ(semester grade × semester credits) ÷ Σ(credits)"] : [`CGPA = (${sg.map(f).join(" + ")}) ÷ ${sg.length} = ${f(simple)}`],
      notes: weighted === undefined ? ["This is a simple average of semester grades. If your semesters carry different credits, add them below for the credit-weighted CGPA that most universities report."] : [],
    });
  },

  "cgpa-to-percentage-calculator": (v) => {
    const cgpa = num(v, "cgpa");
    if (cgpa > 10) return fail("CGPA can't be more than 10 on a 10-point scale. For a 4.0 scale use the GPA Calculator.", "cgpa");
    const method = str(v, "method");
    if (method === "custom" && optNum(v, "multiplier") === undefined) return fail("Enter the multiplier from your institution's formula.", "multiplier");
    const { pct, formula } = percentFromCgpa(method, cgpa, v);
    const notes = ["Conversion formulas are set by each board or university and they differ. This tool shows the arithmetic; your institution's formula (or certificate) is what counts."];
    if (pct > 100) notes.unshift("That's above 100%, so the formula you entered can't be right for this CGPA.");
    if (pct < 0) notes.unshift("That's below 0%, so the offset or multiplier you entered doesn't suit this CGPA.");
    return ok({
      primary: { label: "Percentage", value: fixed(round(pct, 2), 2, "%") },
      table: {
        caption: "The same CGPA under common rules of thumb",
        columns: ["Rule", "Percentage"],
        rows: [["CBSE: CGPA × 9.5", P(round(cgpa * 9.5, 2), 2)], ["Simple: CGPA × 10", P(round(cgpa * 10, 2), 2)]],
      },
      steps: [`Percentage = ${formula} = ${f(pct)}%`],
      notes,
    });
  },

  "percentage-to-cgpa-calculator": (v) => {
    const pct = num(v, "percentage");
    if (pct > 100) return fail("A percentage can't be more than 100.", "percentage");
    const method = str(v, "method");
    let cgpa: number;
    let formula: string;
    if (method === "cbse") {
      cgpa = clean(pct / 9.5);
      formula = `${f(pct)} ÷ 9.5`;
    } else if (method === "x10") {
      cgpa = clean(pct / 10);
      formula = `${f(pct)} ÷ 10`;
    } else {
      const mult = optNum(v, "multiplier");
      if (mult === undefined || mult === 0) return fail("Enter a non-zero multiplier from your institution's formula.", "multiplier");
      const offset = optNum(v, "offset") ?? 0;
      cgpa = clean(pct / mult + offset);
      formula = `${f(pct)} ÷ ${f(mult)} + ${f(offset)}`;
    }
    return ok({
      primary: { label: "CGPA (10-point scale)", value: fixed(round(cgpa, 2), 2) },
      steps: [`CGPA = ${formula} = ${f(cgpa)}`],
      notes: [...(cgpa > 10 ? ["That's above 10, so the formula doesn't fit this percentage."] : []), "Only your institution's own conversion rule is official. This is the reverse of the percentage rule you pick."],
    });
  },

  "gpa-calculator": (v) => {
    const aPlus = Number(str(v, "aplus") || 4);
    const parsed = readCourses(str(v, "courses"), GPA_LETTERS(aPlus), 4.3, "courses");
    if ("error" in parsed) return fail(parsed.error, parsed.field);
    const credits = sumExact(parsed.map((c) => c.credits));
    const quality = clean(parsed.reduce((s, c) => s + c.points * c.credits, 0));
    const gpa = clean(quality / credits);
    const priorGpa = optNum(v, "priorGpa");
    const priorCredits = optNum(v, "priorCredits");
    const secondary = [{ label: "Credits this term", value: N(credits) }, { label: "Quality points", value: N(round(quality, 3)) }];
    const notes: string[] = [];
    if ((priorGpa === undefined) !== (priorCredits === undefined)) notes.push("Enter both a previous GPA and previous credits to get a cumulative GPA.");
    if (priorGpa !== undefined && priorCredits !== undefined) {
      if (priorGpa > 4.3) return fail("Previous GPA can't be above 4.3.", "priorGpa");
      const cumulative = clean((priorGpa * priorCredits + quality) / (priorCredits + credits));
      secondary.unshift({ label: "Cumulative GPA (with previous credits)", value: fixed(round(cumulative, 2), 2) });
    }
    return ok({
      primary: { label: "GPA", value: fixed(round(gpa, 2), 2) },
      secondary,
      table: { columns: ["Grade", "Grade points", "Credits", "Quality points"], rows: parsed.map((c) => [c.label, fixed(c.points, 1), N(c.credits), N(round(c.points * c.credits, 3))]) },
      steps: [`GPA = Σ(grade points × credits) ÷ Σ(credits) = ${f(round(quality, 3))} ÷ ${f(credits)} = ${f(gpa)}`],
      notes: [...notes, "Plus/minus values follow the common US 4.0 scale. Some schools differ (for example A+ = 4.3 or no D−); check your registrar."],
    });
  },

  "sgpa-calculator": (v) => {
    const parsed = readCourses(str(v, "courses"), SGPA_LETTERS, 10, "courses");
    if ("error" in parsed) return fail(parsed.error, parsed.field);
    const credits = sumExact(parsed.map((c) => c.credits));
    const points = clean(parsed.reduce((s, c) => s + c.points * c.credits, 0));
    const sgpa = clean(points / credits);
    return ok({
      primary: { label: "SGPA", value: fixed(round(sgpa, 2), 2) },
      secondary: [{ label: "Total credits", value: N(credits) }, { label: "Credit points earned", value: N(round(points, 3)) }],
      table: { columns: ["Grade", "Grade point", "Credits", "Credit points"], rows: parsed.map((c) => [c.label, N(c.points), N(c.credits), N(round(c.points * c.credits, 3))]) },
      steps: [`SGPA = Σ(grade point × credits) ÷ Σ(credits) = ${f(round(points, 3))} ÷ ${f(credits)} = ${f(sgpa)}`],
      notes: ["Letter grades use a common 10-point mapping (O = 10, A+ = 9, A = 8, B+ = 7, B = 6, C = 5, P = 4, F = 0). Universities vary — type the grade points from your marksheet as numbers if yours differ."],
    });
  },
};

