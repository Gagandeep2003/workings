import type { EngineMap, Values } from "@/tools/types";
import { D, DUR, N, T, formatNumber } from "@/lib/format";
import {
  WEEKDAYS, addDays, addYMD, diffYMD, formatISO, parseDateList, parseISODate, toEpochDay, weekdayOf, weekendDays,
  type WeekendPattern, type YMD,
} from "@/lib/dates";
import { fail, num, ok, optNum, str } from "../helpers";

const f = (n: number) => formatNumber(n);
const parseDate = (v: Values, id: string): YMD | null => parseISODate(str(v, id));
const BAD = "That isn't a real calendar date. Check the day and month (for example, 31 April and 29 February in a non-leap year don't exist).";

function countWorking(from: YMD, to: YMD, weekend: number[], holidays: Set<number>) {
  let working = 0;
  let weekends = 0;
  let holidayHits = 0;
  const a = toEpochDay(from);
  const b = toEpochDay(to);
  for (let day = a; day <= b; day++) {
    const dow = (((day + 4) % 7) + 7) % 7;
    if (weekend.includes(dow)) weekends++;
    else if (holidays.has(day)) holidayHits++;
    else working++;
  }
  return { working, weekends, holidayHits, calendar: b - a + 1 };
}

export const engines: EngineMap = {
  "age-calculator": (v, ctx) => {
    const dob = parseDate(v, "dob");
    if (!dob) return fail(BAD, "dob");
    const asOfText = str(v, "asof");
    if (asOfText && !parseISODate(asOfText)) return fail(BAD, "asof");
    const asOf = parseISODate(asOfText || ctx.today);
    return ageResult(dob, asOf, asOfText === "");
  },

  "days-between-dates-calculator": (v) => {
    const a = parseDate(v, "start");
    const b = parseDate(v, "end");
    if (!a) return fail(BAD, "start");
    if (!b) return fail(BAD, "end");
    const reversed = toEpochDay(b) < toEpochDay(a);
    const [from, to] = reversed ? [b, a] : [a, b];
    const inclusive = str(v, "include") === "yes";
    const diff = diffYMD(from, to);
    const total = diff.totalDays + (inclusive ? 1 : 0);
    const wdow = weekdayOf(to);
    const weekdays = countWorking(from, to, [6, 0], new Set()).working - (inclusive || wdow === 0 || wdow === 6 ? 0 : 1);
    return ok({
      primary: { label: "Days between", value: N(total, total === 1 ? "day" : "days") },
      secondary: [
        { label: "Weeks and days", value: T(`${Math.floor(total / 7)} weeks, ${total % 7} days`) },
        { label: "Years, months, days", value: DUR({ years: diff.years, months: diff.months, days: diff.days }) },
        { label: "Weekdays (Mon–Fri) in the range", value: N(weekdays) },
        { label: "Hours", value: N(total * 24, "hours") },
      ],
      steps: [
        `${formatISO(from)} to ${formatISO(to)} is ${f(diff.totalDays)} days apart`,
        ...(inclusive ? ["Including the end date adds 1 day"] : []),
      ],
      notes: reversed ? ["The end date is before the start date, so the dates were swapped — the result is the size of the gap."] : [],
    });
  },

  "days-until-date-calculator": (v, ctx) => {
    const target = parseDate(v, "target");
    if (!target) return fail(BAD, "target");
    const today = parseISODate(ctx.today);
    if (!today) return fail("Couldn't read today's date from this device.");
    const diffDays = toEpochDay(target) - toEpochDay(today);
    const label = str(v, "label");
    const past = diffDays < 0;
    const [from, to] = past ? [target, today] : [today, target];
    const diff = diffYMD(from, to);
    const abs = Math.abs(diffDays);
    return ok({
      primary: { label: past ? `Days since${label ? ` ${label}` : ""}` : diffDays === 0 ? "That's today" : `Days until${label ? ` ${label}` : ""}`, value: N(abs, abs === 1 ? "day" : "days") },
      secondary: [
        { label: "Weeks and days", value: T(`${Math.floor(abs / 7)} weeks, ${abs % 7} days`) },
        { label: "Years, months, days", value: DUR({ years: diff.years, months: diff.months, days: diff.days }) },
        { label: "Falls on", value: D(formatISO(target)) },
        { label: "Today (your device's date)", value: D(ctx.today) },
      ],
      steps: [`${formatISO(target)} − ${ctx.today} = ${f(diffDays)} days`],
    });
  },

  "date-add-subtract-calculator": (v) => {
    const start = parseDate(v, "start");
    if (!start) return fail(BAD, "start");
    const years = optNum(v, "years") ?? 0;
    const months = optNum(v, "months") ?? 0;
    const weeks = optNum(v, "weeks") ?? 0;
    const days = optNum(v, "days") ?? 0;
    if (years + months + weeks + days === 0) return fail("Enter at least one of years, months, weeks or days.", "days");
    const sign = str(v, "op") === "subtract" ? -1 : 1;
    const result = addYMD(start, sign * years, sign * months, sign * (weeks * 7 + days));
    if (result.y < 1 || result.y > 9999) return fail("The result is outside the supported years (1–9999).");
    const parts = [years && `${f(years)} year${years === 1 ? "" : "s"}`, months && `${f(months)} month${months === 1 ? "" : "s"}`, weeks && `${f(weeks)} week${weeks === 1 ? "" : "s"}`, days && `${f(days)} day${days === 1 ? "" : "s"}`].filter(Boolean).join(", ");
    return ok({
      primary: { label: sign === 1 ? "Date after adding" : "Date after subtracting", value: D(formatISO(result)) },
      secondary: [{ label: "ISO format", value: T(formatISO(result)) }, { label: "Total days moved", value: N(toEpochDay(result) - toEpochDay(start), "days") }],
      steps: [`${formatISO(start)} ${sign === 1 ? "+" : "−"} ${parts}`, "Years and months are applied first (a day that doesn't exist, like 31 Feb, moves to the last day of that month), then weeks and days."],
    });
  },

  "working-days-calculator": (v) => {
    const start = parseDate(v, "start");
    if (!start) return fail(BAD, "start");
    const weekend = weekendDays(str(v, "weekend") as WeekendPattern);
    const { dates, invalid } = parseDateList(str(v, "holidays"));
    if (invalid.length) return fail(`Couldn't read these as dates: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}. Use YYYY-MM-DD, separated by commas or new lines.`, "holidays");
    const holidays = new Set(dates.map(toEpochDay));
    if (str(v, "mode") === "add") {
      const n = num(v, "count");
      if (n > 10000) return fail("That's too many working days to add (limit 10,000).", "count");
      let day = toEpochDay(start);
      let left = n;
      let guard = 0;
      while (left > 0 && guard++ < 200000) {
        day++;
        const dow = (((day + 4) % 7) + 7) % 7;
        if (!weekend.includes(dow) && !holidays.has(day)) left--;
      }
      const end = formatISO(addDays(start, day - toEpochDay(start)));
      return ok({
        primary: { label: `Date after ${f(n)} working days`, value: D(end) },
        secondary: [{ label: "Calendar days later", value: N(day - toEpochDay(start), "days") }],
        steps: [`Starting after ${formatISO(start)}, count forward skipping weekends${dates.length ? " and your holidays" : ""} until ${f(n)} working days are reached`],
        notes: ["The start date itself is not counted — day 1 is the next working day."],
      });
    }
    const end = parseDate(v, "end");
    if (!end) return fail(BAD, "end");
    if (toEpochDay(end) < toEpochDay(start)) return fail("The end date is before the start date.", "end");
    const r = countWorking(start, end, weekend, holidays);
    return ok({
      primary: { label: "Working days", value: N(r.working, r.working === 1 ? "day" : "days") },
      secondary: [
        { label: "Calendar days (inclusive)", value: N(r.calendar) },
        { label: "Weekend days", value: N(r.weekends) },
        { label: "Holidays on working days", value: N(r.holidayHits) },
      ],
      steps: [`${r.calendar} calendar days (both dates included) − ${r.weekends} weekend days − ${r.holidayHits} holidays = ${r.working} working days`],
      notes: ["Both the start and end dates are included. Public holidays differ by country and region, so list yours above."],
    });
  },
};

export function ageResult(dob: YMD, asOf: YMD | null, usingToday: boolean) {
  if (!asOf) return fail("Couldn't read today's date from this device — enter an 'Age at date' instead.", "asof");
  if (toEpochDay(dob) > toEpochDay(asOf)) return fail("The date of birth is after the 'age at' date. Check both dates.", "dob");
  const d = diffYMD(dob, asOf);
  let next = { y: asOf.y, m: dob.m, d: dob.m === 2 && dob.d === 29 && !((asOf.y % 4 === 0 && asOf.y % 100 !== 0) || asOf.y % 400 === 0) ? 28 : dob.d };
  if (toEpochDay(next) < toEpochDay(asOf)) {
    const y = asOf.y + 1;
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    next = { y, m: dob.m, d: dob.m === 2 && dob.d === 29 && !leap ? 28 : dob.d };
  }
  const untilNext = toEpochDay(next) - toEpochDay(asOf);
  const totalMonths = d.years * 12 + d.months;
  return ok({
    primary: { label: "Age", value: DUR({ years: d.years, months: d.months, days: d.days }) },
    secondary: [
      { label: "Total months", value: N(totalMonths) },
      { label: "Total weeks", value: N(Math.floor(d.totalDays / 7)) },
      { label: "Total days", value: N(d.totalDays) },
      { label: "Born on a", value: T(WEEKDAYS[weekdayOf(dob)]) },
      { label: "Next birthday", value: untilNext === 0 ? T("Today! 🎂") : T(`${formatISO(next)} (in ${untilNext} day${untilNext === 1 ? "" : "s"})`) },
    ],
    steps: [`From ${formatISO(dob)} to ${formatISO(asOf)}: ${d.years} full years, then ${d.months} full months, then ${d.days} days`, "Someone born on 29 February is treated as turning a year older on 28 February in non-leap years."],
    notes: usingToday ? ["Calculated to today's date on your device."] : [],
  });
}
