"use client";
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { Dropzone, Notice, NumberField, Progress, SelectField } from "./ui";
import { PdfPreview } from "./PdfPreview";
import { FileProblem } from "@/lib/files/image";
import { PASSWORD_HELP, PasswordNeeded, WRONG_PASSWORD_HELP, WrongPassword, chunkPages, extractPages, openPdf, parseRanges } from "@/lib/files/pdf";
import { baseName, formatBytes, nextFrame, uniqueName } from "@/lib/files/format";
import { downloadBlob } from "@/lib/files/download";
import { makeZip } from "@/lib/files/zip";
import { trackEvent } from "@/lib/analytics";

type Mode = "extract" | "ranges" | "each" | "every" | "remove";
type Out = { name: string; bytes: Uint8Array; pages: number };
const MAX_BYTES = 200 * 1024 * 1024;

export default function PdfSplit() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState(0);
  const [password, setPassword] = useState("");
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<Mode>("extract");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState("2");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outs, setOuts] = useState<Out[] | null>(null);
  const token = useRef(0);

  const load = async (f: File, pw?: string) => {
    setError(""); setOuts(null);
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) { setError(`“${f.name}” isn't a PDF.`); return; }
    if (f.size === 0) { setError(`“${f.name}” is empty.`); return; }
    if (f.size > MAX_BYTES) { setError(`“${f.name}” is ${formatBytes(f.size)}. Files above ${formatBytes(MAX_BYTES)} are too large for browser memory.`); return; }
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      const head = new TextDecoder("latin1").decode(b.subarray(0, 1024));
      if (!head.includes("%PDF-")) throw new FileProblem(`“${f.name}” isn't a PDF file.`);
      const doc = await openPdf(b, pw);
      setFile(f); setBytes(b); setPages(doc.getPageCount()); setLocked(false);
      trackEvent("file_tool_files_added", { toolId: "split-pdf", resultCount: 1 });
    } catch (e) {
      if (e instanceof PasswordNeeded || e instanceof WrongPassword) { setFile(f); setBytes(null); setLocked(true); setError(e instanceof WrongPassword ? WRONG_PASSWORD_HELP : PASSWORD_HELP); }
      else setError(e instanceof FileProblem ? e.message : "This file couldn't be read as a PDF.");
    }
  };

  const groupsFor = (): { pages: number[]; label: string }[] => {
    if (mode === "each") return Array.from({ length: pages }, (_, i) => ({ pages: [i], label: `page-${i + 1}` }));
    if (mode === "every") {
      const n = Math.floor(Number(every));
      if (!(n >= 1)) throw new FileProblem("Enter how many pages each part should have (1 or more).");
      return chunkPages(pages, n).map((g, i) => ({ pages: g, label: `part-${i + 1}-pages-${g[0] + 1}${g.length > 1 ? `-${g[g.length - 1] + 1}` : ""}` }));
    }
    const parsed = parseRanges(ranges, pages);
    if (mode === "extract") {
      const all = parsed.flat();
      return [{ pages: all, label: `pages-${ranges.replace(/\s+/g, "").replace(/[^0-9,\-–]/g, "").replace(/,/g, "_").slice(0, 40) || "selected"}` }];
    }
    if (mode === "ranges") return parsed.map((g, i) => ({ pages: g, label: `part-${i + 1}-pages-${g[0] + 1}${g.length > 1 ? `-${g[g.length - 1] + 1}` : ""}` }));
    const drop = new Set(parsed.flat());
    const keep = Array.from({ length: pages }, (_, i) => i).filter((i) => !drop.has(i));
    if (!keep.length) throw new FileProblem("That would remove every page. Leave at least one page.");
    return [{ pages: keep, label: "without-selected-pages" }];
  };

  const run = async () => {
    if (!bytes || !file) return;
    const mine = ++token.current;
    setError(""); setOuts(null); setBusy(true);
    try {
      const groups = groupsFor();
      if (groups.length > 300) throw new FileProblem(`That would create ${groups.length} files. Choose larger parts (the limit is 300 files at once).`);
      const doc = await openPdf(bytes, password);
      const stem = baseName(file.name);
      const used = new Set<string>();
      const made: Out[] = [];
      setProgress({ done: 0, total: groups.length });
      for (let i = 0; i < groups.length; i++) {
        if (token.current !== mine) return;
        const data = await extractPages(doc, groups[i].pages);
        made.push({ name: uniqueName(`${stem}-${groups[i].label}.pdf`, used), bytes: data, pages: groups[i].pages.length });
        setProgress({ done: i + 1, total: groups.length });
        await nextFrame();
      }
      setOuts(made);
    } catch (e) {
      setError(e instanceof FileProblem ? e.message : "The PDF couldn't be split. It may be damaged or use features this tool can't copy.");
      if (!(e instanceof FileProblem)) console.error(e);
    } finally { if (token.current === mine) setBusy(false); }
  };

  const save = (o: Out) => { downloadBlob(new Blob([o.bytes as BlobPart], { type: "application/pdf" }), o.name); trackEvent("file_tool_download", { toolId: "split-pdf", mode: "single" }); };
  const saveZip = () => {
    if (!outs) return;
    downloadBlob(makeZip(outs.map((o) => ({ name: o.name, data: o.bytes }))), `${baseName(file?.name ?? "split")}-split.zip`);
    trackEvent("file_tool_download", { toolId: "split-pdf", mode: "zip" });
  };
  const needsRanges = mode === "extract" || mode === "ranges" || mode === "remove";
  const rangeLabel = mode === "remove" ? "Pages to remove" : mode === "ranges" ? "Pages for each file" : "Pages to extract";

  return (
    <div className="card file-tool">
      <Dropzone accept="application/pdf,.pdf" multiple={false} onFiles={(f) => { void load(f[0]); }} compact={!!file} title={file ? "Choose a different PDF" : "Choose a PDF or drop it here"} hint="One PDF at a time · processed in your browser" />
      {error && <Notice kind={locked ? "warn" : "error"} role="alert">{error}</Notice>}
      {locked && file && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void load(file, password); }}>
          <label className="sr-only" htmlFor="sp-pw">PDF password</label>
          <input id="sp-pw" type="password" className="input" autoComplete="off" placeholder="PDF password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn btn--secondary btn--sm">Unlock</button>
        </form>
      )}
      {file && bytes && (
        <>
          <p className="file-tool__summary"><strong>{file.name}</strong> · {pages} page{pages === 1 ? "" : "s"} · {formatBytes(file.size)}</p>
          <div className="settings-grid">
            <SelectField id="sp-mode" label="What do you want to do?" wide value={mode} onChange={(v) => { setMode(v); setOuts(null); }} options={[
              { value: "extract", label: "Extract pages into one new PDF" },
              { value: "ranges", label: "Split into separate files by page ranges" },
              { value: "each", label: "Save every page as its own PDF" },
              { value: "every", label: "Split into parts of N pages each" },
              { value: "remove", label: "Remove pages and keep the rest" },
            ]} />
            {needsRanges && (
              <div className="field field--wide">
                <label className="field__label" htmlFor="sp-ranges">{rangeLabel}</label>
                <input id="sp-ranges" className="input input--mono" value={ranges} onChange={(e) => { setRanges(e.target.value); setOuts(null); }} placeholder={`e.g. 1-3, 5, 8-${Math.max(8, Math.min(pages, 12))}`} spellCheck={false} autoComplete="off" />
                <span className="field__hint">Separate pages or ranges with commas. “8-” means page 8 to the end. This PDF has {pages} page{pages === 1 ? "" : "s"}.</span>
              </div>
            )}
            {mode === "every" && <NumberField id="sp-n" label="Pages per part" value={every} onChange={(v) => { setEvery(v); setOuts(null); }} min={1} max={pages} step={1} />}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={run} disabled={busy}>{busy ? "Working…" : mode === "extract" ? "Extract pages" : mode === "remove" ? "Remove pages" : "Split PDF"}</button>
          </div>
          {busy && <Progress done={progress.done} total={progress.total} label="Splitting" />}
          {outs && (
            <div className="photo-result" role="status">
              <Notice kind="success">{outs.length === 1 ? "Done: 1 file ready." : `Done: ${outs.length} files ready.`}</Notice>
              {outs.length > 1 && <div className="btn-row" style={{ marginTop: 0 }}><button type="button" className="btn btn--primary" onClick={saveZip}><Icon name="download" /> Download all ({outs.length}) as ZIP</button></div>}
              <ul className="file-list">
                {outs.slice(0, 60).map((o) => (
                  <li key={o.name} className="file-row"><div className="file-row__main">
                    <span className="file-row__thumb file-row__thumb--empty" aria-hidden="true"><Icon name="file" /></span>
                    <div className="file-row__meta"><p className="file-row__name" title={o.name}>{o.name}</p><p className="file-row__line">{o.pages} page{o.pages === 1 ? "" : "s"} · {formatBytes(o.bytes.length)}</p></div>
                    <div className="file-row__actions"><button type="button" className="btn btn--primary btn--sm" onClick={() => save(o)}><Icon name="download" /> Download</button></div>
                  </div></li>
                ))}
              </ul>
              {outs.length > 60 && <p className="file-row__line">Showing the first 60 files. The ZIP contains all {outs.length}.</p>}
              {outs.length === 1 && <PdfPreview bytes={outs[0].bytes} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
