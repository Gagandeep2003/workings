import { OUT_EXT, type OutType, encodePng, resample, supportsWebpEncode, type TargetResult } from "./image";
import { baseName, nextFrame } from "./format";

export const KB_STRICT = 1000; // aim under limit×1000 bytes so a file passes whether a portal counts 1 KB as 1000 or 1024 bytes

/** Palette size used for lossy PNG at a given quality (100 = lossless). */
export function pngColorsForQuality(q: number): number {
  if (q >= 100) return 0;
  if (q >= 90) return 256;
  if (q >= 75) return 128;
  if (q >= 55) return 64;
  if (q >= 35) return 32;
  return 16;
}

export function typeFromFile(file: File): OutType | null {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (file.type === "image/png" || /\.png$/i.test(file.name)) return "image/png";
  if (file.type === "image/webp" || /\.webp$/i.test(file.name)) return "image/webp";
  return null;
}

export type FormatChoice = "same" | "jpeg" | "png" | "webp";

/** Resolves "same as original" and falls back from WebP when the browser can't write it. */
export async function resolveOutType(file: File, choice: FormatChoice, hasAlpha: boolean): Promise<{ type: OutType; note?: string }> {
  const want: OutType | null = choice === "jpeg" ? "image/jpeg" : choice === "png" ? "image/png" : choice === "webp" ? "image/webp" : typeFromFile(file);
  if (!want) return { type: hasAlpha ? "image/png" : "image/jpeg", note: `${file.type.replace("image/", "").toUpperCase() || "This format"} can't be re-saved by browsers as-is, so it was converted to ${hasAlpha ? "PNG" : "JPG"}.` };
  if (want === "image/webp" && !(await supportsWebpEncode())) return { type: hasAlpha ? "image/png" : "image/jpeg", note: `This browser can't write WebP, so the file was saved as ${hasAlpha ? "PNG" : "JPG"} instead.` };
  return { type: want };
}

export function outName(file: File, suffix: string, type: OutType): string {
  return `${baseName(file.name)}${suffix}.${OUT_EXT[type]}`;
}

/** Lossy-PNG search: fewer palette colours, then smaller pictures, until the file fits. */
export async function encodePngToTarget(canvas: HTMLCanvasElement, maxBytes: number, allowDownscale: boolean): Promise<TargetResult> {
  let current = canvas;
  let scaled = false;
  for (let round = 0; round < 25; round++) {
    let last: Blob | null = null;
    for (const colors of [0, 256, 128, 64, 32, 16]) {
      last = await encodePng(current, colors);
      if (last.size <= maxBytes) return { blob: last, quality: colors, width: current.width, height: current.height, reached: true, scaled };
    }
    if (!allowDownscale || Math.min(current.width, current.height) < 24) {
      return { blob: last!, quality: 16, width: current.width, height: current.height, reached: false, scaled };
    }
    current = resample(current, { x: 0, y: 0, w: current.width, h: current.height }, current.width * 0.9, current.height * 0.9);
    scaled = true;
    await nextFrame();
  }
  const blob = await encodePng(current, 16);
  return { blob, quality: 16, width: current.width, height: current.height, reached: blob.size <= maxBytes, scaled };
}
