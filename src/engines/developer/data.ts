import type { EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { fail, ok, str } from "../helpers";

const MAX = 2_000_000;
const DELIMS: Record<string, string> = { comma: ",", semicolon: ";", tab: "\t", pipe: "|" };

/** RFC 4180 style parser: quoted fields, doubled quotes, line breaks inside quotes, CRLF or LF. Returns rows of strings. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === "") { inQuotes = true; i++; continue; }
    if (ch === delimiter) { pushField(); i++; continue; }
    if (ch === "\r") { pushRow(); i += src[i + 1] === "\n" ? 2 : 1; continue; }
    if (ch === "\n") { pushRow(); i++; continue; }
    field += ch; i++;
  }
  if (inQuotes) throw new Error("unterminated quote");
  if (field !== "" || row.length) pushRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Picks the delimiter that appears most often in the first non-empty line (outside quotes). */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  let best = ",", bestCount = 0;
  for (const d of [",", ";", "\t", "|"]) {
    let count = 0, q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === d) count++; }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export function inferValue(raw: string): string | number | boolean | null {
  const t = raw.trim();
  if (t === "") return null;
  if (NUMBER.test(t)) { const n = Number(t); if (Number.isFinite(n) && (Number.isSafeInteger(n) || !/^-?\d+$/.test(t))) return n; return raw; }
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return raw;
}

export function csvToJson(text: string, o: { delimiter: string; header: boolean; types: boolean; shape: "objects" | "arrays"; indent: string }) {
  const rows = parseCsv(text, o.delimiter);
  if (!rows.length) throw new Error("empty");
  const notes: string[] = [];
  const conv = (s: string) => (o.types ? inferValue(s) : s);
  let result: unknown;
  let columns: number;
  if (o.header && o.shape === "objects") {
    const used = new Map<string, number>();
    const names = rows[0].map((h, idx) => {
      const base = h.trim() === "" ? `column_${idx + 1}` : h.trim();
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      return n === 1 ? base : `${base}_${n}`;
    });
    if (names.some((n, i) => n !== rows[0][i].trim())) notes.push("Empty or repeated column names were made unique (column_N, name_2).");
    let ragged = 0;
    const body = rows.slice(1).map((r) => {
      if (r.length !== names.length) ragged++;
      const obj: Record<string, unknown> = {};
      names.forEach((n, i) => { obj[n] = i < r.length ? conv(r[i]) : o.types ? null : ""; });
      for (let i = names.length; i < r.length; i++) obj[`column_${i + 1}`] = conv(r[i]);
      return obj;
    });
    if (ragged) notes.push(`${ragged} row${ragged === 1 ? " has" : "s have"} a different number of fields than the header. Missing values are ${o.types ? "null" : "empty"}; extra values got column_N names.`);
    result = body;
    columns = names.length;
  } else {
    const data = o.header ? rows.slice(1) : rows;
    result = data.map((r) => r.map(conv));
    columns = Math.max(...rows.map((r) => r.length));
  }
  const json = JSON.stringify(result, null, o.indent === "min" ? undefined : o.indent === "tab" ? "\t" : Number(o.indent));
  return { json, count: Array.isArray(result) ? result.length : 0, columns, notes };
}

type Cell = string | number | boolean | null | undefined;
function flatten(value: unknown, prefix: string, out: Record<string, Cell>, doFlatten: boolean): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && doFlatten) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) { out[prefix] = ""; return; }
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out, doFlatten);
    return;
  }
  if (value !== null && typeof value === "object") out[prefix] = JSON.stringify(value);
  else out[prefix] = value as Cell;
}

export function jsonToCsv(input: string, o: { delimiter: string; header: boolean; flatten: boolean; quoteAll: boolean; protect: boolean }) {
  const parsed: unknown = JSON.parse(input);
  const notes: string[] = [];
  let rows: Record<string, Cell>[];
  let columns: string[] = [];
  let matrixRows: Cell[][] | null = null;
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => Array.isArray(x))) {
    matrixRows = (parsed as unknown[][]).map((r) => r.map((c) => (c !== null && typeof c === "object" ? JSON.stringify(c) : (c as Cell))));
    rows = [];
  } else {
    const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    if (list.length === 0) throw new Error("empty");
    rows = list.map((item) => {
      const rec: Record<string, Cell> = {};
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        for (const [k, v2] of entries) flatten(v2, k, rec, o.flatten);
      }
      else rec.value = item !== null && typeof item === "object" ? JSON.stringify(item) : (item as Cell);
      if ("" in rec) { rec.value = rec[""]; delete rec[""]; }
      return rec;
    });
    const seen = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
  }
  let formulaCells = 0;
  const esc = (c: Cell): string => {
    if (c === null || c === undefined) return o.quoteAll ? '""' : "";
    let s = String(c);
    if (/^[=+\-@\t\r]/.test(s) && typeof c === "string") { formulaCells++; if (o.protect) s = `'${s}`; }
    const needs = o.quoteAll || s.includes(o.delimiter) || /["\r\n]/.test(s) || /^\s|\s$/.test(s);
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  let dataRows: Cell[][];
  if (matrixRows) { dataRows = matrixRows; columns = []; }
  else {
    if (o.header) lines.push(columns.map((c) => esc(c)).join(o.delimiter));
    dataRows = rows.map((r) => columns.map((c) => r[c]));
  }
  for (const r of dataRows) lines.push(r.map(esc).join(o.delimiter));
  if (formulaCells) notes.push(o.protect ? `${formulaCells} cell${formulaCells === 1 ? "" : "s"} starting with = + - or @ got a leading apostrophe so spreadsheets show them as text.` : `${formulaCells} cell${formulaCells === 1 ? " starts" : "s start"} with = + - or @. If this file comes from an untrusted source, spreadsheets may treat such cells as formulas; turn on formula protection.`);
  return { csv: lines.join("\n"), rowCount: dataRows.length, columns, preview: (matrixRows ? dataRows : dataRows).slice(0, 10), notes };
}

export const engines: EngineMap = {
  "csv-to-json-converter": (v) => {
    const text = str(v, "csv");
    if (text.length > MAX) return fail("That CSV is longer than 2 million characters. Convert it in parts.", "csv");
    if (text.trim() === "") return fail("Paste the CSV you want to convert.", "csv");
    const choice = str(v, "delimiter");
    const delimiter = choice === "auto" ? detectDelimiter(text) : DELIMS[choice];
    try {
      const r = csvToJson(text, { delimiter, header: str(v, "header") === "yes", types: str(v, "types") === "yes", shape: str(v, "shape") as "objects" | "arrays", indent: str(v, "indent") });
      const name = { ",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe" }[delimiter];
      return ok({
        primary: { label: "Rows converted", value: N(r.count) },
        secondary: [{ label: "Columns", value: N(r.columns) }, { label: "Delimiter", value: T(`${name}${choice === "auto" ? " (detected)" : ""}`) }],
        texts: [{ label: "JSON (copy this)", value: r.json, language: "json", copyable: true }],
        notes: r.notes.length ? r.notes : undefined,
      });
    } catch (e) {
      return fail((e as Error).message === "unterminated quote" ? "A quoted field is never closed. Look for a stray double quote (\") and either close it or double it (\"\")." : "That doesn't contain any rows to convert.", "csv");
    }
  },
  "json-to-csv-converter": (v) => {
    const text = str(v, "json");
    if (text.length > MAX) return fail("That JSON is longer than 2 million characters. Convert it in parts.", "json");
    if (text.trim() === "") return fail("Paste the JSON you want to convert.", "json");
    try {
      const r = jsonToCsv(text, { delimiter: DELIMS[str(v, "delimiter")], header: str(v, "header") === "yes", flatten: str(v, "flatten") === "yes", quoteAll: str(v, "quotes") === "all", protect: str(v, "protect") === "yes" });
      return ok({
        primary: { label: "Rows", value: N(r.rowCount) },
        secondary: [{ label: "Columns", value: N(r.columns.length || (r.preview[0]?.length ?? 0)) }],
        table: r.columns.length ? { caption: `First ${Math.min(10, r.preview.length)} rows`, columns: r.columns, rows: r.preview.map((row) => row.map((c) => (c === null || c === undefined ? "" : String(c)))), maxHeight: true } : undefined,
        texts: [{ label: "CSV (copy this)", value: r.csv, copyable: true }],
        notes: r.notes.length ? r.notes : undefined,
      });
    } catch (e) {
      if (e instanceof SyntaxError) return fail(`That isn't valid JSON (${e.message.replace(/^JSON\.parse: /, "")}). Check commas, quotes and brackets, or run it through the JSON validator first.`, "json");
      return fail("The JSON has nothing to convert. Use an array of objects such as [{\"name\": \"Ada\"}].", "json");
    }
  },
};
