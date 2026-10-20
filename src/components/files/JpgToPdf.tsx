"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { BlobImage, Dropzone, Notice, NumberField, Progress, SelectField, usePasteFiles } from "./ui";
import { PdfPreview } from "./PdfPreview";
import { FileProblem, IMAGE_ACCEPT, looksLikeImage } from "@/lib/files/image";
import { PAGE_SIZES, imagesToPdf, rotateBy, type ImageItem, type ImagesToPdfOptions, type PageSizeKey, type Rotation } from "@/lib/files/pdf";
import { baseName, formatBytes } from "@/lib/files/format";
import { downloadBlob } from "@/lib/files/download";
import { trackEvent } from "@/lib/analytics";

type Entry = ImageItem & { id: number };
let ids = 1;
const MAX_IMAGES = 100;

function Thumb({ file, rotation }: { file: File; rotation: Rotation }) {
  return (
    <span className="file-row__thumb file-row__thumb--clip">
      <BlobImage blob={file} alt="" style={{ transform: `rotate(${rotation}deg)` }} />
    </span>
  );
}

export default function JpgToPdf() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeKey>("a4");
  const [orientation, setOrientation] = useState<ImagesToPdfOptions["orientation"]>("auto");
  const [margin, setMargin] = useState("10");
  const [scale, setScale] = useState<ImagesToPdfOptions["scale"]>("fit");
  const [reduce, setReduce] = useState(false);
  const [name, setName] = useState("images");
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ bytes: Uint8Array; blob: Blob; pages: number; notes: string[] } | null>(null);
  const token = useRef(0);

  const stale = () => setResult(null);
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => { entriesRef.current = entries; });
  const add = useCallback((files: File[]) => {
    const problems: string[] = [];
    const accepted: Entry[] = [];
    const have = entriesRef.current.length;
    for (const f of files) {
      if (!looksLikeImage(f)) { problems.push(`“${f.name}” isn't an image, so it was skipped.`); continue; }
      if (f.size === 0) { problems.push(`“${f.name}” is empty.`); continue; }
      if (have + accepted.length >= MAX_IMAGES) { problems.push(`Only ${MAX_IMAGES} images fit in one PDF here; “${f.name}” was not added.`); continue; }
      accepted.push({ id: ids++, file: f, rotation: 0 });
    }
    setMessages(problems);
    if (accepted.length) {
      setEntries((prev) => [...prev, ...accepted]);
      setResult(null);
      trackEvent("file_tool_files_added", { toolId: "jpg-to-pdf", resultCount: accepted.length });
    }
  }, []);
  usePasteFiles(add);

  const move = (i: number, d: -1 | 1) => { setEntries((p) => { const j = i + d; if (j < 0 || j >= p.length) return p; const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; }); stale(); };
  const rotate = (i: number, d: 90 | -90) => { setEntries((p) => p.map((e, k) => (k === i ? { ...e, rotation: rotateBy(e.rotation, d) } : e))); stale(); };
  const remove = (i: number) => { setEntries((p) => p.filter((_, k) => k !== i)); stale(); };
  const sortByName = () => { setEntries((p) => [...p].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }))); stale(); };

  useEffect(() => () => { token.current++; }, []);

  const create = async () => {
    const mine = ++token.current;
    setError(""); setResult(null); setBusy(true); setProgress({ done: 0, total: entries.length });
    try {
      const m = Number(margin);
      if (!(m >= 0 && m <= 100)) throw new FileProblem("The margin must be between 0 and 100 mm.");
      const out = await imagesToPdf(entries, { pageSize, orientation, marginMm: m, scale, reduce }, (done, total) => { if (token.current === mine) setProgress({ done, total }); });
      if (token.current !== mine) return;
      setResult({ bytes: out.bytes, blob: new Blob([out.bytes as BlobPart], { type: "application/pdf" }), pages: out.pages, notes: out.notes });
    } catch (e) {
      if (token.current !== mine) return;
      setError(e instanceof FileProblem ? e.message : "The PDF couldn't be created. A picture may be damaged or too large for this device.");
      if (!(e instanceof FileProblem)) console.error(e);
    } finally { if (token.current === mine) setBusy(false); }
  };

  const totalSize = entries.reduce((s, e) => s + e.file.size, 0);
  return (
    <div className="card file-tool">
      <Dropzone accept={IMAGE_ACCEPT} onFiles={add} compact={entries.length > 0} title="Choose pictures or drop them here" hint="JPG, PNG, WebP, GIF, BMP, AVIF · up to 100 pictures · paste with Ctrl+V" />
      {messages.length > 0 && <Notice kind="warn" role="alert"><ul className="plain-list">{messages.map((m) => <li key={m}>{m}</li>)}</ul></Notice>}

      {entries.length > 0 && (
        <>
          <div className="file-tool__bar">
            <p className="file-tool__summary">{entries.length} picture{entries.length === 1 ? "" : "s"} · {formatBytes(totalSize)} · each becomes one page, in this order</p>
            <div className="file-tool__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={sortByName}>Sort by name</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setEntries([]); stale(); setMessages([]); }}><Icon name="trash" /> Clear all</button>
            </div>
          </div>
          <ol className="file-list">
            {entries.map((e, i) => (
              <li key={e.id} className="file-row">
                <div className="file-row__main">
                  <Thumb file={e.file} rotation={e.rotation} />
                  <div className="file-row__meta">
                    <p className="file-row__name" title={e.file.name}><span className="page-no">{i + 1}.</span> {e.file.name}</p>
                    <p className="file-row__line">{formatBytes(e.file.size)}{e.rotation ? ` · rotated ${e.rotation}°` : ""}</p>
                  </div>
                  <div className="file-row__actions">
                    <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.file.name} up`}><Icon name="arrow-up" /></button>
                    <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${e.file.name} down`}><Icon name="arrow-down" /></button>
                    <button type="button" className="icon-btn" onClick={() => rotate(i, -90)} aria-label={`Rotate ${e.file.name} left`}><Icon name="rotate-cw" style={{ transform: "scaleX(-1)" }} /></button>
                    <button type="button" className="icon-btn" onClick={() => rotate(i, 90)} aria-label={`Rotate ${e.file.name} right`}><Icon name="rotate-cw" /></button>
                    <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`Remove ${e.file.name}`}><Icon name="close" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="settings-grid">
            <SelectField id="jp-size" label="Page size" value={pageSize} onChange={(v) => { setPageSize(v); stale(); }} options={[...Object.entries(PAGE_SIZES).map(([k, v]) => ({ value: k as PageSizeKey, label: v.label })), { value: "fit" as PageSizeKey, label: "Same as each picture (no white space)" }]} />
            {pageSize !== "fit" && <SelectField id="jp-or" label="Orientation" value={orientation} onChange={(v) => { setOrientation(v); stale(); }} options={[{ value: "auto", label: "Automatic (follows each picture)" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />}
            <NumberField id="jp-m" label="Margin" value={margin} onChange={(v) => { setMargin(v); stale(); }} min={0} max={100} unit="mm" />
            <SelectField id="jp-sc" label="Picture size on the page" value={scale} onChange={(v) => { setScale(v); stale(); }} options={[{ value: "fit", label: "Fit the page (enlarge small pictures)" }, { value: "shrink", label: "Only shrink pictures that are too big" }]} />
            <div className="field">
              <label className="field__label" htmlFor="jp-name">PDF file name</label>
              <input id="jp-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <label className="check field--wide"><input type="checkbox" checked={reduce} onChange={(e) => { setReduce(e.target.checked); stale(); }} /> Make the PDF smaller (re-compress pictures to at most 1800 px and 80% quality)</label>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={create} disabled={busy}>{busy ? "Creating…" : result ? "Create again" : `Create PDF (${entries.length} page${entries.length === 1 ? "" : "s"})`}</button>
          </div>
          {busy && <Progress done={progress.done} total={progress.total} label="Building the PDF" />}
          {error && <Notice kind="error">{error}</Notice>}
          {result && (
            <div className="photo-result" role="status">
              <Notice kind="success">PDF ready: {result.pages} page{result.pages === 1 ? "" : "s"}, {formatBytes(result.blob.size)}.</Notice>
              {result.notes.map((n) => <Notice key={n} kind="info">{n}</Notice>)}
              <div className="btn-row" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn--primary" onClick={() => { downloadBlob(result.blob, `${baseName(name) || "images"}.pdf`); trackEvent("file_tool_download", { toolId: "jpg-to-pdf", mode: "single" }); }}><Icon name="download" /> Download PDF</button>
              </div>
              <PdfPreview bytes={result.bytes} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
