import qrcode from "qrcode-generator";

/** Builds the QR module matrix (true = dark) for UTF-8 text. Throws if the data does not fit at this error-correction level. */
export function makeMatrix(text: string, level: "L" | "M" | "Q" | "H"): boolean[][] {
  qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));
  const qr = qrcode(0, level);
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
