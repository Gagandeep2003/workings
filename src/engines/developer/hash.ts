import type { EngineMap } from "@/tools/types";
import { fail, ok, str } from "../helpers";

const ALGOS = [
  { id: "SHA-256", label: "SHA-256" },
  { id: "SHA-512", label: "SHA-512" },
  { id: "SHA-384", label: "SHA-384" },
  { id: "SHA-1", label: "SHA-1 (legacy — not for security)" },
] as const;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const engines: EngineMap = {
  "hash-generator": async (v) => {
    const text = str(v, "text");
    if (text.length > 1_000_000) return fail("That text is over 1,000,000 characters. Please shorten it.", "text");
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return fail("Your browser doesn't provide the Web Crypto API here (it needs a secure https:// page). Try a current browser.", "text");
    const data = new TextEncoder().encode(text);
    const upper = str(v, "case") === "upper";
    const digests = await Promise.all(ALGOS.map(async (a) => ({ ...a, value: hex(await subtle.digest(a.id, data)) })));
    const shown = (s: string) => (upper ? s.toUpperCase() : s);
    return ok({
      primary: { label: "SHA-256", value: { kind: "text", value: shown(digests[0].value) } },
      texts: digests.slice(1).map((d) => ({ label: d.label, value: shown(d.value) })),
      secondary: [
        { label: "Input length", value: { kind: "text", value: `${[...text].length} characters, ${data.length} bytes (UTF-8)` } },
      ],
      notes: [
        "The text is hashed in your browser with the Web Crypto API and is never uploaded. The same text always gives the same hash, and the empty string has a valid hash too.",
        "MD5 is not offered: browsers do not implement it, and it is broken for security uses anyway. SHA-1 is shown for compatibility only. Never use a plain fast hash to store passwords — use a dedicated password hashing function such as bcrypt, scrypt or Argon2.",
      ],
    });
  },
};
