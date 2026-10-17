import type { EngineMap } from "@/tools/types";
import { M, P, T, formatNumber } from "@/lib/format";
import { clean, fromMinor, roundMoney, toMinor } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";
import { buildSchedule, checkTenure, emiMinor, tenureMonths } from "./loans";

const f2 = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });
const COMPOUNDING: Record<string, { n: number; label: string }> = { annually: { n: 1, label: "annually" }, half: { n: 2, label: "half-yearly" }, quarterly: { n: 4, label: "quarterly" }, monthly: { n: 12, label: "monthly" } };
const monthsText = (m: number) => { const y = Math.floor(m / 12), r = m % 12; return [y ? `${y} year${y === 1 ? "" : "s"}` : "", r ? `${r} month${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "0 months"; };

export const engines: EngineMap = {
  "lumpsum-calculator": (v) => {
    const c = str(v, "currency");
    const principal = num(v, "principal"), rate = num(v, "rate"), years = num(v, "years");
    const comp = COMPOUNDING[str(v, "compounding")] ?? COMPOUNDING.annually;
    const inflation = optNum(v, "inflation");
    if (principal <= 0) return fail("The amount invested must be greater than zero.", "principal");
    const growth = (t: number) => principal * Math.pow(1 + rate / 100 / comp.n, comp.n * t);
    const fv = growth(years);
    if (!Number.isFinite(fv) || fv > 1e15) return fail("That result is too large to display. Try a shorter period or a lower rate.", "years");
    const effective = Math.pow(1 + rate / 100 / comp.n, comp.n) - 1;
    const gain = fv - principal;
    const rows: (string | ReturnType<typeof M>)[][] = [];
    for (let y = 1; y <= Math.min(Math.floor(years), 50); y++) rows.push([`Year ${y}`, M(roundMoney(growth(y)), c || undefined), M(roundMoney(growth(y) - principal), c || undefined)]);
    const real = inflation !== undefined ? fv / Math.pow(1 + inflation / 100, years) : undefined;
    return ok({
      primary: { label: "Future value", value: M(roundMoney(fv), c || undefined) },
      secondary: [
        { label: "Amount invested", value: M(roundMoney(principal), c || undefined) },
        { label: "Estimated gain", value: M(roundMoney(gain), c || undefined) },
        { label: "Total growth", value: P(clean((gain / principal) * 100), 2) },
        { label: "Effective annual return", value: P(clean(effective * 100), 3) },
        ...(rate > 0 ? [{ label: "Time to double at this rate", value: T(`about ${formatNumber(Math.log(2) / Math.log(1 + effective), { maxDecimals: 1 })} years`) }] : []),
        ...(real !== undefined ? [{ label: `Value in today's money (${formatNumber(inflation!, { maxDecimals: 2 })}% inflation)`, value: M(roundMoney(real), c || undefined) }] : []),
      ],
      ...(rows.length ? { table: { caption: "Growth year by year", columns: ["Year", "Value", "Gain so far"], rows, maxHeight: true } } : {}),
      steps: [`Future value = P × (1 + r ÷ n)^(n × t) with P = ${f2(principal)}, r = ${formatNumber(rate, { maxDecimals: 4 })}%, n = ${comp.n} (${comp.label}), t = ${formatNumber(years, { maxDecimals: 4 })}`, `= ${f2(fv)}`],
      notes: ["A fixed-rate illustration. Market-linked investments do not earn a constant return, and taxes, fees and exit charges are not included, so this is a planning figure and not a forecast."],
    });
  },

  "loan-prepayment-calculator": (v) => {
    const c = str(v, "currency");
    const principal = num(v, "principal"), rate = num(v, "rate"), months = tenureMonths(v);
    const prepay = num(v, "prepayment"), after = num(v, "after");
    const effect = str(v, "effect");
    const bad = checkTenure(months);
    if (bad) return fail(bad, "tenure");
    if (principal < 1) return fail("The loan amount must be at least 1.", "principal");
    if (!Number.isInteger(after) || after < 0 || after >= months) return fail(`Enter the number of EMIs already paid as a whole number from 0 to ${months - 1}.`, "after");
    if (prepay <= 0) return fail("The prepayment amount must be greater than zero.", "prepayment");
    const pMinor = toMinor(principal);
    const emi = emiMinor(pMinor, rate, months);
    const base = buildSchedule(pMinor, rate, months, emi);
    const baseInterest = base.reduce((s, r) => s + r.interest, 0);
    const paidInterest = base.slice(0, after).reduce((s, r) => s + r.interest, 0);
    const balance = after === 0 ? pMinor : base[after - 1].balance;
    const prepayMinor = toMinor(prepay);
    if (prepayMinor > balance) return fail(`The outstanding principal after ${after} EMIs is ${f2(fromMinor(balance))}. A prepayment larger than that would more than clear the loan — enter ${f2(fromMinor(balance))} or less.`, "prepayment");
    const newBalance = balance - prepayMinor;
    const remaining = months - after;
    let after2: ReturnType<typeof buildSchedule> = [];
    let newEmi = emi;
    if (newBalance > 0) {
      if (effect === "emi") { newEmi = emiMinor(newBalance, rate, remaining); after2 = buildSchedule(newBalance, rate, remaining, newEmi); }
      else after2 = buildSchedule(newBalance, rate, 1200, emi);
    }
    const newInterest = paidInterest + after2.reduce((s, r) => s + r.interest, 0);
    const saved = baseInterest - newInterest;
    const newMonths = after + after2.length;
    return ok({
      primary: { label: "Interest saved", value: M(fromMinor(saved), c || undefined) },
      secondary: [
        ...(effect === "emi"
          ? [{ label: "New EMI", value: M(fromMinor(newBalance > 0 ? newEmi : 0), c || undefined) }, { label: "EMI reduction", value: M(fromMinor(emi - (newBalance > 0 ? newEmi : 0)), c || undefined) }]
          : [{ label: "New loan tenure", value: T(monthsText(newMonths)) }, { label: "Time saved", value: T(monthsText(months - newMonths)) }]),
        { label: "Outstanding principal before prepaying", value: M(fromMinor(balance), c || undefined) },
        { label: "Outstanding principal after prepaying", value: M(fromMinor(newBalance), c || undefined) },
        { label: "Original EMI", value: M(fromMinor(emi), c || undefined) },
        { label: "Total interest, original", value: M(fromMinor(baseInterest), c || undefined) },
        { label: "Total interest, with prepayment", value: M(fromMinor(newInterest), c || undefined) },
      ],
      steps: [`Original EMI = ${f2(fromMinor(emi))} for ${months} months; balance after ${after} EMIs = ${f2(fromMinor(balance))}`, `After prepaying ${f2(prepay)}, the balance is ${f2(fromMinor(newBalance))}`, effect === "emi" ? `New EMI over the remaining ${remaining} months = ${f2(fromMinor(newBalance > 0 ? newEmi : 0))}` : `Keeping the EMI at ${f2(fromMinor(emi))}, the loan ends after ${newMonths} months in total`],
      notes: ["Assumes a reducing-balance loan with monthly compounding and no prepayment charge. Many lenders charge a fee on prepayment, treat part-payments differently, or round the EMI, so confirm the figures with your lender."],
    });
  },

  "loan-affordability-calculator": (v) => {
    const c = str(v, "currency");
    const income = num(v, "income"), existing = optNum(v, "existing") ?? 0, share = num(v, "share"), rate = num(v, "rate"), months = tenureMonths(v);
    const bad = checkTenure(months);
    if (bad) return fail(bad, "tenure");
    if (income <= 0) return fail("Enter your monthly income as an amount greater than zero.", "income");
    const cap = (income * share) / 100;
    const room = cap - existing;
    if (room <= 0) return fail(`Your existing EMIs (${f2(existing)}) already use all of the ${formatNumber(share, { maxDecimals: 2 })}% of income (${f2(cap)}) set aside for loan payments, so there is no room for a new EMI. Raise the share or reduce existing EMIs to see a figure.`, "existing");
    const r = rate / 1200;
    const principalFor = (n: number) => (rate === 0 ? room * n : (room * (1 - Math.pow(1 + r, -n))) / r);
    const loan = principalFor(months);
    const rows = [5, 10, 15, 20, 25, 30].map((y) => [`${y} years`, M(roundMoney(principalFor(y * 12)), c || undefined)]);
    return ok({
      primary: { label: "Estimated maximum loan", value: M(roundMoney(loan), c || undefined) },
      secondary: [
        { label: "Affordable new EMI", value: M(roundMoney(room), c || undefined) },
        { label: "Total repayable over the tenure", value: M(roundMoney(room * months), c || undefined) },
        { label: "Total interest", value: M(roundMoney(room * months - loan), c || undefined) },
        { label: "Income set aside for all EMIs", value: M(roundMoney(cap), c || undefined), hint: `${formatNumber(share, { maxDecimals: 2 })}% of monthly income` },
      ],
      table: { caption: "Maximum loan at the same EMI, by tenure", columns: ["Tenure", "Maximum loan"], rows },
      steps: [`Income set aside for EMIs = ${f2(income)} × ${formatNumber(share, { maxDecimals: 2 })}% = ${f2(cap)}`, `Room for a new EMI = ${f2(cap)} − existing EMIs ${f2(existing)} = ${f2(room)}`, rate === 0 ? `With 0% interest, loan = EMI × months = ${f2(loan)}` : `Loan = EMI × (1 − (1 + r)^−n) ÷ r with r = ${formatNumber(clean(r * 100), { maxDecimals: 6 })}% per month, n = ${months}: ${f2(loan)}`],
      notes: ["The share of income you can safely give to EMIs is a personal decision; lenders apply their own limits, credit checks and loan-to-value rules. This is a planning estimate and not an offer or approval."],
    });
  },
};
