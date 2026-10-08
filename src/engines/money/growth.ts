import type { EngineMap } from "@/tools/types";
import { M, N, P, formatNumber } from "@/lib/format";
import { clean, round, roundMoney } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const money = (x: number, c: string) => M(roundMoney(x), c || undefined);
const f2 = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });
const f = (x: number) => formatNumber(x, { maxDecimals: 6 });
const fmtRate = (x: number) => formatNumber(x, { maxDecimals: 4 });

function yearsFrom(v: Parameters<typeof num>[0], idValue = "time", idUnit = "unit"): number {
  const t = num(v, idValue);
  const unit = str(v, idUnit);
  return unit === "months" ? t / 12 : unit === "days" ? t / 365 : t;
}

export const FREQUENCIES: Record<string, { n: number; label: string }> = {
  "1": { n: 1, label: "annually" }, "2": { n: 2, label: "half-yearly" }, "4": { n: 4, label: "quarterly" },
  "12": { n: 12, label: "monthly" }, "52": { n: 52, label: "weekly" }, "365": { n: 365, label: "daily" },
};

export const engines: EngineMap = {
  "simple-interest-calculator": (v) => {
    const c = str(v, "currency");
    const p = num(v, "principal");
    const rate = num(v, "rate");
    const years = yearsFrom(v);
    const interest = roundMoney((p * rate * years) / 100);
    return ok({
      primary: { label: "Simple interest", value: money(interest, c) },
      secondary: [{ label: "Total amount (principal + interest)", value: money(p + interest, c) }, { label: "Time used in the formula", value: N(clean(years), "years", 6) }],
      steps: [`SI = P × R × T ÷ 100 = ${f2(p)} × ${fmtRate(rate)} × ${f(clean(years))} ÷ 100 = ${f2(interest)}`, `Amount = principal + interest = ${f2(p)} + ${f2(interest)} = ${f2(p + interest)}`],
      notes: str(v, "unit") === "days" ? ["Days are converted to years by dividing by 365."] : [],
    });
  },

  "compound-interest-calculator": (v) => {
    const c = str(v, "currency");
    const p = num(v, "principal");
    const rate = num(v, "rate") / 100;
    const years = num(v, "years");
    const freq = str(v, "freq");
    const continuous = freq === "continuous";
    const n = continuous ? 0 : FREQUENCIES[freq]?.n;
    if (!continuous && !n) return fail("Choose how often interest is compounded.", "freq");
    const growth = (t: number) => (continuous ? Math.exp(rate * t) : Math.pow(1 + rate / n, n * t));
    const amount = roundMoney(p * growth(years));
    if (!Number.isFinite(amount) || amount > 1e18) return fail("That result is too large to show reliably. Try a shorter time or a lower rate.");
    const ear = (continuous ? Math.exp(rate) - 1 : Math.pow(1 + rate / n, n) - 1) * 100;
    const rows: (string | ReturnType<typeof M>)[][] = [];
    const wholeYears = Math.floor(years);
    for (let y = 1; y <= Math.min(wholeYears, 100); y++) {
      const bal = p * growth(y);
      rows.push([`Year ${y}`, money(bal, c), money(bal - p, c)]);
    }
    if (years !== wholeYears) rows.push([`${f(years)} years`, money(amount, c), money(amount - p, c)]);
    return ok({
      primary: { label: "Final amount", value: money(amount, c) },
      secondary: [
        { label: "Interest earned", value: money(amount - p, c) },
        { label: "Effective annual rate", value: P(round(ear, 4), 4) },
        { label: "Growth multiple", value: N(clean(amount / p), undefined, 4) },
      ],
      table: { caption: "Balance at the end of each year", columns: ["When", "Balance", "Interest so far"], rows, maxHeight: true },
      steps: continuous
        ? [`A = P × e^(r × t) = ${f2(p)} × e^(${f(rate)} × ${f(years)}) = ${f2(amount)}`]
        : [`A = P × (1 + r ÷ n)^(n × t) = ${f2(p)} × (1 + ${f(rate)} ÷ ${n})^(${n} × ${f(years)}) = ${f2(amount)}`],
      notes: ["Assumes the rate stays constant and no money is added or withdrawn. Interest on interest is the whole point of compounding, so more frequent compounding gives slightly more."],
    });
  },

  "sip-calculator": (v) => {
    const c = str(v, "currency");
    const monthly = num(v, "monthly");
    const rate = num(v, "rate");
    const years = num(v, "years");
    const stepUp = optNum(v, "stepUp") ?? 0;
    const atStart = str(v, "timing") !== "end";
    const months = Math.round(years * 12);
    if (months < 1) return fail("The investment period must be at least 1 month.", "years");
    if (months > 600) return fail("The investment period can't be more than 50 years.", "years");
    const i = rate / 1200;
    let balance = 0;
    let invested = 0;
    const rows: (string | ReturnType<typeof M>)[][] = [];
    for (let m = 1; m <= months; m++) {
      const contribution = monthly * Math.pow(1 + stepUp / 100, Math.floor((m - 1) / 12));
      balance = atStart ? (balance + contribution) * (1 + i) : balance * (1 + i) + contribution;
      invested += contribution;
      if (m % 12 === 0 || m === months) rows.push([m % 12 === 0 ? `Year ${m / 12}` : `Month ${m}`, money(invested, c), money(balance, c), money(balance - invested, c)]);
    }
    const fv = roundMoney(balance);
    const inv = roundMoney(invested);
    return ok({
      primary: { label: "Estimated maturity value", value: money(fv, c) },
      secondary: [
        { label: "Total invested", value: money(inv, c) },
        { label: "Estimated returns", value: money(fv - inv, c) },
        { label: "Value as a multiple of the amount invested", value: N(clean(fv / inv), undefined, 3) },
      ],
      table: { caption: "Growth over time", columns: ["When", "Invested", "Value", "Returns"], rows, maxHeight: true },
      steps: stepUp === 0
        ? [`Monthly rate i = ${fmtRate(rate)}% ÷ 12; value = ${f2(monthly)} × [((1 + i)ⁿ − 1) ÷ i]${atStart ? " × (1 + i)" : ""} with n = ${months}`, `= ${f2(fv)}`]
        : [`Each month the balance earns ${fmtRate(rate)}% ÷ 12, and the monthly amount rises ${fmtRate(stepUp)}% every 12 months`],
      notes: ["This is a projection at a constant return — real mutual-fund returns move up and down and are not guaranteed. Expense ratios, exit loads and taxes are not deducted."],
    });
  },

  "fd-calculator": (v) => {
    const c = str(v, "currency");
    const p = num(v, "principal");
    const rate = num(v, "rate") / 100;
    const years = yearsFrom(v, "tenure", "tenureUnit");
    const comp = str(v, "compounding");
    if (years <= 0) return fail("The tenure must be greater than zero.", "tenure");
    const n = comp === "simple" ? 0 : FREQUENCIES[comp]?.n;
    if (comp !== "simple" && !n) return fail("Choose a compounding option.", "compounding");
    const amount = roundMoney(comp === "simple" ? p * (1 + rate * years) : p * Math.pow(1 + rate / n, n * years));
    const interest = amount - p;
    const ear = comp === "simple" ? rate * 100 : (Math.pow(1 + rate / n, n) - 1) * 100;
    return ok({
      primary: { label: "Maturity amount", value: money(amount, c) },
      secondary: [
        { label: "Interest earned", value: money(interest, c) },
        { label: "Effective annual yield", value: P(round(ear, 3), 3) },
        { label: "Tenure used", value: N(clean(years), "years", 4) },
      ],
      steps: comp === "simple"
        ? [`Maturity = P × (1 + r × t) = ${f2(p)} × (1 + ${f(rate)} × ${f(clean(years))}) = ${f2(amount)}`]
        : [`Maturity = P × (1 + r ÷ n)^(n × t) = ${f2(p)} × (1 + ${f(rate)} ÷ ${n})^(${n} × ${f(clean(years))}) = ${f2(amount)}`],
      notes: ["Cumulative deposit, interest paid at maturity. Banks differ in how they treat odd tenures and part-periods, and TDS applies above certain interest limits — your bank's receipt is the final word."],
    });
  },

  "rd-calculator": (v) => {
    const c = str(v, "currency");
    const monthly = num(v, "monthly");
    const rate = num(v, "rate") / 100;
    const months = Math.round(num(v, "tenure") * (str(v, "tenureUnit") === "years" ? 12 : 1));
    const m = FREQUENCIES[str(v, "compounding")]?.n;
    if (!m) return fail("Choose a compounding option.", "compounding");
    if (months < 1) return fail("The tenure must be at least 1 month.", "tenure");
    if (months > 600) return fail("The tenure can't be more than 50 years.", "tenure");
    const g = Math.pow(1 + rate / m, m / 12); // growth per month
    let maturity = 0;
    for (let k = 1; k <= months; k++) maturity += monthly * Math.pow(g, months - k + 1);
    const deposited = monthly * months;
    const amount = roundMoney(maturity);
    return ok({
      primary: { label: "Maturity amount", value: money(amount, c) },
      secondary: [
        { label: "Total deposited", value: money(deposited, c) },
        { label: "Interest earned", value: money(amount - deposited, c) },
        { label: "Number of deposits", value: N(months) },
      ],
      steps: [`Each monthly deposit grows for the months it stays in the account: deposit k earns (1 + r ÷ ${m})^(${m} × (months remaining ÷ 12))`, `Maturity = Σ over ${months} deposits = ${f2(amount)}`],
      notes: ["Deposits are assumed to be made at the start of each month and interest compounds at the chosen frequency. Banks' own tables can differ by a small amount."],
    });
  },

  "inflation-calculator": (v) => {
    const c = str(v, "currency");
    const mode = str(v, "mode");
    if (mode === "rate") {
      const start = num(v, "start");
      const end = num(v, "end");
      const years = num(v, "years");
      if (start <= 0 || end <= 0) return fail("Both prices must be greater than zero.", "start");
      if (years <= 0) return fail("The number of years must be greater than zero.", "years");
      const rate = (Math.pow(end / start, 1 / years) - 1) * 100;
      return ok({
        primary: { label: "Average yearly inflation", value: P(round(rate, 3), 3) },
        secondary: [{ label: "Total price change", value: P(round((end / start - 1) * 100, 2), 2) }],
        steps: [`Rate = (end ÷ start)^(1 ÷ years) − 1 = (${f(end)} ÷ ${f(start)})^(1 ÷ ${f(years)}) − 1 = ${fmtRate(round(rate, 4))}%`],
      });
    }
    const amount = num(v, "amount");
    const rate = num(v, "rate") / 100;
    const years = num(v, "years");
    const factor = Math.pow(1 + rate, years);
    if (mode === "future") {
      const future = roundMoney(amount * factor);
      return ok({
        primary: { label: `What costs ${f2(amount)} today will cost`, value: money(future, c) },
        secondary: [{ label: "Extra cost from inflation", value: money(future - amount, c) }, { label: "Prices rise by", value: P(round((factor - 1) * 100, 2), 2) }],
        steps: [`Future cost = today's cost × (1 + inflation)^years = ${f2(amount)} × (1 + ${f(rate)})^${f(years)} = ${f2(future)}`],
        notes: ["Uses the single yearly inflation rate you entered. Real inflation changes from year to year and differs by goods and services."],
      });
    }
    const worth = roundMoney(amount / factor);
    return ok({
      primary: { label: `${f2(amount)} will buy what this buys today`, value: money(worth, c) },
      secondary: [{ label: "Purchasing power lost", value: money(amount - worth, c) }, { label: "Purchasing power lost (%)", value: P(round((1 - 1 / factor) * 100, 2), 2) }],
      steps: [`Value in today's money = amount ÷ (1 + inflation)^years = ${f2(amount)} ÷ (1 + ${f(rate)})^${f(years)} = ${f2(worth)}`],
      notes: ["Uses the single yearly inflation rate you entered, not official price-index data."],
    });
  },

  "cagr-calculator": (v) => {
    const begin = num(v, "begin");
    const end = num(v, "end");
    const years = num(v, "years");
    if (begin <= 0) return fail("The starting value must be greater than zero.", "begin");
    if (years <= 0) return fail("The number of years must be greater than zero.", "years");
    if (end < 0) return fail("The ending value can't be negative.", "end");
    const g = Math.pow(end / begin, 1 / years) - 1;
    const pct = round(g * 100, 4);
    return ok({
      primary: { label: "CAGR", value: P(pct, 4) },
      secondary: [
        { label: "Total return", value: P(round((end / begin - 1) * 100, 2), 2) },
        { label: "Absolute gain or loss", value: N(clean(end - begin)) },
        ...(g > 0 ? [{ label: "Years to double at this rate", value: N(round(Math.log(2) / Math.log(1 + g), 2), "years") }] : []),
      ],
      steps: [`CAGR = (end ÷ begin)^(1 ÷ years) − 1 = (${f(end)} ÷ ${f(begin)})^(1 ÷ ${f(years)}) − 1 = ${fmtRate(pct)}%`],
      notes: ["CAGR smooths out the ups and downs into one steady yearly rate. It says nothing about the path in between, and it ignores any money added or withdrawn along the way."],
    });
  },
};

