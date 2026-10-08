"use client";
import { useRef } from "react";
import { Icon } from "../Icon";
import { CopyButton } from "./CopyButton";
import { formatValue, type Value } from "@/lib/format";
import type { ResultTable, TableCell, ToolOutput } from "@/tools/types";

const isNumeric = (c: TableCell) => typeof c === "number" || (typeof c === "object" && ["number", "money", "percent"].includes(c.kind));
const cellText = (c: TableCell): string => (typeof c === "object" ? formatValue(c as Value) : String(c));

function DataTable({ table }: { table: ResultTable }) {
  const label = table.caption ?? "Results table";
  return (
    <div className={`table-wrap ${table.maxHeight ? "is-tall" : ""}`} role="region" aria-label={label} tabIndex={0}>
      <table className="data-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>{table.columns.map((c, i) => <th key={c + i} scope="col" className={table.rows.some((r) => isNumeric(r[i])) ? "num" : undefined}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (i === 0 ? <th key={i} scope="row" style={{ fontWeight: 600 }}>{cellText(cell)}</th> : <td key={i} className={isNumeric(cell) ? "num" : "wrap"}>{cellText(cell)}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function qrSvgString(matrix: boolean[][], margin = 4): string {
  const n = matrix.length;
  const size = n + margin * 2;
  let d = "";
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + margin} ${y + margin}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function QrView({ matrix }: { matrix: boolean[][] }) {
  const margin = 4;
  const size = matrix.length + margin * 2;
  let d = "";
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + margin} ${y + margin}h1v1h-1z`; }));
  return (
    <div className="qr">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR code" shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => download(new Blob([qrSvgString(matrix)], { type: "image/svg+xml" }), "qr-code.svg")}><Icon name="download" /> SVG</button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => {
            const scale = Math.max(4, Math.floor(1024 / size));
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = size * scale;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#000";
            matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale); }));
            canvas.toBlob((b) => b && download(b, "qr-code.png"));
          }}
        ><Icon name="download" /> PNG</button>
      </div>
    </div>
  );
}

function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.slice(0, 1000).forEach(([s, e], i) => {
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(<mark key={i}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  parts.push(text.slice(pos));
  return <pre className="hl" aria-label="Text with matches highlighted">{parts}</pre>;
}

type Props = {
  output: ToolOutput;
  copyText: string;
  stale: boolean;
  shareable: boolean;
  onShare?: () => void;
  onCopied?: () => void;
  shareNote?: string;
  headingId: string;
};

export function ResultView({ output, copyText, stale, shareable, onShare, onCopied, shareNote, headingId }: Props) {
  const primary = formatValue(output.primary.value);
  const kind = output.primary.value.kind;
  const asText = kind === "text" || kind === "duration" || kind === "date" || primary.length > 16;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="result" ref={ref} style={stale ? { opacity: 0.6 } : undefined} aria-labelledby={headingId} role="group">
      <div className="result__main">
        <h3 className="result__label" id={headingId} style={{ fontSize: "var(--fs-sm)" }}>{output.primary.label}</h3>
        <p className={`result__value ${asText ? "result__value--text" : ""}`}>{primary}</p>
        {stale && <p className="form-note" style={{ marginTop: "var(--s-2)" }}><strong>Inputs changed.</strong> Press the button to update this result.</p>}
      </div>
      {output.swatch && (
        <div className="result__section"><div className="swatch" role="img" aria-label={`Colour swatch ${output.swatch}`}><span style={{ background: output.swatch }} /></div></div>
      )}
      {output.qr && <div className="result__section"><QrView matrix={output.qr.matrix} /></div>}
      {output.secondary && output.secondary.length > 0 && (
        <dl className="result__list">
          {output.secondary.map((s) => (
            <div className="result__row" key={s.label}>
              <dt>{s.label}</dt>
              <dd>{formatValue(s.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {output.highlight && <div className="result__section"><h3>Matches in your text</h3><Highlighted text={output.highlight.text} ranges={output.highlight.ranges} /></div>}
      {output.texts?.map((t) => (
        <div className="result__section" key={t.label}>
          <div className="textblock">
            <div className="textblock__bar"><span>{t.label}</span>{t.copyable !== false && <CopyButton getText={() => t.value} label="Copy" size="sm" variant="ghost" />}</div>
            <pre tabIndex={0} aria-label={t.label}>{t.value}</pre>
          </div>
        </div>
      ))}
      {output.table && <div className="result__section"><h3>{output.table.caption ?? "Details"}</h3><DataTable table={output.table} /></div>}
      {output.steps && output.steps.length > 0 && (
        <div className="result__section">
          <details className="result__details" open>
            <summary>How this was calculated</summary>
            <ol className="steps" style={{ marginTop: "var(--s-3)" }}>{output.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>
        </div>
      )}
      {output.notes && output.notes.length > 0 && (
        <div className="result__section">
          {output.notes.map((n, i) => (
            <p className="callout" key={i}><Icon name="info" /><span>{n}</span></p>
          ))}
        </div>
      )}
      <div className="result__actions no-print">
        <CopyButton getText={() => copyText} label="Copy result" doneLabel="Result copied" onCopied={onCopied} />
        {shareable && onShare && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={onShare}><Icon name="share" /> Share link</button>
        )}
        {shareNote && <p className="form-note" style={{ flexBasis: "100%", margin: 0 }} role="status">{shareNote}</p>}
      </div>
    </div>
  );
}
