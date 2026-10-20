/**
 * Browser-side PDF helpers. Uses @cantoo/pdf-lib (MIT, a maintained fork of pdf-lib) for building, merging, splitting and
 * rewriting PDFs and pdf.js (Apache-2.0) for drawing pages. Both are loaded on demand, only on the PDF tool pages.
 */
import { FileProblem, decodeImage, encodeLossy, fullRect, readJpegOrientation, resample, canvasToBlob } from "./image";
import { nextFrame } from "./format";
import type { PDFRef, PDFRawStream, PDFDict } from "@cantoo/pdf-lib";

type PdfLib = typeof import("@cantoo/pdf-lib");
export const loadPdfLib = (): Promise<PdfLib> => import("@cantoo/pdf-lib");

/** Page sizes in PDF points (1 pt = 1/72 inch). */
export const PAGE_SIZES = {
  a4: { label: "A4 (210 × 297 mm)", size: [595.28, 841.89] as const },
  a3: { label: "A3 (297 × 420 mm)", size: [841.89, 1190.55] as const },
  a5: { label: "A5 (148 × 210 mm)", size: [419.53, 595.28] as const },
  letter: { label: "US Letter (8.5 × 11 in)", size: [612, 792] as const },
  legal: { label: "US Legal (8.5 × 14 in)", size: [612, 1008] as const },
} as const;
export type PageSizeKey = keyof typeof PAGE_SIZES | "fit";
export const MM = 72 / 25.4;

export type Rotation = 0 | 90 | 180 | 270;
export const rotateBy = (r: Rotation, delta: 90 | -90): Rotation => (((r + delta + 360) % 360) as Rotation);

// ------------------------------------------------------------------------------------------------------------------
// Images → PDF
// ------------------------------------------------------------------------------------------------------------------
export type ImageItem = { file: File; rotation: Rotation };
export type ImagesToPdfOptions = {
  pageSize: PageSizeKey;
  orientation: "auto" | "portrait" | "landscape";
  marginMm: number;
  /** "fit" scales every picture to fill the printable area; "shrink" only makes oversized pictures smaller. */
  scale: "fit" | "shrink";
  /** Re-compress pictures (max 1800 px on the long side, JPEG 80%) to make the PDF smaller. */
  reduce: boolean;
};

const sniff = (b: Uint8Array): "jpeg" | "png" | null =>
  b[0] === 0xff && b[1] === 0xd8 ? "jpeg" : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "png" : null;

/** Orientation 1–8 → clockwise rotation to apply, and whether the picture is mirrored (mirrored ones are re-drawn on a canvas). */
const EXIF_ROTATION: Record<number, { rot: Rotation; mirrored: boolean }> = {
  1: { rot: 0, mirrored: false }, 2: { rot: 0, mirrored: true }, 3: { rot: 180, mirrored: false }, 4: { rot: 180, mirrored: true },
  5: { rot: 90, mirrored: true }, 6: { rot: 90, mirrored: false }, 7: { rot: 270, mirrored: true }, 8: { rot: 270, mirrored: false },
};

export async function imagesToPdf(
  items: ImageItem[], o: ImagesToPdfOptions, onProgress?: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; pages: number; notes: string[] }> {
  if (!items.length) throw new FileProblem("Add at least one image first.");
  const { PDFDocument, degrees } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const notes: string[] = [];
  let index = 0;
  for (const item of items) {
    index++;
    onProgress?.(index - 1, items.length);
    await nextFrame();
    const name = item.file.name;
    let bytes = new Uint8Array(await item.file.arrayBuffer());
    let kind = sniff(bytes);
    let pxW = 0, pxH = 0;
    let baseRotation: Rotation = 0;

    const needsCanvas = o.reduce || !kind;
    if (kind === "jpeg" && !needsCanvas) {
      const orient = EXIF_ROTATION[readJpegOrientation(bytes)];
      if (orient.mirrored) { /* handled by the canvas path below */ } else baseRotation = orient.rot;
      if (orient.mirrored) { kind = null; }
    }
    let embedded;
    if (kind && !(o.reduce)) {
      try {
        embedded = kind === "jpeg" ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        pxW = embedded.width; pxH = embedded.height;
      } catch {
        embedded = undefined; // unusual JPEG/PNG variants: redraw through the browser instead
        baseRotation = 0;
      }
    }
    if (!embedded) {
      const d = await decodeImage(item.file, name);
      try {
        const long = Math.max(d.width, d.height);
        const scale = o.reduce ? Math.min(1, 1800 / long) : 1;
        const canvas = resample(d.source, fullRect(d), d.width * scale, d.height * scale, "#ffffff");
        const blob = await encodeLossy(canvas, "image/jpeg", o.reduce ? 0.8 : 0.92);
        bytes = new Uint8Array(await blob.arrayBuffer());
        embedded = await doc.embedJpg(bytes);
        pxW = embedded.width; pxH = embedded.height;
        baseRotation = 0; // the canvas path already applied EXIF orientation
        if (!o.reduce) notes.push(`“${name}” was converted through the browser (${kind ? "unusual file" : "format not directly embeddable"}), so it was re-encoded as JPEG at 92% quality.`);
      } finally { d.close(); }
    }

    const rot = ((baseRotation + item.rotation) % 360) as Rotation;
    const swap = rot === 90 || rot === 270;
    const dispW = swap ? pxH : pxW;   // size of the picture as it will be seen, in pixels
    const dispH = swap ? pxW : pxH;
    const margin = o.marginMm * MM;

    let pageW: number, pageH: number;
    if (o.pageSize === "fit") {
      pageW = dispW * 0.75 + margin * 2;
      pageH = dispH * 0.75 + margin * 2;
    } else {
      const [w, h] = PAGE_SIZES[o.pageSize].size;
      const landscape = o.orientation === "landscape" || (o.orientation === "auto" && dispW > dispH);
      [pageW, pageH] = landscape ? [h, w] : [w, h];
    }
    const boxW = Math.max(1, pageW - margin * 2);
    const boxH = Math.max(1, pageH - margin * 2);
    const natural = { w: dispW * 0.75, h: dispH * 0.75 }; // 96 dpi screen pixels → points
    let k = Math.min(boxW / natural.w, boxH / natural.h);
    if (o.scale === "shrink") k = Math.min(1, k);
    const sw = natural.w * k, sh = natural.h * k;
    const bx = margin + (boxW - sw) / 2;
    const by = margin + (boxH - sh) / 2;
    const uW = swap ? sh : sw, uH = swap ? sw : sh; // size of the *unrotated* picture
    const page = doc.addPage([pageW, pageH]);
    const spot = rot === 0 ? { x: bx, y: by } : rot === 90 ? { x: bx, y: by + sh } : rot === 180 ? { x: bx + sw, y: by + sh } : { x: bx + sw, y: by };
    const angle = rot === 0 ? 0 : rot === 90 ? -90 : rot === 180 ? 180 : 90;
    page.drawImage(embedded, { x: spot.x, y: spot.y, width: uW, height: uH, rotate: degrees(angle) });
  }
  onProgress?.(items.length, items.length);
  doc.setProducer("Workings (workings-inky.vercel.app)");
  doc.setCreator("Workings");
  return { bytes: await doc.save(), pages: items.length, notes };
}

// ------------------------------------------------------------------------------------------------------------------
// Opening, merging and splitting
// ------------------------------------------------------------------------------------------------------------------
export class PasswordNeeded extends Error {
  constructor() { super("password required"); this.name = "PasswordNeeded"; }
}
/** A password was given but it did not open the file. The visitor can try again. */
export class WrongPassword extends Error {
  constructor() { super("wrong password"); this.name = "WrongPassword"; }
}
export const PASSWORD_HELP = "This PDF is password-protected. Enter its password to continue. The result will not be password-protected.";
export const WRONG_PASSWORD_HELP = "That password didn't open the PDF. Check it and try again.";

export async function openPdf(bytes: Uint8Array, password?: string) {
  const { PDFDocument, EncryptedPDFError } = await loadPdfLib();
  try {
    return await PDFDocument.load(bytes, { password: password || undefined, updateMetadata: false });
  } catch (e) {
    const message = String((e as Error)?.message ?? "");
    if (/password incorrect/i.test(message)) throw new WrongPassword();
    if (e instanceof EncryptedPDFError || /encrypt/i.test(message)) throw password ? new WrongPassword() : new PasswordNeeded();
    throw new FileProblem("This file couldn't be read as a PDF. It may be damaged, not a real PDF, or use features this tool can't handle.");
  }
}

export type PdfInfo = { pages: number; bytes: Uint8Array };
export async function inspectPdf(file: File, password?: string): Promise<PdfInfo> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") {
    // Many real PDFs have a few bytes of junk before the header; accept anything within the first 1 KB.
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
    if (!head.includes("%PDF-")) throw new FileProblem(`“${file.name}” isn't a PDF file.`);
  }
  const doc = await openPdf(bytes, password);
  return { pages: doc.getPageCount(), bytes };
}

export async function mergePdfs(parts: { bytes: Uint8Array; password?: string }[]): Promise<{ bytes: Uint8Array; pages: number }> {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  for (const p of parts) {
    const src = await openPdf(p.bytes, p.password);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((pg) => out.addPage(pg));
    await nextFrame();
  }
  out.setProducer("Workings (workings-inky.vercel.app)");
  return { bytes: await out.save({ useObjectStreams: true }), pages: out.getPageCount() };
}

/** "1-3, 5, 8-" → [[0,1,2],[4],[7..last]] (0-based). Throws a FileProblem with a precise message on bad input. */
export function parseRanges(text: string, pageCount: number): number[][] {
  const groups: number[][] = [];
  const tokens = text.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) throw new FileProblem("Type the pages you want, for example 1-3, 5, 8-10.");
  for (const token of tokens) {
    const m = /^(\d+)?\s*(?:[-–—]\s*(\d+)?)?$/.exec(token);
    if (!m || (!m[1] && !m[2])) throw new FileProblem(`“${token}” isn't a page or a range. Use numbers like 3 or 2-6.`);
    const hasDash = /[-–—]/.test(token);
    const from = m[1] ? parseInt(m[1], 10) : 1;
    const to = hasDash ? (m[2] ? parseInt(m[2], 10) : pageCount) : from;
    if (from < 1 || to < 1) throw new FileProblem("Page numbers start at 1.");
    if (from > pageCount || to > pageCount) throw new FileProblem(`“${token}” goes past the last page. This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.`);
    if (from > to) throw new FileProblem(`“${token}” counts backwards. Write it as ${to}-${from}.`);
    const g: number[] = [];
    for (let i = from; i <= to; i++) g.push(i - 1);
    groups.push(g);
  }
  return groups;
}

export const chunkPages = (pageCount: number, size: number): number[][] =>
  Array.from({ length: Math.ceil(pageCount / size) }, (_, i) => Array.from({ length: Math.min(size, pageCount - i * size) }, (_, j) => i * size + j));

export async function extractPages(source: Awaited<ReturnType<typeof openPdf>>, pages: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, pages);
  copied.forEach((p) => out.addPage(p));
  out.setProducer("Workings (workings-inky.vercel.app)");
  return out.save({ useObjectStreams: true });
}

// ------------------------------------------------------------------------------------------------------------------
// Compression
// ------------------------------------------------------------------------------------------------------------------
export type RecompressReport = { bytes: Uint8Array; found: number; recompressed: number; skipped: number; notes: string[] };

/**
 * Keeps all text, fonts and links, and re-compresses only the pictures inside the PDF: embedded JPEGs and plain
 * (Flate) RGB/grey images are re-encoded at the chosen quality and, if larger than `maxDim`, scaled down.
 * An image is replaced only when the new version is clearly smaller.
 */
export async function recompressPdfImages(
  bytes: Uint8Array, o: { quality: number; maxDim: number; password?: string }, onProgress?: (done: number, total: number) => void,
): Promise<RecompressReport> {
  const lib = await loadPdfLib();
  const { PDFName, PDFNumber, PDFRawStream, PDFArray, PDFBool, decodePDFRawStream } = lib;
  const doc = await openPdf(bytes, o.password);
  const ctx = doc.context;
  const images: { ref: PDFRef; stream: PDFRawStream }[] = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) images.push({ ref, stream: obj });
  }
  const notes: string[] = [];
  let recompressed = 0, skipped = 0;
  const name = (v: unknown): string | null => (v instanceof PDFName ? v.decodeText() : null);
  const num = (v: unknown): number | null => (v instanceof PDFNumber ? v.asNumber() : null);

  for (let i = 0; i < images.length; i++) {
    onProgress?.(i, images.length);
    await nextFrame();
    const { ref, stream } = images[i];
    const dict = stream.dict;
    const w = num(ctx.lookup(dict.get(PDFName.of("Width"))));
    const h = num(ctx.lookup(dict.get(PDFName.of("Height"))));
    const bpc = num(ctx.lookup(dict.get(PDFName.of("BitsPerComponent"))));
    const isMask = ctx.lookup(dict.get(PDFName.of("ImageMask")));
    // Filters are applied in order; a JPEG may be wrapped in text/zip encodings (for example ASCII85 then DCT), which are undone first.
    const rawFilter = ctx.lookup(dict.get(PDFName.of("Filter")));
    const filters: string[] = rawFilter instanceof PDFArray
      ? Array.from({ length: rawFilter.size() }, (_, k) => name(ctx.lookup(rawFilter.get(k))) ?? "?")
      : rawFilter ? [name(rawFilter) ?? "?"] : [];
    const filterName = filters[filters.length - 1];
    const wrappers = filters.slice(0, -1);
    const wrapperOk = wrappers.every((f) => ["ASCII85Decode", "ASCIIHexDecode", "FlateDecode", "RunLengthDecode", "LZWDecode"].includes(f)) && (wrappers.length === 0 || !dict.has(PDFName.of("DecodeParms")));
    const cs = ctx.lookup(dict.get(PDFName.of("ColorSpace")));
    let comps: number | null = null;
    const csName = name(cs);
    if (csName === "DeviceRGB") comps = 3;
    else if (csName === "DeviceGray") comps = 1;
    else if (cs instanceof PDFArray && name(ctx.lookup(cs.get(0))) === "ICCBased") {
      const icc = ctx.lookup(cs.get(1));
      const n = icc && "dict" in (icc as object) ? num(ctx.lookup(((icc as unknown) as { dict: PDFDict }).dict.get(PDFName.of("N")))) : null;
      if (n === 1 || n === 3) comps = n;
    }
    const unsupported = !wrapperOk || (filterName === "FlateDecode" && wrappers.length > 0) || !w || !h || (isMask instanceof PDFBool && isMask.asBoolean()) || dict.has(PDFName.of("Decode")) || dict.has(PDFName.of("Mask")) || comps === null || (filterName === "FlateDecode" && bpc !== 8);
    if (unsupported || (filterName !== "DCTDecode" && filterName !== "FlateDecode") || w * h < 4096) { skipped++; continue; }

    try {
      let blob: Blob;
      const long = Math.max(w, h);
      const k = Math.min(1, o.maxDim / long);
      const dw = Math.max(1, Math.round(w * k)), dh = Math.max(1, Math.round(h * k));
      if (filterName === "DCTDecode") {
        let jpeg: Uint8Array = stream.getContents();
        if (wrappers.length) {
          const tmp = PDFRawStream.of(ctx.obj({ Filter: wrappers.length === 1 ? PDFName.of(wrappers[0]) : wrappers.map((f) => PDFName.of(f)) }) as PDFDict, jpeg);
          jpeg = decodePDFRawStream(tmp).decode();
        }
        const bmp = await createImageBitmap(new Blob([jpeg as BlobPart], { type: "image/jpeg" }), { imageOrientation: "none" });
        try {
          blob = await encodeLossy(resample(bmp, { x: 0, y: 0, w: bmp.width, h: bmp.height }, dw, dh, "#ffffff"), "image/jpeg", o.quality);
        } finally { bmp.close(); }
      } else {
        const raw = decodePDFRawStream(stream).decode();
        if (raw.length < w * h * comps!) { skipped++; continue; }
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let p = 0, q = 0, s = 0; p < w * h; p++, q += 4) {
          if (comps === 3) { rgba[q] = raw[s++]; rgba[q + 1] = raw[s++]; rgba[q + 2] = raw[s++]; } else { const g = raw[s++]; rgba[q] = rgba[q + 1] = rgba[q + 2] = g; }
          rgba[q + 3] = 255;
        }
        const src = document.createElement("canvas");
        src.width = w; src.height = h;
        src.getContext("2d")!.putImageData(new ImageData(rgba, w, h), 0, 0);
        blob = await encodeLossy(resample(src, { x: 0, y: 0, w, h }, dw, dh, "#ffffff"), "image/jpeg", o.quality);
      }
      const oldSize = stream.getContents().length;
      // Flate images (screenshots, diagrams) are often already small; JPEG must beat them clearly to be worth the quality loss.
      const needed = filterName === "FlateDecode" ? 0.7 : 0.95;
      if (blob.size >= oldSize * needed) { skipped++; continue; }
      const data = new Uint8Array(await blob.arrayBuffer());
      const next = ctx.stream(data, {
        Type: "XObject", Subtype: "Image", Width: dw, Height: dh, ColorSpace: "DeviceRGB", BitsPerComponent: 8, Filter: "DCTDecode",
      });
      // keep a soft mask (transparency) if the original had one
      const smask = dict.get(PDFName.of("SMask"));
      if (smask) next.dict.set(PDFName.of("SMask"), smask);
      ctx.assign(ref, next);
      recompressed++;
    } catch {
      skipped++;
    }
  }
  onProgress?.(images.length, images.length);
  if (!images.length) notes.push("This PDF has no embedded pictures to re-compress (it is probably text and vector graphics only).");
  const out = await doc.save({ useObjectStreams: true });
  return { bytes: out, found: images.length, recompressed, skipped, notes };
}

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | undefined;
export function loadPdfJs(): Promise<PdfJs> {
  return (pdfjs ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    return m as unknown as PdfJs;
  }));
}

/** Draws every page to a picture and rebuilds the PDF from those pictures. Text stops being selectable — see the tool page. */
export async function rasterizePdf(
  bytes: Uint8Array, o: { dpi: number; quality: number; password?: string }, onProgress?: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; pages: number }> {
  const pdfjsLib = await loadPdfJs();
  const { PDFDocument } = await loadPdfLib();
  const task = pdfjsLib.getDocument({ data: bytes.slice(), password: o.password });
  let src;
  try { src = await task.promise; } catch (e) {
    if ((e as { name?: string })?.name === "PasswordException") throw o.password ? new WrongPassword() : new PasswordNeeded();
    throw new FileProblem("This PDF couldn't be drawn. It may be damaged or use features this tool can't handle.");
  }
  const out = await PDFDocument.create();
  try {
    for (let n = 1; n <= src.numPages; n++) {
      onProgress?.(n - 1, src.numPages);
      await nextFrame();
      const page = await src.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(o.dpi / 72, 4000 / Math.max(base.width, base.height));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
      const g = canvas.getContext("2d")!;
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: g, viewport: vp, canvas }).promise;
      const jpg = await out.embedJpg(new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", o.quality)).arrayBuffer()));
      const p = out.addPage([base.width, base.height]);
      p.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      canvas.width = 1; canvas.height = 1;
    }
  } finally { await task.destroy(); }
  onProgress?.(src.numPages, src.numPages);
  out.setProducer("Workings (workings-inky.vercel.app)");
  return { bytes: await out.save({ useObjectStreams: true }), pages: out.getPageCount() };
}

/** Small previews of the first pages of a PDF (as blobs) so the visitor can check the result before downloading. */
export async function renderThumbnails(bytes: Uint8Array, maxPages = 6, width = 240): Promise<{ blobs: Blob[]; total: number }> {
  const pdfjsLib = await loadPdfJs();
  const task = pdfjsLib.getDocument({ data: bytes.slice() });
  const src = await task.promise;
  const blobs: Blob[] = [];
  try {
    for (let n = 1; n <= Math.min(maxPages, src.numPages); n++) {
      const page = await src.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (width * (window.devicePixelRatio > 1 ? 1.5 : 1)) / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
      const g = canvas.getContext("2d")!;
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: g, viewport: vp, canvas }).promise;
      blobs.push(await canvasToBlob(canvas, "image/png"));
      page.cleanup();
    }
    return { blobs, total: src.numPages };
  } finally { await task.destroy(); }
}
