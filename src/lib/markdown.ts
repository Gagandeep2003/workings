/**
 * A small, safe Markdown parser (CommonMark/GFM subset) used by the Markdown previewer.
 *
 * Safety by construction:
 *  • The output is a typed tree, not HTML. The page renders it with React elements, so nothing the visitor types can become markup.
 *  • Raw HTML in the input is kept as literal text (and escaped when HTML output is generated).
 *  • Links are limited to http, https and mailto. Anything else (javascript:, data:, …) is shown as plain text.
 *  • Remote images are never loaded (that would reveal the visitor's IP address to an arbitrary host); the preview shows the alt text.
 *  • Work is bounded: input size, nesting depth and the distance searched for a closing delimiter are all capped.
 *
 * Supported: headings (# and underline), paragraphs, **bold**, *italic*, ~~strikethrough~~, `code`, fenced code blocks, links, images,
 * block quotes, bullet / numbered / task lists (nested), horizontal rules, tables with alignment, backslash escapes, hard line breaks.
 * Not supported: reference-style links, footnotes, raw HTML, setext edge cases and other rarely used CommonMark corners.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "em" | "strong" | "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "image"; alt: string; src: string | null }
  | { t: "br" };

export type Align = "left" | "center" | "right" | null;
export type Block =
  | { t: "h"; level: 1 | 2 | 3 | 4 | 5 | 6; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "code"; lang: string; v: string }
  | { t: "quote"; c: Block[] }
  | { t: "list"; ordered: boolean; start: number; items: { task: boolean | null; c: Block[] }[] }
  | { t: "hr" }
  | { t: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] };

export const MAX_INPUT = 50_000;
const MAX_DEPTH = 6; // nested quotes / lists / emphasis
const WINDOW = 1_000; // how far to look for a closing delimiter or bracket

const SAFE_URL = /^(https?:\/\/|mailto:)[^\s<>"]+$/i;
export const safeUrl = (raw: string): string | null => (SAFE_URL.test(raw.trim()) ? raw.trim() : null);

// ------------------------------------------------------------------ inline
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~<>]/;
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isWordChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9]/.test(c);

/** Find the index of the bracket that closes the one at `open`, allowing nested pairs; -1 if none within the window. */
function matchBracket(s: string, open: number, o: string, c: string): number {
  let depth = 0;
  const end = Math.min(s.length, open + WINDOW);
  for (let i = open; i < end; i++) {
    if (s[i] === "\\") { i++; continue; }
    if (s[i] === o) depth++;
    else if (s[i] === c && --depth === 0) return i;
  }
  return -1;
}

/** Find a closing emphasis delimiter for the opener at `from` (the text after the opener starts at `from + len`). */
function findCloser(s: string, from: number, delim: string): number {
  const len = delim.length, ch = delim[0];
  const end = Math.min(s.length - len + 1, from + len + WINDOW);
  for (let j = from + len + 1; j < end; j++) {
    if (s[j] === "\\") { j++; continue; }
    if (s[j] === "`") { const close = s.indexOf("`", j + 1); if (close !== -1 && close < end) { j = close; continue; } }
    if (!s.startsWith(delim, j)) continue;
    if (ch !== "~" && len === 1 && (s[j + 1] === ch || s[j - 1] === ch)) continue; // part of a longer run
    if (isSpace(s[j - 1])) continue; // a closer is never preceded by whitespace
    if (ch === "_" && isWordChar(s[j + len])) continue; // no intra-word underscore emphasis (snake_case)
    return j;
  }
  return -1;
}

export function parseInline(s: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      if (s[i + 1] === "\n") { flush(); out.push({ t: "br" }); i += 2; continue; }
      if (ESCAPABLE.test(s[i + 1])) { buf += s[i + 1]; i += 2; continue; }
    }
    if (c === "\n") {
      if (buf.endsWith("  ")) { buf = buf.replace(/ +$/, ""); flush(); out.push({ t: "br" }); } else { buf = buf.replace(/ +$/, "") + " "; }
      i++; while (s[i] === " ") i++;
      continue;
    }
    if (c === "`") {
      const run = /^`+/.exec(s.slice(i, i + 64))![0];
      let j = i + run.length, found = -1;
      const limit = Math.min(s.length, i + WINDOW);
      while ((j = s.indexOf(run, j)) !== -1 && j < limit) { if (s[j - 1] !== "`" && s[j + run.length] !== "`") { found = j; break; } j++; }
      if (found !== -1) {
        let code = s.slice(i + run.length, found).replace(/\n/g, " ");
        if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") code = code.slice(1, -1);
        flush(); out.push({ t: "code", v: code }); i = found + run.length; continue;
      }
      buf += run; i += run.length; continue;
    }
    if ((c === "!" && s[i + 1] === "[") || c === "[") {
      const image = c === "!";
      const open = image ? i + 1 : i;
      const close = matchBracket(s, open, "[", "]");
      if (close !== -1 && s[close + 1] === "(") {
        const pClose = matchBracket(s, close + 1, "(", ")");
        if (pClose !== -1) {
          const dest = s.slice(close + 2, pClose).trim().replace(/\s+("[^"]*"|'[^']*')$/, "").replace(/^<(.*)>$/, "$1");
          const label = s.slice(open + 1, close);
          flush();
          if (image) out.push({ t: "image", alt: label.replace(/[*_`\\]/g, ""), src: safeUrl(dest) });
          else {
            const href = safeUrl(dest);
            const inner = depth < MAX_DEPTH ? parseInline(label, depth + 1) : [{ t: "text", v: label } as Inline];
            if (href) out.push({ t: "link", href, c: inner }); else out.push(...inner);
          }
          i = pClose + 1; continue;
        }
      }
    }
    if (c === "<") {
      const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(s.slice(i, i + WINDOW));
      if (m) { flush(); out.push({ t: "link", href: m[1], c: [{ t: "text", v: m[1] }] }); i += m[0].length; continue; }
    }
    if ((c === "*" || c === "_" || c === "~") && depth < MAX_DEPTH) {
      const run = /^([*_~])\1*/.exec(s.slice(i, i + 8))![0].length;
      const tryDelim = (delim: string, make: (inner: Inline[]) => Inline): boolean => {
        if (!s.startsWith(delim, i) || isSpace(s[i + delim.length])) return false;
        if (c === "_" && isWordChar(s[i - 1])) return false;
        if (c === "~" && delim.length !== 2) return false;
        const j = findCloser(s, i, delim);
        if (j === -1 || j === i + delim.length) return false;
        flush();
        out.push(make(parseInline(s.slice(i + delim.length, j), depth + 1)));
        i = j + delim.length;
        return true;
      };
      if (c === "~") { if (tryDelim("~~", (x) => ({ t: "del", c: x }))) continue; }
      else if (run >= 3 && tryDelim(c.repeat(3), (x) => ({ t: "strong", c: [{ t: "em", c: x }] }))) continue;
      else if (run >= 2 && tryDelim(c.repeat(2), (x) => ({ t: "strong", c: x }))) continue;
      else if (tryDelim(c, (x) => ({ t: "em", c: x }))) continue;
    }
    buf += c; i++;
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ blocks
const blank = (l: string) => /^\s*$/.test(l);
const indentOf = (l: string) => /^ */.exec(l)![0].length;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const LIST = /^( {0,3})([-*+]|\d{1,9}[.)])( +)(\S.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") { cur += "|"; i++; }
    else if (t[i] === "|") { cells.push(cur.trim()); cur = ""; }
    else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
}

const startsBlock = (l: string) => FENCE.test(l) || (HEADING.test(l) && /^ {0,3}#/.test(l)) || HR.test(l) || QUOTE.test(l) || (LIST.test(l) && (!/\d/.test(LIST.exec(l)![2]) || /^1[.)]$/.test(LIST.exec(l)![2])));

function parseList(lines: string[], start: number, depth: number): [Block, number] {
  const first = LIST.exec(lines[start])!;
  const ordered = /\d/.test(first[2]);
  const marker = ordered ? first[2].slice(-1) : first[2];
  const items: { task: boolean | null; c: Block[] }[] = [];
  let i = start;
  const sameKind = (m: RegExpExecArray | null) => !!m && /\d/.test(m[2]) === ordered && (ordered ? m[2].slice(-1) === marker : m[2] === marker);
  while (i < lines.length) {
    const m = LIST.exec(lines[i]);
    if (!sameKind(m)) break;
    const contentIndent = m![1].length + m![2].length + m![3].length;
    const itemLines = [m![4]];
    i++;
    let prevBlank = false;
    while (i < lines.length) {
      const l = lines[i];
      if (blank(l)) {
        let k = i;
        while (k < lines.length && blank(lines[k])) k++;
        if (k < lines.length && indentOf(lines[k]) >= contentIndent) { for (; i < k; i++) itemLines.push(""); prevBlank = true; continue; }
        break;
      }
      if (indentOf(l) >= contentIndent) { itemLines.push(l.slice(contentIndent)); prevBlank = false; i++; }
      else if (!prevBlank && !startsBlock(l) && !LIST.test(l)) { itemLines.push(l.trim()); i++; }
      else break;
    }
    let task: boolean | null = null;
    const tm = /^\[( |x|X)\]\s+(.*)$/.exec(itemLines[0]);
    if (tm) { task = tm[1] !== " "; itemLines[0] = tm[2]; }
    items.push({ task, c: depth < MAX_DEPTH ? parseBlocks(itemLines, depth + 1) : [{ t: "p", c: [{ t: "text", v: itemLines.join(" ") }] }] });
    let k = i;
    while (k < lines.length && blank(lines[k])) k++;
    if (k < lines.length && sameKind(LIST.exec(lines[k]))) i = k; else break;
  }
  return [{ t: "list", ordered, start: ordered ? Number(first[2].slice(0, -1)) : 1, items }, i];
}

export function parseBlocks(lines: string[], depth = 0): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const [, marks, lang] = fence;
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i].trim().startsWith(marks[0].repeat(marks.length)) && lines[i].trim().replace(new RegExp(`^\\${marks[0]}+`), "").trim() === "")) body.push(lines[i++]);
      i++; // closing fence (or the end of input: an unclosed fence runs to the end)
      blocks.push({ t: "code", lang: lang.replace(/[^\w+-]/g, "").slice(0, 20), v: body.join("\n") });
      continue;
    }
    if (HR.test(line)) { blocks.push({ t: "hr" }); i++; continue; }
    const h = HEADING.exec(line);
    if (h && /^ {0,3}#/.test(line)) { blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3 | 4 | 5 | 6, c: parseInline((h[2] ?? "").trim()) }); i++; continue; }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) inner.push(QUOTE.exec(lines[i++])![1]);
      blocks.push({ t: "quote", c: depth < MAX_DEPTH ? parseBlocks(inner, depth + 1) : [{ t: "p", c: [{ t: "text", v: inner.join(" ") }] }] });
      continue;
    }
    if (LIST.test(line)) { const [block, next] = parseList(lines, i, depth); blocks.push(block); i = next; continue; }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(line), seps = splitRow(lines[i + 1]);
      if (head.length === seps.length) {
        const align: Align[] = seps.map((s) => (s.startsWith(":") && s.endsWith(":") ? "center" : s.endsWith(":") ? "right" : s.startsWith(":") ? "left" : null));
        const rows: Inline[][][] = [];
        i += 2;
        while (i < lines.length && !blank(lines[i]) && lines[i].includes("|")) {
          const cells = splitRow(lines[i++]);
          while (cells.length < head.length) cells.push("");
          rows.push(cells.slice(0, head.length).map((x) => parseInline(x)));
        }
        blocks.push({ t: "table", align, head: head.map((x) => parseInline(x)), rows });
        continue;
      }
    }
    // paragraph (possibly a setext heading)
    const para = [line.trim()];
    let level: 1 | 2 | null = null;
    i++;
    while (i < lines.length && !blank(lines[i])) {
      if (/^ {0,3}=+\s*$/.test(lines[i])) { level = 1; i++; break; }
      if (/^ {0,3}-+\s*$/.test(lines[i])) { level = 2; i++; break; }
      if (startsBlock(lines[i])) break;
      para.push(lines[i].replace(/^\s+/, ""));
      i++;
    }
    const inline = parseInline(para.join("\n"));
    blocks.push(level ? { t: "h", level, c: inline } : { t: "p", c: inline });
  }
  return blocks;
}

export function parseMarkdown(src: string): Block[] {
  const text = src.slice(0, MAX_INPUT).replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  return parseBlocks(text.split("\n"));
}

// ------------------------------------------------------------------ analysis and HTML output
export function plainTextOf(blocks: Block[]): string {
  const inl = (xs: Inline[]): string => xs.map((x) => (x.t === "text" || x.t === "code" ? x.v : x.t === "image" ? x.alt : x.t === "br" ? " " : inl(x.c))).join("");
  const blk = (b: Block): string => {
    switch (b.t) {
      case "h": case "p": return inl(b.c);
      case "code": return b.v;
      case "quote": return b.c.map(blk).join(" ");
      case "list": return b.items.map((it) => it.c.map(blk).join(" ")).join(" ");
      case "table": return [b.head, ...b.rows].flat().map(inl).join(" ");
      default: return "";
    }
  };
  return blocks.map(blk).join("\n");
}

export function countNodes(blocks: Block[]): { headings: number; links: number; images: number; codeBlocks: number } {
  const n = { headings: 0, links: 0, images: 0, codeBlocks: 0 };
  const inl = (xs: Inline[]) => { for (const x of xs) { if (x.t === "link") { n.links++; inl(x.c); } else if (x.t === "image") n.images++; else if (x.t === "em" || x.t === "strong" || x.t === "del") inl(x.c); } };
  const blk = (b: Block) => {
    if (b.t === "h") { n.headings++; inl(b.c); } else if (b.t === "p") inl(b.c);
    else if (b.t === "code") n.codeBlocks++;
    else if (b.t === "quote") b.c.forEach(blk);
    else if (b.t === "list") b.items.forEach((it) => it.c.forEach(blk));
    else if (b.t === "table") [b.head, ...b.rows].flat().forEach(inl);
  };
  blocks.forEach(blk);
  return n;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** HTML for copying. Every piece of text is escaped, every URL was validated by the parser, and raw HTML in the input stays literal text. */
export function toHtml(blocks: Block[]): string {
  const inl = (xs: Inline[]): string => xs.map((x) => {
    switch (x.t) {
      case "text": return esc(x.v);
      case "code": return `<code>${esc(x.v)}</code>`;
      case "em": return `<em>${inl(x.c)}</em>`;
      case "strong": return `<strong>${inl(x.c)}</strong>`;
      case "del": return `<del>${inl(x.c)}</del>`;
      case "br": return "<br>";
      case "link": return `<a href="${esc(x.href)}" rel="noopener noreferrer nofollow">${inl(x.c)}</a>`;
      case "image": return x.src ? `<img src="${esc(x.src)}" alt="${esc(x.alt)}">` : esc(x.alt);
    }
  }).join("");
  const blk = (b: Block): string => {
    switch (b.t) {
      case "h": return `<h${b.level}>${inl(b.c)}</h${b.level}>`;
      case "p": return `<p>${inl(b.c)}</p>`;
      case "code": return `<pre><code${b.lang ? ` class="language-${b.lang}"` : ""}>${esc(b.v)}</code></pre>`;
      case "quote": return `<blockquote>\n${b.c.map(blk).join("\n")}\n</blockquote>`;
      case "hr": return "<hr>";
      case "list": {
        const tag = b.ordered ? "ol" : "ul";
        const items = b.items.map((it) => {
          const box = it.task === null ? "" : `<input type="checkbox" disabled${it.task ? " checked" : ""}> `;
          const inner = it.c.length === 1 && it.c[0].t === "p" ? inl(it.c[0].c) : `\n${it.c.map(blk).join("\n")}\n`;
          return `<li>${box}${inner}</li>`;
        });
        return `<${tag}${b.ordered && b.start !== 1 ? ` start="${b.start}"` : ""}>\n${items.join("\n")}\n</${tag}>`;
      }
      case "table": {
        const cell = (tag: string, c: Inline[], i: number) => `<${tag}${b.align[i] ? ` style="text-align:${b.align[i]}"` : ""}>${inl(c)}</${tag}>`;
        return `<table>\n<thead>\n<tr>${b.head.map((c, i) => cell("th", c, i)).join("")}</tr>\n</thead>\n<tbody>\n${b.rows.map((r) => `<tr>${r.map((c, i) => cell("td", c, i)).join("")}</tr>`).join("\n")}\n</tbody>\n</table>`;
      }
    }
  };
  return blocks.map(blk).join("\n");
}
