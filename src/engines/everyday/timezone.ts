import type { EngineMap } from "@/tools/types";
import { D, N, T } from "@/lib/format";
import { WEEKDAYS, MONTHS, parseISODate } from "@/lib/dates";
import { TIME_ZONES, formatOffset, instantToZoned, isValidTimeZone, pad2, wallTimeToInstant } from "@/lib/tz";
import { fail, ok, str } from "../helpers";

const zoneLabel = (id: string) =>
  TIME_ZONES.find((z) => z.id === id)?.label.split(" — ").pop()?.split(" / ")[0].replace(/ \(.*\)/, "") ?? id;

const SAMPLE_ZONES = ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

function describe(epochMs: number, zone: string): string {
  const z = instantToZoned(epochMs, zone);
  return `${WEEKDAYS[z.weekday].slice(0, 3)}, ${z.d} ${MONTHS[z.m - 1].slice(0, 3)} ${z.y}, ${pad2(z.hh)}:${pad2(z.mm)} (${formatOffset(z.offsetMinutes)})`;
}

export const engines: EngineMap = {
  "timezone-converter": (v) => {
    const date = parseISODate(str(v, "date"));
    if (!date) return fail("That isn't a real calendar date.", "date");
    const [hh, mm] = str(v, "time").split(":").map(Number);
    const fromZone = str(v, "from");
    const toZone = str(v, "to");
    if (!isValidTimeZone(fromZone)) return fail("This device doesn't recognise that source time zone.", "from");
    if (!isValidTimeZone(toZone)) return fail("This device doesn't recognise that target time zone.", "to");
    const resolved = wallTimeToInstant({ ...date, hh, mm }, fromZone);
    if (resolved.status === "gap") {
      return fail(`${str(v, "time")} on ${str(v, "date")} doesn't exist in ${zoneLabel(fromZone)} — clocks skip forward that night for daylight saving. Pick a time just before or after.`, "time");
    }
    const notes: string[] = [];
    if (resolved.status === "ambiguous") {
      notes.push(`${str(v, "time")} happens twice in ${zoneLabel(fromZone)} that day (clocks go back). The earlier occurrence is used; the later one is ${describe(resolved.alternative, toZone)} in ${zoneLabel(toZone)}.`);
    }
    const epoch = resolved.epochMs;
    const target = instantToZoned(epoch, toZone);
    const source = instantToZoned(epoch, fromZone);
    const diffMin = target.offsetMinutes - source.offsetMinutes;
    const diffText = diffMin === 0 ? "Same offset" : `${Math.abs(diffMin) / 60} hours ${diffMin > 0 ? "ahead of" : "behind"} ${zoneLabel(fromZone)}`;
    return ok({
      primary: { label: `Time in ${zoneLabel(toZone)}`, value: T(describe(epoch, toZone)) },
      secondary: [
        { label: "Date there", value: D(target.isoDate) },
        { label: "Difference", value: T(diffText.replace("1 hours", "1 hour")) },
        { label: "UTC time", value: T(describe(epoch, "UTC").replace(" (UTC+00:00)", " UTC")) },
        { label: "Unix timestamp (seconds)", value: N(Math.floor(epoch / 1000)) },
      ],
      table: {
        caption: "The same moment in other places",
        columns: ["Time zone", "Local time"],
        rows: SAMPLE_ZONES.filter((z) => z !== toZone && isValidTimeZone(z)).map((z) => [zoneLabel(z), describe(epoch, z)]),
        maxHeight: true,
      },
      steps: [
        `${str(v, "date")} ${str(v, "time")} in ${zoneLabel(fromZone)} is ${formatOffset(source.offsetMinutes)}`,
        `Subtracting that offset gives the universal moment (UTC) ${describe(epoch, "UTC").replace(" (UTC+00:00)", " UTC")}`,
        `Adding ${zoneLabel(toZone)}'s offset ${formatOffset(target.offsetMinutes)} on that date gives the local time`,
      ],
      notes: [...notes, "Daylight-saving rules come from your device's time-zone database, so past and near-future dates are reliable; far-future dates assume today's rules."],
    });
  },
};
