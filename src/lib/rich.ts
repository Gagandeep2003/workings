/** Tiny inline markup for tool copy: [[tool-id]], [[tool-id|anchor text]] and `code`. */
export type RichPart = { t: "text"; v: string } | { t: "link"; id: string; label?: string } | { t: "code"; v: string };

export function parseRich(text: string): RichPart[] {
  const parts: RichPart[] = [];
  const re = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push({ t: "text", v: text.slice(last, m.index) });
    if (m[1]) parts.push({ t: "link", id: m[1], label: m[2] });
    else parts.push({ t: "code", v: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ t: "text", v: text.slice(last) });
  return parts;
}
