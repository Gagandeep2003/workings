import type { EngineMap } from "@/tools/types";
import { M, P, formatNumber } from "@/lib/format";
import { clean, roundMoney } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

/** India — new tax regime, individuals, salaried. Verified against published summaries on 2026-10-03 (see tool metadata). */
export const NEW_REGIME_FY2026_27 = {
  label: "FY 2026-27 (assessment year 2027-28)",
  standardDeduction: 75_000,
  rebateThreshold: 1_200_000,
  rebateMax: 60_000,
  cess: 0.04,
  slabs: [
    { upTo: 400_000, rate: 0 },
    { upTo: 800_000, rate: 0.05 },
    { upTo: 1_200_000, rate: 0.1 },
    { upTo: 1_600_000, rate: 0.15 },
    { upTo: 2_000_000, rate: 0.2 },
    { upTo: 2_400_000, rate: 0.25 },
    { upTo: Infinity, rate: 0.3 },
  ],
  surchargeFrom: 5_000_000,
};

export function slabTax(taxable: number, slabs = NEW_REGIME_FY2026_27.slabs): number {
  let tax = 0;
  let lower = 0;
  for (const s of slabs) {
    if (taxable > lower) tax += (Math.min(taxable, s.upTo) - lower) * s.rate;
    lower = s.upTo;
  }
  return tax;
}

export function incomeTaxNewRegime(taxable: number) {
  const cfg = NEW_REGIME_FY2026_27;
  const base = slabTax(taxable);
  let afterRelief = base;
  let relief = 0;
  if (taxable <= cfg.rebateThreshold) {
    relief = Math.min(base, cfg.rebateMax);
    afterRelief = base - relief;
  } else {
    const cap = taxable - cfg.rebateThreshold; // marginal relief: tax can't exceed income above the threshold
    if (base > cap) {
      relief = base - cap;
      afterRelief = cap;
    }
  }
  const cess = afterRelief * cfg.cess;
  return { slabTax: base, relief, taxBeforeCess: afterRelief, cess, total: afterRelief + cess };
}

export const engines: EngineMap = {
  "ctc-to-take-home-calculator": (v) => {
    const c = str(v, "currency");
    const ctc = num(v, "ctc");
    const basicPct = num(v, "basicPct");
    const benefits = optNum(v, "benefits") ?? 0;
    const ptYear = optNum(v, "pt") ?? 0;
    const pfMode = str(v, "pf");
    if (basicPct > 100) return fail("Basic pay can't be more than 100% of CTC.", "basicPct");
    if (benefits >= ctc) return fail("Employer-paid benefits can't be as large as the whole CTC.", "benefits");
    const basicYear = (ctc * basicPct) / 100;
    const pfBasisMonthly = pfMode === "full" ? basicYear / 12 : Math.min(basicYear / 12, 15_000);
    const pfYear = pfMode === "none" ? 0 : roundMoney(pfBasisMonthly * 12 * 0.12);
    const gross = ctc - pfYear - benefits; // employer PF and benefits are part of CTC but never reach your bank account
    if (gross <= 0) return fail("After employer PF and benefits nothing is left as salary. Reduce those amounts.", "benefits");
    const taxable = Math.max(0, gross - NEW_REGIME_FY2026_27.standardDeduction);
    const tax = incomeTaxNewRegime(taxable);
    const totalTax = roundMoney(tax.total);
    const deductions = pfYear + ptYear + totalTax;
    const inHandYear = gross - deductions;
    if (inHandYear < 0) return fail("The deductions are larger than the salary. Check the PF and professional tax amounts.");
    const row = (label: string, yearly: number) => [label, M(roundMoney(yearly / 12), c || undefined), M(roundMoney(yearly), c || undefined)];
    const notes = [
      "Estimate only. Uses the new tax regime for salaried individuals; ignores old-regime deductions (80C, HRA), employer NPS, other income, surcharge on very high incomes, and company-specific components.",
      "Variable pay is spread evenly across 12 months here; in reality it is usually paid in one or two lumps and TDS is deducted when it's paid.",
    ];
    if (taxable > NEW_REGIME_FY2026_27.surchargeFrom) notes.unshift("Taxable income is above ₹50 lakh, where surcharge applies. It is NOT included, so the real tax will be higher.");
    return ok({
      primary: { label: "Estimated monthly take-home", value: M(roundMoney(inHandYear / 12), c || undefined) },
      secondary: [
        { label: "Estimated annual take-home", value: M(roundMoney(inHandYear), c || undefined) },
        { label: "Income tax + cess (estimated)", value: M(totalTax, c || undefined) },
        { label: "Take-home as a share of CTC", value: P(clean((inHandYear / ctc) * 100), 1) },
      ],
      table: {
        caption: "Where the CTC goes",
        columns: ["Item", "Per month", "Per year"],
        rows: [
          row("Annual CTC", ctc),
          row("− Employer PF (in CTC, not paid to you)", -pfYear),
          row("− Other employer-paid benefits", -benefits),
          row("= Gross salary paid to you", gross),
          row("− Employee PF", -pfYear),
          row("− Professional tax", -ptYear),
          row("− Income tax + cess (new regime)", -totalTax),
          row("= Take-home", inHandYear),
        ],
      },
      steps: [
        `Gross salary = CTC − employer PF − employer-paid benefits = ${formatNumber(roundMoney(gross), { minDecimals: 2 })}`,
        `Taxable income = gross − standard deduction (₹75,000) = ${formatNumber(roundMoney(taxable), { minDecimals: 2 })}`,
        `Slab tax ${formatNumber(roundMoney(tax.slabTax))}; rebate / marginal relief ${formatNumber(roundMoney(tax.relief))}; 4% cess ${formatNumber(roundMoney(tax.cess))} → ${formatNumber(totalTax)}`,
        `Take-home = gross − employee PF − professional tax − income tax = ${formatNumber(roundMoney(inHandYear), { minDecimals: 2 })}`,
      ],
      notes,
    });
  },
};
