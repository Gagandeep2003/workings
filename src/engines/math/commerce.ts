import type { EngineMap } from "@/tools/types";
import { M, P, formatNumber } from "@/lib/format";
import { clean, roundMoney } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const money = (x: number, c: string) => M(roundMoney(x), c || undefined);
const pc = (x: number) => formatNumber(x, { maxDecimals: 2 });

export const engines: EngineMap = {
  "profit-loss-calculator": (v) => {
    const c = str(v, "currency");
    const mode = str(v, "mode");
    const fmtM = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });
    if (mode === "prices") {
      const cp = num(v, "cp");
      const sp = num(v, "sp");
      if (cp <= 0) return fail("Cost price must be greater than zero — profit percentage is measured against it.", "cp");
      const diff = roundMoney(sp - cp);
      const label = diff > 0 ? "Profit" : diff < 0 ? "Loss" : "No profit or loss";
      const pctCost = clean(((sp - cp) / cp) * 100);
      return ok({
        primary: { label, value: money(Math.abs(diff), c) },
        secondary: [
          { label: diff < 0 ? "Loss % (on cost price)" : "Profit % (on cost price)", value: P(Math.abs(pctCost), 4) },
          ...(sp > 0 ? [{ label: "Margin (on selling price)", value: P(clean((Math.abs(sp - cp) / sp) * 100), 4) }] : []),
        ],
        steps: [
          `${diff < 0 ? "Loss" : "Profit"} = |selling price − cost price| = |${fmtM(sp)} − ${fmtM(cp)}| = ${fmtM(Math.abs(diff))}`,
          `${diff < 0 ? "Loss" : "Profit"} % = ${diff < 0 ? "loss" : "profit"} ÷ cost price × 100 = ${pc(Math.abs(pctCost))}%`,
        ],
        notes: ["Profit % and loss % are measured on the cost price (the usual textbook rule). Margin is measured on the selling price, so it is always smaller."],
      });
    }
    const pct = num(v, "pct");
    const isLoss = str(v, "kind") === "loss";
    const factor = isLoss ? 1 - pct / 100 : 1 + pct / 100;
    if (isLoss && pct > 100) return fail("A loss can't be more than 100% of the cost price.", "pct");
    if (mode === "sp-from-cp") {
      const cp = num(v, "cp2");
      const sp = roundMoney(cp * factor);
      return ok({
        primary: { label: "Selling price", value: money(sp, c) },
        secondary: [{ label: isLoss ? "Loss amount" : "Profit amount", value: money(Math.abs(sp - cp), c) }],
        steps: [`Selling price = cost price × (1 ${isLoss ? "−" : "+"} ${pc(pct)} ÷ 100) = ${fmtM(cp)} × ${formatNumber(clean(factor), { maxDecimals: 6 })} = ${fmtM(sp)}`],
      });
    }
    const sp = num(v, "sp2");
    if (factor === 0) return fail("With a 100% loss the selling price is zero, so the cost price can't be worked out.", "pct");
    const cp = roundMoney(sp / factor);
    return ok({
      primary: { label: "Cost price", value: money(cp, c) },
      secondary: [{ label: isLoss ? "Loss amount" : "Profit amount", value: money(Math.abs(sp - cp), c) }],
      steps: [`Cost price = selling price ÷ (1 ${isLoss ? "−" : "+"} ${pc(pct)} ÷ 100) = ${fmtM(sp)} ÷ ${formatNumber(clean(factor), { maxDecimals: 6 })} = ${fmtM(cp)}`],
    });
  },

  "discount-calculator": (v) => {
    const c = str(v, "currency");
    const fmtM = (x: number) => formatNumber(roundMoney(x), { minDecimals: 2, maxDecimals: 2 });
    if (str(v, "mode") === "percent") {
      const original = num(v, "original");
      const sale = num(v, "sale");
      if (original <= 0) return fail("The original price must be greater than zero.", "original");
      const pct = clean(((original - sale) / original) * 100);
      return ok({
        primary: { label: "Discount", value: P(pct, 4) },
        secondary: [{ label: "You save", value: money(original - sale, c) }],
        steps: [`Discount % = (original − sale) ÷ original × 100 = (${fmtM(original)} − ${fmtM(sale)}) ÷ ${fmtM(original)} × 100 = ${pc(pct)}%`],
        notes: sale > original ? ["The sale price is higher than the original, so this is a price increase (shown as a negative discount)."] : [],
      });
    }
    const price = num(v, "price");
    const d1 = num(v, "d1");
    const d2 = optNum(v, "d2") ?? 0;
    const tax = optNum(v, "tax") ?? 0;
    if (d1 > 100 || d2 > 100) return fail("A discount can't be more than 100%.", d1 > 100 ? "d1" : "d2");
    const after1 = price * (1 - d1 / 100);
    const final = after1 * (1 - d2 / 100);
    const taxAmount = final * (tax / 100);
    const effective = price === 0 ? 0 : clean((1 - final / price) * 100);
    const steps = [`After ${pc(d1)}% off: ${fmtM(price)} × (1 − ${pc(d1)} ÷ 100) = ${fmtM(after1)}`];
    if (d2 > 0) steps.push(`Then ${pc(d2)}% off that price: ${fmtM(after1)} × (1 − ${pc(d2)} ÷ 100) = ${fmtM(final)}`);
    if (tax > 0) steps.push(`Add ${pc(tax)}% tax on the discounted price: ${fmtM(final)} + ${fmtM(taxAmount)} = ${fmtM(final + taxAmount)}`);
    return ok({
      primary: tax > 0 ? { label: "Total to pay", value: money(final + taxAmount, c) } : { label: "Price after discount", value: money(final, c) },
      secondary: [
        { label: "You save", value: money(price - final, c) },
        { label: "Effective discount", value: P(effective, 4) },
        ...(tax > 0 ? [{ label: "Tax amount", value: money(taxAmount, c) }, { label: "Price after discount (before tax)", value: money(final, c) }] : []),
      ],
      steps,
      notes: d2 > 0 ? ["Two discounts are applied one after the other, so they don't simply add up: 20% then 10% is 28% off, not 30%."] : [],
    });
  },
};

