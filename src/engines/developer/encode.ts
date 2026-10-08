import type { EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { bytesToUtf8, decodeBase64, encodeBase64, toHex } from "@/lib/base64";
import { parseJson, printJson } from "@/lib/json";
import { MONTHS, WEEKDAYS, parseISODate } from "@/lib/dates";
import { formatOffset, instantToZoned, isValidTimeZone, pad2, wallTimeToInstant } from "@/lib/tz";
import { fail, num, ok, optNum, str } from "../helpers";

const enc = new TextEncoder();

export function uuidV4(rand: (n: number) => Uint8Array): string {
  const b = rand(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return fmtUuid(b);
}

/** UUIDv7 (RFC 9562): 48-bit Unix-millisecond timestamp followed by random bits. */
export function uuidV7(rand: (n: number) => Uint8Array, nowMs: number): string {
  const b = rand(16);
  let t = BigInt(Math.floor(nowMs));
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(t & 0xffn);
    t >>= 8n;
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return fmtUuid(b);
}

function fmtUuid(b: Uint8Array): string {
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function decodeSegment(seg: string): { ok: true; json: string } | { ok: false; message: string } {
  const r = decodeBase64(seg);
  if (!r.ok) return { ok: false, message: r.message };
  const text = bytesToUtf8(r.bytes);
  if (text === null) return { ok: false, message: "the decoded bytes aren't valid UTF-8 text" };
  return { ok: true, json: text };
}

const fmtUtc = (ms: number) => {
  const z = instantToZoned(ms, "UTC");
  return `${WEEKDAYS[z.weekday].slice(0, 3)}, ${z.d} ${MONTHS[z.m - 1].slice(0, 3)} ${z.y} ${pad2(z.hh)}:${pad2(z.mm)}:${pad2(z.ss)} UTC`;
};

function relative(deltaMs: number): string {
  const abs = Math.abs(deltaMs) / 1000;
  const units: [number, string][] = [[86400 * 365, "year"], [86400 * 30, "month"], [86400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]];
  for (const [size, name] of units) {
    if (abs >= size) {
      const n = Math.floor(abs / size);
      return deltaMs < 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`;
    }
  }
  return "just now";
}

export const engines: EngineMap = {
  "base64-encode-decode": (v) => {
    const text = str(v, "text");
    if (str(v, "mode") === "encode") {
      const bytes = enc.encode(text);
      const out = encodeBase64(bytes, str(v, "variant") === "url", str(v, "variant") !== "url-nopad");
      return ok({
        primary: { label: "Base64", value: T(out.length > 60 ? `${out.slice(0, 60)}…` : out) },
        secondary: [{ label: "Input size", value: N(bytes.length, "bytes") }, { label: "Output size", value: N(out.length, "characters") }],
        texts: [{ label: "Base64 output", value: out, copyable: true }],
        notes: ["Text is converted to UTF-8 bytes first, so accented letters, emoji and non-Latin scripts encode correctly. Base64 is an encoding, not encryption — anyone can reverse it."],
      });
    }
    const r = decodeBase64(text);
    if (!r.ok) return fail(r.message, "text");
    const utf8 = bytesToUtf8(r.bytes);
    if (utf8 === null) {
      return ok({
        primary: { label: "Decoded", value: T("Binary data (not valid UTF-8 text)") },
        secondary: [{ label: "Size", value: N(r.bytes.length, "bytes") }],
        texts: [{ label: "First bytes (hex)", value: toHex(r.bytes), copyable: true }],
        notes: ["The decoded bytes aren't readable text — this is probably an image, file, compressed or encrypted data."],
      });
    }
    return ok({
      primary: { label: "Decoded text", value: T(utf8.length > 60 ? `${utf8.slice(0, 60)}…` : utf8 || "(empty)") },
      secondary: [{ label: "Size", value: N(r.bytes.length, "bytes") }],
      texts: [{ label: "Decoded text", value: utf8, copyable: true }],
    });
  },

  "url-encode-decode": (v) => {
    const text = str(v, "text");
    const mode = str(v, "mode");
    try {
      let out: string;
      if (mode === "component") out = encodeURIComponent(text);
      else if (mode === "full") out = encodeURI(text);
      else if (mode === "form") out = encodeURIComponent(text).replace(/%20/g, "+");
      else out = decodeURIComponent(str(v, "plus") === "yes" ? text.replace(/\+/g, " ") : text);
      return ok({
        primary: { label: mode === "decode" ? "Decoded text" : "Encoded text", value: T(out.length > 70 ? `${out.slice(0, 70)}…` : out || "(empty)") },
        secondary: [{ label: "Length", value: N(out.length, "characters") }],
        texts: [{ label: mode === "decode" ? "Decoded text" : "Encoded text", value: out, copyable: true }],
        notes: mode === "full" ? ["Encode full URL leaves characters that structure a URL (: / ? # & =) alone. To encode a single value such as a query parameter, use 'Encode a component'."] : mode === "form" ? ["Form encoding (application/x-www-form-urlencoded) writes spaces as +."] : [],
      });
    } catch {
      const bad = /%(?![0-9a-fA-F]{2})/.exec(text);
      return fail(bad ? `Malformed % sequence at position ${bad.index + 1}: a % must be followed by two hexadecimal digits (like %20).` : "Those % sequences don't form valid UTF-8, so they can't be decoded as text.", "text");
    }
  },

  "uuid-generator": (v, ctx) => {
    const count = num(v, "count");
    const version = str(v, "version");
    const upper = str(v, "case") === "upper";
    const hyphens = str(v, "hyphens") !== "no";
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      let id = version === "v7" ? uuidV7(ctx.random, ctx.nowMs + i) : uuidV4(ctx.random);
      if (!hyphens) id = id.replace(/-/g, "");
      list.push(upper ? id.toUpperCase() : id);
    }
    return ok({
      primary: { label: count === 1 ? "UUID" : `${count} UUIDs`, value: T(list[0] + (count > 1 ? " …" : "")) },
      secondary: [{ label: "Version", value: T(version === "v7" ? "7 (time-ordered)" : "4 (random)") }, { label: "Count", value: N(count) }],
      texts: [{ label: count === 1 ? "UUID" : "UUIDs (one per line)", value: list.join("\n"), copyable: true }],
      notes: ["Generated in your browser with the secure random-number generator (crypto.getRandomValues). Nothing is sent or stored. Click Generate again for new values."],
    });
  },

  "jwt-decoder": (v, ctx) => {
    const raw = str(v, "token").trim().replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
    const parts = raw.split(".");
    if (parts.length === 5) return fail("This looks like an encrypted token (JWE, five parts). Its contents are encrypted, so it can't be decoded without the key.", "token");
    if (parts.length !== 3) return fail(`A JWT has three parts separated by dots (header.payload.signature). This has ${parts.length}.`, "token");
    const names = ["header", "payload"] as const;
    const decoded: string[] = [];
    for (let i = 0; i < 2; i++) {
      const d = decodeSegment(parts[i]);
      if (!d.ok) return fail(`The ${names[i]} isn't valid Base64URL: ${d.message}.`, "token");
      const parsed = parseJson(d.json);
      if (!parsed.ok) return fail(`The ${names[i]} decoded, but it isn't valid JSON (${parsed.error.message}).`, "token");
      decoded.push(printJson(parsed.node, { indent: "  " }));
    }
    const header = JSON.parse(decoded[0]) as Record<string, unknown>;
    const payload = JSON.parse(decoded[1]) as Record<string, unknown>;
    const alg = typeof header.alg === "string" ? header.alg : "unknown";
    const rows: (string | ReturnType<typeof T>)[][] = [];
    const secondary = [{ label: "Algorithm", value: T(alg) }, { label: "Signature present", value: T(parts[2] ? "Yes — NOT verified" : "No (unsigned token)") }];
    for (const [claim, label] of [["iat", "Issued at"], ["nbf", "Not valid before"], ["exp", "Expires"]] as const) {
      const val = payload[claim];
      if (typeof val === "number" && Number.isFinite(val)) {
        const ms = val * 1000;
        if (Math.abs(ms) < 8.64e15) rows.push([`${claim} — ${label}`, T(`${fmtUtc(ms)} (${relative(ms - ctx.nowMs)})`)]);
      }
    }
    const notes = ["Decoded locally in your browser — the token is never uploaded. The signature has NOT been verified, so do not treat these claims as trustworthy: anyone can write a token with any contents."];
    const exp = payload.exp;
    if (typeof exp === "number") notes.push(exp * 1000 < ctx.nowMs ? "Based on this device's clock, the token has expired." : "Based on this device's clock, the token has not expired yet.");
    if (alg.toLowerCase() === "none") notes.push("The algorithm is 'none', which means the token is unsigned. Servers must reject such tokens.");
    for (const k of ["iss", "sub", "aud", "jti"]) if (payload[k] !== undefined) rows.push([k, T(typeof payload[k] === "string" ? (payload[k] as string) : JSON.stringify(payload[k]))]);
    return ok({
      primary: { label: "Result", value: T("Decoded — signature not verified") },
      secondary,
      table: rows.length ? { caption: "Standard claims", columns: ["Claim", "Value"], rows } : undefined,
      texts: [{ label: "Header", value: decoded[0], language: "json", copyable: true }, { label: "Payload", value: decoded[1], language: "json", copyable: true }],
      notes,
    });
  },

  "unix-timestamp-converter": (v, ctx) => {
    const mode = str(v, "mode");
    const zone = str(v, "zone") === "local" ? ctx.timeZone : "UTC";
    if (!isValidTimeZone(zone)) return fail("This device didn't report a valid time zone — choose UTC instead.", "zone");
    if (mode === "now") {
      const ms = ctx.nowMs;
      return ok({
        primary: { label: "Current Unix timestamp (seconds)", value: N(Math.floor(ms / 1000)) },
        secondary: [{ label: "Milliseconds", value: N(Math.floor(ms)) }, { label: "UTC", value: T(fmtUtc(ms)) }],
        notes: ["Read from this device's clock at the moment you pressed the button."],
      });
    }
    if (mode === "to-date") {
      const value = num(v, "timestamp");
      const unit = str(v, "unit");
      const ms = unit === "auto" ? (Math.abs(value) >= 1e11 ? value : value * 1000) : unit === "ms" ? value : value * 1000;
      if (!Number.isInteger(value) && unit === "ms") return fail("A millisecond timestamp must be a whole number.", "timestamp");
      if (Math.abs(ms) > 8.64e15) return fail("That timestamp is outside the range dates can represent (about ±275,000 years).", "timestamp");
      const z = instantToZoned(ms, zone);
      const guessed = unit === "auto" ? (Math.abs(value) >= 1e11 ? "milliseconds" : "seconds") : unit === "ms" ? "milliseconds" : "seconds";
      return ok({
        primary: { label: "UTC date and time", value: T(fmtUtc(ms)) },
        secondary: [
          { label: "ISO 8601", value: T(new Date(ms).toISOString()) },
          ...(zone !== "UTC" ? [{ label: `Your local time (${zone})`, value: T(`${WEEKDAYS[z.weekday].slice(0, 3)}, ${z.d} ${MONTHS[z.m - 1].slice(0, 3)} ${z.y} ${pad2(z.hh)}:${pad2(z.mm)}:${pad2(z.ss)} (${formatOffset(z.offsetMinutes)})`) }] : []),
          { label: "Relative to now", value: T(relative(ms - ctx.nowMs)) },
          { label: "Interpreted as", value: T(guessed) },
        ],
        notes: unit === "auto" ? ["Auto-detect treats values of 100 billion or more as milliseconds, anything smaller as seconds."] : [],
      });
    }
    const date = parseISODate(str(v, "date"));
    if (!date) return fail("That isn't a real calendar date.", "date");
    const [hh, mm] = (str(v, "time") || "00:00").split(":").map(Number);
    const secs = optNum(v, "seconds") ?? 0;
    if (secs > 59) return fail("Seconds must be between 0 and 59.", "seconds");
    const r = wallTimeToInstant({ ...date, hh, mm }, zone);
    if (r.status === "gap") return fail("That local time doesn't exist (clocks skip forward for daylight saving). Pick another time.", "time");
    const ms = r.epochMs + secs * 1000;
    return ok({
      primary: { label: "Unix timestamp (seconds)", value: N(Math.floor(ms / 1000)) },
      secondary: [{ label: "Milliseconds", value: N(ms) }, { label: "UTC", value: T(fmtUtc(ms)) }],
      notes: r.status === "ambiguous" ? ["That local time happens twice (clocks go back). The earlier moment is used."] : [],
    });
  },
};

