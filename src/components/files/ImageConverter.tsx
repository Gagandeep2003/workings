"use client";
import { useState } from "react";
import { BatchShell, type ProcessResult } from "./BatchShell";
import { Notice, RangeField, SelectField } from "./ui";
import { FileProblem, decodeImage, encodeLossy, encodePng, fullRect, hasTransparency, resample, supportsWebpEncode } from "@/lib/files/image";
import { outName, typeFromFile } from "@/lib/files/imageOps";

type Settings = { to: "jpeg" | "png" | "webp"; quality: number; bg: string };
const INITIAL: Settings = { to: "jpeg", quality: 90, bg: "#ffffff" };

async function convert(file: File, s: Settings): Promise<ProcessResult> {
  const d = await decodeImage(file, file.name);
  try {
    const warnings: string[] = [];
    const notes: string[] = [];
    const type = s.to === "jpeg" ? "image/jpeg" : s.to === "png" ? "image/png" : "image/webp";
    if (type === "image/webp" && !(await supportsWebpEncode())) {
      throw new FileProblem("This browser can't create WebP files. Use Chrome, Edge or Firefox for WebP output, or choose JPG or PNG.");
    }
    const srcType = typeFromFile(file);
    if (srcType === type) notes.push(`This file was already ${s.to.toUpperCase()}; it was re-encoded, which may change its size slightly.`);
    if (type === "image/jpeg" && srcType !== "image/jpeg" && hasTransparency(d)) warnings.push("Transparent areas became the background colour because JPG can't store transparency.");
    const canvas = resample(d.source, fullRect(d), d.width, d.height, type === "image/jpeg" ? s.bg : undefined);
    const blob = type === "image/png" ? await encodePng(canvas) : await encodeLossy(canvas, type, s.quality / 100);
    return { blob, filename: outName(file, "", type), width: d.width, height: d.height, notes, warnings };
  } finally { d.close(); }
}

export default function ImageConverter() {
  const [s, setS] = useState<Settings>(INITIAL);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const panel = (
    <div className="settings-grid">
      <SelectField id="cv-to" label="Convert to" value={s.to} onChange={(v) => set("to", v)} options={[{ value: "jpeg", label: "JPG / JPEG" }, { value: "png", label: "PNG (lossless)" }, { value: "webp", label: "WebP" }]} />
      {s.to !== "png" && <RangeField id="cv-q" label="Quality" value={s.quality} min={30} max={100} step={5} suffix="%" onChange={(v) => set("quality", v)} hint="90% is visually near-identical for most pictures." />}
      {s.to === "jpeg" && (
        <div className="field">
          <label className="field__label" htmlFor="cv-bg">Background for transparent areas</label>
          <input id="cv-bg" type="color" className="color-input" value={s.bg} onChange={(e) => set("bg", e.target.value)} />
          <span className="field__hint">PNG, WebP and GIF can be transparent; JPG cannot.</span>
        </div>
      )}
    </div>
  );
  return (
    <>
      <BatchShell
        toolId="image-converter" settings={s} settingsPanel={panel} process={convert} verb="Converted" zipName="converted-images.zip" showSavings={false}
        dropTitle="Choose images or drop them here" dropHint="JPG, PNG, WebP, GIF, BMP, AVIF (whatever your browser can open) · up to 50 files · paste with Ctrl+V"
      />
      <Notice kind="info">The file is genuinely re-encoded in the new format, not just renamed. Animated GIFs convert only their first frame. Nothing is uploaded.</Notice>
    </>
  );
}
