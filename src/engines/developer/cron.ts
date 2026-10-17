import type { EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { fail, ok, str } from "../helpers";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MACROS: Record<string, string> = { "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *" };

type Spec = { name: string; min: number; max: number; names?: string[]; nameBase?: number };
const SPECS: Spec[] = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day of month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12, names: MONTHS.map((m) => m.slice(0, 3).toUpperCase()), nameBase: 1 },
  { name: "day of week", min: 0, max: 7, names: DAYS.map((d) => d.slice(0, 3).toUpperCase()), nameBase: 0 },
];

export class CronError extends Error {}

export type ParsedField = { text: string; values: number[]; star: boolean };

function parseField(text: string, spec: Spec): ParsedField {
  const out = new Set<number>();
  const value = (tok: string): number => {
    const upper = tok.toUpperCase();
    if (spec.names) {
      const i = spec.names.indexOf(upper);
      if (i >= 0) return i + (spec.nameBase ?? 0);
    }
    if (!/^\d+$/.test(tok)) throw new CronError(`"${tok}" isn't a valid ${spec.name} value${spec.names ? " (use a number or a three-letter name)" : ""}.`);
    const n = Number(tok);
    if (n < spec.min || n > spec.max) throw new CronError(`${n} is outside the ${spec.name} range ${spec.min}–${spec.max}.`);
    return n;
  };
  for (const part of text.split(",")) {
    if (part === "") throw new CronError(`The ${spec.name} field has an empty item (a stray comma).`);
    if (/[?LW#]/i.test(part) && !(spec.names && spec.names.includes(part.toUpperCase()))) {
      if (/^\?$/.test(part)) throw new CronError(`"?" is a Quartz-style extension and isn't part of standard 5-field cron. Use * instead.`);
      if (/[LW#]/i.test(part) && !/^[A-Za-z]{3}(-[A-Za-z]{3})?(\/\d+)?$/.test(part)) throw new CronError(`"${part}" uses L, W or # (Quartz-style), which standard 5-field cron doesn't support.`);
    }
    const [range, stepText, extra] = part.split("/");
    if (extra !== undefined) throw new CronError(`"${part}" has more than one "/".`);
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) < 1) throw new CronError(`The step in "${part}" must be a whole number of 1 or more.`);
      step = Number(stepText);
    }
    let lo: number, hi: number;
    if (range === "*") { lo = spec.min; hi = spec.name === "day of week" ? 6 : spec.max; }
    else if (range.includes("-")) {
      const [a, b, more] = range.split("-");
      if (more !== undefined || a === "" || b === "") throw new CronError(`"${range}" isn't a valid range.`);
      lo = value(a); hi = value(b);
      if (lo > hi) throw new CronError(`The range "${range}" runs backwards (${lo} is after ${hi}). Ranges can't wrap around — list the two parts separately instead, like 22-23,0-5.`);
    } else {
      lo = value(range);
      hi = stepText !== undefined ? (spec.name === "day of week" ? 6 : spec.max) : lo;
    }
    for (let x = lo; x <= hi; x += step) out.add(spec.name === "day of week" && x === 7 ? 0 : x);
  }
  return { text, values: [...out].sort((a, b) => a - b), star: text.startsWith("*") };
}

export function parseCron(expression: string): { fields: ParsedField[]; normalised: string } {
  let expr = expression.trim().replace(/\s+/g, " ");
  if (expr.toLowerCase() === "@reboot") throw new CronError("@reboot runs once at startup, so it has no schedule to calculate.");
  const macro = MACROS[expr.toLowerCase()];
  if (macro) expr = macro;
  const parts = expr.split(" ");
  if (parts.length === 6 || parts.length === 7) throw new CronError(`This has ${parts.length} fields. Standard cron has exactly 5 (minute, hour, day of month, month, day of week). Some schedulers add a seconds or a year field — remove it to check the schedule here.`);
  if (parts.length !== 5) throw new CronError(`Cron needs exactly 5 fields separated by spaces: minute hour day-of-month month day-of-week. You entered ${parts.length}.`);
  const fields = parts.map((p, i) => {
    try { return parseField(p, SPECS[i]); } catch (e) { throw e instanceof CronError ? new CronError(`Field ${i + 1} (${SPECS[i].name}): ${e.message}`) : e; }
  });
  return { fields, normalised: parts.join(" ") };
}

const pad = (n: number) => String(n).padStart(2, "0");

function listText(vals: number[], fmt: (n: number) => string): string {
  const parts: string[] = [];
  for (let i = 0; i < vals.length;) {
    let j = i;
    while (j + 1 < vals.length && vals[j + 1] === vals[j] + 1) j++;
    if (j - i >= 2) parts.push(`${fmt(vals[i])} through ${fmt(vals[j])}`);
    else for (let k = i; k <= j; k++) parts.push(fmt(vals[k]));
    i = j + 1;
  }
  return parts.length <= 1 ? parts[0] ?? "" : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function describeCron(fields: ParsedField[]): string {
  const [min, hour, dom, mon, dow] = fields;
  const minStep = /^\*\/(\d+)$/.exec(min.text), hourStep = /^\*\/(\d+)$/.exec(hour.text);
  let time: string;
  if (min.text === "*" && hour.text === "*") time = "Every minute";
  else if (minStep && hour.text === "*") time = Number(minStep[1]) === 1 ? "Every minute" : `Every ${minStep[1]} minutes`;
  else if (hour.text === "*" && min.values.length === 1) time = min.values[0] === 0 ? "At the start of every hour" : `At minute ${min.values[0]} past every hour`;
  else if (hour.text === "*") time = `At minutes ${listText(min.values, String)} past every hour`;
  else if (hourStep && min.values.length === 1) time = `At minute ${min.values[0]} past every ${hourStep[1]}${Number(hourStep[1]) === 1 ? "" : "th"} hour`;
  else if (min.values.length === 1 && hour.values.length <= 8) time = `At ${hour.values.map((h) => `${pad(h)}:${pad(min.values[0])}`).join(", ").replace(/, ([^,]*)$/, " and $1")}`;
  else if (min.values.length === 1) time = `At minute ${min.values[0]} past ${listText(hour.values, (h) => `hour ${h}`)}`;
  else time = `At minutes ${listText(min.values, String)} past ${hour.text === "*" ? "every hour" : listText(hour.values, (h) => `hour ${h}`)}`;

  const dowText = (): string => {
    const v = dow.values;
    if (v.join() === "1,2,3,4,5") return "Monday through Friday";
    if (v.join() === "0,6") return "Saturday and Sunday";
    return listText(v, (d) => DAYS[d]);
  };
  let day: string;
  if (dom.star && dow.star) day = "every day";
  else if (dow.star) day = `on day ${listText(dom.values, String)} of the month`;
  else if (dom.star) day = `on ${dowText()}`;
  else day = `on day ${listText(dom.values, String)} of the month and on ${dowText()}`;
  const month = mon.star && mon.values.length === 12 ? "" : ` in ${listText(mon.values, (m) => MONTHS[m - 1])}`;
  return `${time}, ${day}${month}`;
}

const MAX_DAYS = 366 * 8;

export function nextRuns(fields: ParsedField[], fromMs: number, count: number): number[] {
  const [min, hour, dom, mon, dow] = fields;
  const domSet = new Set(dom.values), dowSet = new Set(dow.values), monSet = new Set(mon.values);
  const out: number[] = [];
  const startDay = Math.floor(fromMs / 86400000) * 86400000;
  for (let off = 0; off < MAX_DAYS && out.length < count; off++) {
    const dayMs = startDay + off * 86400000;
    const d = new Date(dayMs);
    if (!monSet.has(d.getUTCMonth() + 1)) continue;
    const dm = domSet.has(d.getUTCDate()), dw = dowSet.has(d.getUTCDay());
    // Vixie cron: if EITHER day field starts with "*" both must match (a plain "*" always matches, "*/2" does not); only when both are restricted is it "either".
    const matches = dom.star || dow.star ? dm && dw : dm || dw;
    if (!matches) continue;
    for (const h of hour.values) for (const m of min.values) {
      const ts = dayMs + h * 3600000 + m * 60000;
      if (ts >= fromMs) { out.push(ts); if (out.length === count) return out; }
    }
  }
  return out;
}

const stamp = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

export const engines: EngineMap = {
  "cron-expression-explainer": (v, ctx) => {
    let parsed: ReturnType<typeof parseCron>;
    try { parsed = parseCron(str(v, "expression")); } catch (e) { if (e instanceof CronError) return fail(e.message, "expression"); throw e; }
    const startText = str(v, "start");
    const fromMs = startText ? Date.parse(`${startText}T00:00:00Z`) : Math.floor(ctx.nowMs / 60000) * 60000 + 60000;
    if (Number.isNaN(fromMs)) return fail("Enter the start date as a valid date.", "start");
    const runs = nextRuns(parsed.fields, fromMs, 10);
    const expand = (f: ParsedField) => (f.values.length > 14 ? `${f.values.length} values (${f.values.slice(0, 5).join(", ")}, …)` : f.values.join(", "));
    const fieldRows = parsed.fields.map((f, i) => [SPECS[i].name, f.text, expand(f)]);
    const desc = describeCron(parsed.fields);
    return ok({
      primary: { label: "In plain English", value: T(desc) },
      secondary: [{ label: "Expression", value: T(parsed.normalised) }, { label: runs.length ? (startText ? `First run on or after ${startText}` : "Next run") : "Next run", value: T(runs.length ? `${stamp(runs[0])} UTC` : "none in the next 8 years") }, { label: "Runs shown", value: N(runs.length) }],
      table: { caption: "How each field is read", columns: ["Field", "Written as", "Expands to"], rows: fieldRows },
      texts: runs.length ? [{ label: `Next ${runs.length} runs (UTC)`, value: runs.map((r, i) => `${String(i + 1).padStart(2, " ")}.  ${stamp(r)}  ${DAYS[new Date(r).getUTCDay()].slice(0, 3)}`).join("\n") }] : [],
      notes: [
        "Standard 5-field cron (minute, hour, day of month, month, day of week). Seconds, years and the Quartz extensions ?, L, W and # are not supported. Sunday is 0 or 7.",
        "When both day-of-month and day-of-week are restricted, the job runs when either matches — this is how standard cron behaves, and a common surprise.",
        "Run times are shown in UTC. Your scheduler may use a different time zone, and daylight-saving changes can skip or repeat local times.",
        ...(runs.length === 0 ? ["This expression doesn't match any real date within eight years, for example February 30th."] : []),
      ],
    });
  },
};
