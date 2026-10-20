"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Dropzone, Notice, Progress } from "./ui";
import { PdfPreview } from "./PdfPreview";
import { FileProblem } from "@/lib/files/image";
import { PASSWORD_HELP, PasswordNeeded, WRONG_PASSWORD_HELP, WrongPassword, inspectPdf, mergePdfs } from "@/lib/files/pdf";
import { baseName, formatBytes } from "@/lib/files/format";
import { downloadBlob } from "@/lib/files/download";
import { trackEvent } from "@/lib/analytics";

type Entry = { id: number; name: string; size: number; bytes?: Uint8Array; pages?: number; password: string; status: "reading" | "ready" | "locked" | "error"; error?: string };
let ids = 1;
const MAX_FILES = 30;
const MAX_TOTAL = 300 * 1024 * 1024;

export default function PdfMerge() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [name, setName] = useState("merged");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ bytes: Uint8Array; blob: Blob; pages: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const ref = useRef<Entry[]>([]);
  useEffect(() => { ref.current = entries; });
  const files = useRef(new Map<number, File>());
  const update = (id: number, p: Partial<Entry>) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const read = useCallback(async (id: number, password?: string) => {
    const f = files.current.get(id);
    if (!f) return;
    try {
      const info = await inspectPdf(f, password);
      update(id, { status: "ready", pages: info.pages, bytes: info.bytes, error: undefined, password: password ?? "" });
    } catch (e) {
      if (e instanceof PasswordNeeded) update(id, { status: "locked", error: PASSWORD_HELP });
      else if (e instanceof WrongPassword) update(id, { status: "locked", error: WRONG_PASSWORD_HELP });
      else update(id, { status: "error", error: e instanceof FileProblem ? e.message : "This file couldn't be read as a PDF." });
    }
  }, []);

  const add = useCallback((list: File[]) => {
    const problems: string[] = [];
    const accepted: Entry[] = [];
    let total = ref.current.reduce((s, e) => s + e.size, 0);
    for (const f of list) {
      if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) { problems.push(`“${f.name}” isn't a PDF, so it was skipped.`); continue; }
      if (f.size === 0) { problems.push(`“${f.name}” is empty.`); continue; }
      if (ref.current.length + accepted.length >= MAX_FILES) { problems.push(`Up to ${MAX_FILES} PDFs can be merged at once; “${f.name}” was not added.`); continue; }
      if (total + f.size > MAX_TOTAL) { problems.push(`Adding “${f.name}” would pass ${formatBytes(MAX_TOTAL)} in total, which is too much for browser memory.`); continue; }
      total += f.size;
      const id = ids++;
      files.current.set(id, f);
      accepted.push({ id, name: f.name, size: f.size, password: "", status: "reading" });
    }
    setMessages(problems);
    if (!accepted.length) return;
    setEntries((p) => [...p, ...accepted]);
    setResult(null);
    trackEvent("file_tool_files_added", { toolId: "merge-pdf", resultCount: accepted.length });
    accepted.forEach((e) => { void read(e.id); });
  }, [read]);

  useEffect(() => () => { files.current.clear(); }, []);

  const move = (i: number, d: -1 | 1) => { setEntries((p) => { const j = i + d; if (j < 0 || j >= p.length) return p; const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; }); setResult(null); };
  const remove = (id: number) => { files.current.delete(id); setEntries((p) => p.filter((e) => e.id !== id)); setResult(null); };
  const ready = entries.filter((e) => e.status === "ready");
  const totalPages = ready.reduce((s, e) => s + (e.pages ?? 0), 0);

  const merge = async () => {
    setBusy(true); setError(""); setResult(null); setProgress(0);
    try {
      const parts = ready.map((e) => ({ bytes: e.bytes!, password: e.password }));
      const out = await mergePdfs(parts);
      setProgress(100);
      setResult({ bytes: out.bytes, blob: new Blob([out.bytes as BlobPart], { type: "application/pdf" }), pages: out.pages });
    } catch (e) {
      setError(e instanceof FileProblem ? e.message : "The PDFs couldn't be merged. One of them may be damaged or use features this tool can't copy.");
      if (!(e instanceof FileProblem)) console.error(e);
    } finally { setBusy(false); }
  };

  return (
    <div className="card file-tool">
      <Dropzone accept="application/pdf,.pdf" onFiles={add} compact={entries.length > 0} title="Choose PDF files or drop them here" hint="Up to 30 PDFs · the order below is the order in the merged file" />
      {messages.length > 0 && <Notice kind="warn" role="alert"><ul className="plain-list">{messages.map((m) => <li key={m}>{m}</li>)}</ul></Notice>}
      {entries.length > 0 && (
        <>
          <div className="file-tool__bar">
            <p className="file-tool__summary">{ready.length} of {entries.length} file{entries.length === 1 ? "" : "s"} ready · {totalPages} page{totalPages === 1 ? "" : "s"} in total</p>
            <div className="file-tool__actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setEntries((p) => [...p].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))); setResult(null); }}>Sort by name</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => { files.current.clear(); setEntries([]); setResult(null); setMessages([]); }}><Icon name="trash" /> Clear all</button>
            </div>
          </div>
          <ol className="file-list">
            {entries.map((e, i) => (
              <li key={e.id} className={`file-row file-row--${e.status === "error" ? "error" : e.status}`}>
                <div className="file-row__main">
                  <span className="file-row__thumb file-row__thumb--empty" aria-hidden="true"><Icon name="file" /></span>
                  <div className="file-row__meta">
                    <p className="file-row__name" title={e.name}><span className="page-no">{i + 1}.</span> {e.name}</p>
                    <p className="file-row__line">{formatBytes(e.size)}{e.pages ? ` · ${e.pages} page${e.pages === 1 ? "" : "s"}` : ""}{e.status === "reading" ? " · reading…" : ""}</p>
                    {e.error && <p className="file-row__line file-row__line--error" role="alert">{e.error}</p>}
                    {e.status === "locked" && (
                      <form className="inline-form" onSubmit={(ev) => { ev.preventDefault(); const pw = (new FormData(ev.currentTarget).get("pw") as string) ?? ""; update(e.id, { status: "reading", error: undefined }); void read(e.id, pw); }}>
                        <label className="sr-only" htmlFor={`pw-${e.id}`}>Password for {e.name}</label>
                        <input id={`pw-${e.id}`} name="pw" type="password" className="input" autoComplete="off" placeholder="PDF password" />
                        <button type="submit" className="btn btn--secondary btn--sm">Unlock</button>
                      </form>
                    )}
                  </div>
                  <div className="file-row__actions">
                    <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.name} up`}><Icon name="arrow-up" /></button>
                    <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${e.name} down`}><Icon name="arrow-down" /></button>
                    <button type="button" className="icon-btn" onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`}><Icon name="close" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {ready.length === 1 && <Notice kind="info">Add at least one more PDF to merge. To pick pages out of a single PDF, use the PDF splitter instead.</Notice>}
          <div className="settings-grid">
            <div className="field">
              <label className="field__label" htmlFor="pm-name">Merged file name</label>
              <input id="pm-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={merge} disabled={busy || ready.length < 2}>{busy ? "Merging…" : `Merge ${ready.length} PDFs`}</button>
          </div>
          {busy && <Progress done={progress} total={100} label="Merging" />}
          {error && <Notice kind="error">{error}</Notice>}
          {result && (
            <div className="photo-result" role="status">
              <Notice kind="success">Merged: {result.pages} page{result.pages === 1 ? "" : "s"}, {formatBytes(result.blob.size)}.</Notice>
              <div className="btn-row" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn--primary" onClick={() => { downloadBlob(result.blob, `${baseName(name) || "merged"}.pdf`); trackEvent("file_tool_download", { toolId: "merge-pdf", mode: "single" }); }}><Icon name="download" /> Download merged PDF</button>
              </div>
              <PdfPreview bytes={result.bytes} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
