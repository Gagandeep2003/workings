import { describe, it, expect } from "vitest";
import { parseMarkdown, parseInline, toHtml, plainTextOf, countNodes, safeUrl, MAX_INPUT, type Block, type Inline } from "@/lib/markdown";
import { engines } from "@/engines/developer/markdown";
import { errs, out, primary, run, sec } from "./util";

const html = (md: string) => toHtml(parseMarkdown(md));
const inl = (md: string) => toHtml([{ t: "p", c: parseInline(md) } as Block]).replace(/^<p>|<\/p>$/g, "");

describe("inline formatting", () => {
  it("bold, italic, strikethrough, code", () => {
    expect(inl("**bold** and *italic* and ~~gone~~ and `code`")).toBe("<strong>bold</strong> and <em>italic</em> and <del>gone</del> and <code>code</code>");
    expect(inl("__bold__ and _italic_")).toBe("<strong>bold</strong> and <em>italic</em>");
    expect(inl("***both***")).toBe("<strong><em>both</em></strong>");
    expect(inl("**bold with *nested italic* inside**")).toBe("<strong>bold with <em>nested italic</em> inside</strong>");
  });
  it("does not treat stray or intra-word delimiters as emphasis", () => {
    expect(inl("snake_case_name stays")).toBe("snake_case_name stays");
    expect(inl("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(inl("a * b")).toBe("a * b");
    expect(inl("unclosed *star")).toBe("unclosed *star");
    expect(inl("**unclosed bold")).toBe("**unclosed bold");
    expect(inl("5 > 3 & 2 < 4")).toBe("5 &gt; 3 &amp; 2 &lt; 4");
  });
  it("code spans protect their contents and handle longer fences", () => {
    expect(inl("`*not italic*` and `<b>`")).toBe("<code>*not italic*</code> and <code>&lt;b&gt;</code>");
    expect(inl("`` a ` b ``")).toBe("<code>a ` b</code>");
    expect(inl("`unclosed")).toBe("`unclosed");
  });
  it("backslash escapes", () => {
    expect(inl("\\*literal\\* \\# \\[x\\]")).toBe("*literal* # [x]");
    expect(inl("trailing backslash\\")).toBe("trailing backslash\\");
  });
  it("line breaks: two trailing spaces or a backslash make <br>, a plain newline is a space", () => {
    expect(inl("a  \nb")).toBe("a<br>b");
    expect(inl("a\\\nb")).toBe("a<br>b");
    expect(inl("a\nb")).toBe("a b");
  });
  it("links and autolinks", () => {
    expect(inl("[site](https://example.com)")).toBe('<a href="https://example.com" rel="noopener noreferrer nofollow">site</a>');
    expect(inl("[mail](mailto:a@b.co)")).toContain('href="mailto:a@b.co"');
    expect(inl("<https://example.com/x?a=1&b=2>")).toBe('<a href="https://example.com/x?a=1&amp;b=2" rel="noopener noreferrer nofollow">https://example.com/x?a=1&amp;b=2</a>');
    expect(inl('[titled](https://example.com "A title")')).toContain('href="https://example.com"');
    expect(inl("[**bold link**](https://e.com)")).toContain("<strong>bold link</strong>");
    expect(inl("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))")).toContain('href="https://en.wikipedia.org/wiki/Foo_(bar)"');
    expect(inl("[broken](")).toBe("[broken](");
    expect(inl("[no url]")).toBe("[no url]");
  });
  it("images show alt text and never produce a remote request in the preview", () => {
    const [p] = parseMarkdown("![A cat](https://example.com/cat.png)") as { t: "p"; c: Inline[] }[];
    expect(p.c[0]).toEqual({ t: "image", alt: "A cat", src: "https://example.com/cat.png" });
    expect(inl("![A cat](javascript:alert(1))")).toBe("A cat"); // unsafe source dropped
  });
});

describe("security: untrusted input", () => {
  it("raw HTML is escaped, never passed through", () => {
    expect(html("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(html('<img src=x onerror="alert(1)">')).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
    expect(html("a <b>bold</b> b")).toBe("<p>a &lt;b&gt;bold&lt;/b&gt; b</p>");
    expect(html("```\n<script>x</script>\n```")).toBe("<pre><code>&lt;script&gt;x&lt;/script&gt;</code></pre>");
  });
  it("only http, https and mailto links survive", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>x</script>", "vbscript:x", "file:///etc/passwd", "//evil.com", "ftp://x.com", " javascript:alert(1)", "java\nscript:alert(1)", "https://x.com/\" onmouseover=\"alert(1)"]) {
      const out_ = inl(`[click](${bad})`);
      expect(out_, bad).not.toContain("<a ");
      expect(out_, bad).not.toMatch(/href=/);
    }
    expect(safeUrl("https://a.co")).toBe("https://a.co");
    expect(safeUrl("HTTP://A.CO")).toBe("HTTP://A.CO");
    expect(safeUrl("javascript:1")).toBeNull();
    expect(safeUrl("https://a.co/ b")).toBeNull();
    expect(safeUrl('https://a.co/"x')).toBeNull();
  });
  it("attributes and text are escaped in HTML output", () => {
    expect(html('[x](https://a.co/?q=1&r="2")')).not.toContain('"2"');
    expect(html("**<img>**")).toBe("<p><strong>&lt;img&gt;</strong></p>");
    const t = toHtml(parseMarkdown("| a<b> | c |\n|---|---|\n| <i>x</i> | y |"));
    expect(t).not.toMatch(/<b>|<i>/);
  });
  it("the rendered tree never contains a raw-HTML node type", () => {
    const tree = JSON.stringify(parseMarkdown("<div>hi</div>\n\n<span onclick=1>x</span>\n\n# T"));
    expect(tree).not.toMatch(/"t":"html"/);
  });
  it("deep nesting and pathological repetition are bounded and fast", () => {
    const cases: Record<string, string> = {
      "1000 nested quotes": "> ".repeat(1000) + "deep",
      "1000 nested list levels": Array.from({ length: 1000 }, (_, i) => " ".repeat(i * 2) + "- x").join("\n"),
      "50k asterisks": "*".repeat(50_000),
      "50k underscores": "_".repeat(50_000),
      "50k open brackets": "[".repeat(50_000),
      "50k backticks": "`".repeat(50_000),
      "50k '[a](' repeats": "[a](".repeat(12_000),
      "50k '**a ' repeats": "**a ".repeat(12_000),
      "50k tildes": "~".repeat(50_000),
      "50k open emphasis in a table": "| a |\n|---|\n" + "| *x |\n".repeat(7000),
      "50k pipes": "|".repeat(50_000),
      "50k '>'": ">".repeat(50_000),
      "50k newlines": "\n".repeat(50_000),
    };
    for (const [name, md] of Object.entries(cases)) {
      const t0 = performance.now();
      const blocks = parseMarkdown(md);
      const h = toHtml(blocks);
      const ms = performance.now() - t0;
      expect(ms, `${name}: ${ms.toFixed(0)} ms`).toBeLessThan(2500);
      expect(typeof h).toBe("string");
    }
  });
  it("input beyond the limit is truncated, not rejected by the parser", () => {
    expect(parseMarkdown("a".repeat(MAX_INPUT * 2))).toHaveLength(1);
  });
});

describe("blocks", () => {
  it("headings: ATX, trailing hashes, empty, setext; seven hashes is not a heading", () => {
    expect(html("# One\n## Two ##\n###### Six")).toBe("<h1>One</h1>\n<h2>Two</h2>\n<h6>Six</h6>");
    expect(html("#")).toBe("<h1></h1>");
    expect(html("Title\n=====")).toBe("<h1>Title</h1>");
    expect(html("Sub\n---")).toBe("<h2>Sub</h2>");
    expect(html("####### seven")).toBe("<p>####### seven</p>");
    expect(html("#nospace")).toBe("<p>#nospace</p>");
    expect(html("# *styled* **head**")).toBe("<h1><em>styled</em> <strong>head</strong></h1>");
  });
  it("paragraphs and rules", () => {
    expect(html("one\ntwo\n\nthree")).toBe("<p>one two</p>\n<p>three</p>");
    expect(html("a\n\n---\n\nb")).toBe("<p>a</p>\n<hr>\n<p>b</p>");
    expect(html("***")).toBe("<hr>");
    expect(html("* * *")).toBe("<hr>");
    expect(html("___")).toBe("<hr>");
  });
  it("fenced code: language, tilde fences, unclosed fence, inner fences", () => {
    expect(html("```js\nconst a = 1;\n```")).toBe('<pre><code class="language-js">const a = 1;</code></pre>');
    expect(html("~~~\nx\n~~~")).toBe("<pre><code>x</code></pre>");
    expect(html("```\nnever closed\nstill code")).toBe("<pre><code>never closed\nstill code</code></pre>");
    expect(html("````\n```\ninner\n```\n````")).toBe("<pre><code>```\ninner\n```</code></pre>");
    expect(html('```"><script>\nx\n```')).toBe('<pre><code class="language-script">x</code></pre>'); // the info string is cut down to word characters, so it cannot break out of the attribute
  });
  it("block quotes, including nested ones", () => {
    expect(html("> quoted")).toBe("<blockquote>\n<p>quoted</p>\n</blockquote>");
    expect(html("> a\n> b")).toBe("<blockquote>\n<p>a b</p>\n</blockquote>");
    expect(html("> outer\n>\n> > inner")).toContain("<blockquote>\n<p>inner</p>\n</blockquote>");
  });
  it("lists: bullets, numbered with start, nesting, task items", () => {
    expect(html("- a\n- b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(html("* a\n* b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(html("1. a\n2. b")).toBe("<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
    expect(html("5. five\n6. six")).toContain('<ol start="5">');
    expect(html("- a\n  - nested\n- b")).toBe("<ul>\n<li>\na\n<ul>\n<li>nested</li>\n</ul>\n</li>\n<li>b</li>\n</ul>".replace("\na\n", "\n<p>a</p>\n"));
    expect(html("- [x] done\n- [ ] todo")).toBe('<ul>\n<li><input type="checkbox" disabled checked> done</li>\n<li><input type="checkbox" disabled> todo</li>\n</ul>');
    expect(html("- a\n\n- b")).toContain("<li>a</li>"); // loose list keeps both items
    expect(html("-not a list")).toBe("<p>-not a list</p>");
    expect(html("2024. a year")).toBe("<ol start=\"2024\">\n<li>a year</li>\n</ol>");
  });
  it("a list item can contain several paragraphs and code", () => {
    const h = html("- first\n\n  second paragraph\n\n  ```\n  code\n  ```\n- next");
    expect(h).toContain("<p>second paragraph</p>");
    expect(h).toContain("<pre><code>code</code></pre>");
    expect(h.match(/<li>/g)).toHaveLength(2);
  });
  it("tables: alignment, escaped pipes, ragged rows, inline formatting", () => {
    const h = html("| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | **b** | c |\n| only |");
    expect(h).toContain('<th style="text-align:left">Left</th>');
    expect(h).toContain('<th style="text-align:center">Center</th>');
    expect(h).toContain('<th style="text-align:right">Right</th>');
    expect(h).toContain('<td style="text-align:center"><strong>b</strong></td>');
    expect(h).toContain('<td style="text-align:left">only</td><td style="text-align:center"></td><td style="text-align:right"></td>'); // short row padded to the header width
    expect(html("| a \\| b | c |\n|---|---|\n| 1 | 2 |")).toContain("<th>a | b</th>");
    expect(html("a | b\n--|--\n1 | 2")).toContain("<table>");
    expect(html("| a | b |\n|---|\n| 1 | 2 |")).not.toContain("<table>"); // column counts disagree → not a table
  });
  it("a realistic README renders end to end", () => {
    const readme = "# Project\n\nA *small* tool.\n\n## Install\n\n```bash\nnpm install\n```\n\n## Features\n\n- Fast\n- Private\n  - runs locally\n\n| Option | Default |\n|---|---|\n| `mode` | live |\n\n> Note: see [docs](https://example.com/docs).\n";
    const blocks = parseMarkdown(readme);
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "h", "code", "h", "list", "table", "quote"]);
    const n = countNodes(blocks);
    expect(n).toMatchObject({ headings: 3, links: 1, codeBlocks: 1, images: 0 });
  });
  it("empty and whitespace input produce nothing", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n\n  ")).toEqual([]);
  });
  it("tabs and Windows line endings are normalised", () => {
    expect(html("# A\r\n\r\n-\tx\r\n-\ty")).toBe("<h1>A</h1>\n<ul>\n<li>x</li>\n<li>y</li>\n</ul>".replace("-\t", ""));
  });
});

describe("plain text and counts", () => {
  it("extracts visible text for word counts", () => {
    expect(plainTextOf(parseMarkdown("# Hi there\n\nSome **bold** `code` [link](https://a.co)."))).toBe("Hi there\nSome bold code link.");
    expect(plainTextOf(parseMarkdown("| a | b |\n|---|---|\n| 1 | 2 |"))).toBe("a b 1 2");
  });
});

describe("Markdown previewer engine", () => {
  const preview = (text: string) => run(engines, "markdown-previewer", { text });
  it("reports word count, reading time and structure, and returns the tree and HTML", () => {
    const r = preview("# Title\n\nOne two three [four](https://a.co) five.\n\n- six\n- seven");
    expect(primary(r)).toBe(8); // Title, One, two, three, four, five., six, seven
    expect(sec(r, "Headings")).toBe(1);
    expect(sec(r, "Links")).toBe(1);
    expect(sec(r, "Reading time")).toBe("about 1 min");
    expect(out(r).markdown!.map((b) => b.t)).toEqual(["h", "p", "list"]);
    expect(out(r).texts![0].value).toContain('<a href="https://a.co" rel="noopener noreferrer nofollow">four</a>');
  });
  it("reading time scales with length", () => {
    expect(sec(preview(Array(2300).fill("word").join(" ")), "Reading time")).toBe("about 10 min");
  });
  it("counts images without loading them", () => {
    const r = preview("![a](https://x.co/a.png) text");
    expect(sec(r, "Images")).toBe(1);
    expect(JSON.stringify(out(r).markdown)).toContain('"t":"image"');
  });
  it("asks for input and enforces the size limit", () => {
    expect(errs(preview("   "))).toMatch(/Type or paste some Markdown/);
    expect(errs(preview("a".repeat(MAX_INPUT + 1)))).toMatch(/over 50,000 characters/);
  });
  it("the worked example in the definition renders", () => {
    const sample = "# Hello, Markdown\n\nWrite **bold**, *italic* or `code`, and add a [link](https://example.com).\n\n- [x] Preview as you type\n- [ ] Copy the HTML\n\n| Tool | Runs in |\n| --- | :---: |\n| Workings | your browser |";
    const r = preview(sample);
    expect(out(r).markdown!.map((b) => b.t)).toEqual(["h", "p", "list", "table"]);
    expect(out(r).texts![0].value).toContain("<h1>Hello, Markdown</h1>");
  });
});
