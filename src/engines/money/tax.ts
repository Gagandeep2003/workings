import type { EngineMap } from "@/tools/types";
import { M, P, formatNumber } from "@/lib/format";
import { roundMoney } from "@/lib/numeric";
import { fail, num, ok, str } from "../helpers";

export const engines: EngineMap = {
  "gst-calculator": (v) => {
    const c = str(v, "currency");
    const amount = num(v, "amount");
    const rate = num(v, "rate");
    if (rate > 100) return fail("A GST rate above 100% isn't valid.", "rate");
    const inclusive = str(v, "mode") === "inclusive";
    const net = inclusive ? roundMoney((amount * 100) / (100 + rate)) : roundMoney(amount);
    const gst = inclusive ? roundMoney(amount - net) : roundMoney((amount * rate) / 100);
    const gross = roundMoney(net + gst);
    const half = roundMoney(gst / 2);
    const cur = c || undefined;
    const f2 = (x: number) => formatNumber(x, { minDecimals: 2, maxDecimals: 2 });
    return ok({
      primary: inclusive ? { label: "Price without GST", value: M(net, cur) } : { label: "Price including GST", value: M(gross, cur) },
      secondary: [
        { label: "GST amount", value: M(gst, cur) },
        { label: inclusive ? "Price including GST" : "Price without GST", value: M(inclusive ? gross : net, cur) },
        { label: "CGST (half, same-state sale)", value: M(half, cur) },
        { label: "SGST / UTGST (half, same-state sale)", value: M(roundMoney(gst - half), cur) },
        { label: "IGST (inter-state sale)", value: M(gst, cur) },
        { label: "Rate applied", value: P(rate, 3) },
      ],
      steps: inclusive
        ? [`Price without GST = GST-inclusive price × 100 ÷ (100 + rate) = ${f2(amount)} × 100 ÷ ${formatNumber(100 + rate)} = ${f2(net)}`, `GST = inclusive price − price without GST = ${f2(amount)} − ${f2(net)} = ${f2(gst)}`]
        : [`GST = price × rate ÷ 100 = ${f2(amount)} × ${formatNumber(rate)} ÷ 100 = ${f2(gst)}`, `Price including GST = ${f2(amount)} + ${f2(gst)} = ${f2(gross)}`],
      notes: ["This does the arithmetic only. Which rate applies to your product or service is decided by its tariff classification — check the current GST rate schedule or ask your tax professional."],
    });
  },
};
