import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { ExprError, evaluateExpression, type AngleMode } from "@/lib/expr";
import { fail, ok, str } from "../helpers";
import { sci } from "./algebra";

export const engines: EngineMap = {
  "scientific-calculator": (v) => {
    const src = str(v, "expression").trim();
    const angle = (str(v, "angle") === "rad" ? "rad" : "deg") as AngleMode;
    try {
      const value = evaluateExpression(src, angle);
      const abs = Math.abs(value);
      return ok({
        primary: { label: "Result", value: N(value, undefined, 12) },
        secondary: [
          ...(abs !== 0 && (abs >= 1e9 || abs < 1e-6) ? [{ label: "Scientific notation", value: T(sci(value)) }] : []),
          ...(Number.isInteger(value) && abs >= 1000 ? [] : [{ label: "Rounded to 4 decimal places", value: T(formatNumber(value, { maxDecimals: 4 })) }]),
          { label: "Angle mode", value: T(angle === "deg" ? "Degrees" : "Radians") },
        ],
        steps: ["Evaluated with the usual order of operations: brackets, then powers and factorials, then × ÷ (including implicit multiplication), then + −."],
        notes: ["Results are accurate to about 12 significant digits (standard double-precision arithmetic)."],
      });
    } catch (e) {
      if (e instanceof ExprError) return fail(e.position !== undefined ? `${e.message} (at character ${e.position + 1}).` : `${e.message}.`, "expression");
      throw e;
    }
  },
};
