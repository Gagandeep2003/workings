"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { BlobImage, Dropzone, Notice, NumberField, RangeField, SelectField, usePasteFiles } from "./ui";
import { FileProblem, IMAGE_ACCEPT, decodeImage, encodeLossy, encodePng, encodeToTarget, fullRect, looksLikeImage, makeCanvas, resample } from "@/lib/files/image";
import { KB_STRICT, encodePngToTarget } from "@/lib/files/imageOps";
import { padJpeg, padPng } from "@/lib/files/pad";
import { KB, baseName, formatBytes } from "@/lib/files/format";
import { downloadBlob } from "@/lib/files/download";
import { trackEvent } from "@/lib/analytics";

type Unit = "px" | "cm" | "mm" | "in";
type Preset = { id: string; group: "Photo" | "Signature" | "Other scans"; label: string; w: number; h: number; unit: Unit; dpi?: number; minKb?: number; maxKb?: number };

/**
 * Commonly published values (for example the bank-exam style forms). They are shortcuts, not rules: portals and
 * notifications change from year to year, so always compare with the numbers on your own form.
 */
export const PRESETS: Preset[] = [
  { id: "bank-photo", group: "Photo", label: "Bank-exam style photo — 200 × 230 px, 20–50 KB", w: 200, h: 230, unit: "px", minKb: 20, maxKb: 50 },
  { id: "photo-3545", group: "Photo", label: "Passport size 3.5 × 4.5 cm (300 DPI), up to 50 KB", w: 3.5, h: 4.5, unit: "cm", dpi: 300, maxKb: 50 },
  { id: "photo-2x2", group: "Photo", label: "2 × 2 inch square (600 × 600 px)", w: 600, h: 600, unit: "px" },
  { id: "bank-sign", group: "Signature", label: "Bank-exam style signature — 140 × 60 px, 10–20 KB", w: 140, h: 60, unit: "px", minKb: 10, maxKb: 20 },
  { id: "sign-4020", group: "Signature", label: "Signature 4.0 × 2.0 cm (300 DPI), 10–20 KB", w: 4, h: 2, unit: "cm", dpi: 300, minKb: 10, maxKb: 20 },
  { id: "sign-3515", group: "Signature", label: "Signature 3.5 × 1.5 cm (300 DPI), up to 20 KB", w: 3.5, h: 1.5, unit: "cm", dpi: 300, maxKb: 20 },
  { id: "thumb", group: "Other scans", label: "Left thumb impression — 240 × 240 px, 20–50 KB", w: 240, h: 240, unit: "px", minKb: 20, maxKb: 50 },
  { id: "declaration", group: "Other scans", label: "Handwritten declaration — 800 × 400 px, 50–100 KB", w: 800, h: 400, unit: "px", minKb: 50, maxKb: 100 },
];

const toPx = (v: number, unit: Unit, dpi: number) => Math.round(unit === "px" ? v : unit === "in" ? v * dpi : unit === "cm" ? (v / 2.54) * dpi : (v / 25.4) * dpi);
type Result = { blob: Blob; w: number; h: number; quality: number; warnings: string[]; good: string[] };

export default function PhotoResizer({ preset = "photo" }: { preset?: string }) {
  const kind: "photo" | "signature" = preset === "signature" ? "signature" : "photo";
  const first = PRESETS.find((p) => p.group === (kind === "photo" ? "Photo" : "Signature"))!;
  const [presetId, setPresetId] = useState(first.id);
  const [w, setW] = useState(String(first.w));
  const [h, setH] = useState(String(first.h));
  const [unit, setUnit] = useState<Unit>(first.unit);
  const [dpi, setDpi] = useState(String(first.dpi ?? 300));
  const [minKb, setMinKb] = useState(first.minKb ? String(first.minKb) : "");
  const [maxKb, setMaxKb] = useState(first.maxKb ? String(first.maxKb) : "");
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [fit, setFit] = useState<"crop" | "pad">("crop");
  const [bg, setBg] = useState("#ffffff");
  const [padMin, setPadMin] = useState(true);
  const [clean, setClean] = useState(kind === "signature");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 }); // centre of the visible region, as a fraction of the source
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null); // decoded picture (long side ≤ 4000 px)
  const previewRef = useRef<HTMLCanvasElement>(null);
  const run = useRef(0);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setW(String(p.w)); setH(String(p.h)); setUnit(p.unit); if (p.dpi) setDpi(String(p.dpi));
    setMinKb(p.minKb ? String(p.minKb) : ""); setMaxKb(p.maxKb ? String(p.maxKb) : "");
  };

  const loadFile = useCallback(async (files: File[]) => {
    const f = files[0];
    setError(""); setResult(null);
    if (!f) return;
    if (!looksLikeImage(f)) { setError(`“${f.name}” isn't an image. Choose a JPG, PNG or WebP file.`); return; }
    if (f.size > 60 * 1024 * 1024) { setError(`“${f.name}” is ${formatBytes(f.size)}, which is too large to process safely. Choose a smaller file.`); return; }
    try {
      const d = await decodeImage(f, f.name);
      const k = Math.min(1, 4000 / Math.max(d.width, d.height));
      const c = resample(d.source, fullRect(d), d.width * k, d.height * k, "#ffffff");
      d.close();
      setBase(c); setFile(f); setRotation(0); setZoom(1); setCenter({ x: 0.5, y: 0.5 });
      trackEvent("file_tool_files_added", { toolId: kind === "photo" ? "passport-photo-resizer" : "signature-resizer", resultCount: 1 });
    } catch (e) { setError(e instanceof FileProblem ? e.message : "That file couldn't be opened."); }
  }, [kind]);
  usePasteFiles(loadFile);

  // rotated working copy
  const working = useMemo(() => {
    if (!base) return null;
    if (rotation === 0) return base;
    const swap = rotation === 90 || rotation === 270;
    const c = makeCanvas(swap ? base.height : base.width, swap ? base.width : base.height);
    const g = c.getContext("2d")!;
    g.translate(c.width / 2, c.height / 2);
    g.rotate((rotation * Math.PI) / 180);
    g.drawImage(base, -base.width / 2, -base.height / 2);
    return c;
  }, [base, rotation]);

  const dpiNum = Number(dpi);
  const W = Number(w) > 0 ? toPx(Number(w), unit, dpiNum) : 0;
  const H = Number(h) > 0 ? toPx(Number(h), unit, dpiNum) : 0;
  const sizeProblem = !W || !H ? "Enter a width and height above zero." : unit !== "px" && !(dpiNum >= 36 && dpiNum <= 1200) ? "Enter a resolution between 36 and 1200 DPI." : W > 6000 || H > 6000 ? "The width and height are limited to 6000 px each." : "";

  // region of the source that ends up in the frame
  const region = useMemo(() => {
    if (!working || sizeProblem) return null;
    const sw = working.width, sh = working.height;
    if (fit === "pad") return null;
    const scale = Math.max(W / sw, H / sh) * zoom;
    const rw = Math.min(sw, W / scale), rh = Math.min(sh, H / scale);
    const x = Math.min(Math.max(center.x * sw - rw / 2, 0), sw - rw);
    const y = Math.min(Math.max(center.y * sh - rh / 2, 0), sh - rh);
    return { x, y, w: rw, h: rh };
  }, [working, W, H, zoom, center, fit, sizeProblem]);

  // live preview
  const aspect = W && H ? W / H : 1;
  const pw = aspect >= 1 ? 360 : Math.round(360 * aspect);
  const ph = aspect >= 1 ? Math.round(360 / aspect) : 360;
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv || !working || sizeProblem) return;
    cv.width = pw; cv.height = ph;
    const g = cv.getContext("2d")!;
    g.fillStyle = bg; g.fillRect(0, 0, pw, ph);
    g.imageSmoothingQuality = "high";
    if (region) g.drawImage(working, region.x, region.y, region.w, region.h, 0, 0, pw, ph);
    else {
      const k = Math.min(pw / working.width, ph / working.height);
      g.drawImage(working, (pw - working.width * k) / 2, (ph - working.height * k) / 2, working.width * k, working.height * k);
    }
  }, [working, region, pw, ph, bg, sizeProblem]);

  // build the real output (debounced)
  useEffect(() => {
    if (!working || sizeProblem) return;
    const id = ++run.current;
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        const minB = minKb.trim() ? Math.round(Number(minKb) * KB) : 0;
        const maxB = maxKb.trim() ? Math.floor(Number(maxKb) * KB_STRICT) : 0;
        if ((minKb.trim() && !(Number(minKb) >= 0)) || (maxKb.trim() && !(Number(maxKb) > 0))) throw new FileProblem("File sizes must be positive numbers.");
        if (minB && maxB && minB > maxB) throw new FileProblem("The minimum size is larger than the maximum size.");
        let canvas: HTMLCanvasElement;
        if (region) canvas = resample(working, region, W, H, bg);
        else {
          canvas = makeCanvas(W, H);
          const g = canvas.getContext("2d")!;
          g.fillStyle = bg; g.fillRect(0, 0, W, H);
          const k = Math.min(W / working.width, H / working.height);
          const fitted = resample(working, fullRect(working), working.width * k, working.height * k, bg);
          g.drawImage(fitted, (W - fitted.width) / 2, (H - fitted.height) / 2);
        }
        if (clean) cleanScan(canvas);
        const warnings: string[] = [], good: string[] = [];
        let blob: Blob, quality = 1;
        if (format === "jpeg") {
          if (maxB) {
            const r = await encodeToTarget(canvas, "image/jpeg", { maxBytes: maxB, allowDownscale: false, minQuality: 0.05, maxQuality: 1 });
            blob = r.blob; quality = r.quality;
            if (!r.reached) warnings.push(`At ${W} × ${H} px the smallest JPG is ${formatBytes(blob.size)}, above your ${maxKb} KB limit. Use a simpler background, a smaller pixel size (if your form allows it), or ask the portal for a larger limit.`);
          } else blob = await encodeLossy(canvas, "image/jpeg", 0.92);
          if (minB && blob.size < minB && padMin) { blob = await padJpeg(blob, minB + 64); good.push(`Padded with invisible filler to reach ${minKb} KB. The picture itself is unchanged.`); }
        } else {
          if (maxB) {
            const r = await encodePngToTarget(canvas, maxB, false);
            blob = r.blob;
            if (!r.reached) warnings.push(`At ${W} × ${H} px the smallest PNG is ${formatBytes(blob.size)}, above your ${maxKb} KB limit. Choose JPG, which is much smaller for photos and scans.`);
          } else blob = await encodePng(canvas);
          if (minB && blob.size < minB && padMin) { blob = await padPng(blob, minB + 64); good.push(`Padded with invisible filler to reach ${minKb} KB. The picture itself is unchanged.`); }
        }
        if (minB && blob.size < minB) warnings.push(`The file is ${formatBytes(blob.size)}, below your ${minKb} KB minimum. Turn on “Pad to the minimum size”.`);
        if (maxB && blob.size <= maxB && (!minB || blob.size >= minB)) good.push(`Within your size limit${minB ? ` (${minKb}–${maxKb} KB)` : ` (up to ${maxKb} KB)`}.`);
        if (run.current !== id) return;
        setResult({ blob, w: canvas.width, h: canvas.height, quality, warnings, good });
        setError("");
      } catch (e) {
        if (run.current !== id) return;
        setResult(null);
        setError(e instanceof FileProblem ? e.message : "The output couldn't be created. Try a smaller size.");
      } finally { if (run.current === id) setBusy(false); }
    }, 220);
    return () => window.clearTimeout(t);
  }, [working, region, W, H, bg, format, minKb, maxKb, padMin, clean, sizeProblem]);

  const shown = working && !sizeProblem ? result : null; // a stale result is never shown once the inputs are invalid

  // drag to reposition
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const move = (dxFrac: number, dyFrac: number) => setCenter((c) => ({ x: Math.min(1, Math.max(0, c.x + dxFrac)), y: Math.min(1, Math.max(0, c.y + dyFrac)) }));
  const canDrag = !!region && !!working;
  const download = () => {
    if (!result || !file) return;
    downloadBlob(result.blob, `${baseName(file.name)}-${kind}-${result.w}x${result.h}.${format === "jpeg" ? "jpg" : "png"}`);
    trackEvent("file_tool_download", { toolId: kind === "photo" ? "passport-photo-resizer" : "signature-resizer", mode: "single" });
  };
  const groupOptions = (g: Preset["group"]) => PRESETS.filter((p) => p.group === g);

  return (
    <div className="card file-tool">
      <div className="settings-grid">
        <div className="field field--wide">
          <label className="field__label" htmlFor="pr-preset">Start from a common size</label>
          <select id="pr-preset" className="select" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {(kind === "photo" ? ["Photo", "Other scans", "Signature"] : ["Signature", "Other scans", "Photo"]).map((g) => (
              <optgroup key={g} label={g}>{groupOptions(g as Preset["group"]).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
            ))}
            <option value="custom">Custom — I’ll type the numbers from my form</option>
          </select>
          <span className="field__hint">These are typical published values, not rules. Forms change: always use the numbers on your own notification, and edit them below.</span>
        </div>
        <NumberField id="pr-w" label="Width" value={w} onChange={(v) => { setW(v); setPresetId("custom"); }} min={0} unit={unit} />
        <NumberField id="pr-h" label="Height" value={h} onChange={(v) => { setH(v); setPresetId("custom"); }} min={0} unit={unit} />
        <SelectField id="pr-unit" label="Unit" value={unit} onChange={(v) => { setUnit(v); setPresetId("custom"); }} options={[{ value: "px", label: "Pixels" }, { value: "cm", label: "Centimetres" }, { value: "mm", label: "Millimetres" }, { value: "in", label: "Inches" }]} />
        {unit !== "px" && <NumberField id="pr-dpi" label="Resolution" value={dpi} onChange={setDpi} min={36} max={1200} unit="DPI" hint={W && H ? `= ${W} × ${H} px` : undefined} />}
        <NumberField id="pr-min" label="Minimum file size" value={minKb} onChange={(v) => { setMinKb(v); setPresetId("custom"); }} min={0} unit="KB" optional />
        <NumberField id="pr-max" label="Maximum file size" value={maxKb} onChange={(v) => { setMaxKb(v); setPresetId("custom"); }} min={1} unit="KB" optional hint="Aims just under the limit so it passes whether your portal counts 1 KB as 1000 or 1024 bytes." />
        <SelectField id="pr-fmt" label="File type" value={format} onChange={setFormat} options={[{ value: "jpeg", label: "JPG (smaller; what most portals ask for)" }, { value: "png", label: "PNG" }]} />
        <SelectField id="pr-fit" label="Framing" value={fit} onChange={setFit} options={[{ value: "crop", label: "Fill the frame (crop and position)" }, { value: "pad", label: "Fit the whole picture (add margins)" }]} />
        <div className="field">
          <label className="field__label" htmlFor="pr-bg">Background colour</label>
          <input id="pr-bg" type="color" className="color-input" value={bg} onChange={(e) => setBg(e.target.value)} />
          <span className="field__hint">Fills margins and any transparent areas.</span>
        </div>
        <div className="field field--wide checks">
          <label className="check"><input type="checkbox" checked={padMin} onChange={(e) => setPadMin(e.target.checked)} /> Pad to the minimum size if the picture compresses below it</label>
          <label className="check"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> Clean up a scan: whiten the paper and darken the ink</label>
        </div>
      </div>
      {sizeProblem && <Notice kind="warn">{sizeProblem}</Notice>}

      <Dropzone accept={IMAGE_ACCEPT} multiple={false} onFiles={loadFile} compact={!!file} title={file ? "Choose a different picture" : kind === "photo" ? "Choose your photo or drop it here" : "Choose a photo or scan of your signature"} hint="JPG, PNG or WebP · one picture at a time · or paste with Ctrl+V" />
      {error && <Notice kind="error">{error}</Notice>}

      {working && !sizeProblem && (
        <div className="photo-grid">
          <div className="photo-grid__col">
            <h3 className="photo-grid__h">Position</h3>
            <div
              className={`crop${canDrag ? " crop--drag" : ""}`}
              style={{ aspectRatio: `${pw} / ${ph}`, maxWidth: pw }}
              tabIndex={canDrag ? 0 : -1}
              role="group"
              aria-label="Preview of the final picture. Drag, or use the arrow keys, to move the picture inside the frame."
              onPointerDown={(e) => { if (!canDrag) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y }; }}
              onPointerMove={(e) => {
                if (!drag.current || !region || !working) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const dx = ((e.clientX - drag.current.x) / rect.width) * (region.w / working.width);
                const dy = ((e.clientY - drag.current.y) / rect.height) * (region.h / working.height);
                setCenter({ x: Math.min(1, Math.max(0, drag.current.cx - dx)), y: Math.min(1, Math.max(0, drag.current.cy - dy)) });
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onKeyDown={(e) => {
                if (!canDrag || !region || !working) return;
                const stepX = (region.w / working.width) * 0.05, stepY = (region.h / working.height) * 0.05;
                const map: Record<string, [number, number]> = { ArrowLeft: [-stepX, 0], ArrowRight: [stepX, 0], ArrowUp: [0, -stepY], ArrowDown: [0, stepY] };
                const m = map[e.key];
                if (m) { e.preventDefault(); move(m[0], m[1]); }
              }}
            >
              <canvas ref={previewRef} className="crop__canvas" aria-hidden="true" />
            </div>
            {fit === "crop" && <RangeField id="pr-zoom" label="Zoom" value={Math.round(zoom * 100)} min={100} max={400} step={5} suffix="%" onChange={(v) => setZoom(v / 100)} hint="Drag the picture, or focus it and use the arrow keys." />}
            <div className="btn-row" style={{ marginTop: "var(--s-3)" }}>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRotation((r) => (r + 270) % 360)}><Icon name="rotate-cw" style={{ transform: "scaleX(-1)" }} /> Rotate left</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRotation((r) => (r + 90) % 360)}><Icon name="rotate-cw" /> Rotate right</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setZoom(1); setCenter({ x: 0.5, y: 0.5 }); }}>Reset position</button>
            </div>
          </div>
          <div className="photo-grid__col">
            <h3 className="photo-grid__h">Result</h3>
            {busy && !shown && <p className="file-row__line">Working…</p>}
            {shown && (
              <div className="photo-result">
                <div className="photo-result__img"><BlobImage blob={shown.blob} alt="Your resized picture" width={shown.w} height={shown.h} style={{ maxWidth: "100%", height: "auto" }} /></div>
                <dl className="stat-list">
                  <div><dt>Pixels</dt><dd>{shown.w} × {shown.h}</dd></div>
                  <div><dt>File size</dt><dd>{formatBytes(shown.blob.size)} <span className="stat-sub">({Math.round(shown.blob.size)} bytes)</span></dd></div>
                  <div><dt>Original</dt><dd>{file ? formatBytes(file.size) : "—"}</dd></div>
                  {format === "jpeg" && <div><dt>JPG quality used</dt><dd>{Math.round(shown.quality * 100)}%</dd></div>}
                </dl>
                {shown.good.map((m) => <Notice key={m} kind="success">{m}</Notice>)}
                {shown.warnings.map((m) => <Notice key={m} kind="warn">{m}</Notice>)}
                <button type="button" className="btn btn--primary" onClick={download} disabled={busy}><Icon name="download" /> Download {format === "jpeg" ? "JPG" : "PNG"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Stretches the tonal range so paper becomes white and ink darker: maps the 3rd–97th brightness percentiles to 0–255. */
function cleanScan(canvas: HTMLCanvasElement) {
  const g = canvas.getContext("2d")!;
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
  const total = d.length / 4;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.03) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.2) { hi = v; break; } } // paper is the brightest large area
  if (hi - lo < 30) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, (d[i + c] - lo) * k));
  g.putImageData(img, 0, 0);
}
