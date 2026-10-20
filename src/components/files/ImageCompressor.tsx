"use client";
import { useState } from "react";
import { BatchShell, type ProcessResult } from "./BatchShell";
import { NumberField, Notice, RangeField, SelectField } from "./ui";
import { FileProblem, decodeImage, encodeLossy, encodePng, encodeToTarget, fullRect, hasTransparency, resample } from "@/lib/files/image";
import { KB_STRICT, encodePngToTarget, outName, pngColorsForQuality, resolveOutType, typeFromFile, type FormatChoice } from "@/lib/files/imageOps";
import { formatBytes } from "@/lib/files/format";

type Settings = { mode: "quality" | "target"; quality: number; targetKb: string; format: FormatChoice; maxDim: string; bg: string };
const INITIAL: Settings = { mode: "quality", quality: 75, targetKb: "100", format: "same", maxDim: "", bg: "#ffffff" };

async function compress(file: File, s: Settings): Promise<ProcessResult> {
  const d = await decodeImage(file, file.name);
  try {
    const notes: string[] = [];
    const warnings: string[] = [];
    const srcType = typeFromFile(file);
    const mayHaveAlpha = srcType !== "image/jpeg";
    const alpha = mayHaveAlpha && hasTransparency(d);
    const { type, note } = await resolveOutType(file, s.format, alpha);
    if (note) notes.push(note);
    if (type === "image/jpeg" && alpha) warnings.push("This picture has transparent areas. JPG can't store transparency, so they were filled with the background colour.");

    const maxDim = Number(s.maxDim);
    const scale = Number.isFinite(maxDim) && maxDim >= 16 ? Math.min(1, maxDim / Math.max(d.width, d.height)) : 1;
    const w = Math.max(1, Math.round(d.width * scale)), h = Math.max(1, Math.round(d.height * scale));
    if (scale < 1) notes.push(`Resized from ${d.width} × ${d.height} to ${w} × ${h} px.`);
    const canvas = resample(d.source, fullRect(d), w, h, type === "image/jpeg" ? s.bg : undefined);

    let blob: Blob;
    let outW = w, outH = h;
    if (s.mode === "target") {
      const kb = Number(s.targetKb);
      if (!Number.isFinite(kb) || kb < 1) throw new FileProblem("Enter a target size of at least 1 KB.");
      const maxBytes = Math.floor(kb * KB_STRICT);
      const r = type === "image/png" ? await encodePngToTarget(canvas, maxBytes, true) : await encodeToTarget(canvas, type, { maxBytes, allowDownscale: true, background: s.bg });
      blob = r.blob; outW = r.width; outH = r.height;
      if (r.scaled) notes.push(`To reach ${kb} KB the picture was also scaled down to ${r.width} × ${r.height} px.`);
      if (!r.reached) warnings.push(`Couldn't get below ${kb} KB (best: ${formatBytes(blob.size)}). Try a larger target or another format.`);
      else notes.push(type === "image/png" ? "Target met by reducing the number of colours." : `Target met at about ${Math.round(r.quality * 100)}% quality.`);
    } else {
      blob = type === "image/png" ? await encodePng(canvas, pngColorsForQuality(s.quality)) : await encodeLossy(canvas, type, s.quality / 100);
      if (type === "image/png" && s.quality >= 100) notes.push("Lossless PNG: the browser's encoder rarely beats a PNG that was already optimised.");
    }

    const sameFormat = type === srcType;
    if (sameFormat && scale === 1 && s.mode === "quality" && blob.size >= file.size) {
      return { blob: file, filename: file.name, width: d.width, height: d.height, kept: true, notes: ["Re-compressing would not make this file smaller, so the original is returned unchanged."] };
    }
    if (blob.size >= file.size) warnings.push("The result is not smaller than the original. Lower the quality, choose WebP or JPG, or reduce the dimensions.");
    return { blob, filename: outName(file, "-compressed", type), width: outW, height: outH, notes, warnings };
  } finally { d.close(); }
}

export default function ImageCompressor() {
  const [s, setS] = useState<Settings>(INITIAL);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const panel = (
    <div className="settings-grid">
      <SelectField id="ic-mode" label="How to compress" value={s.mode} onChange={(v) => set("mode", v)} options={[{ value: "quality", label: "By quality (recommended)" }, { value: "target", label: "To a target file size" }]} />
      {s.mode === "quality"
        ? <RangeField id="ic-q" label="Quality" value={s.quality} min={10} max={100} step={5} suffix="%" onChange={(v) => set("quality", v)} hint="70–80% is usually the best balance. For PNG this sets how many colours are kept." />
        : <NumberField id="ic-kb" label="Target size" value={s.targetKb} onChange={(v) => set("targetKb", v)} min={1} unit="KB" hint="Aims slightly under this size. If quality alone can't reach it, the picture is scaled down." />}
      <SelectField id="ic-fmt" label="Output format" value={s.format} onChange={(v) => set("format", v)} options={[{ value: "same", label: "Same as original" }, { value: "jpeg", label: "JPG (smallest for photos)" }, { value: "webp", label: "WebP (small, modern)" }, { value: "png", label: "PNG (transparency, sharp edges)" }]} />
      <NumberField id="ic-dim" label="Limit longest side" value={s.maxDim} onChange={(v) => set("maxDim", v)} min={16} unit="px" optional hint="Leave empty to keep the original dimensions." />
      {(s.format === "jpeg" || s.format === "same") && (
        <div className="field">
          <label className="field__label" htmlFor="ic-bg">Background for transparent areas</label>
          <input id="ic-bg" type="color" className="color-input" value={s.bg} onChange={(e) => set("bg", e.target.value)} />
          <span className="field__hint">Only used when a transparent picture is saved as JPG.</span>
        </div>
      )}
    </div>
  );
  return (
    <>
      <BatchShell
        toolId="image-compressor" settings={s} settingsPanel={panel} process={compress} verb="Compressed" zipName="compressed-images.zip"
        dropTitle="Choose images or drop them here" dropHint="JPG, PNG, WebP (also GIF, BMP, AVIF if your browser opens them) · up to 50 files · you can also paste with Ctrl+V"
      />
      <Notice kind="info">Re-compressing removes hidden metadata such as GPS location and camera details. Nothing is uploaded: your pictures stay in this browser tab.</Notice>
    </>
  );
}
