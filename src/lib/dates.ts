/**
 * Date-only (civil calendar) arithmetic. No JavaScript Date objects are used for calculations,
 * so there are no time-zone or daylight-saving surprises. Days are counted as integer
 * "epoch days" since 1970-01-01 in the proleptic Gregorian calendar.
 */

export type YMD = { y: number; m: number; d: number };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function isValidYMD({ y, m, d }: YMD): boolean {
  return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
    y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Strict YYYY-MM-DD parser. Returns null for anything that is not a real calendar date. */
export function parseISODate(text: string | undefined): YMD | null {
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const ymd = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return isValidYMD(ymd) ? ymd : null;
}

export function formatISO({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Days since 1970-01-01 (Howard Hinnant's civil-from-days algorithm). */
export function toEpochDay({ y, m, d }: YMD): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(epochDay: number): YMD {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return { y, m, d };
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(epochDay: number): number {
  return (((epochDay + 4) % 7) + 7) % 7;
}

export const weekdayOf = (ymd: YMD): number => dayOfWeek(toEpochDay(ymd));

export function addDays(ymd: YMD, days: number): YMD {
  return fromEpochDay(toEpochDay(ymd) + days);
}

/** Add calendar months; if the target month is shorter the day is clamped (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(ymd: YMD, months: number): YMD {
  const total = ymd.y * 12 + (ymd.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return { y, m, d: Math.min(ymd.d, daysInMonth(y, m)) };
}

export function compareYMD(a: YMD, b: YMD): number {
  return toEpochDay(a) - toEpochDay(b);
}

export type YMDDiff = { years: number; months: number; days: number; totalDays: number };

/**
 * Calendar difference between two dates (from <= to): whole years, whole months, remaining days.
 * Whole months are the largest count such that from + months <= to (with month-end clamping).
 */
export function diffYMD(from: YMD, to: YMD): YMDDiff {
  const totalDays = toEpochDay(to) - toEpochDay(from);
  if (totalDays < 0) throw new RangeError("diffYMD requires from <= to");
  let totalMonths = (to.y - from.y) * 12 + (to.m - from.m);
  if (compareYMD(addMonths(from, totalMonths), to) > 0) totalMonths -= 1;
  const mid = addMonths(from, totalMonths);
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: toEpochDay(to) - toEpochDay(mid),
    totalDays,
  };
}

/** Add years, months, then days to a date (years/months first, as most people expect). */
export function addYMD(ymd: YMD, years: number, months: number, days: number): YMD {
  return addDays(addMonths(ymd, years * 12 + months), days);
}

export function formatDateLong(iso: string): string {
  const ymd = parseISODate(iso);
  if (!ymd) return iso;
  return `${WEEKDAYS[weekdayOf(ymd)]}, ${ymd.d} ${MONTHS[ymd.m - 1]} ${ymd.y}`;
}

export function formatDateShort(ymd: YMD): string {
  return `${ymd.d} ${MONTHS[ymd.m - 1].slice(0, 3)} ${ymd.y}`;
}

/** Today's date in the *device's* local calendar, as YYYY-MM-DD. */
export function localTodayISO(now: Date = new Date()): string {
  return formatISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

/** Parse a list of ISO dates separated by commas, spaces or new lines. */
export function parseDateList(text: string | undefined): { dates: YMD[]; invalid: string[] } {
  const dates: YMD[] = [];
  const invalid: string[] = [];
  if (!text) return { dates, invalid };
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const parsed = parseISODate(token);
    if (parsed) dates.push(parsed);
    else invalid.push(token);
  }
  return { dates, invalid };
}

export type WeekendPattern = "sat-sun" | "fri-sat" | "sun-only" | "none";
export function weekendDays(pattern: WeekendPattern): number[] {
  switch (pattern) {
    case "sat-sun": return [6, 0];
    case "fri-sat": return [5, 6];
    case "sun-only": return [0];
    default: return [];
  }
}
