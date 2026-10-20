/**
 * Browser-side image helpers built on the Canvas API. Nothing here talks to a server.
 * Decoding honours EXIF orientation, so phone photos come out the right way up; encoding to JPEG/WebP uses the
 * browser's own encoders; lossy PNG uses a small open-source quantiser (UPNG.js) loaded only when needed.
 */
import { nextFrame } from "./format";

/** An error whose message is safe and useful to show to a visitor. */
export class FileProblem extends Error {
  constructor(message: string) { super(message); this.name = "FileProblem"; }
}

export type OutType = "image/jpeg" | "image/png" | "image/webp";
export const MAX_PIXELS = 120_000_000;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif";

type Source = ImageBitmap | HTMLImageElement;
export type Decoded = { source: Source; width: number; height: number; close: () => void };

export function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name);
}

export async function decodeImage(file: Blob, name = "this file"): Promise<Decoded> {
  let decoded: Decoded | null = null;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    decoded = { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    decoded = await decodeWithImageElement(file);
  }
  if (!decoded) {
    const heic = /\.(heic|heif)$/i.test(name);
    throw new FileProblem(heic
      ? `“${name}” is a HEIC photo, which most browsers can't open. Export it as JPG from your phone's Photos app (or share it as “Most compatible”) and try again.`
      : `“${name}” couldn't be read as an image. It may be damaged or in a format this browser can't open.`);
  }
  if (decoded.width * decoded.height > MAX_PIXELS) {
    decoded.close();
    throw new FileProblem(`“${name}” is ${(decoded.width * decoded.height / 1e6).toFixed(0)} megapixels, which is more than a browser can safely process (limit ${MAX_PIXELS / 1e6} MP). Reduce its size first.`);
  }
  return decoded;
}

async function decodeWithImageElement(file: Blob): Promise<Decoded | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) return null;
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } catch {
    return null;
  } finally {
    // The element keeps its decoded pixels after the URL is released.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Draws a region of `source` onto a new canvas of destW × destH. Large reductions are done in halving steps, which keeps
 * fine detail (text, signatures) much cleaner than one big jump. `background` is painted first (needed for JPEG, which has no transparency).
 */
export function resample(source: CanvasImageSource, region: Rect, destW: number, destH: number, background?: string): HTMLCanvasElement {
  destW = Math.max(1, Math.round(destW));
  destH = Math.max(1, Math.round(destH));
  let cur: CanvasImageSource = source;
  let r = { ...region };
  while (r.w / 2 >= destW && r.h / 2 >= destH) {
    const nw = Math.max(destW, Math.round(r.w / 2));
    const nh = Math.max(destH, Math.round(r.h / 2));
    const step = makeCanvas(nw, nh);
    const sctx = step.getContext("2d")!;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(cur, r.x, r.y, r.w, r.h, 0, 0, nw, nh);
    cur = step;
    r = { x: 0, y: 0, w: nw, h: nh };
  }
  const out = makeCanvas(destW, destH);
  const ctx = out.getContext("2d")!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, destW, destH); }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, r.x, r.y, r.w, r.h, 0, 0, destW, destH);
  return out;
}

export const fullRect = (d: { width: number; height: number }): Rect => ({ x: 0, y: 0, w: d.width, h: d.height });

/** True if any pixel is noticeably transparent. Looks at a reduced copy, which keeps partly transparent edges visible. */
export function hasTransparency(d: Decoded): boolean {
  const scale = Math.min(1, 512 / Math.max(d.width, d.height));
  const c = resample(d.source, fullRect(d), d.width * scale, d.height * scale);
  const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: OutType, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new FileProblem("The browser couldn't create the output image. It may be too large for this device; try a smaller size."))), type, quality);
  });
}

let webpEncode: Promise<boolean> | undefined;
/** Chrome, Edge and Firefox can encode WebP from a canvas; Safari silently returns PNG instead, so test it. */
export function supportsWebpEncode(): Promise<boolean> {
  return (webpEncode ??= (async () => {
    try { return (await canvasToBlob(makeCanvas(2, 2), "image/webp", 0.8)).type === "image/webp"; } catch { return false; }
  })());
}

/** Encodes with the browser's JPEG/WebP encoder and checks the browser really produced that format. */
export async function encodeLossy(canvas: HTMLCanvasElement, type: "image/jpeg" | "image/webp", quality: number): Promise<Blob> {
  const blob = await canvasToBlob(canvas, type, quality);
  if (blob.type !== type) throw new FileProblem(type === "image/webp" ? "This browser can't create WebP images. Try Chrome, Edge or Firefox, or choose JPG or PNG." : "This browser couldn't create a JPEG.");
  return blob;
}

export async function encodePng(canvas: HTMLCanvasElement, colors = 0): Promise<Blob> {
  if (!colors) return canvasToBlob(canvas, "image/png");
  const mod = await import("upng-js");
  const UPNG = (mod as unknown as { default?: typeof import("upng-js") }).default ?? (mod as unknown as typeof import("upng-js"));
  const { width, height } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const png = UPNG.encode([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], width, height, colors);
  return new Blob([png], { type: "image/png" });
}

export type TargetResult = { blob: Blob; quality: number; width: number; height: number; reached: boolean; scaled: boolean };

/**
 * Finds the highest quality whose file is no larger than `maxBytes`. If even the lowest quality is too big and
 * `allowDownscale` is set, the picture is shrunk in 10% steps. `reached` is false when the size could not be met.
 */
export async function encodeToTarget(
  canvas: HTMLCanvasElement, type: "image/jpeg" | "image/webp",
  o: { maxBytes: number; allowDownscale: boolean; minQuality?: number; maxQuality?: number; background?: string },
): Promise<TargetResult> {
  const minQ = o.minQuality ?? 0.05;
  const maxQ = o.maxQuality ?? 1;
  let current = canvas;
  let scaled = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const best = await encodeLossy(current, type, maxQ);
    if (best.size <= o.maxBytes) return { blob: best, quality: maxQ, width: current.width, height: current.height, reached: true, scaled };
    const worst = await encodeLossy(current, type, minQ);
    if (worst.size <= o.maxBytes) {
      let lo = minQ, hi = maxQ, found = worst, foundQ = minQ;
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        const b = await encodeLossy(current, type, mid);
        if (b.size <= o.maxBytes) { lo = mid; found = b; foundQ = mid; } else hi = mid;
      }
      return { blob: found, quality: foundQ, width: current.width, height: current.height, reached: true, scaled };
    }
    if (!o.allowDownscale || Math.min(current.width, current.height) < 24) {
      return { blob: worst, quality: minQ, width: current.width, height: current.height, reached: false, scaled };
    }
    current = resample(current, { x: 0, y: 0, w: current.width, h: current.height }, current.width * 0.9, current.height * 0.9, o.background);
    scaled = true;
    await nextFrame();
  }
  const last = await encodeLossy(current, type, minQ);
  return { blob: last, quality: minQ, width: current.width, height: current.height, reached: last.size <= o.maxBytes, scaled };
}

/** Reads the EXIF orientation (1–8) of a JPEG. 1 when absent or unreadable. */
export function readJpegOrientation(b: Uint8Array): number {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let p = 2;
  while (p + 4 < b.length) {
    if (b[p] !== 0xff) return 1;
    const marker = b[p + 1];
    if (marker === 0xda || marker === 0xd9) return 1;
    const len = (b[p + 2] << 8) | b[p + 3];
    if (marker === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const t = p + 10; // start of the TIFF header
      const little = b[t] === 0x49;
      const u16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const u32 = (o: number) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
      const ifd = t + u32(t + 4);
      if (ifd + 2 > b.length) return 1;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > b.length) return 1;
        if (u16(e) === 0x0112) { const v = u16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
      }
      return 1;
    }
    p += 2 + len;
  }
  return 1;
}

export const OUT_EXT: Record<OutType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
