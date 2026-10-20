import { describe, it, expect } from "vitest";
import jsQR from "jsqr";
import { engines as json } from "@/engines/developer/json";
import { engines as enc, uuidV4, uuidV7 } from "@/engines/developer/encode";
import { engines as web } from "@/engines/developer/web";
import { engines as txt } from "@/engines/developer/text";
import { engines as rx } from "@/engines/developer/regex";
import { makeMatrix } from "@/lib/files/qrmatrix";
import { wifiPayload, upiPayload, vcardPayload, smsPayload, emailPayload } from "@/lib/files/qr";
import { decodeBase64, encodeBase64 } from "@/lib/base64";
import { formatHtml } from "@/lib/html-format";
import { formatCss, minifyCss } from "@/lib/css-format";
import { parseColor, toHex, contrastRatio } from "@/lib/color";
import { makeContext } from "@/engines/helpers";
import { ctx, errs, out, primary, run, sec } from "./util";

const text = (res: ReturnType<typeof run>, i = 0) => out(res).texts![i].value;

describe("JSON tools", () => {
  it("formats, sorts, and keeps numbers intact", () => {
    const r = run(json, "json-formatter", { json: '{"b":1.0,"a":[12345678901234567890]}', indent: "2", sort: "yes" });
    expect(text(r)).toBe('{\n  "a": [\n    12345678901234567890\n  ],\n  "b": 1.0\n}');
    expect(out(r).notes?.[0]).toMatch(/larger than 9,007/);
    expect(text(run(json, "json-formatter", { json: "[1,2]", indent: "tab", sort: "no" }))).toBe("[\n\t1,\n\t2\n]");
    expect(text(run(json, "json-formatter", { json: "[1]", indent: "4", sort: "no" }))).toBe("[\n    1\n]");
  });
  it("reports precise errors", () => {
    const e = errs(run(json, "json-formatter", { json: '{\n  "a": 1,\n}', indent: "2", sort: "no" }));
    expect(e).toMatch(/Line 3, column 1/);
    expect(e).toMatch(/trailing comma/);
    expect(errs(run(json, "json-formatter", { json: "  ", indent: "2", sort: "no" }))).toMatch(/empty/);
    expect(errs(run(json, "json-validator", { json: "{'a': 1}" }))).toMatch(/single quotes|double quotes/);
  });
  it("validates with stats and warnings", () => {
    const r = run(json, "json-validator", { json: '{"a":1,"a":2,"n":[true,null]}' });
    expect(primary(r)).toBe("Valid JSON ✓");
    expect(sec(r, "Top-level type")).toBe("object");
    expect(sec(r, "Keys")).toBe(3);
    expect(out(r).notes?.[0]).toMatch(/more than once/);
  });
  it("minifies", () => {
    const r = run(json, "json-minifier", { json: '{\n  "a": [ 1, 2 ],\n  "b": "x y"\n}' });
    expect(text(r)).toBe('{"a":[1,2],"b":"x y"}');
    expect(primary(r)).toBe(Buffer.byteLength('{\n  "a": [ 1, 2 ],\n  "b": "x y"\n}') - Buffer.byteLength('{"a":[1,2],"b":"x y"}'));
  });
});

describe("Base64, URL, UUID", () => {
  it("encodes and decodes Base64 per RFC 4648 test vectors", () => {
    const e = (s: string, urlSafe = false, pad = true) => encodeBase64(new TextEncoder().encode(s), urlSafe, pad);
    expect(e("")).toBe("");
    expect(e("f")).toBe("Zg==");
    expect(e("fo")).toBe("Zm8=");
    expect(e("foo")).toBe("Zm9v");
    expect(e("foobar")).toBe("Zm9vYmFy");
    expect(e("fo", false, false)).toBe("Zm8");
    expect(e("??>>", true)).toBe("Pz8-Pg==");
    const d = decodeBase64("Zm9vYmFy");
    expect(d.ok && new TextDecoder().decode(d.bytes)).toBe("foobar");
    const noPad = decodeBase64("Zm8");
    expect(noPad.ok && new TextDecoder().decode(noPad.bytes)).toBe("fo");
    const web64 = decodeBase64("Pz8-Pg");
    expect(web64.ok && new TextDecoder().decode(web64.bytes)).toBe("??>>");
    expect(decodeBase64("Zm9v\nYmFy").ok).toBe(true);
    expect(decodeBase64("Zm9*").ok).toBe(false);
    expect(decodeBase64("Z").ok).toBe(false);
    expect(decodeBase64("Zg===").ok).toBe(false);
  });
  it("handles Unicode and binary", () => {
    const r = run(enc, "base64-encode-decode", { mode: "encode", text: "héllo 🌍", variant: "std" });
    expect(text(r)).toBe(Buffer.from("héllo 🌍").toString("base64"));
    expect(text(run(enc, "base64-encode-decode", { mode: "decode", text: Buffer.from("héllo 🌍").toString("base64") }))).toBe("héllo 🌍");
    const bin = run(enc, "base64-encode-decode", { mode: "decode", text: "/9j/4AAQ" });
    expect(primary(bin)).toMatch(/Binary data/);
    expect(errs(run(enc, "base64-encode-decode", { mode: "decode", text: "!!!" }))).toMatch(/isn't a Base64 character/);
  });
  it("URL-encodes and decodes", () => {
    const u = (mode: string, t: string, extra = {}) => run(enc, "url-encode-decode", { mode, text: t, ...extra });
    expect(text(u("component", "a b&c=d/é?"))).toBe("a%20b%26c%3Dd%2F%C3%A9%3F");
    expect(text(u("full", "https://x.com/a b?q=é"))).toBe("https://x.com/a%20b?q=%C3%A9");
    expect(text(u("form", "a b+c"))).toBe("a+b%2Bc");
    expect(text(u("decode", "a%20b%26c", { plus: "no" }))).toBe("a b&c");
    expect(text(u("decode", "a+b%2Bc", { plus: "yes" }))).toBe("a b+c");
    expect(text(u("decode", "a+b", { plus: "no" }))).toBe("a+b");
    expect(errs(u("decode", "100%", { plus: "no" }))).toMatch(/Malformed % sequence at position 4/);
    expect(errs(u("decode", "%E0%A4%A", { plus: "no" }))).toMatch(/Malformed/);
    expect(errs(u("decode", "%FF", { plus: "no" }))).toMatch(/valid UTF-8/);
  });
  it("generates well-formed UUIDs", () => {
    const rand = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
    const v4 = uuidV4(rand);
    expect(v4).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const v7 = uuidV7(rand, 0x018f1234abcd);
    expect(v7.startsWith("018f1234-abcd-7")).toBe(true);
    expect(v7).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const r = run(enc, "uuid-generator", { count: 5, version: "v4", case: "lower", hyphens: "yes" }, makeContext());
    const list = text(r).split("\n");
    expect(list).toHaveLength(5);
    expect(new Set(list).size).toBe(5);
    expect(text(run(enc, "uuid-generator", { count: 2, version: "v4", case: "upper", hyphens: "no" })).split("\n")[0]).toMatch(/^[0-9A-F]{32}$/);
    const ordered = text(run(enc, "uuid-generator", { count: 20, version: "v7", case: "lower", hyphens: "yes" }, makeContext({ nowMs: 1_700_000_000_000 }))).split("\n");
    expect([...ordered].sort()).toEqual(ordered);
  });
});

describe("JWT decoder", () => {
  const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: "1234567890", name: "Jane", iat: 1516239022, exp: 1516242622 })}.c2lnbmF0dXJl`;
  it("decodes header and payload without verifying", () => {
    const r = run(enc, "jwt-decoder", { token }, makeContext({ nowMs: Date.UTC(2026, 0, 1) }));
    expect(sec(r, "Algorithm")).toBe("HS256");
    expect(text(r, 1)).toContain('"name": "Jane"');
    const claims = out(r).table!.rows.map((x) => String(typeof x[1] === "object" ? (x[1] as { value: string }).value : x[1]));
    expect(claims[0]).toContain("18 Jan 2018");
    expect(out(r).notes?.join(" ")).toMatch(/NOT been verified/);
    expect(out(r).notes?.join(" ")).toMatch(/has expired/);
  });
  it("accepts a Bearer prefix and flags alg none", () => {
    const none = `${b64u({ alg: "none" })}.${b64u({ a: 1 })}.`;
    const r = run(enc, "jwt-decoder", { token: `Bearer ${none}` });
    expect(out(r).notes?.join(" ")).toMatch(/unsigned/);
  });
  it("rejects malformed tokens clearly", () => {
    expect(errs(run(enc, "jwt-decoder", { token: "abc.def" }))).toMatch(/three parts/);
    expect(errs(run(enc, "jwt-decoder", { token: "a.b.c.d.e" }))).toMatch(/encrypted/);
    expect(errs(run(enc, "jwt-decoder", { token: "!!!.e30.sig" }))).toMatch(/header isn't valid Base64URL/);
    expect(errs(run(enc, "jwt-decoder", { token: `${Buffer.from("not json").toString("base64url")}.e30.x` }))).toMatch(/header decoded, but it isn't valid JSON/);
  });
});

describe("Unix timestamps", () => {
  it("converts timestamps to dates", () => {
    const r = run(enc, "unix-timestamp-converter", { mode: "to-date", timestamp: 1700000000, unit: "auto", zone: "utc" });
    expect(primary(r)).toBe("Tue, 14 Nov 2023 22:13:20 UTC");
    expect(sec(r, "ISO 8601")).toBe("2023-11-14T22:13:20.000Z");
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "to-date", timestamp: 1700000000000, unit: "auto", zone: "utc" }))).toBe("Tue, 14 Nov 2023 22:13:20 UTC");
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "to-date", timestamp: 0, unit: "s", zone: "utc" }))).toBe("Thu, 1 Jan 1970 00:00:00 UTC");
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "to-date", timestamp: -1, unit: "s", zone: "utc" }))).toBe("Wed, 31 Dec 1969 23:59:59 UTC");
    expect(errs(run(enc, "unix-timestamp-converter", { mode: "to-date", timestamp: 9e15, unit: "s", zone: "utc" }))).toMatch(/outside the range/);
    const local = run(enc, "unix-timestamp-converter", { mode: "to-date", timestamp: 1700000000, unit: "s", zone: "local" }, makeContext({ timeZone: "Asia/Kolkata" }));
    expect(sec(local, "Your local time (Asia/Kolkata)")).toBe("Wed, 15 Nov 2023 03:43:20 (UTC+05:30)");
  });
  it("converts dates to timestamps and reads the clock", () => {
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "to-timestamp", date: "2023-11-14", time: "22:13", seconds: 20, zone: "utc" }))).toBe(1700000000);
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "to-timestamp", date: "2024-02-29", time: "00:00", zone: "utc" }))).toBe(1709164800);
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "to-timestamp", date: "2024-01-01", time: "05:30", zone: "local" }, makeContext({ timeZone: "Asia/Kolkata" })))).toBe(1704067200);
    expect(errs(run(enc, "unix-timestamp-converter", { mode: "to-timestamp", date: "2024-03-10", time: "02:30", zone: "local" }, makeContext({ timeZone: "America/New_York" })))).toMatch(/doesn't exist/);
    expect(errs(run(enc, "unix-timestamp-converter", { mode: "to-timestamp", date: "2024-02-30", time: "00:00", zone: "utc" }))).toMatch(/real calendar/);
    expect(primary(run(enc, "unix-timestamp-converter", { mode: "now", zone: "utc" }, ctx))).toBe(Date.UTC(2026, 0, 1, 12) / 1000);
  });
});

describe("HTML and CSS formatting", () => {
  it("indents nested HTML and keeps inline content together", () => {
    const out1 = formatHtml("<div><p>Hello <b>world</b>!</p><ul><li>One<li>Two</ul></div>").output;
    expect(out1).toBe("<div>\n  <p>Hello <b>world</b>!</p>\n  <ul>\n    <li>One</li>\n    <li>Two</li>\n  </ul>\n</div>");
  });
  it("preserves raw elements, comments, doctype and attributes", () => {
    const src = '<!DOCTYPE html><html><head><title>T</title><style>a{color:red}</style><script>\n  if (a < b) { x(); }\n</script></head><body><!-- c --><pre>  keep\n  me </pre><img src="a>b.png" alt="x"></body></html>';
    const r = formatHtml(src);
    expect(r.output).toContain("<!DOCTYPE html>");
    expect(r.output).toContain("<pre>  keep\n  me </pre>");
    expect(r.output).toContain('<img src="a>b.png" alt="x">');
    expect(r.output).toContain("    <title>T</title>");
    expect(r.output).toContain("if (a < b) { x(); }");
    expect(r.output).toContain("<!-- c -->");
    expect(r.warnings).toEqual([]);
  });
  it("reports structure problems without failing", () => {
    expect(formatHtml("<div><span>x</div>").warnings.join(" ")).toMatch(/span> was never closed/);
    expect(formatHtml("text</p>").warnings.join(" ")).toMatch(/no matching opening tag/);
    expect(errs(run(web, "html-formatter", { html: "", indent: "2" }))).toMatch(/empty/);
    expect(text(run(web, "html-formatter", { html: "<p>a</p>", indent: "4" }))).toBe("<p>a</p>");
  });
  it("formats and minifies CSS", () => {
    const css = "a,b{color:red;margin:0 auto}@media (max-width:600px){.x{display:none}}/* hi */\n.y{background:url(data:image/png;base64,AA==);content:\"a, b\"}";
    const f = formatCss(css);
    expect(f.ok && f.output).toBe('a,\nb {\n  color: red;\n  margin: 0 auto;\n}\n\n@media (max-width:600px) {\n  .x {\n    display: none;\n  }\n}\n\n/* hi */\n.y {\n  background: url(data:image/png;base64,AA==);\n  content: "a, b";\n}');
    const m = minifyCss(css);
    expect(m.ok && m.output).toBe('a,b{color:red;margin:0 auto}@media (max-width:600px){.x{display:none}}.y{background:url(data:image/png;base64,AA==);content:"a, b"}');
    expect(formatCss("a{color:red").ok).toBe(false);
    expect(formatCss("a{}}").ok).toBe(false);
    expect(formatCss('a{content:"x}').ok).toBe(false);
    expect(errs(run(web, "css-formatter", { css: "a{", mode: "format", indent: "2" }))).toMatch(/never closed/);
  });
});

describe("colour converter", () => {
  it("parses and converts", () => {
    const r = run(web, "color-converter", { color: "#3b82f6" });
    expect(primary(r)).toBe("#3B82F6");
    expect(sec(r, "RGB")).toBe("rgb(59, 130, 246)");
    expect(sec(r, "HSL")).toBe("hsl(217, 91%, 60%)");
    expect(primary(run(web, "color-converter", { color: "rgb(255, 0, 0)" }))).toBe("#FF0000");
    expect(primary(run(web, "color-converter", { color: "hsl(120, 100%, 25%)" }))).toBe("#008000");
    expect(primary(run(web, "color-converter", { color: "f80" }))).toBe("#FF8800");
    expect(primary(run(web, "color-converter", { color: "rgb(0 128 255 / 50%)" }))).toBe("#0080FF80");
    expect(primary(run(web, "color-converter", { color: "Teal" }))).toBe("#008080");
    expect(sec(run(web, "color-converter", { color: "#fff" }), "Contrast on black")).toBe("21:1 — AAA");
  });
  it("rejects bad colours", () => {
    expect(errs(run(web, "color-converter", { color: "rgb(300,0,0)" }))).toMatch(/Red must be between 0 and 255/);
    expect(errs(run(web, "color-converter", { color: "#12" }))).toMatch(/Couldn't read/);
    expect(errs(run(web, "color-converter", { color: "hsl(10, 200%, 50%)" }))).toMatch(/Saturation/);
    expect(parseColor("rgb(1,2)").ok).toBe(false);
    expect(toHex({ r: 1, g: 2, b: 3, a: 1 })).toBe("#010203");
    expect(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })).toBe(21);
  });
});

describe("text tools", () => {
  it("counts words, characters and sentences", () => {
    const r = run(txt, "word-counter", { text: "Hello world! This is a test.\n\nSecond paragraph here." });
    expect(primary(r)).toBe(9);
    expect(sec(r, "Sentences")).toBe(3);
    expect(sec(r, "Paragraphs")).toBe(2);
    expect(sec(r, "Lines")).toBe(3);
    expect(primary(run(txt, "word-counter", { text: "" }))).toBe(0);
    expect(primary(run(txt, "word-counter", { text: "don't stop-gap 3.5" }))).toBe(3);
    expect(primary(run(txt, "word-counter", { text: "Well — it's 1,000 days, e-mail me" }))).toBe(6);
    expect(primary(run(txt, "word-counter", { text: "日本語のテキスト" }))).toBeGreaterThan(1);
    expect(sec(run(txt, "word-counter", { text: "a😀b" }), "Characters")).toBe(3);
    expect(sec(run(txt, "word-counter", { text: "a b" }), "Characters (no spaces)")).toBe(2);
  });
  it("converts case", () => {
    const r = run(txt, "case-converter", { text: "helloWorld_foo-bar XMLHttpRequest" });
    const get = (label: string) => out(r).texts!.find((t) => t.label === label)!.value;
    expect(get("snake_case")).toBe("hello_world_foo_bar_xml_http_request");
    expect(get("camelCase")).toBe("helloWorldFooBarXmlHttpRequest");
    expect(get("PascalCase")).toBe("HelloWorldFooBarXmlHttpRequest");
    expect(get("kebab-case")).toBe("hello-world-foo-bar-xml-http-request");
    expect(get("CONSTANT_CASE")).toBe("HELLO_WORLD_FOO_BAR_XML_HTTP_REQUEST");
    const s = run(txt, "case-converter", { text: "the quick brown fox. it jumps!" });
    expect(out(s).texts!.find((t) => t.label === "Sentence case")!.value).toBe("The quick brown fox. It jumps!");
    expect(out(s).texts!.find((t) => t.label === "Title Case")!.value).toBe("The Quick Brown Fox. It Jumps!");
    expect(errs(run(txt, "case-converter", { text: "  " }))).toMatch(/Type or paste/);
  });
});

describe("regex tester", () => {
  it("finds matches, groups and positions", () => {
    const r = run(rx, "regex-tester", { pattern: "(\\d+)-(\\d+)", flags: "g", text: "a 10-20 b 3-4" });
    expect(primary(r)).toBe(2);
    expect(out(r).table!.rows[1]).toEqual(["2", "10", "3-4", "3", "4"]);
    expect(out(r).highlight!.ranges).toEqual([[2, 7], [10, 13]]);
    expect(primary(run(rx, "regex-tester", { pattern: "o", flags: "", text: "foo boo" }))).toBe(1);
    expect(primary(run(rx, "regex-tester", { pattern: "O", flags: "gi", text: "foo boo" }))).toBe(4);
    expect(primary(run(rx, "regex-tester", { pattern: "x", flags: "g", text: "abc" }))).toBe(0);
  });
  it("supports named groups, empty matches and replacements", () => {
    expect(primary(run(rx, "regex-tester", { pattern: "(?<y>\\d{4})", flags: "g", text: "2024 and 1999" }))).toBe(2);
    expect(primary(run(rx, "regex-tester", { pattern: "a*", flags: "g", text: "baa" }))).toBe(3);
    const rep = run(rx, "regex-tester", { pattern: "(\\w+)@(\\w+)", flags: "g", text: "me@x you@y", replacement: "$2:$1" });
    expect(out(rep).texts![0].value).toBe("x:me y:you");
  });
  it("rejects invalid patterns, flags and huge inputs", () => {
    expect(errs(run(rx, "regex-tester", { pattern: "(", flags: "g", text: "a" }))).toMatch(/Invalid pattern/);
    expect(errs(run(rx, "regex-tester", { pattern: "a", flags: "gg", text: "a" }))).toMatch(/repeated/);
    expect(errs(run(rx, "regex-tester", { pattern: "a", flags: "z", text: "a" }))).toMatch(/isn't valid/);
    expect(errs(run(rx, "regex-tester", { pattern: "a", flags: "uv", text: "a" }))).toMatch(/can't be used together/);
    expect(errs(run(rx, "regex-tester", { pattern: "a", flags: "g", text: "a".repeat(100001) }))).toMatch(/longer than/);
    expect(out(run(rx, "regex-tester", { pattern: "a", flags: "g", text: "a".repeat(5000) })).notes?.join(" ")).toMatch(/first 1,000/);
  });
});

describe("QR code generator", () => {
  function decode(matrix: boolean[][]) {
    const scale = 6, quiet = 4, size = (matrix.length + quiet * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    matrix.forEach((row, r) => row.forEach((dark, c) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
        const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }));
    return jsQR(data, size, size)?.data;
  }
  it("produces codes that a real decoder reads back", () => {
    for (const [txt, level] of [["https://example.com/a?b=c&d=e", "M"], ["Hello", "L"], ["héllo wörld ✓ 日本語", "Q"], ["x".repeat(300), "H"]] as const) {
      expect(decode(makeMatrix(txt, level)), `${txt.slice(0, 10)} ${level}`).toBe(txt);
    }
  });
  it("round-trips every payload type through a real decoder", () => {
    const payloads = [
      wifiPayload({ ssid: "Cafe;Net", password: 'p:a,s"s\\w', security: "WPA", hidden: true }),
      upiPayload({ vpa: "shop@okbank", name: "Ravi Store", amount: "150.50", note: "Order #12" }),
      vcardPayload({ first: "Ada", last: "Lovelace", org: "Analytical, Co", title: "", phone: "+91 98765 43210", email: "ada@example.com", url: "", street: "", city: "London", country: "UK" }),
      smsPayload("+91 98765 43210", "Hello there"),
      emailPayload("a@b.co", "Hi there", "x & y"),
    ];
    for (const p of payloads) expect(decode(makeMatrix(p, "M")), p.slice(0, 20)).toBe(p);
  });
  it("rejects data that does not fit", () => {
    expect(() => makeMatrix("x".repeat(3000), "H")).toThrow();
  });
});
