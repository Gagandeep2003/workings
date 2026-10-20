"use client";
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { Dropzone, Notice, NumberField, Progress, SelectField } from "./ui";
import { FileProblem } from "@/lib/files/image";
import { PASSWORD_HELP, PasswordNeeded, WRONG_PASSWORD_HELP, WrongPassword, inspectPdf, rasterizePdf, recompressPdfImages } from "@/lib/files/pdf";
import { KB_STRICT } from "@/lib/files/imageOps";
import { baseName, describeChange, formatBytes } from "@/lib/files/format";
import { downloadBlob } from "@/lib/files/download";
import { trackEvent } from "@/lib/analytics";

type Method = "pictures" | "pages";
type Level = "low" | "medium" | "high";
// quality ladders, gentlest first
const PICTURE_STEPS = [{ q: 0.85, dim: 2400 }, { q: 0.75, dim: 2000 }, { q: 0.65, dim: 1600 }, { q: 0.55, dim: 1300 }, { q: 0.45, dim: 1000 }, { q: 0.35, dim: 800 }];
const PAGE_STEPS = [{ dpi: 150, q: 0.8 }, { dpi: 130, q: 0.7 }, { dpi: 110, q: 0.6 }, { dpi: 96, q: 0.5 }, { dpi: 80, q: 0.45 }, { dpi: 72, q: 0.4 }, { dpi: 60, q: 0.35 }];
const LEVEL_INDEX: Record<Level, number> = { low: 1, medium: 2, high: 4 };
const MAX_BYTES = 150 * 1024 * 1024;

type Outcome = { bytes: Uint8Array; method: Method; summary: string[]; reached?: boolean; structuralOnly?: boolean };

export default function PdfCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState(0);
  const [password, setPassword] = useState("");
  const [locked, setLocked] = useState(false);
  const [method, setMethod] = useState<Method>("pictures");
  const [level, setLevel] = useState<Level>("medium");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [out, setOut] = useState<Outcome | null>(null);
  const token = useRef(0);

  const load = async (f: File, pw?: string) => {
    setError(""); setOut(null);
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) { setError(`“${f.name}” isn't a PDF.`); return; }
    if (f.size === 0) { setError(`“${f.name}” is empty.`); return; }
    if (f.size > MAX_BYTES) { setError(`“${f.name}” is ${formatBytes(f.size)}. Files above ${formatBytes(MAX_BYTES)} are too large for browser memory.`); return; }
    try {
      const info = await inspectPdf(f, pw);
      setFile(f); setBytes(info.bytes); setPages(info.pages); setLocked(false);
      trackEvent("file_tool_files_added", { toolId: "pdf-compressor", resultCount: 1 });
    } catch (e) {
      if (e instanceof PasswordNeeded || e instanceof WrongPassword) { setFile(f); setBytes(null); setLocked(true); setError(e instanceof WrongPassword ? WRONG_PASSWORD_HELP : PASSWORD_HELP); }
      else setError(e instanceof FileProblem ? e.message : "This file couldn't be read as a PDF.");
    }
  };

  const run = async () => {
    if (!bytes || !file) return;
    const mine = ++token.current;
    setBusy(true); setError(""); setOut(null);
    const ok = () => token.current === mine;
    try {
      const targetBytes = target.trim() ? Math.floor(Number(target) * KB_STRICT) : 0;
      if (target.trim() && !(Number(target) >= 5)) throw new FileProblem("Enter a target size of at least 5 KB.");
      const steps = method === "pictures" ? PICTURE_STEPS : PAGE_STEPS;
      const indices = targetBytes ? steps.map((_, i) => i) : [LEVEL_INDEX[level]];
      let best: Outcome | null = null;
      let summary: string[] = [];
      let structuralOnly = false;
      for (let n = 0; n < indices.length; n++) {
        const step = steps[indices[n]];
        const label = targetBytes ? `Attempt ${n + 1} of ${indices.length}` : "Compressing";
        setProgress({ done: 0, total: 1, label });
        const onProgress = (done: number, total: number) => { if (ok()) setProgress({ done, total, label }); };
        let data: Uint8Array;
        if (method === "pictures") {
          const s = step as (typeof PICTURE_STEPS)[number];
          const r = await recompressPdfImages(bytes, { quality: s.q, maxDim: s.dim, password }, onProgress);
          data = r.bytes;
          structuralOnly = r.recompressed === 0;
          summary = r.recompressed > 0
            ? [`${r.found} picture${r.found === 1 ? "" : "s"} found in the PDF: ${r.recompressed} re-compressed, ${r.skipped} left as they were.`, `Picture quality ${Math.round(s.q * 100)}%, longest side limited to ${s.dim} px.`]
            : [...(r.found ? [`${r.found} picture${r.found === 1 ? "" : "s"} found, but none could be made clearly smaller (they may be already compressed, or use a format this method leaves alone).`] : r.notes), "Any saving comes only from re-saving the file with a more compact internal structure."];
        } else {
          const s = step as (typeof PAGE_STEPS)[number];
          const r = await rasterizePdf(bytes, { dpi: s.dpi, quality: s.q, password }, onProgress);
          data = r.bytes;
          summary = [`${r.pages} page${r.pages === 1 ? "" : "s"} redrawn as pictures at ${s.dpi} DPI, JPEG quality ${Math.round(s.q * 100)}%.`];
        }
        if (!ok()) return;
        if (!best || data.length < best.bytes.length) best = { bytes: data, method, summary, structuralOnly, reached: targetBytes ? data.length <= targetBytes : undefined };
        if (targetBytes && data.length <= targetBytes) { best = { bytes: data, method, summary, structuralOnly, reached: true }; break; }
      }
      if (ok() && best) setOut(best);
    } catch (e) {
      if (!ok()) return;
      if (e instanceof PasswordNeeded || e instanceof WrongPassword) { setLocked(true); setError(e instanceof WrongPassword ? WRONG_PASSWORD_HELP : PASSWORD_HELP); }
      else setError(e instanceof FileProblem ? e.message : "The PDF couldn't be compressed. It may be damaged or use features this tool can't handle.");
      if (!(e instanceof FileProblem) && !(e instanceof PasswordNeeded) && !(e instanceof WrongPassword)) console.error(e);
    } finally { if (ok()) setBusy(false); }
  };

  const smaller = out && file ? out.bytes.length < file.size : false;
  const smallGain = out && file ? smaller && (out.structuralOnly || (file.size - out.bytes.length) / file.size < 0.03) : false;
  const save = () => {
    if (!out || !file) return;
    downloadBlob(new Blob([out.bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)}-compressed.pdf`);
    trackEvent("file_tool_download", { toolId: "pdf-compressor", mode: "single" });
  };

  return (
    <div className="card file-tool">
      <Dropzone accept="application/pdf,.pdf" multiple={false} onFiles={(f) => { void load(f[0]); }} compact={!!file} title={file ? "Choose a different PDF" : "Choose a PDF or drop it here"} hint="One PDF at a time · up to 150 MB · processed in your browser" />
      {error && <Notice kind={locked ? "warn" : "error"} role="alert">{error}</Notice>}
      {locked && file && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void load(file, password); }}>
          <label className="sr-only" htmlFor="pc-pw">PDF password</label>
          <input id="pc-pw" type="password" className="input" autoComplete="off" placeholder="PDF password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn btn--secondary btn--sm">Unlock</button>
        </form>
      )}
      {file && bytes && (
        <>
          <p className="file-tool__summary"><strong>{file.name}</strong> · {pages} page{pages === 1 ? "" : "s"} · {formatBytes(file.size)}</p>
          <div className="settings-grid">
            <SelectField id="pc-method" label="Method" wide value={method} onChange={(v) => { setMethod(v); setOut(null); }} options={[
              { value: "pictures", label: "Keep text and links — re-compress the pictures inside (recommended)" },
              { value: "pages", label: "Maximum — turn every page into a picture (text stops being selectable)" },
            ]} />
            <SelectField id="pc-level" label="Compression strength" value={level} onChange={(v) => { setLevel(v); setOut(null); }} options={[{ value: "low", label: "Light — best quality" }, { value: "medium", label: "Medium — balanced" }, { value: "high", label: "Strong — smallest file" }]} hint={target.trim() ? "Ignored while a target size is set." : undefined} />
            <NumberField id="pc-target" label="Target size" value={target} onChange={(v) => { setTarget(v); setOut(null); }} min={5} unit="KB" optional hint="Tries stronger and stronger settings until the file fits. It may not be reachable." />
          </div>
          {method === "pages" && <Notice kind="warn">Maximum mode redraws each page as a picture. The PDF will look the same but you won’t be able to select or search its text, and links will stop working. For text-only PDFs the result can even be larger.</Notice>}
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={run} disabled={busy}>{busy ? "Compressing…" : "Compress PDF"}</button>
          </div>
          {busy && <><Progress done={progress.done} total={progress.total} label="Compressing" /><p className="file-row__line" aria-live="polite">{progress.label}: {progress.done} of {progress.total}</p></>}
          {out && (
            <div className="photo-result" role="status">
              <dl className="stat-list">
                <div><dt>Original</dt><dd>{formatBytes(file.size)}</dd></div>
                <div><dt>Compressed</dt><dd>{formatBytes(out.bytes.length)}</dd></div>
                <div><dt>Change</dt><dd>{describeChange(file.size, out.bytes.length)}</dd></div>
              </dl>
              {smaller && smallGain ? <Notice kind="info">{out?.structuralOnly ? "No pictures were compressed, so the saving comes only from a more compact file structure." : "Only a small saving: this PDF has little that can be compressed with this method."} {method === "pictures" ? "If it is made of scanned pages, try “Maximum”." : ""} Check the copy opens and looks right before you rely on it.</Notice>
                : smaller ? <Notice kind="success">The compressed copy is smaller. Check it opens and looks right before you rely on it.</Notice>
                : <Notice kind="warn">This method could not make the file smaller. {method === "pictures" ? "The PDF has little or no picture data to compress. Try “Maximum”, which redraws pages as pictures." : "Redrawing pages as pictures made it larger, which happens with text-only PDFs. Your original is already well optimised."}</Notice>}
              {out.reached === false && <Notice kind="warn">Couldn’t reach {target} KB with this method. Try the other method, or split the document into parts.</Notice>}
              <ul className="plain-list file-row__note-list">{out.summary.map((s) => <li key={s}>{s}</li>)}</ul>
              {smaller && <div className="btn-row" style={{ marginTop: 0 }}><button type="button" className="btn btn--primary" onClick={save}><Icon name="download" /> Download compressed PDF</button></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
