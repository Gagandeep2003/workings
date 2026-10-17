import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const KM_PER_MILE = 1.609344;
const pad = (n: number) => String(n).padStart(2, "0");

/** Seconds → "H:MM:SS" (or "M:SS" under an hour), rounded to the nearest second with proper carry. */
export function clock(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const parseClock = (text: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
};
const hhmm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const twelve = (mins: number) => { const h = Math.floor(mins / 60), m = mins % 60; return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
const hm = (mins: number) => `${Math.floor(mins / 60)} h ${pad(mins % 60)} min`;
const f = (n: number) => formatNumber(clean(n), { maxDecimals: 4 });

export const engines: EngineMap = {
  "time-duration-calculator": (v) => {
    if (str(v, "mode") === "add") {
      const start = parseClock(str(v, "time"));
      if (start === null) return fail("Enter a time like 09:30.", "time");
      const h = num(v, "add_hours"), m = num(v, "add_minutes");
      const delta = Math.round((h * 60 + m) * (str(v, "op") === "subtract" ? -1 : 1));
      const raw = start + delta;
      const day = Math.floor(raw / 1440);
      const mins = ((raw % 1440) + 1440) % 1440;
      const dayNote = day === 0 ? "same day" : day > 0 ? `${day === 1 ? "next day" : `${day} days later`}` : `${day === -1 ? "previous day" : `${-day} days earlier`}`;
      return ok({
        primary: { label: "Resulting time", value: T(`${hhmm(mins)}  (${twelve(mins)})`) },
        secondary: [{ label: "Day", value: T(dayNote) }, { label: "Duration applied", value: T(`${str(v, "op") === "subtract" ? "−" : "+"}${hm(Math.abs(delta))}`) }],
        steps: [`${hhmm(start)} ${str(v, "op") === "subtract" ? "−" : "+"} ${hm(Math.abs(delta))} = ${hhmm(mins)} (${dayNote})`],
      });
    }
    const a = parseClock(str(v, "start")), b = parseClock(str(v, "end"));
    if (a === null) return fail("Enter a start time like 09:30.", "start");
    if (b === null) return fail("Enter an end time like 17:45.", "end");
    const brk = optNum(v, "break_min") ?? 0;
    const overnight = b < a;
    const gross = overnight ? b + 1440 - a : b - a;
    if (brk > gross) return fail(`The break (${f(brk)} min) is longer than the time between the two times (${hm(gross)}).`, "break_min");
    const net = gross - brk;
    return ok({
      primary: { label: brk ? "Net duration" : "Duration", value: T(hm(Math.round(net))) },
      secondary: [
        { label: "In decimal hours", value: N(clean(net / 60), "hours", 4) },
        { label: "In minutes", value: N(Math.round(net)) },
        ...(brk ? [{ label: "Before the break", value: T(hm(gross)) }] : []),
        ...(overnight ? [{ label: "Crosses midnight", value: T("Yes — the end time is treated as the next day") }] : []),
      ],
      steps: [`From ${hhmm(a)} to ${hhmm(b)}${overnight ? " (next day)" : ""} = ${hm(gross)}${brk ? `, minus a ${f(brk)} min break = ${hm(Math.round(net))}` : ""}`],
      notes: a === b ? ["The two times are identical, so the duration is zero. If you mean a full 24 hours, set the end time a minute earlier and add one minute."] : undefined,
    });
  },

  "pace-calculator": (v) => {
    const solve = str(v, "solve");
    const distUnit = str(v, "dist_unit") === "mi" ? KM_PER_MILE : 1;
    const paceUnit = str(v, "pace_unit") === "mi" ? KM_PER_MILE : 1;
    const timeSec = (optNum(v, "hours") ?? 0) * 3600 + (optNum(v, "minutes") ?? 0) * 60 + (optNum(v, "seconds") ?? 0);
    const paceSecPerUnit = (optNum(v, "pace_min") ?? 0) * 60 + (optNum(v, "pace_sec") ?? 0);
    let distKm: number, totalSec: number, secPerKm: number;
    if (solve === "pace") {
      const d = optNum(v, "distance");
      if (d === undefined || d <= 0) return fail("Enter a distance greater than zero.", "distance");
      if (timeSec <= 0) return fail("Enter a time greater than zero.", "hours");
      distKm = d * distUnit; totalSec = timeSec; secPerKm = totalSec / distKm;
    } else if (solve === "time") {
      const d = optNum(v, "distance");
      if (d === undefined || d <= 0) return fail("Enter a distance greater than zero.", "distance");
      if (paceSecPerUnit <= 0) return fail("Enter a pace greater than zero.", "pace_min");
      distKm = d * distUnit; secPerKm = paceSecPerUnit / paceUnit; totalSec = secPerKm * distKm;
    } else {
      if (timeSec <= 0) return fail("Enter a time greater than zero.", "hours");
      if (paceSecPerUnit <= 0) return fail("Enter a pace greater than zero.", "pace_min");
      secPerKm = paceSecPerUnit / paceUnit; totalSec = timeSec; distKm = totalSec / secPerKm;
    }
    const kmh = 3600 / secPerKm, mph = kmh / KM_PER_MILE;
    const races: [string, number][] = [["1 km", 1], ["1 mile", KM_PER_MILE], ["5 km", 5], ["10 km", 10], ["15 km", 15], ["10 miles", 10 * KM_PER_MILE], ["Half marathon (21.0975 km)", 21.0975], ["Marathon (42.195 km)", 42.195]];
    const primary = solve === "pace" ? { label: "Pace", value: T(`${clock(secPerKm)} per km  ·  ${clock(secPerKm * KM_PER_MILE)} per mile`) }
      : solve === "time" ? { label: "Finish time", value: T(clock(totalSec)) }
      : { label: "Distance", value: N(clean(distKm / distUnit), str(v, "dist_unit") === "mi" ? "miles" : "km", 3) };
    return ok({
      primary,
      secondary: [
        { label: "Pace per km", value: T(clock(secPerKm)) },
        { label: "Pace per mile", value: T(clock(secPerKm * KM_PER_MILE)) },
        { label: "Speed", value: T(`${f(kmh)} km/h  ·  ${f(mph)} mph`) },
        ...(solve !== "time" ? [{ label: "Time", value: T(clock(totalSec)) }] : []),
        ...(solve !== "distance" ? [{ label: "Distance", value: T(`${f(clean(distKm))} km  ·  ${f(clean(distKm / KM_PER_MILE))} miles`) }] : []),
      ],
      table: { caption: "Time at this pace, held constant", columns: ["Distance", "Time"], rows: races.map(([label, km]) => [label, clock(secPerKm * km)]) },
      steps: [`Pace = time ÷ distance, speed = distance ÷ time`, `1 mile = ${KM_PER_MILE} km exactly, so pace per mile = pace per km × ${KM_PER_MILE}`],
      notes: ["The race table assumes you hold exactly this pace for the whole distance. Real races are rarely that even, and longer distances usually slow the pace."],
    });
  },
};
