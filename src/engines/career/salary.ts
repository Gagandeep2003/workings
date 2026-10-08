import type { EngineMap } from "@/tools/types";
import { M, N, P, T, formatNumber } from "@/lib/format";
import { clean, roundMoney } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const money = (x: number, c: string) => M(roundMoney(x), c || undefined);
const f2 = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });
const pc = (x: number) => formatNumber(x, { maxDecimals: 2 });

export const engines: EngineMap = {
  "salary-increment-calculator": (v) => {
    const c = str(v, "currency");
    const period = str(v, "period");
    const salary = num(v, "salary");
    const pct = num(v, "pct");
    const years = optNum(v, "years") ?? 1;
    const label = period === "monthly" ? "month" : "year";
    const factor = 1 + pct / 100;
    const newSalary = roundMoney(salary * factor);
    const annual = (x: number) => (period === "monthly" ? x * 12 : x);
    const rows: (string | number | ReturnType<typeof M>)[][] = [];
    let current = salary;
    for (let y = 1; y <= years; y++) {
      const next = current * factor;
      rows.push([`After ${y} year${y > 1 ? "s" : ""}`, money(next, c), money(next - current, c), money(next / (period === "monthly" ? 1 : 12), c)]);
      current = next;
    }
    return ok({
      primary: { label: `New salary per ${label}`, value: money(newSalary, c) },
      secondary: [
        { label: `Increase per ${label}`, value: money(newSalary - salary, c) },
        { label: "New annual salary", value: money(annual(newSalary), c) },
        { label: "New monthly salary", value: money(period === "monthly" ? newSalary : newSalary / 12, c) },
      ],
      ...(years > 1 ? { table: { caption: "If you receive the same increment every year", columns: ["When", `Salary per ${label}`, "Increase that year", "Monthly equivalent"], rows } } : {}),
      steps: [`New salary = ${f2(salary)} × (1 + ${pc(pct)} ÷ 100) = ${f2(salary)} × ${formatNumber(clean(factor), { maxDecimals: 6 })} = ${f2(newSalary)}`],
      notes: ["Increment % is applied to the figure you entered. If your increment applies only to basic pay, enter the basic pay instead of the total."],
    });
  },

  "salary-hike-percentage-calculator": (v) => {
    const c = str(v, "currency");
    const old = num(v, "old");
    const next = num(v, "new");
    if (old === 0) return fail("The current salary can't be zero — a hike is measured against what you earn now.", "old");
    const pct = clean(((next - old) / old) * 100);
    const kind = pct > 0 ? "Hike" : pct < 0 ? "Reduction" : "No change";
    return ok({
      primary: { label: pct < 0 ? "Salary reduction" : "Salary hike", value: P(Math.abs(pct), 4) },
      secondary: [
        { label: "Result", value: T(kind) },
        { label: "Difference", value: money(next - old, c) },
        { label: "Difference per month (if annual figures)", value: money((next - old) / 12, c) },
        { label: "New salary as a multiple of the old", value: N(clean(next / old), undefined, 4) },
      ],
      steps: [`Hike % = (new − old) ÷ old × 100 = (${f2(next)} − ${f2(old)}) ÷ ${f2(old)} × 100 = ${formatNumber(pct, { maxDecimals: 4 })}%`],
      notes: ["Compare like with like — both figures should be annual CTC, or both monthly in-hand. Comparing CTC with take-home gives a misleading hike."],
    });
  },

  "salary-comparison-calculator": (v) => {
    const c = str(v, "currency");
    const mult = str(v, "period") === "monthly" ? 12 : 1;
    const total = (p: string) => (num(v, `${p}base`) + (optNum(v, `${p}bonus`) ?? 0) + (optNum(v, `${p}other`) ?? 0)) * mult;
    const a = total("a");
    const b = total("b");
    const diff = roundMoney(b - a);
    const winner = diff > 0 ? "Offer B" : diff < 0 ? "Offer A" : "Both offers";
    const pct = a === 0 ? undefined : clean((Math.abs(b - a) / Math.min(a, b || a)) * 100);
    return ok({
      primary: { label: diff === 0 ? "The offers are equal" : `${winner} pays more`, value: money(Math.abs(diff), c) },
      secondary: [
        { label: "Per year", value: money(Math.abs(diff), c) },
        { label: "Per month", value: money(Math.abs(diff) / 12, c) },
        ...(pct !== undefined && diff !== 0 && Math.min(a, b) > 0 ? [{ label: "How much more (relative to the lower offer)", value: P(pct, 2) }] : []),
      ],
      table: {
        columns: ["", "Offer A", "Offer B"],
        rows: [
          ["Base pay (annual)", money(num(v, "abase") * mult, c), money(num(v, "bbase") * mult, c)],
          ["Bonus (annual)", money((optNum(v, "abonus") ?? 0) * mult, c), money((optNum(v, "bbonus") ?? 0) * mult, c)],
          ["Other (annual)", money((optNum(v, "aother") ?? 0) * mult, c), money((optNum(v, "bother") ?? 0) * mult, c)],
          ["Total per year", money(a, c), money(b, c)],
          ["Total per month", money(a / 12, c), money(b / 12, c)],
        ],
      },
      steps: [`Offer A = ${f2(a)} per year; Offer B = ${f2(b)} per year`, `Difference = |${f2(b)} − ${f2(a)}| = ${f2(Math.abs(diff))}`],
      notes: ["Gross figures only. Taxes, benefits, commute, growth and job security can matter more than a small pay gap."],
    });
  },

  "hourly-to-salary-calculator": (v) => {
    const c = str(v, "currency");
    const hours = num(v, "hours");
    const weeks = num(v, "weeks");
    const off = optNum(v, "off") ?? 0;
    if (hours > 168) return fail("There are only 168 hours in a week.", "hours");
    if (off >= weeks) return fail("Unpaid weeks off must be fewer than the weeks you work per year.", "off");
    const paidWeeks = weeks - off;
    const perYearHours = hours * paidWeeks;
    let hourly: number;
    let annual: number;
    if (str(v, "mode") === "hourly") {
      hourly = num(v, "rate");
      annual = hourly * perYearHours;
    } else {
      annual = num(v, "annual");
      hourly = annual / perYearHours;
    }
    return ok({
      primary: str(v, "mode") === "hourly" ? { label: "Annual pay", value: money(annual, c) } : { label: "Hourly rate", value: money(hourly, c) },
      secondary: [
        ...(str(v, "mode") === "hourly" ? [] : []),
        { label: "Hourly", value: money(hourly, c) },
        { label: "Daily (5-day week)", value: money((hourly * hours) / 5, c) },
        { label: "Weekly", value: money(hourly * hours, c) },
        { label: "Every two weeks", value: money(hourly * hours * 2, c) },
        { label: "Monthly (annual ÷ 12)", value: money(annual / 12, c) },
        { label: "Annual", value: money(annual, c) },
      ].filter((s, i, arr) => arr.findIndex((x) => x.label === s.label) === i && s.label !== (str(v, "mode") === "hourly" ? "Annual" : "Hourly")),
      steps: [`Paid hours per year = ${formatNumber(hours)} hours × ${formatNumber(paidWeeks)} paid weeks = ${formatNumber(perYearHours)}`, str(v, "mode") === "hourly" ? `Annual = ${f2(hourly)} × ${formatNumber(perYearHours)} = ${f2(annual)}` : `Hourly = ${f2(annual)} ÷ ${formatNumber(perYearHours)} = ${f2(hourly)}`],
      notes: ["Gross pay before tax and deductions. Paid holidays count as paid weeks — only enter weeks that are genuinely unpaid as 'weeks off'."],
    });
  },
};
