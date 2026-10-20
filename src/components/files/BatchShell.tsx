"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../Icon";
import { BlobImage, Dropzone, Notice, Progress, usePasteFiles } from "./ui";
import { IMAGE_ACCEPT, FileProblem, looksLikeImage } from "@/lib/files/image";
import { describeChange, formatBytes, nextFrame, uniqueName } from "@/lib/files/format";
import { downloadBlob } from "@/lib/files/download";
import { makeZip } from "@/lib/files/zip";
import { trackEvent } from "@/lib/analytics";

export type ProcessResult = {
  blob: Blob;
  filename: string;
  width?: number;
  height?: number;
  /** Short facts about this file ("Resized to 1600 × 1200"). */
  notes?: string[];
  /** Warnings about this file ("Transparency was replaced by white"). */
  warnings?: string[];
  /** The original was returned unchanged (it was already as small as it could get). */
  kept?: boolean;
};

type Item = {
  id: number;
  file: File;
  status: "queued" | "working" | "done" | "error";
  result?: ProcessResult & { url: string };
  error?: string;
};

const MAX_FILES = 50;
const MAX_FILE_BYTES = 60 * 1024 * 1024;
let nextId = 1;

/**
 * The common flow of the image tools: choose or drop pictures → every file is processed in the browser, one at a time →
 * each result has its own size comparison, preview and download, and several results can be saved as one ZIP.
 * Changing a setting re-processes everything after a short pause.
 */
export function BatchShell<S>({ toolId, settings, settingsPanel, process, dropTitle, dropHint, verb, zipName, showSavings = true }: {
  toolId: string;
  settings: S;
  settingsPanel: ReactNode;
  process: (file: File, settings: S) => Promise<ProcessResult>;
  dropTitle: string;
  dropHint: string;
  /** Past tense used in the summary, e.g. "Compressed". */
  verb: string;
  zipName: string;
  showSavings?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [announce, setAnnounce] = useState("");
  const run = useRef(0);
  const urls = useRef(new Set<string>());
  const settingsRef = useRef(settings);
  const processRef = useRef(process);
  const itemsRef = useRef<Item[]>([]);
  // keep the latest values readable from async callbacks (runs after every render, before the effects below)
  useEffect(() => { settingsRef.current = settings; processRef.current = process; itemsRef.current = items; });

  useEffect(() => () => { run.current++; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const patch = useCallback((id: number, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))), []);

  const processList = useCallback(async (list: Item[]) => {
    const mine = ++run.current;
    if (!list.length) { setBusy(false); return; }
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let done = 0;
    for (const item of list) {
      if (run.current !== mine) return;
      patch(item.id, { status: "working", error: undefined });
      await nextFrame();
      try {
        const res = await processRef.current(item.file, settingsRef.current);
        if (run.current !== mine) return;
        const url = URL.createObjectURL(res.blob);
        urls.current.add(url);
        const old = itemsRef.current.find((i) => i.id === item.id)?.result?.url;
        if (old) { URL.revokeObjectURL(old); urls.current.delete(old); }
        patch(item.id, { status: "done", result: { ...res, url } });
      } catch (e) {
        if (run.current !== mine) return;
        patch(item.id, { status: "error", error: e instanceof FileProblem ? e.message : "This file couldn't be processed. It may be damaged or too large for this device." });
        if (!(e instanceof FileProblem)) console.error(e);
      }
      done++;
      setProgress({ done, total: list.length });
    }
    if (run.current === mine) {
      setBusy(false);
      setAnnounce(`${verb} ${list.length} file${list.length === 1 ? "" : "s"}.`);
    }
  }, [patch, verb]);

  const addFiles = useCallback((incoming: File[]) => {
    const problems: string[] = [];
    const room = MAX_FILES - itemsRef.current.length;
    const accepted: Item[] = [];
    for (const f of incoming) {
      if (!looksLikeImage(f)) { problems.push(`“${f.name}” isn't an image, so it was skipped.`); continue; }
      if (f.size === 0) { problems.push(`“${f.name}” is empty.`); continue; }
      if (f.size > MAX_FILE_BYTES) { problems.push(`“${f.name}” is ${formatBytes(f.size)}. Files above ${formatBytes(MAX_FILE_BYTES)} are skipped to protect your device's memory.`); continue; }
      if (accepted.length >= room) { problems.push(`Only ${MAX_FILES} files can be processed at once; “${f.name}” was not added.`); continue; }
      accepted.push({ id: nextId++, file: f, status: "queued" });
    }
    setMessages(problems);
    if (!accepted.length) return;
    trackEvent("file_tool_files_added", { toolId, resultCount: accepted.length });
    setItems((prev) => [...prev, ...accepted]);
    // process only the new files; existing ones are already done with the current settings
    void processList(accepted);
  }, [processList, toolId]);

  usePasteFiles(addFiles);

  // re-process everything when a setting changes
  const key = JSON.stringify(settings);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!itemsRef.current.length) return;
    const t = window.setTimeout(() => { void processList(itemsRef.current.map((i) => ({ ...i }))); }, 450);
    return () => window.clearTimeout(t);
  }, [key, processList]);

  const remove = (id: number) => {
    const victim = items.find((i) => i.id === id);
    if (victim?.result) { URL.revokeObjectURL(victim.result.url); urls.current.delete(victim.result.url); }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const clear = () => {
    run.current++;
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setItems([]); setMessages([]); setBusy(false);
  };

  const finished = items.filter((i) => i.status === "done" && i.result);
  const totals = finished.reduce((t, i) => ({ before: t.before + i.file.size, after: t.after + i.result!.blob.size }), { before: 0, after: 0 });

  const downloadOne = (i: Item) => {
    if (!i.result) return;
    downloadBlob(i.result.blob, i.result.filename);
    trackEvent("file_tool_download", { toolId, mode: "single" });
  };
  const downloadZip = async () => {
    const used = new Set<string>();
    const entries = await Promise.all(finished.map(async (i) => ({ name: uniqueName(i.result!.filename, used), data: new Uint8Array(await i.result!.blob.arrayBuffer()) })));
    downloadBlob(makeZip(entries), zipName);
    trackEvent("file_tool_download", { toolId, mode: "zip" });
  };

  return (
    <div className="card file-tool">
      <div className="file-tool__settings">{settingsPanel}</div>
      <Dropzone accept={IMAGE_ACCEPT} onFiles={addFiles} title={dropTitle} hint={dropHint} compact={items.length > 0} />
      {messages.length > 0 && <Notice kind="warn" role="alert"><ul className="plain-list">{messages.map((m) => <li key={m}>{m}</li>)}</ul></Notice>}

      {items.length > 0 && (
        <>
          <div className="file-tool__bar">
            <p className="file-tool__summary" aria-live="polite">
              {busy ? `Working… ${progress.done} of ${progress.total}` : finished.length ? (
                showSavings && finished.length > 0
                  ? <>{verb} {finished.length} file{finished.length === 1 ? "" : "s"}: <strong>{formatBytes(totals.before)} → {formatBytes(totals.after)}</strong> ({describeChange(totals.before, totals.after)})</>
                  : <>{verb} {finished.length} file{finished.length === 1 ? "" : "s"}.</>
              ) : "Nothing finished yet."}
            </p>
            <div className="file-tool__actions">
              {finished.length > 1 && <button type="button" className="btn btn--primary btn--sm" onClick={downloadZip} disabled={busy}><Icon name="download" /> Download all (ZIP)</button>}
              <button type="button" className="btn btn--secondary btn--sm" onClick={clear}><Icon name="trash" /> Clear all</button>
            </div>
          </div>
          {busy && <Progress done={progress.done} total={progress.total} label="Processing files" />}
          <ul className="file-list">
            {items.map((i) => <Row key={i.id} item={i} showSavings={showSavings} onRemove={() => remove(i.id)} onDownload={() => downloadOne(i)} />)}
          </ul>
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}

function Row({ item, showSavings, onRemove, onDownload }: { item: Item; showSavings: boolean; onRemove: () => void; onDownload: () => void }) {
  const [open, setOpen] = useState(false);
  const r = item.result;
  return (
    <li className={`file-row file-row--${item.status}`}>
      <div className="file-row__main">
        {r ? <BlobImage className="file-row__thumb" blob={r.blob} alt="" width={56} height={56} /> : <span className="file-row__thumb file-row__thumb--empty" aria-hidden="true"><Icon name="image-file" /></span>}
        <div className="file-row__meta">
          <p className="file-row__name" title={item.file.name}>{item.file.name}</p>
          {item.status === "working" && <p className="file-row__line">Working…</p>}
          {item.status === "queued" && <p className="file-row__line">Waiting…</p>}
          {item.status === "error" && <p className="file-row__line file-row__line--error" role="alert">{item.error}</p>}
          {r && (
            <p className="file-row__line">
              {showSavings
                ? <><span>{formatBytes(item.file.size)}</span> → <strong>{formatBytes(r.blob.size)}</strong> · {r.kept ? "original kept (already as small as it gets)" : describeChange(item.file.size, r.blob.size)}</>
                : <><span>{formatBytes(item.file.size)}</span> → <strong>{formatBytes(r.blob.size)}</strong></>}
              {r.width && r.height ? <> · {r.width} × {r.height} px</> : null}
            </p>
          )}
          {r?.notes?.map((n) => <p key={n} className="file-row__note">{n}</p>)}
          {r?.warnings?.map((n) => <p key={n} className="file-row__note file-row__note--warn"><Icon name="alert" /> {n}</p>)}
        </div>
        <div className="file-row__actions">
          {r && <button type="button" className="btn btn--primary btn--sm" onClick={onDownload}><Icon name="download" /> Download</button>}
          {r && <button type="button" className="btn btn--ghost btn--sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide preview" : "Before / after"}</button>}
          <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove ${item.file.name}`}><Icon name="close" /></button>
        </div>
      </div>
      {open && r && (
        <div className="compare">
          <figure><BlobImage blob={item.file} alt={`Original: ${item.file.name}`} /><figcaption>Before · {formatBytes(item.file.size)}</figcaption></figure>
          <figure><BlobImage blob={r.blob} alt={`Result: ${r.filename}`} /><figcaption>After · {formatBytes(r.blob.size)}</figcaption></figure>
        </div>
      )}
    </li>
  );
}
