import type { EngineMap } from "@/tools/types";
import { M, N, formatNumber } from "@/lib/format";
import { clean, roundMoney } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const f = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });

export const engines: EngineMap = {
  "overtime-pay-calculator": (v) => {
    const c = str(v, "currency");
    const basis = str(v, "basis");
    const hours = num(v, "overtime_hours"), mult = num(v, "multiplier");
    if (mult < 1) return fail("The overtime multiplier can't be below 1 — that would pay overtime at less than the normal rate.", "multiplier");
    let hourly: number;
    let regularPay = 0;
    const steps: string[] = [];
    if (basis === "hourly") {
      hourly = num(v, "hourly_rate");
      const regular = optNum(v, "regular_hours") ?? 0;
      regularPay = hourly * regular;
      steps.push(`Normal hourly rate = ${f(hourly)}`);
    } else {
      const salary = num(v, "monthly_salary"), days = num(v, "days"), perDay = num(v, "hours_per_day");
      hourly = salary / (days * perDay);
      regularPay = salary;
      steps.push(`Normal hourly rate = monthly pay ÷ (working days × hours per day) = ${f(salary)} ÷ (${days} × ${perDay}) = ${f(hourly)}`);
    }
    const otRate = hourly * mult;
    const otPay = otRate * hours;
    steps.push(`Overtime rate = ${f(hourly)} × ${formatNumber(mult, { maxDecimals: 3 })} = ${f(otRate)} per hour`, `Overtime pay = ${f(otRate)} × ${formatNumber(hours, { maxDecimals: 2 })} hours = ${f(otPay)}`);
    const hasRegular = basis !== "hourly" || (optNum(v, "regular_hours") ?? 0) > 0;
    return ok({
      primary: { label: "Overtime pay", value: M(roundMoney(otPay), c || undefined) },
      secondary: [
        { label: "Normal hourly rate", value: M(roundMoney(hourly), c || undefined) },
        { label: "Overtime rate per hour", value: M(roundMoney(otRate), c || undefined) },
        { label: "Extra earned compared with normal pay for those hours", value: M(roundMoney(otPay - hourly * hours), c || undefined) },
        ...(hasRegular ? [{ label: "Normal pay plus overtime", value: M(roundMoney(regularPay + otPay), c || undefined) }] : []),
        { label: "Overtime hours", value: N(clean(hours), "hours", 2) },
      ],
      steps,
      notes: ["The multiplier, the working days and the daily hours are assumptions that you control. Overtime rules differ by country, state, industry and employment contract — for example, some rules pay 1.5× the regular rate and some pay 2× — so use the figures your contract or local law specifies. Tax and deductions are not applied."],
    });
  },
};
