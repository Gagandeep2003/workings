const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

export function encodeBase64(bytes: Uint8Array, urlSafe = false, pad = true): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : ALPHABET[c & 63];
  }
  if (urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_");
  return pad ? out : out.replace(/=+$/, "");
}

export type DecodeResult = { ok: true; bytes: Uint8Array } | { ok: false; message: string };

/** Decode standard or URL-safe Base64. Whitespace is ignored and missing padding is tolerated. */
export function decodeBase64(input: string): DecodeResult {
  const text = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const body = text.replace(/=+$/, "");
  const bad = [...body].findIndex((ch) => !LOOKUP.has(ch));
  if (bad >= 0) return { ok: false, message: `"${body[bad]}" at position ${bad + 1} isn't a Base64 character. Base64 uses A–Z, a–z, 0–9, + and / (or - and _ in the URL-safe form).` };
  if (text.length - body.length > 2) return { ok: false, message: "Too many '=' padding characters at the end (at most 2)." };
  if (body.length % 4 === 1) return { ok: false, message: "That length can't be valid Base64 — a character is probably missing or extra." };
  const out: number[] = [];
  for (let i = 0; i < body.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < body.length ? (LOOKUP.get(body[i + k]) as number) : 0));
    const chunk = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
    out.push((chunk >> 16) & 255);
    if (i + 2 < body.length) out.push((chunk >> 8) & 255);
    if (i + 3 < body.length) out.push(chunk & 255);
  }
  return { ok: true, bytes: Uint8Array.from(out) };
}

export function bytesToUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function toHex(bytes: Uint8Array, limit = 32): string {
  const hex = [...bytes.slice(0, limit)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  return bytes.length > limit ? `${hex} …` : hex;
}
