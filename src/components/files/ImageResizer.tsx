"use client";
import { useState } from "react";
import { BatchShell, type ProcessResult } from "./BatchShell";
import { Notice, NumberField, RangeField, SelectField } from "./ui";
import { FileProblem, decodeImage, encodeLossy, encodePng, encodeToTarget, fullRect, hasTransparency, resample } from "@/lib/files/image";
import { KB_STRICT, encodePngToTarget, outName, resolveOutType, type FormatChoice } from "@/lib/files/imageOps";

type Unit = "px" | "percent" | "cm" | "mm" | "in";
type Settings = { unit: Unit; width: string; height: string; keep: "fit" | "exact"; noEnlarge: boolean; dpi: string; format: FormatChoice; quality: number; maxKb: string; bg: string };
const INITIAL: Settings = { unit: "px", width: "1200", height: "", keep: "fit", noEnlarge: false, dpi: "300", format: "same", quality: 90, maxKb: "", bg: "#ffffff" };

export const toPx = (value: number, unit: Unit, dpi: number): number =>
  unit === "px" ? value : unit === "in" ? value * dpi : unit === "cm" ? (value / 2.54) * dpi : unit === "mm" ? (value / 25.4) * dpi : value;

async function resize(file: File, s: Settings): Promise<ProcessResult> {
  const d = await decodeImage(file, file.name);
  try {
    const notes: string[] = [];
    const warnings: string[] = [];
    const dpi = Number(s.dpi);
    if (s.unit !== "px" && s.unit !== "percent" && !(dpi >= 36 && dpi <= 1200)) throw new FileProblem("Enter a resolution between 36 and 1200 DPI.");
    const wIn = s.width.trim() === "" ? null : Number(s.width);
    const hIn = s.height.trim() === "" ? null : Number(s.height);
    if ((wIn !== null && !(wIn > 0)) || (hIn !== null && !(hIn > 0))) throw new FileProblem("Width and height must be numbers above zero.");
    if (wIn === null && hIn === null) throw new FileProblem("Enter a width, a height, or both.");

    let tw: number, th: number;
    if (s.unit === "percent") {
      const p = (wIn ?? hIn)! / 100;
      tw = d.width * p; th = d.height * p;
    } else {
      const wpx = wIn === null ? null : toPx(wIn, s.unit, dpi);
      const hpx = hIn === null ? null : toPx(hIn, s.unit, dpi);
      if (s.keep === "exact" && wpx !== null && hpx !== null) { tw = wpx; th = hpx; }
      else if (wpx !== null && hpx !== null) { const k = Math.min(wpx / d.width, hpx / d.height); tw = d.width * k; th = d.height * k; }
      else if (wpx !== null) { tw = wpx; th = d.height * (wpx / d.width); }
      else { th = hpx!; tw = d.width * (hpx! / d.height); }
    }
    if (s.noEnlarge && (tw > d.width || th > d.height)) {
      const k = Math.min(d.width / tw, d.height / th);
      tw *= k; th *= k;
      notes.push("The picture was already smaller than the requested size, so it was not enlarged.");
    }
    tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th));
    if (tw * th > 100_000_000) throw new FileProblem("That size is more than 100 megapixels. Choose a smaller size.");
    if (tw > d.width || th > d.height) warnings.push("Enlarging a picture can't add detail; it will look softer than the original.");

    const alpha = hasTransparency(d);
    const { type, note } = await resolveOutType(file, s.format, alpha);
    if (note) notes.push(note);
    if (type === "image/jpeg" && alpha) warnings.push("Transparent areas became the background colour because JPG can't store transparency.");
    const canvas = resample(d.source, fullRect(d), tw, th, type === "image/jpeg" ? s.bg : undefined);
    let blob: Blob;
    const maxKb = s.maxKb.trim() === "" ? null : Number(s.maxKb);
    if (maxKb !== null && maxKb >= 1) {
      const maxBytes = Math.floor(maxKb * KB_STRICT);
      const r = type === "image/png" ? await encodePngToTarget(canvas, maxBytes, false) : await encodeToTarget(canvas, type, { maxBytes, allowDownscale: false, background: s.bg });
      blob = r.blob;
      if (!r.reached) warnings.push(`Couldn't get below ${maxKb} KB at ${tw} × ${th} px. Use a smaller size, or JPG/WebP.`);
    } else {
      blob = type === "image/png" ? await encodePng(canvas) : await encodeLossy(canvas, type, s.quality / 100);
    }
    return { blob, filename: outName(file, `-${tw}x${th}`, type), width: tw, height: th, notes, warnings };
  } finally { d.close(); }
}

export default function ImageResizer() {
  const [s, setS] = useState<Settings>(INITIAL);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const unitLabel = s.unit === "percent" ? "%" : s.unit === "in" ? "in" : s.unit;
  const panel = (
    <div className="settings-grid">
      <SelectField id="rz-unit" label="Resize by" value={s.unit} onChange={(v) => set("unit", v)} options={[{ value: "px", label: "Pixels" }, { value: "percent", label: "Percent of original" }, { value: "cm", label: "Centimetres (needs DPI)" }, { value: "mm", label: "Millimetres (needs DPI)" }, { value: "in", label: "Inches (needs DPI)" }]} />
      <NumberField id="rz-w" label={s.unit === "percent" ? "Scale" : "Width"} value={s.width} onChange={(v) => set("width", v)} min={0} unit={unitLabel} optional={s.unit !== "percent"} />
      {s.unit !== "percent" && <NumberField id="rz-h" label="Height" value={s.height} onChange={(v) => set("height", v)} min={0} unit={unitLabel} optional hint="Leave one empty to keep the proportions." />}
      {s.unit !== "percent" && s.unit !== "px" && <NumberField id="rz-dpi" label="Resolution" value={s.dpi} onChange={(v) => set("dpi", v)} min={36} max={1200} unit="DPI" hint="Pixels = size in inches × DPI. 300 DPI suits print; 96–150 is typical for screens." />}
      {s.unit !== "percent" && s.width.trim() !== "" && s.height.trim() !== "" && (
        <SelectField id="rz-keep" label="When both are given" value={s.keep} onChange={(v) => set("keep", v)} options={[{ value: "fit", label: "Fit inside, keep proportions" }, { value: "exact", label: "Exactly this size (may stretch)" }]} />
      )}
      <SelectField id="rz-fmt" label="Output format" value={s.format} onChange={(v) => set("format", v)} options={[{ value: "same", label: "Same as original" }, { value: "jpeg", label: "JPG" }, { value: "png", label: "PNG" }, { value: "webp", label: "WebP" }]} />
      <RangeField id="rz-q" label="Quality (JPG / WebP)" value={s.quality} min={30} max={100} step={5} suffix="%" onChange={(v) => set("quality", v)} />
      <NumberField id="rz-kb" label="Maximum file size" value={s.maxKb} onChange={(v) => set("maxKb", v)} min={1} unit="KB" optional hint="Lowers quality (never the dimensions) until the file fits." />
      <label className="check"><input type="checkbox" checked={s.noEnlarge} onChange={(e) => set("noEnlarge", e.target.checked)} /> Don’t enlarge pictures that are already smaller</label>
    </div>
  );
  return (
    <>
      <BatchShell
        toolId="image-resizer" settings={s} settingsPanel={panel} process={resize} verb="Resized" zipName="resized-images.zip" showSavings={false}
        dropTitle="Choose images or drop them here" dropHint="JPG, PNG, WebP, GIF, BMP, AVIF · up to 50 files · paste with Ctrl+V"
      />
      <Notice kind="info">Physical sizes (cm, mm, inches) are converted to pixels with the DPI you set; browsers do not store DPI in the saved file. Nothing is uploaded.</Notice>
    </>
  );
}
