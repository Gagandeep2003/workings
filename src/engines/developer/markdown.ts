import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { MAX_INPUT, countNodes, parseMarkdown, plainTextOf, toHtml } from "@/lib/markdown";
import { fail, ok, str } from "../helpers";

export const engines: EngineMap = {
  "markdown-previewer": (v) => {
    const text = str(v, "text");
    if (text.trim() === "") return fail("Type or paste some Markdown to preview.", "text");
    if (text.length > MAX_INPUT) return fail(`That is over ${MAX_INPUT.toLocaleString("en-US")} characters. Please preview a shorter section.`, "text");
    const blocks = parseMarkdown(text);
    const words = plainTextOf(blocks).split(/\s+/).filter(Boolean).length;
    const n = countNodes(blocks);
    return ok({
      primary: { label: "Words", value: N(words) },
      secondary: [
        { label: "Reading time", value: T(words === 0 ? "under a minute" : `about ${formatNumber(Math.max(1, Math.round(words / 230)), { maxDecimals: 0 })} min`), hint: "At about 230 words per minute." },
        { label: "Headings", value: N(n.headings) },
        { label: "Links", value: N(n.links) },
        ...(n.images ? [{ label: "Images", value: N(n.images), hint: "Not loaded in the preview, so nothing is fetched from other sites." }] : []),
      ],
      markdown: blocks,
      texts: [{ label: "HTML output (copy this)", value: toHtml(blocks) }],
      notes: ["Raw HTML you type is shown as text, not run. Only http, https and mailto links are kept, and images are not loaded in the preview. Supports headings, emphasis, lists (including task lists), tables, code, quotes and links."],
    });
  },
};
