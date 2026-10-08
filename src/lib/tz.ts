/**
 * Time-zone helpers built on Intl (the browser's / Node's IANA database).
 * Distinguishes between a wall-clock time in a zone and an absolute instant, and reports
 * daylight-saving gaps (time does not exist) and overlaps (time occurs twice).
 */
import { fromEpochDay } from "./dates";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds (positive = ahead of UTC). */
export function tzOffsetMs(epochMs: number, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

export type WallTime = { y: number; m: number; d: number; hh: number; mm: number };
export type ZonedResolution =
  | { status: "ok"; epochMs: number }
  | { status: "ambiguous"; epochMs: number; alternative: number }
  | { status: "gap" };

/** Convert a wall-clock time in `timeZone` to an instant. */
export function wallTimeToInstant(w: WallTime, timeZone: string): ZonedResolution {
  const wall = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, 0);
  const offsets = new Set([tzOffsetMs(wall - 86_400_000, timeZone), tzOffsetMs(wall + 86_400_000, timeZone)]);
  const valid: number[] = [];
  for (const offset of offsets) {
    const candidate = wall - offset;
    if (tzOffsetMs(candidate, timeZone) === offset) valid.push(candidate);
  }
  valid.sort((a, b) => a - b);
  if (valid.length === 0) return { status: "gap" };
  if (valid.length === 1) return { status: "ok", epochMs: valid[0] };
  return { status: "ambiguous", epochMs: valid[0], alternative: valid[1] };
}

export type ZonedParts = {
  y: number; m: number; d: number; hh: number; mm: number; ss: number;
  offsetMinutes: number; weekday: number; isoDate: string;
};

export function instantToZoned(epochMs: number, timeZone: string): ZonedParts {
  const offset = tzOffsetMs(epochMs, timeZone);
  const local = epochMs + offset;
  const day = Math.floor(local / 86_400_000);
  const msOfDay = local - day * 86_400_000;
  const { y, m, d } = fromEpochDay(day);
  return {
    y, m, d,
    hh: Math.floor(msOfDay / 3_600_000),
    mm: Math.floor((msOfDay % 3_600_000) / 60_000),
    ss: Math.floor((msOfDay % 60_000) / 1000),
    offsetMinutes: offset / 60_000,
    weekday: (((day + 4) % 7) + 7) % 7,
    isoDate: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  };
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

export type ZoneOption = { id: string; label: string; group: string };

/** Curated list of widely used IANA zones (kept short on purpose; the database itself is not). */
export const TIME_ZONES: ZoneOption[] = [
  { id: "UTC", label: "UTC (Coordinated Universal Time)", group: "Universal" },
  { id: "Asia/Kolkata", label: "India — Kolkata / Mumbai / Delhi", group: "Asia" },
  { id: "Asia/Dubai", label: "UAE — Dubai", group: "Asia" },
  { id: "Asia/Karachi", label: "Pakistan — Karachi", group: "Asia" },
  { id: "Asia/Dhaka", label: "Bangladesh — Dhaka", group: "Asia" },
  { id: "Asia/Kathmandu", label: "Nepal — Kathmandu", group: "Asia" },
  { id: "Asia/Colombo", label: "Sri Lanka — Colombo", group: "Asia" },
  { id: "Asia/Bangkok", label: "Thailand — Bangkok", group: "Asia" },
  { id: "Asia/Singapore", label: "Singapore", group: "Asia" },
  { id: "Asia/Hong_Kong", label: "Hong Kong", group: "Asia" },
  { id: "Asia/Shanghai", label: "China — Shanghai / Beijing", group: "Asia" },
  { id: "Asia/Manila", label: "Philippines — Manila", group: "Asia" },
  { id: "Asia/Tokyo", label: "Japan — Tokyo", group: "Asia" },
  { id: "Asia/Seoul", label: "South Korea — Seoul", group: "Asia" },
  { id: "Asia/Riyadh", label: "Saudi Arabia — Riyadh", group: "Asia" },
  { id: "Asia/Tehran", label: "Iran — Tehran", group: "Asia" },
  { id: "Europe/London", label: "United Kingdom — London", group: "Europe" },
  { id: "Europe/Dublin", label: "Ireland — Dublin", group: "Europe" },
  { id: "Europe/Lisbon", label: "Portugal — Lisbon", group: "Europe" },
  { id: "Europe/Paris", label: "France — Paris", group: "Europe" },
  { id: "Europe/Berlin", label: "Germany — Berlin", group: "Europe" },
  { id: "Europe/Madrid", label: "Spain — Madrid", group: "Europe" },
  { id: "Europe/Rome", label: "Italy — Rome", group: "Europe" },
  { id: "Europe/Amsterdam", label: "Netherlands — Amsterdam", group: "Europe" },
  { id: "Europe/Athens", label: "Greece — Athens", group: "Europe" },
  { id: "Europe/Istanbul", label: "Turkey — Istanbul", group: "Europe" },
  { id: "Europe/Moscow", label: "Russia — Moscow", group: "Europe" },
  { id: "Africa/Cairo", label: "Egypt — Cairo", group: "Africa" },
  { id: "Africa/Lagos", label: "Nigeria — Lagos", group: "Africa" },
  { id: "Africa/Nairobi", label: "Kenya — Nairobi", group: "Africa" },
  { id: "Africa/Johannesburg", label: "South Africa — Johannesburg", group: "Africa" },
  { id: "America/New_York", label: "US Eastern — New York", group: "Americas" },
  { id: "America/Chicago", label: "US Central — Chicago", group: "Americas" },
  { id: "America/Denver", label: "US Mountain — Denver", group: "Americas" },
  { id: "America/Phoenix", label: "US Arizona — Phoenix (no DST)", group: "Americas" },
  { id: "America/Los_Angeles", label: "US Pacific — Los Angeles", group: "Americas" },
  { id: "America/Anchorage", label: "US Alaska — Anchorage", group: "Americas" },
  { id: "Pacific/Honolulu", label: "US Hawaii — Honolulu", group: "Americas" },
  { id: "America/Toronto", label: "Canada — Toronto", group: "Americas" },
  { id: "America/Vancouver", label: "Canada — Vancouver", group: "Americas" },
  { id: "America/Mexico_City", label: "Mexico — Mexico City", group: "Americas" },
  { id: "America/Sao_Paulo", label: "Brazil — São Paulo", group: "Americas" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina — Buenos Aires", group: "Americas" },
  { id: "Australia/Perth", label: "Australia — Perth", group: "Oceania" },
  { id: "Australia/Adelaide", label: "Australia — Adelaide", group: "Oceania" },
  { id: "Australia/Sydney", label: "Australia — Sydney / Melbourne", group: "Oceania" },
  { id: "Australia/Brisbane", label: "Australia — Brisbane (no DST)", group: "Oceania" },
  { id: "Pacific/Auckland", label: "New Zealand — Auckland", group: "Oceania" },
];
