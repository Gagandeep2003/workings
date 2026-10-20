"use client";
import { useEffect, useState } from "react";
import { renderThumbnails } from "@/lib/files/pdf";

type View = { bytes: Uint8Array; urls: string[]; total: number; failed: boolean };

/** Shows the first few pages of a generated PDF, drawn by pdf.js in the browser. */
export function PdfPreview({ bytes, label = "Preview" }: { bytes: Uint8Array; label?: string }) {
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    renderThumbnails(bytes).then(({ blobs, total }) => {
      if (cancelled) return;
      blobs.forEach((b) => made.push(URL.createObjectURL(b)));
      setView({ bytes, urls: [...made], total, failed: false });
    }).catch(() => { if (!cancelled) setView({ bytes, urls: [], total: 0, failed: true }); });
    return () => { cancelled = true; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [bytes]);
  const cur = view && view.bytes === bytes ? view : null; // ignore a preview that belongs to an earlier PDF
  if (cur?.failed) return <p className="file-row__line">A preview couldn’t be drawn in this browser, but the PDF itself was created. Download it to check.</p>;
  if (!cur || !cur.urls.length) return <p className="file-row__line" aria-live="polite">Drawing preview…</p>;
  return (
    <div>
      <h3 className="photo-grid__h">{label}{cur.total > cur.urls.length ? ` (first ${cur.urls.length} of ${cur.total} pages)` : ""}</h3>
      <ul className="thumb-strip">
        {/* eslint-disable-next-line @next/next/no-img-element -- local Blob URL */}
        {cur.urls.map((u, i) => <li key={u}><img src={u} alt={`Page ${i + 1} of the result`} /><span>Page {i + 1}</span></li>)}
      </ul>
    </div>
  );
}
