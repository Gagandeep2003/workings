/**
 * Adds harmless filler to a file so it reaches a portal's *minimum* size. The picture itself is not changed: JPEG gets
 * comment segments, PNG gets a text chunk. (Some upload forms reject files below a minimum size; compressing alone can
 * overshoot that.) WebP and PDF are not padded.
 */
import { crc32 } from "./zip";

const FILL = 0x20;

export async function padJpeg(blob: Blob, targetBytes: number): Promise<Blob> {
  const src = new Uint8Array(await blob.arrayBuffer());
  if (src.length >= targetBytes || src[0] !== 0xff || src[1] !== 0xd8) return blob;
  // Insert after SOI and any APPn segments (JFIF/EXIF must stay first).
  let pos = 2;
  while (pos + 4 <= src.length && src[pos] === 0xff && src[pos + 1] >= 0xe0 && src[pos + 1] <= 0xef) pos += 2 + ((src[pos + 2] << 8) | src[pos + 3]);
  let remaining = targetBytes - src.length;
  const chunks: Uint8Array[] = [];
  while (remaining > 0) {
    const payload = Math.max(1, Math.min(65_533, remaining - 4));
    const seg = new Uint8Array(4 + payload);
    seg[0] = 0xff; seg[1] = 0xfe;
    seg[2] = (payload + 2) >> 8; seg[3] = (payload + 2) & 0xff;
    seg.fill(FILL, 4);
    chunks.push(seg);
    remaining -= seg.length;
  }
  const out = new Uint8Array(src.length + chunks.reduce((s, c) => s + c.length, 0));
  out.set(src.subarray(0, pos), 0);
  let w = pos;
  for (const c of chunks) { out.set(c, w); w += c.length; }
  out.set(src.subarray(pos), w);
  return new Blob([out], { type: "image/jpeg" });
}

export async function padPng(blob: Blob, targetBytes: number): Promise<Blob> {
  const src = new Uint8Array(await blob.arrayBuffer());
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (src.length >= targetBytes || SIG.some((b, i) => src[i] !== b)) return blob;
  const iend = src.length - 12; // IEND chunk is always the last 12 bytes in a valid PNG
  if (String.fromCharCode(...src.subarray(iend + 4, iend + 8)) !== "IEND") return blob;
  const dataLen = Math.max(9, targetBytes - src.length - 12); // 12 bytes of chunk framing
  const chunk = new Uint8Array(12 + dataLen);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, dataLen);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4); // "tEXt"
  chunk.set(new TextEncoder().encode("Comment\0"), 8); // keyword + separator
  chunk.fill(FILL, 16, 8 + dataLen);
  view.setUint32(8 + dataLen, crc32(chunk.subarray(4, 8 + dataLen)));
  const out = new Uint8Array(src.length + chunk.length);
  out.set(src.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(src.subarray(iend), iend + chunk.length);
  return new Blob([out], { type: "image/png" });
}
