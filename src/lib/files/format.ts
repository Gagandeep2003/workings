/** Sizes follow what operating systems and upload portals show: 1 KB = 1024 bytes. */
export const KB = 1024;
export const MB = 1024 * 1024;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < KB) return `${Math.round(n)} B`;
  if (n < MB) return `${(n / KB).toFixed(n < 10 * KB ? 2 : 1)} KB`;
  return `${(n / MB).toFixed(2)} MB`;
}

/** Positive `percent` means the output is smaller than the original; negative means it grew. */
export function reduction(original: number, output: number): { bytes: number; percent: number } {
  const bytes = original - output;
  return { bytes, percent: original > 0 ? (bytes / original) * 100 : 0 };
}

export function describeChange(original: number, output: number): string {
  const r = reduction(original, output);
  if (Math.abs(r.percent) < 0.05) return "same size";
  return r.bytes > 0 ? `${r.percent.toFixed(1)}% smaller (−${formatBytes(r.bytes)})` : `${Math.abs(r.percent).toFixed(1)}% larger (+${formatBytes(-r.bytes)})`;
}

export function baseName(filename: string): string {
  const clean = filename.replace(/^.*[\\/]/, "");
  const dot = clean.lastIndexOf(".");
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  return stem.replace(/[^\p{L}\p{N}._ -]+/gu, "_").trim().slice(0, 80) || "file";
}

export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "image/svg+xml": "svg", "application/zip": "zip" };

/** "photo.jpg", "photo.jpg" → "photo.jpg", "photo-2.jpg" so that a ZIP never holds two entries with the same name. */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name.toLowerCase())) { used.add(name.toLowerCase()); return name; }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!used.has(candidate.toLowerCase())) { used.add(candidate.toLowerCase()); return candidate; }
  }
}

/** Lets the browser paint (progress text, spinners) between heavy steps. */
export const nextFrame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
