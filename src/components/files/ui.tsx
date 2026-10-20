"use client";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "../Icon";

export function Notice({ kind = "info", children, role }: { kind?: "info" | "warn" | "error" | "success"; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div className={`notice notice--${kind}`} role={role ?? (kind === "error" ? "alert" : undefined)}>
      <Icon name={kind === "error" || kind === "warn" ? "alert" : kind === "success" ? "check" : "info"} />
      <div>{children}</div>
    </div>
  );
}

/**
 * File picker + drag-and-drop target. The real <input type="file"> sits inside the label, so keyboard users can focus it
 * and press Enter/Space, and screen readers announce it normally.
 */
export function Dropzone({ accept, multiple = true, onFiles, title, hint, compact }: {
  accept: string; multiple?: boolean; onFiles: (files: File[]) => void; title: string; hint?: string; compact?: boolean;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <label
      htmlFor={id}
      className={`dropzone${over ? " dropzone--active" : ""}${compact ? " dropzone--compact" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const files = [...e.dataTransfer.files]; if (files.length) onFiles(multiple ? files : files.slice(0, 1)); }}
    >
      <input
        ref={input} id={id} type="file" className="dropzone__input" accept={accept} multiple={multiple}
        onChange={(e) => { const files = [...(e.target.files ?? [])]; if (files.length) onFiles(files); e.target.value = ""; }}
      />
      <span className="dropzone__icon" aria-hidden="true"><Icon name="upload" /></span>
      <span className="dropzone__title">{title}</span>
      {hint && <span className="dropzone__hint">{hint}</span>}
    </label>
  );
}

/**
 * An <img> whose source is a Blob or File. The object URL is created when the Blob changes and released when it changes
 * again or the image goes away; it is assigned straight to the element, so no component state is involved.
 */
export function BlobImage({ blob, alt, className, style, width, height }: { blob: Blob | null | undefined; alt: string; className?: string; style?: CSSProperties; width?: number; height?: number }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !blob) return;
    const url = URL.createObjectURL(blob);
    el.src = url;
    return () => { URL.revokeObjectURL(url); el.removeAttribute("src"); };
  }, [blob]);
  // eslint-disable-next-line @next/next/no-img-element -- the source is a local Blob URL, which next/image cannot optimise
  return <img ref={ref} alt={alt} className={className} style={style} width={width} height={height} />;
}

/** Pastes images from the clipboard (Ctrl/Cmd+V) into the tool. Ignores pastes into text fields. */
export function usePasteFiles(onFiles: (files: File[]) => void, enabled = true) {
  const cb = useRef(onFiles);
  useEffect(() => { cb.current = onFiles; });
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); cb.current(files); }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [enabled]);
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RangeField({ id, label, value, min, max, step = 1, onChange, suffix, hint }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}<span className="range-value">{value}{suffix}</span></label>
      <input id={id} type="range" className="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function SelectField<T extends string>({ id, label, value, options, onChange, hint, wide }: {
  id: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: string; wide?: boolean;
}) {
  return (
    <div className={`field${wide ? " field--wide" : ""}`}>
      <label className="field__label" htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function NumberField({ id, label, value, onChange, min, max, step, unit, hint, optional, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number | "any"; unit?: string; hint?: string; optional?: boolean; placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}{optional && <span className="field__optional">optional</span>}</label>
      <div className="control-wrap">
        <input id={id} className={`input input--num${unit ? " input--has-unit" : ""}`} type="number" inputMode="decimal" min={min} max={max} step={step ?? "any"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {unit && <span className="control-unit" aria-hidden="true">{unit}</span>}
      </div>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
