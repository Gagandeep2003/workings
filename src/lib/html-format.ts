/**
 * Small, dependency-free HTML pretty-printer. It only changes whitespace *between* tags; tag names,
 * attributes and text are never rewritten. It is a formatter, not a validator.
 */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const INLINE = new Set(["a", "abbr", "b", "bdi", "bdo", "button", "cite", "code", "data", "dfn", "em", "i", "img", "input", "kbd", "label", "mark", "q", "s", "samp", "select", "small", "span", "strong", "sub", "sup", "time", "u", "var", "br", "wbr"]);
const RAW = new Set(["script", "style", "pre", "textarea"]);
const IMPLIED_END: Record<string, { closes: string[]; stop: string[] }> = {
  li: { closes: ["li"], stop: ["ul", "ol", "menu"] },
  dt: { closes: ["dt", "dd"], stop: ["dl"] },
  dd: { closes: ["dt", "dd"], stop: ["dl"] },
  tr: { closes: ["tr", "td", "th"], stop: ["table", "thead", "tbody", "tfoot"] },
  td: { closes: ["td", "th"], stop: ["tr", "table"] },
  th: { closes: ["td", "th"], stop: ["tr", "table"] },
  option: { closes: ["option"], stop: ["select", "datalist", "optgroup"] },
};

type Node =
  | { t: "text"; v: string }
  | { t: "comment"; v: string }
  | { t: "doctype"; v: string }
  | { t: "raw"; name: string; open: string; body: string; close: string }
  | { t: "el"; name: string; open: string; children: Node[]; selfClosed: boolean; closed: boolean };

export type HtmlFormatResult = { output: string; warnings: string[] };

function readTag(src: string, start: number): number {
  let quote = "";
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ">") return i + 1;
  }
  return -1;
}

export function formatHtml(src: string, indentUnit = "  ", maxLine = 100): HtmlFormatResult {
  const warnings: string[] = [];
  const root: Node & { t: "el" } = { t: "el", name: "#root", open: "", children: [], selfClosed: false, closed: true };
  const stack: (Node & { t: "el" })[] = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < src.length) {
    if (src[i] !== "<") {
      const next = src.indexOf("<", i);
      const end = next === -1 ? src.length : next;
      top().children.push({ t: "text", v: src.slice(i, end) });
      i = end;
      continue;
    }
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const stop = end === -1 ? src.length : end + 3;
      if (end === -1) warnings.push("A comment is never closed (missing -->).");
      top().children.push({ t: "comment", v: src.slice(i, stop) });
      i = stop;
      continue;
    }
    if (src[i + 1] === "!" || src[i + 1] === "?") {
      const end = readTag(src, i);
      const stop = end === -1 ? src.length : end;
      top().children.push({ t: "doctype", v: src.slice(i, stop).trim() });
      i = stop;
      continue;
    }
    const closeMatch = /^<\/([A-Za-z][^\s>/]*)\s*>/.exec(src.slice(i, i + 80));
    if (closeMatch) {
      const name = closeMatch[1].toLowerCase();
      let idx = -1;
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].name === name) { idx = k; break; }
      if (idx === -1) warnings.push(`A closing </${name}> has no matching opening tag.`);
      else {
        while (stack.length - 1 > idx) {
          const un = stack.pop()!;
          warnings.push(`<${un.name}> was never closed.`);
        }
        stack.pop()!.closed = true;
      }
      i += closeMatch[0].length;
      continue;
    }
    const openMatch = /^<([A-Za-z][^\s>/]*)/.exec(src.slice(i, i + 80));
    if (!openMatch) {
      top().children.push({ t: "text", v: "<" });
      i++;
      continue;
    }
    const end = readTag(src, i);
    if (end === -1) {
      warnings.push(`A tag starting at "${src.slice(i, i + 20)}…" is never closed with >.`);
      top().children.push({ t: "text", v: src.slice(i) });
      break;
    }
    const open = src.slice(i, end).replace(/\s+/g, " ").replace(/ >$/, ">").replace(/ \/>$/, " />");
    const name = openMatch[1].toLowerCase();
    const selfClosed = /\/>$/.test(open);
    i = end;
    const implied = IMPLIED_END[name];
    if (implied) {
      for (let k = stack.length - 1; k > 0; k--) {
        if (implied.stop.includes(stack[k].name)) break;
        if (implied.closes.includes(stack[k].name)) { while (stack.length - 1 >= k) stack.pop()!.closed = true; break; }
      }
    }
    if (RAW.has(name) && !selfClosed) {
      const closeRe = new RegExp(`</${name}\\s*>`, "i");
      const m = closeRe.exec(src.slice(i));
      const bodyEnd = m ? i + m.index : src.length;
      if (!m) warnings.push(`<${name}> is never closed.`);
      top().children.push({ t: "raw", name, open, body: src.slice(i, bodyEnd), close: m ? m[0] : "" });
      i = m ? bodyEnd + m[0].length : src.length;
      continue;
    }
    const el: Node & { t: "el" } = { t: "el", name, open, children: [], selfClosed: selfClosed || VOID.has(name), closed: selfClosed || VOID.has(name) };
    top().children.push(el);
    if (!el.selfClosed) stack.push(el);
  }
  for (let k = stack.length - 1; k > 0; k--) warnings.push(`<${stack[k].name}> was never closed.`);

  const isInline = (n: Node): boolean =>
    n.t === "text" || n.t === "comment" || (n.t === "el" && INLINE.has(n.name)) || (n.t === "raw" && (n.name === "textarea"));
  const collapse = (s: string) => s.replace(/\s+/g, " ");

  function inlineText(nodes: Node[]): string {
    let out = "";
    for (const n of nodes) {
      if (n.t === "text") out += collapse(n.v);
      else if (n.t === "comment") out += n.v;
      else if (n.t === "raw") out += n.open + n.body + n.close;
      else if (n.t === "el") out += n.selfClosed ? n.open : n.open + inlineText(n.children) + `</${n.name}>`;
    }
    return out;
  }

  const lines: string[] = [];
  const push = (depth: number, text: string) => { if (text.trim()) lines.push(indentUnit.repeat(depth) + text.trim()); };

  function renderChildren(nodes: Node[], depth: number) {
    let run: Node[] = [];
    const flushRun = () => {
      const text = inlineText(run).trim();
      if (text) push(depth, text);
      run = [];
    };
    for (const n of nodes) {
      if (isInline(n) && !(n.t === "el" && n.children.some((c) => !isInline(c)))) { run.push(n); continue; }
      flushRun();
      renderBlock(n, depth);
    }
    flushRun();
  }

  function renderBlock(n: Node, depth: number) {
    if (n.t === "doctype" || n.t === "comment") return push(depth, n.v);
    if (n.t === "text") return push(depth, collapse(n.v));
    if (n.t === "raw") {
      if (n.name === "pre" || n.name === "textarea") return push(depth, n.open + n.body + n.close), void 0;
      const body = n.body.replace(/^\s*\n/, "").replace(/\s+$/, "");
      if (!body.trim()) return push(depth, n.open + n.close);
      push(depth, n.open);
      const bodyLines = body.split("\n");
      const common = Math.min(...bodyLines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length));
      for (const l of bodyLines) if (l.trim()) lines.push(indentUnit.repeat(depth + 1) + l.slice(common).replace(/\s+$/, ""));
      return push(depth, n.close);
    }
    if (n.selfClosed) return push(depth, n.open);
    const close = `</${n.name}>`;
    const kids = n.children.filter((c) => !(c.t === "text" && c.v.trim() === ""));
    if (kids.length === 0) return push(depth, n.open + close);
    if (kids.every(isInline)) {
      const text = inlineText(kids).trim();
      if (indentUnit.length * depth + n.open.length + text.length + close.length <= maxLine && !text.includes("\n")) return push(depth, n.open + text + close);
      push(depth, n.open);
      push(depth + 1, text);
      return push(depth, close);
    }
    push(depth, n.open);
    renderChildren(kids, depth + 1);
    push(depth, close);
  }

  renderChildren(root.children.filter((c) => !(c.t === "text" && c.v.trim() === "")), 0);
  return { output: lines.join("\n"), warnings: [...new Set(warnings)].slice(0, 6) };
}
