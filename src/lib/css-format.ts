/** Dependency-free CSS formatter / minifier. Handles strings, comments, url(), at-rules and nesting. */
export type CssResult = { ok: true; output: string } | { ok: false; message: string; line: number };

const lineAt = (src: string, pos: number) => src.slice(0, pos).split("\n").length;

function tidyValue(text: string): string {
  let out = "";
  let quote = "";
  let depthUrl = 0;
  const s = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      out += ch;
      if (ch === "\\") out += s[++i] ?? "";
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
    if (/^url\($/i.test(out.slice(-4)) ) depthUrl = 1;
    if (depthUrl && ch === ")") depthUrl = 0;
    if (ch === "," && !depthUrl) { out += ", "; while (s[i + 1] === " ") i++; continue; }
    out += ch;
  }
  return out;
}

function tidyDeclaration(decl: string): string {
  const idx = decl.indexOf(":");
  if (idx === -1 || decl.trimStart().startsWith("@")) return tidyValue(decl);
  const prop = decl.slice(0, idx).trim();
  const value = tidyValue(decl.slice(idx + 1)).replace(/\s*!\s*important/i, " !important");
  return `${prop}: ${value}`;
}

function splitTopLevelCommas(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0, quote = "", cur = "";
  for (const ch of selector) {
    if (quote) { cur += ch; if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function formatCss(src: string, indentUnit = "  "): CssResult {
  const out: string[] = [];
  let level = 0;
  let cur = "";
  let i = 0;
  const pad = () => indentUnit.repeat(level);
  const emit = (text: string) => out.push(pad() + text);
  const stack: number[] = [];
  while (i < src.length) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end === -1) return { ok: false, message: "A comment is never closed (missing */).", line: lineAt(src, i) };
      if (cur.trim()) { cur += " "; } else emit(src.slice(i, end + 2).split("\n").map((l) => l.trim()).join("\n" + pad() + " "));
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) { if (src[j] === "\\") j++; if (src[j] === "\n") return { ok: false, message: "A string isn't closed before the end of the line.", line: lineAt(src, i) }; j++; }
      if (j >= src.length) return { ok: false, message: "A string is never closed.", line: lineAt(src, i) };
      cur += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "(") {
      let depth = 1, j = i + 1, q = "";
      while (j < src.length && depth > 0) {
        const c = src[j];
        if (q) { if (c === q) q = ""; } else if (c === '"' || c === "'") q = c; else if (c === "(") depth++; else if (c === ")") depth--;
        j++;
      }
      if (depth > 0) return { ok: false, message: "A ( is never closed with ).", line: lineAt(src, i) };
      cur += src.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "{") {
      const selector = cur.trim();
      const text = selector.startsWith("@") ? tidyValue(selector) : splitTopLevelCommas(selector).map(tidyValue).join(",\n" + pad());
      emit(`${text} {`);
      stack.push(i);
      level++;
      cur = "";
    } else if (ch === ";") {
      if (cur.trim()) emit(tidyDeclaration(cur) + ";");
      cur = "";
    } else if (ch === "}") {
      if (level === 0) return { ok: false, message: "Unexpected } — there is no matching {.", line: lineAt(src, i) };
      if (cur.trim()) emit(tidyDeclaration(cur) + ";");
      cur = "";
      level--;
      stack.pop();
      emit("}");
      if (level === 0) out.push("");
    } else cur += ch;
    i++;
  }
  if (level > 0) return { ok: false, message: `A { is never closed — add a } (the unclosed block starts on line ${lineAt(src, stack[stack.length - 1])}).`, line: lineAt(src, stack[stack.length - 1]) };
  if (cur.trim()) emit(tidyDeclaration(cur) + (cur.trim().startsWith("@") ? ";" : ""));
  return { ok: true, output: out.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

export function minifyCss(src: string): CssResult {
  const f = formatCss(src, "");
  if (!f.ok) return f;
  const text = f.output;
  let out = "";
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === "\\") out += text[++i] ?? "";
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (/\s/.test(ch)) {
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      const prev = out[out.length - 1];
      const next = text[j];
      if (prev !== undefined && next !== undefined && !"{};,:".includes(prev) && !"{};,".includes(next)) out += " ";
      i = j - 1;
      continue;
    }
    if (ch === "}" && out.endsWith(";")) out = out.slice(0, -1);
    out += ch;
  }
  return { ok: true, output: out };
}
