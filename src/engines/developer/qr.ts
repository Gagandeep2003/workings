import qrcode from "qrcode-generator";
import type { EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { fail, ok, str } from "../helpers";

export function makeMatrix(text: string, level: "L" | "M" | "Q" | "H"): boolean[][] {
  qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));
  const qr = qrcode(0, level);
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export const engines: EngineMap = {
  "qr-code-generator": (v) => {
    const text = str(v, "text");
    if (text.trim() === "") return fail("Enter the text or link the QR code should contain.", "text");
    const level = str(v, "level") as "L" | "M" | "Q" | "H";
    let matrix: boolean[][];
    try {
      matrix = makeMatrix(text, level);
    } catch {
      return fail("That's too much data for a QR code at this error-correction level. Shorten the text or choose a lower level (L holds the most).", "text");
    }
    const size = matrix.length;
    const version = (size - 17) / 4;
    const notes = ["Made entirely in your browser — the text is never sent anywhere. A quiet margin of 4 squares is included; keep it when you print."];
    if (/^https?:\/\//i.test(text) === false && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(text)) notes.push("This looks like a web address without http:// or https://. Many phone cameras need the prefix to treat it as a link.");
    return ok({
      primary: { label: "QR code", value: T("Ready — scan with your phone camera") },
      secondary: [{ label: "Size", value: T(`${size} × ${size} modules (version ${version})`) }, { label: "Characters encoded", value: N([...text].length) }, { label: "Error correction", value: T({ L: "L — about 7% damage tolerated", M: "M — about 15%", Q: "Q — about 25%", H: "H — about 30%" }[level]) }],
      qr: { matrix, text },
      notes,
    });
  },
};
