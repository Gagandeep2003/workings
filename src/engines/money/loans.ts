import type { EngineMap, ToolOutput } from "@/tools/types";
import { M, N, P, T, formatNumber } from "@/lib/format";
import { clean, fromMinor, round, roundMoney, toMinor } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const f2 = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });

/** Level monthly instalment in whole minor units (cents/paise), rounded half-up. */
export function emiMinor(principalMinor: number, annualPct: number, months: number): number {
  if (annualPct === 0) return Math.round(principalMinor / months);
  const r = annualPct / 1200;
  const growth = Math.pow(1 + r, months);
  return Math.round((principalMinor * r * growth) / (growth - 1));
}

export type ScheduleRow = { month: number; payment: number; interest: number; principal: number; balance: number };

/** Month-by-month schedule in integer minor units. The final payment clears whatever balance remains. */
export function buildSchedule(principalMinor: number, annualPct: number, months: number, paymentMinor: number, extraMinor = 0): ScheduleRow[] {
  const r = annualPct / 1200;
  const rows: ScheduleRow[] = [];
  let balance = principalMinor;
  for (let m = 1; m <= months && balance > 0; m++) {
    const interest = Math.round(balance * r);
    let payment = paymentMinor + extraMinor;
    if (m === months || payment >= balance + interest) payment = balance + interest;
    const principal = payment - interest;
    balance -= principal;
    rows.push({ month: m, payment, interest, principal, balance });
  }
  return rows;
}

const tenureMonths = (v: Parameters<typeof num>[0], idValue = "tenure", idUnit = "tenureUnit") =>
  num(v, idValue) * (str(v, idUnit) === "years" ? 12 : 1);

function checkTenure(months: number): string | null {
  if (!Number.isInteger(months)) return "Tenure must work out to a whole number of months (for example 2.5 years = 30 months).";
  if (months < 1) return "Tenure must be at least 1 month.";
  if (months > 600) return "Tenure can't be more than 50 years (600 months).";
  return null;
}

function yearlyTable(rows: ScheduleRow[], c: string): NonNullable<ToolOutput["table"]> {
  const years = new Map<number, { interest: number; principal: number; balance: number }>();
  for (const r of rows) {
    const y = Math.ceil(r.month / 12);
    const cur = years.get(y) ?? { interest: 0, principal: 0, balance: 0 };
    cur.interest += r.interest;
    cur.principal += r.principal;
    cur.balance = r.balance;
    years.set(y, cur);
  }
  return {
    caption: "Year-by-year breakdown",
    columns: ["Year", "Principal repaid", "Interest paid", "Balance at year end"],
    rows: [...years].map(([y, r]) => [`Year ${y}`, M(fromMinor(r.principal), c || undefined), M(fromMinor(r.interest), c || undefined), M(fromMinor(r.balance), c || undefined)]),
    maxHeight: true,
  };
}

export const engines: EngineMap = {
  "emi-calculator": (v) => {
    const c = str(v, "currency");
    const principal = num(v, "principal");
    const rate = num(v, "rate");
    const months = tenureMonths(v);
    const bad = checkTenure(months);
    if (bad) return fail(bad, "tenure");
    if (principal < 1) return fail("The loan amount must be at least 1.", "principal");
    const pMinor = toMinor(principal);
    const emi = emiMinor(pMinor, rate, months);
    const totalMinor = emi * months;
    const interestMinor = totalMinor - pMinor;
    const schedule = buildSchedule(pMinor, rate, months, emi);
    const r = rate / 1200;
    return ok({
      primary: { label: "Monthly EMI", value: M(fromMinor(emi), c || undefined) },
      secondary: [
        { label: "Total interest", value: M(fromMinor(interestMinor), c || undefined) },
        { label: "Total amount payable", value: M(fromMinor(totalMinor), c || undefined) },
        { label: "Interest as a share of total", value: P(clean((interestMinor / totalMinor) * 100), 1) },
        { label: "Number of instalments", value: N(months) },
      ],
      table: yearlyTable(schedule, c),
      steps: rate === 0
        ? [`With 0% interest, EMI = principal ÷ months = ${f2(principal)} ÷ ${months} = ${f2(fromMinor(emi))}`]
        : [`Monthly rate r = ${formatNumber(rate, { maxDecimals: 4 })}% ÷ 12 = ${formatNumber(clean(r * 100), { maxDecimals: 6 })}%`, `EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1) with P = ${f2(principal)}, n = ${months}`, `Total payable = EMI × n = ${f2(fromMinor(emi))} × ${months} = ${f2(fromMinor(totalMinor))}`],
      notes: ["Reducing-balance method with monthly compounding. Lenders round differently and usually adjust the last instalment by a few paise, so your sanction letter can differ slightly. Processing fees and insurance are not included."],
    });
  },

  "amortization-schedule-calculator": (v) => {
    const c = str(v, "currency");
    const principal = num(v, "principal");
    const rate = num(v, "rate");
    const months = tenureMonths(v);
    const extra = optNum(v, "extra") ?? 0;
    const bad = checkTenure(months);
    if (bad) return fail(bad, "tenure");
    if (principal < 1) return fail("The loan amount must be at least 1.", "principal");
    const pMinor = toMinor(principal);
    const emi = emiMinor(pMinor, rate, months);
    const base = buildSchedule(pMinor, rate, months, emi);
    const actual = extra > 0 ? buildSchedule(pMinor, rate, months, emi, toMinor(extra)) : base;
    const sum = (rows: ScheduleRow[], k: "interest" | "payment") => rows.reduce((s, r) => s + r[k], 0);
    const interest = sum(actual, "interest");
    const saved = sum(base, "interest") - interest;
    const monthsSaved = base.length - actual.length;
    return ok({
      primary: { label: "Total interest", value: M(fromMinor(interest), c || undefined) },
      secondary: [
        { label: "Monthly instalment", value: M(fromMinor(emi), c || undefined) },
        { label: "Total paid", value: M(fromMinor(sum(actual, "payment")), c || undefined) },
        { label: "Months to pay off", value: N(actual.length) },
        ...(extra > 0 ? [{ label: "Interest saved by paying extra", value: M(fromMinor(saved), c || undefined) }, { label: "Time saved", value: T(monthsSaved > 0 ? `${Math.floor(monthsSaved / 12)} years ${monthsSaved % 12} months earlier` : "No time saved") }] : []),
      ],
      table: {
        caption: `Month-by-month schedule (${actual.length} payments)`,
        columns: ["Month", "Payment", "Principal", "Interest", "Balance"],
        rows: actual.map((r) => [`${r.month}`, M(fromMinor(r.payment), c || undefined), M(fromMinor(r.principal), c || undefined), M(fromMinor(r.interest), c || undefined), M(fromMinor(r.balance), c || undefined)]),
        maxHeight: true,
      },
      steps: [`Each month: interest = balance × (${formatNumber(rate, { maxDecimals: 4 })}% ÷ 12); principal repaid = payment − interest; new balance = balance − principal`, "Amounts are held in whole cents/paise and the last payment clears the exact remaining balance."],
      notes: ["Reducing-balance schedule with monthly compounding. Extra payments are applied to principal every month, with no prepayment penalty assumed."],
    });
  },

  "loan-interest-rate-calculator": (v) => {
    const principal = num(v, "principal");
    const payment = num(v, "payment");
    const months = tenureMonths(v);
    const bad = checkTenure(months);
    if (bad) return fail(bad, "tenure");
    if (principal <= 0) return fail("The loan amount must be greater than zero.", "principal");
    if (payment <= 0) return fail("The monthly payment must be greater than zero.", "payment");
    if (payment * months < principal - 0.005) {
      return fail(`${f2(payment)} a month for ${months} months only adds up to ${f2(payment * months)}, which doesn't even repay the ${f2(principal)} borrowed. Check the payment or the tenure.`, "payment");
    }
    let rate: number;
    if (Math.abs(payment * months - principal) < 0.005) {
      rate = 0;
    } else {
      const pv = (r: number) => (payment * (1 - Math.pow(1 + r, -months))) / r - principal;
      let lo = 1e-9;
      let hi = 1;
      if (pv(hi) > 0) return fail("That payment implies a monthly rate above 100%, which isn't realistic. Check the numbers.", "payment");
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (pv(mid) > 0) lo = mid;
        else hi = mid;
      }
      rate = (lo + hi) / 2;
    }
    const nominal = rate * 12 * 100;
    const effective = (Math.pow(1 + rate, 12) - 1) * 100;
    const totalInterest = payment * months - principal;
    return ok({
      primary: { label: "Interest rate (per year)", value: P(round(nominal, 4), 4) },
      secondary: [
        { label: "Effective annual rate (with monthly compounding)", value: P(round(effective, 4), 4) },
        { label: "Monthly rate", value: P(round(rate * 100, 5), 5) },
        { label: "Total interest over the loan", value: N(round(totalInterest, 2), undefined, 2) },
      ],
      steps: ["Solve  loan = payment × (1 − (1 + r)⁻ⁿ) ÷ r  for the monthly rate r (there is no closed-form answer, so it is found by repeated halving — bisection)", `Annual rate = r × 12 = ${formatNumber(round(nominal, 4))}%`],
      notes: ["Assumes equal monthly payments on a reducing balance and no fees. If fees are bundled in, the true cost of borrowing is higher than the rate shown."],
    });
  },
};
