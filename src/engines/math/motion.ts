import type { EngineMap } from "@/tools/types";
import { N, P, T, formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { getUnit } from "@/lib/units";
import { fail, failMany, num, ok, optNum, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 6 });
const hms = (hours: number): string => {
  const total = Math.round(hours * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const engines: EngineMap = {
  "speed-time-distance-calculator": (v) => {
    const solve = str(v, "solve");
    const du = str(v, "distUnit");
    const tu = str(v, "timeUnit");
    const dUnit = getUnit("length", du);
    const tUnit = getUnit("time", tu);
    if (!dUnit || !tUnit) return fail("Choose a distance unit and a time unit.");
    const speedUnit = `${dUnit.symbol}/${tUnit.symbol}`;
    let distance = optNum(v, "distance");
    let speed = optNum(v, "speed");
    let time = optNum(v, "time");
    let step: string;
    if (solve === "distance") {
      distance = clean(speed! * time!);
      step = `Distance = speed × time = ${f(speed!)} ${speedUnit} × ${f(time!)} ${tUnit.symbol} = ${f(distance)} ${dUnit.symbol}`;
    } else if (solve === "speed") {
      if (time === 0) return fail("Time can't be zero when finding speed.", "time");
      speed = clean(distance! / time!);
      step = `Speed = distance ÷ time = ${f(distance!)} ${dUnit.symbol} ÷ ${f(time!)} ${tUnit.symbol} = ${f(speed)} ${speedUnit}`;
    } else {
      if (speed === 0) return fail("Speed can't be zero when finding time.", "speed");
      time = clean(distance! / speed!);
      step = `Time = distance ÷ speed = ${f(distance!)} ${dUnit.symbol} ÷ ${f(speed!)} ${speedUnit} = ${f(time)} ${tUnit.symbol}`;
    }
    const mps = (speed! * dUnit.factor) / tUnit.factor;
    const timeHours = (time! * tUnit.factor) / 3600;
    const primary = solve === "distance" ? { label: "Distance", value: N(distance!, dUnit.symbol) } : solve === "speed" ? { label: "Speed", value: N(speed!, speedUnit) } : { label: "Time", value: N(time!, tUnit.symbol) };
    return ok({
      primary,
      secondary: [
        { label: "Speed in km/h", value: N(clean(mps * 3.6), "km/h", 4) },
        { label: "Speed in m/s", value: N(clean(mps), "m/s", 4) },
        { label: "Speed in mph", value: N(clean(mps / 0.44704), "mph", 4) },
        { label: "Time as h:mm:ss", value: T(hms(timeHours)) },
      ],
      steps: [step],
    });
  },

  "time-and-work-calculator": (v) => {
    const mode = str(v, "mode");
    if (mode === "together") {
      const days = [optNum(v, "a"), optNum(v, "b"), optNum(v, "c")].filter((x): x is number => x !== undefined);
      if (days.length < 2) return failMany([{ field: "b", message: "Enter the days for at least two workers." }]);
      if (days.some((d) => d <= 0)) return fail("Each worker's days must be greater than zero.", "a");
      const rates = days.map((d) => 1 / d);
      const total = clean(1 / rates.reduce((s, r) => s + r, 0));
      const names = ["A", "B", "C"];
      return ok({
        primary: { label: "Days to finish together", value: N(total, "days", 4) },
        secondary: [{ label: "Combined work per day", value: P(clean(100 / total), 4) }],
        table: {
          columns: ["Worker", "Days alone", "Work per day", "Share of the job"],
          rows: days.map((d, i) => [names[i], N(d), P(clean(100 / d), 3), P(clean(((1 / d) * total) * 100), 3)]),
        },
        steps: [`Work per day: ${days.map((d, i) => `${names[i]} = 1/${f(d)}`).join(", ")}`, `Together: ${days.map((d) => `1/${f(d)}`).join(" + ")} = 1/${f(total)} of the job per day`, `Days = 1 ÷ combined rate = ${f(total)}`],
      });
    }
    if (mode === "missing") {
      const t = num(v, "t");
      const a = num(v, "a2");
      if (a <= t) return fail("The first worker alone must take longer than the whole team — otherwise the second worker would be adding negative work.", "a2");
      const b = clean(1 / (1 / t - 1 / a));
      return ok({
        primary: { label: "Days for the other worker alone", value: N(b, "days", 4) },
        steps: [`Other worker's rate = 1/${f(t)} − 1/${f(a)} = ${formatNumber(clean(1 / t - 1 / a), { maxDecimals: 8 })} of the job per day`, `Days alone = 1 ÷ that rate = ${f(b)}`],
      });
    }
    const a = num(v, "a3");
    const b = num(v, "b3");
    const x = num(v, "x");
    if (x >= a) return fail("A alone would already finish the job in that many days, so B never joins. Enter fewer days.", "x");
    const remaining = 1 - x / a;
    const together = clean(remaining / (1 / a + 1 / b));
    return ok({
      primary: { label: "Total days", value: N(clean(x + together), "days", 4) },
      secondary: [
        { label: "Work done by A before B joins", value: P(clean((x / a) * 100), 4) },
        { label: "Days both work together", value: N(together, "days", 4) },
      ],
      steps: [`A alone for ${f(x)} days completes ${f(x)}/${f(a)} of the job; ${formatNumber(clean(remaining), { maxDecimals: 6 })} remains`, `Together they do 1/${f(a)} + 1/${f(b)} per day, so the rest takes ${f(together)} days`, `Total = ${f(x)} + ${f(together)} = ${f(clean(x + together))} days`],
    });
  },
};
