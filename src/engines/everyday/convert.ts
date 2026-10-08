import type { Engine, EngineMap } from "@/tools/types";
import { N, formatNumber } from "@/lib/format";
import { CATEGORY_BY_ID, convert, conversionFactor, getUnit } from "@/lib/units";
import { fail, num, ok, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 10 });

/** Build a converter engine for a unit category. `fromId`/`toId`/`valueId` are the form field ids. */
export function makeConverter(categoryId: string, fields = { value: "value", from: "from", to: "to" }): Engine {
  return (v) => {
    const category = CATEGORY_BY_ID.get(categoryId);
    if (!category) return fail("Unknown unit category.");
    const value = num(v, fields.value);
    const from = getUnit(categoryId, str(v, fields.from));
    const to = getUnit(categoryId, str(v, fields.to));
    if (!from) return fail("Choose a unit to convert from.", fields.from);
    if (!to) return fail("Choose a unit to convert to.", fields.to);
    if (categoryId === "fuel" && value === 0) return fail("Fuel economy of zero isn't meaningful — it would mean no distance on a full tank (or infinite consumption).", fields.value);
    if (categoryId === "temperature") {
      const kelvin = convert("temperature", from.id, "k", value);
      if (kelvin < 0) return fail(`That's below absolute zero (0 K = −273.15 °C = −459.67 °F), which is physically impossible.`, fields.value);
    }
    const result = convert(categoryId, from.id, to.id, value);
    if (!Number.isFinite(result)) return fail("That result is too large to show reliably.");
    const factor = conversionFactor(categoryId, from.id, to.id);
    const rows = category.units
      .filter((u) => u.id !== from.id)
      .map((u) => [`${u.label} (${u.symbol})`, N(convert(categoryId, from.id, u.id, value), u.symbol, 10)]);
    const steps = factor !== null
      ? [`1 ${from.symbol} = ${f(factor)} ${to.symbol}`, `${f(value)} ${from.symbol} × ${f(factor)} = ${f(result)} ${to.symbol}`]
      : categoryId === "temperature"
        ? [temperatureStep(from.id, to.id, value, result)]
        : [`${f(value)} ${from.symbol} → ${f(result)} ${to.symbol} (fuel economy is a reciprocal relationship: L/100 km = 100 ÷ km/L)`];
    return ok({
      primary: { label: `${from.label} to ${to.label}`.replace(/\s+/g, " "), value: N(result, to.symbol, 10) },
      secondary: [{ label: "In words", value: { kind: "text", value: `${f(value)} ${from.symbol} = ${f(result)} ${to.symbol}` } }],
      table: { caption: `${f(value)} ${from.symbol} in every ${category.label.toLowerCase()} unit`, columns: ["Unit", "Value"], rows, maxHeight: true },
      steps,
      notes: category.note ? [category.note] : [],
    });
  };
}

function temperatureStep(from: string, to: string, value: number, result: number): string {
  const key = `${from}>${to}`;
  const r = f(result);
  const v = f(value);
  const table: Record<string, string> = {
    "c>f": `°F = °C × 9/5 + 32 = ${v} × 1.8 + 32 = ${r}`,
    "f>c": `°C = (°F − 32) × 5/9 = (${v} − 32) × 5/9 = ${r}`,
    "c>k": `K = °C + 273.15 = ${v} + 273.15 = ${r}`,
    "k>c": `°C = K − 273.15 = ${v} − 273.15 = ${r}`,
    "f>k": `K = (°F − 32) × 5/9 + 273.15 = ${r}`,
    "k>f": `°F = (K − 273.15) × 9/5 + 32 = ${r}`,
  };
  return table[key] ?? `${v} → ${r} (via degrees Celsius)`;
}

export const engines: EngineMap = {
  "length-converter": makeConverter("length"),
  "weight-converter": makeConverter("mass"),
  "temperature-converter": makeConverter("temperature"),
  "area-converter": makeConverter("area"),
  "volume-converter": makeConverter("volume"),
  "speed-converter": makeConverter("speed"),
  "fuel-economy-converter": makeConverter("fuel"),
  "unit-converter": (v, ctx) => makeConverter(str(v, "category"))(v, ctx),
};
