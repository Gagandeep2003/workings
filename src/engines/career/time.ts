import type { EngineMap } from "@/tools/types";
import { D, DUR, N, T, formatNumber } from "@/lib/format";
import { addDays, addMonths, diffYMD, formatISO, fromEpochDay, parseISODate, toEpochDay, weekdayOf, WEEKDAYS, type YMD } from "@/lib/dates";
import { lines } from "@/lib/lists";
import { clean, round } from "@/lib/numeric";
import { fail, num, ok, optNum, str } from "../helpers";

const f = (n: number) => formatNumber(n, { maxDecimals: 4 });

function normalise(years: number, months: number, days: number) {
  months += Math.floor(days / 30);
  days %= 30;
  years += Math.floor(months / 12);
  months %= 12;
  return { years, months, days };
}

export const engines: EngineMap = {
  "experience-calculator": (v, ctx) => {
    const rows = lines(str(v, "periods"));
    if (rows.length === 0) return fail("Enter at least one job on its own line, like  2019-06-03 to 2022-03-31  (or 'present' for a current job).", "periods");
    if (rows.length > 50) return fail("Too many lines — the limit is 50.", "periods");
    type Period = { label: string; start: number; end: number };
    const periods: Period[] = [];
    for (const row of rows) {
      const dates = row.text.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
      const open = /\b(present|current|now|today|till date|to date)\b/i.test(row.text);
      const label = row.text.replace(/\d{4}-\d{2}-\d{2}/g, "").replace(/\b(to|present|current|now|today|till date|to date)\b/gi, "").replace(/[-–—,→:]+/g, " ").replace(/\s+/g, " ").trim();
      let start: YMD | null;
      let end: YMD | null;
      if (dates.length === 2) {
        start = parseISODate(dates[0]);
        end = parseISODate(dates[1]);
      } else if (dates.length === 1 && open) {
        start = parseISODate(dates[0]);
        end = parseISODate(ctx.today);
      } else {
        return fail(`Line ${row.line} ("${row.text.slice(0, 40)}") needs a start and an end date like 2019-06-03 to 2022-03-31, or a start date followed by 'present'.`, "periods");
      }
      if (!start || !end) return fail(`Line ${row.line} contains a date that doesn't exist on the calendar. Use YYYY-MM-DD.`, "periods");
      if (toEpochDay(end) < toEpochDay(start)) return fail(`Line ${row.line}: the end date is before the start date.`, "periods");
      periods.push({ label: label || `Job ${periods.length + 1}`, start: toEpochDay(start), end: toEpochDay(end) });
    }
    const sorted = [...periods].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const p of sorted) {
      const last = merged[merged.length - 1];
      if (last && p.start <= last.end + 1) last.end = Math.max(last.end, p.end);
      else merged.push({ ...p });
    }
    const durationOf = (s: number, e: number) => diffYMD(fromEpochDay(s), fromEpochDay(e + 1));
    const sumDays = (list: { start: number; end: number }[]) => list.reduce((s, p) => s + (p.end - p.start + 1), 0);
    const mergedDays = sumDays(merged);
    const rawDays = sumDays(periods);
    let y = 0, m = 0, d = 0;
    for (const p of merged) {
      const part = durationOf(p.start, p.end);
      y += part.years; m += part.months; d += part.days;
    }
    const total = normalise(y, m, d);
    const gaps = merged.slice(1).reduce((s, p, i) => s + (p.start - merged[i].end - 1), 0);
    const notes: string[] = ["Both the first and last day of each job are counted as worked."];
    if (rawDays !== mergedDays) notes.push(`Overlapping periods are counted once (${formatNumber(rawDays - mergedDays)} overlapping days removed).`);
    if (merged.length > 1) notes.push("With several separate periods, months are added up and every 30 leftover days are counted as one month.");
    return ok({
      primary: { label: "Total experience", value: DUR(total) },
      secondary: [
        { label: "Total months (approx.)", value: N(round(mergedDays / 30.436875, 1), "months") },
        { label: "Total days worked", value: N(mergedDays) },
        { label: "Total in years", value: N(round(mergedDays / 365.2425, 2), "years") },
        ...(gaps > 0 ? [{ label: "Gaps between jobs", value: N(gaps, "days") }] : []),
      ],
      table: {
        columns: ["Role", "From", "To", "Duration"],
        rows: periods.map((p) => [p.label, D(formatISO(fromEpochDay(p.start))), D(formatISO(fromEpochDay(p.end))), DUR(durationOf(p.start, p.end))]),
      },
      steps: [`Each period runs from its start date up to and including its end date, e.g. ${formatISO(fromEpochDay(periods[0].start))} → ${formatISO(fromEpochDay(periods[0].end))}`, "Overlaps and back-to-back periods are merged first so no day is counted twice."],
      notes,
    });
  },

  "notice-period-calculator": (v, ctx) => {
    const start = parseISODate(str(v, "start"));
    if (!start) return fail("That isn't a real calendar date.", "start");
    const n = num(v, "length");
    const unit = str(v, "unit");
    const counting = str(v, "counting");
    const dayOne = str(v, "dayOne");
    if (unit === "months" && !Number.isInteger(n)) return fail("Notice in months must be a whole number (use days for part-months).", "length");
    if (counting === "working" && unit === "months") return fail("Working-day counting works with days or weeks. Switch the notice unit to days (for example 60 days), or count in calendar time.", "counting");
    let last: YMD;
    let calendarDays: number;
    if (counting === "working") {
      const target = unit === "weeks" ? n * 5 : n;
      let day = toEpochDay(start) + (dayOne === "same" ? -1 : 0);
      let left = target;
      let guard = 0;
      while (left > 0 && guard++ < 100000) {
        day++;
        const dow = (((day + 4) % 7) + 7) % 7;
        if (dow !== 0 && dow !== 6) left--;
      }
      last = fromEpochDay(day);
      calendarDays = day - toEpochDay(start) + (dayOne === "same" ? 1 : 0);
    } else {
      const base = unit === "months" ? addMonths(start, n) : addDays(start, unit === "weeks" ? n * 7 : n);
      last = dayOne === "same" ? addDays(base, -1) : base;
      calendarDays = toEpochDay(last) - toEpochDay(start) + (dayOne === "same" ? 1 : 0);
    }
    const dow = weekdayOf(last);
    const today = parseISODate(ctx.today);
    const left = today ? toEpochDay(last) - toEpochDay(today) : undefined;
    const notes: string[] = [];
    if (dow === 0 || dow === 6) notes.push(`That day is a ${WEEKDAYS[dow]}. Many employers set the last working day to the Friday before — confirm with HR.`);
    notes.push("Holidays and approved leave during the notice period can extend or shorten the last day. Your employment contract decides.");
    return ok({
      primary: { label: "Last day of notice", value: D(formatISO(last)) },
      secondary: [
        { label: "Calendar days in the notice period", value: N(calendarDays) },
        ...(left !== undefined ? [{ label: "From today (your device date)", value: T(left > 0 ? `${left} days to go` : left === 0 ? "Last day is today" : `${-left} days ago`) }] : []),
      ],
      steps: [`${formatISO(start)} + ${f(n)} ${counting === "working" ? "working " : ""}${unit}${dayOne === "same" ? ", counting the resignation day as day 1" : ", counting from the next day"} = ${formatISO(last)}`],
      notes,
    });
  },

  "leave-calculator": (v, ctx) => {
    const annual = num(v, "annual");
    const startMonth = Number(str(v, "startMonth"));
    const asOf = parseISODate(str(v, "asof") || ctx.today);
    if (!asOf) return fail("That isn't a real calendar date.", "asof");
    const joiningText = str(v, "joining");
    const joining = joiningText ? parseISODate(joiningText) : null;
    if (joiningText && !joining) return fail("That isn't a real calendar date.", "joining");
    const taken = optNum(v, "taken") ?? 0;
    const carry = optNum(v, "carry") ?? 0;
    const lyStart: YMD = asOf.m >= startMonth ? { y: asOf.y, m: startMonth, d: 1 } : { y: asOf.y - 1, m: startMonth, d: 1 };
    const lyNext = addMonths(lyStart, 12);
    const lyDays = toEpochDay(lyNext) - toEpochDay(lyStart);
    if (joining && toEpochDay(joining) > toEpochDay(asOf)) return fail("The joining date is after the 'as of' date.", "joining");
    const effStart = joining && toEpochDay(joining) > toEpochDay(lyStart) ? joining : lyStart;
    const elapsedDays = toEpochDay(asOf) - toEpochDay(effStart) + 1;
    let accrued: number;
    let step: string;
    if (str(v, "method") === "monthly") {
      const d = diffYMD(effStart, fromEpochDay(toEpochDay(asOf) + 1));
      const months = d.years * 12 + d.months;
      accrued = clean((annual * months) / 12);
      step = `Completed months in this leave year = ${months}; accrued = ${f(annual)} × ${months} ÷ 12 = ${f(accrued)} days`;
    } else {
      accrued = clean((annual * elapsedDays) / lyDays);
      step = `Days elapsed = ${elapsedDays} of ${lyDays}; accrued = ${f(annual)} × ${elapsedDays} ÷ ${lyDays} = ${f(accrued)} days`;
    }
    const proRataYear = clean((annual * (toEpochDay(lyNext) - toEpochDay(effStart))) / lyDays);
    const balance = clean(accrued + carry - taken);
    const notes: string[] = [];
    if (balance < 0) notes.push(`You've taken ${f(-balance)} more days than you've accrued so far. Check whether your employer allows leave in advance.`);
    if (joining && toEpochDay(joining) > toEpochDay(lyStart)) notes.push("Because you joined during this leave year, accrual starts from your joining date.");
    notes.push("Leave rules (accrual timing, rounding to half-days, carry-forward caps, public holidays) vary by employer and country. This follows a simple pro-rata model.");
    return ok({
      primary: { label: "Leave balance", value: N(round(balance, 2), "days") },
      secondary: [
        { label: "Accrued so far this leave year", value: N(round(accrued, 2), "days") },
        { label: "Taken", value: N(taken, "days") },
        { label: "Carried forward", value: N(carry, "days") },
        { label: "Full-year entitlement (pro-rata if you joined late)", value: N(round(proRataYear, 2), "days") },
        { label: "Leave year", value: T(`${formatISO(lyStart)} to ${formatISO(addDays(lyNext, -1))}`) },
      ],
      steps: [step, `Balance = accrued + carried forward − taken = ${f(accrued)} + ${f(carry)} − ${f(taken)} = ${f(balance)} days`],
      notes,
    });
  },
};

