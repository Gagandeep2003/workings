import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { fail, ok, str } from "../helpers";

type Op = { kind: "same" | "add" | "del"; text: string };
const MAX_LINES = 2500;

export function diffLines(a: string[], b: string[], norm: (s: string) => string): Op[] {
  const A = a.map(norm), B = b.map(norm);
  const n = A.length, m = B.length;
  // Longest-common-subsequence lengths, filled from the end so the walk below goes front to back.
  const w = m + 1;
  const L = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ kind: "same", text: b[j] }); i++; j++; }
    else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { ops.push({ kind: "del", text: a[i] }); i++; }
    else { ops.push({ kind: "add", text: b[j] }); j++; }
  }
  while (i < n) ops.push({ kind: "del", text: a[i++] });
  while (j < m) ops.push({ kind: "add", text: b[j++] });
  return ops;
}

const split = (s: string) => (s === "" ? [] : s.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n"));

export const engines: EngineMap = {
  "text-diff-checker": (v) => {
    const a = split(str(v, "original")), b = split(str(v, "changed"));
    if (a.length > MAX_LINES || b.length > MAX_LINES) return fail(`Each text can have at most ${MAX_LINES.toLocaleString("en-US")} lines for a side-by-side comparison. Compare smaller sections.`, "original");
    const ignoreCase = str(v, "ignore_case") === "yes", ignoreSpace = str(v, "ignore_space") === "yes";
    const norm = (s: string) => { let x = s; if (ignoreSpace) x = x.trim().replace(/\s+/g, " "); if (ignoreCase) x = x.toLowerCase(); return x; };
    const ops = diffLines(a, b, norm);
    const added = ops.filter((o) => o.kind === "add").length, removed = ops.filter((o) => o.kind === "del").length, same = ops.length - added - removed;
    const identical = added === 0 && removed === 0;
    const mark = (o: Op) => (o.kind === "add" ? "+ " : o.kind === "del" ? "- " : "  ") + o.text;
    let body: string;
    if (str(v, "view") === "full") body = ops.map(mark).join("\n");
    else {
      const keep = new Array<boolean>(ops.length).fill(false);
      ops.forEach((o, i) => { if (o.kind !== "same") for (let k = Math.max(0, i - 2); k <= Math.min(ops.length - 1, i + 2); k++) keep[k] = true; });
      const out: string[] = [];
      let gap = false;
      ops.forEach((o, i) => { if (keep[i]) { out.push(mark(o)); gap = false; } else if (!gap) { out.push("  …"); gap = true; } });
      body = out.join("\n");
    }
    const similarity = a.length + b.length === 0 ? 100 : (2 * same) / (a.length + b.length) * 100;
    return ok({
      primary: { label: "Result", value: T(identical ? "The two texts are identical" : `${added} line${added === 1 ? "" : "s"} added, ${removed} removed`) },
      secondary: [{ label: "Lines added", value: N(added) }, { label: "Lines removed", value: N(removed) }, { label: "Lines unchanged", value: N(same) }, { label: "Line similarity", value: T(`${formatNumber(Math.round(similarity * 10) / 10, { maxDecimals: 1 })}%`) }],
      ...(identical ? {} : { texts: [{ label: str(v, "view") === "full" ? "Full comparison  (+ added, − removed)" : "Changes with 2 lines of context  (+ added, − removed)", value: body }] }),
      notes: ["Compared line by line. A line that was edited shows as one removed line and one added line. The comparison runs on your device and the text is not uploaded."],
    });
  },
};
