import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { engines as hashEngines } from "@/engines/developer/hash";
import { engines as diffEngines, diffLines } from "@/engines/developer/diff";
import { engines as cronEngines, CronError, describeCron, nextRuns, parseCron } from "@/engines/developer/cron";
import { engines as more, decodeEntities, encodeEntities, slugify } from "@/engines/developer/more";
import { errs, out, primary, run, runAsync, sec } from "./util";

describe("hash generator (verified against Node's crypto)", () => {
  const inputs = ["abc", "", "héllo ☃ 😀", "a".repeat(10_000), "line1\nline2\r\nline3", "Ünïcödé — ‘quotes’"];
  for (const text of inputs) {
    it(`matches for ${JSON.stringify(text.length > 20 ? text.slice(0, 20) + "…" : text)}`, async () => {
      const r = await runAsync(hashEngines, "hash-generator", { text, case: "lower" });
      const o = out(r);
      const node = (alg: string) => createHash(alg).update(text, "utf8").digest("hex");
      expect(JSON.stringify(o.primary.value)).toContain(node("sha256"));
      const byLabel = Object.fromEntries(o.texts!.map((t) => [t.label.split(" ")[0], t.value]));
      expect(byLabel["SHA-512"]).toBe(node("sha512"));
      expect(byLabel["SHA-384"]).toBe(node("sha384"));
      expect(byLabel["SHA-1"]).toBe(node("sha1"));
    });
  }
  it("known vector and uppercase option", async () => {
    const lower = await runAsync(hashEngines, "hash-generator", { text: "abc", case: "lower" });
    expect(primary(lower)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(primary(await runAsync(hashEngines, "hash-generator", { text: "abc", case: "upper" }))).toBe("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD");
  });
  it("a one-character change gives a completely different hash; the empty string has the well-known hash", async () => {
    const a = String(primary(await runAsync(hashEngines, "hash-generator", { text: "abc", case: "lower" })));
    const b = String(primary(await runAsync(hashEngines, "hash-generator", { text: "abd", case: "lower" })));
    expect(a).not.toBe(b);
    expect([...a].filter((ch, i) => ch !== b[i]).length).toBeGreaterThan(40); // avalanche: most hex digits differ
    expect(primary(await runAsync(hashEngines, "hash-generator", { text: "", case: "lower" }))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("reports the byte length in UTF-8, not the character count", async () => {
    const r = await runAsync(hashEngines, "hash-generator", { text: "é😀", case: "lower" });
    expect(sec(r, "Input length")).toBe("2 characters, 6 bytes (UTF-8)");
  });
  it("refuses oversized input", async () => {
    expect(errs(await runAsync(hashEngines, "hash-generator", { text: "x".repeat(1_000_001), case: "lower" }))).toMatch(/over 1,000,000/);
  });
});

describe("text diff", () => {
  const norm = (s: string) => s;
  const apply = (ops: ReturnType<typeof diffLines>) => ({ a: ops.filter((o) => o.kind !== "add").map((o) => o.text), b: ops.filter((o) => o.kind !== "del").map((o) => o.text) });
  /** brute-force longest common subsequence length */
  const lcs = (a: string[], b: string[]) => { const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) t[i][j] = a[i - 1] === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]); return t[a.length][b.length]; };
  it("produces a minimal, reversible edit script", () => {
    const ops = diffLines(["apple", "banana", "cherry", "date"], ["apple", "blueberry", "cherry", "date", "elderberry"], norm);
    expect(ops.map((o) => `${o.kind}:${o.text}`)).toEqual(["same:apple", "del:banana", "add:blueberry", "same:cherry", "same:date", "add:elderberry"]);
  });
  it("is correct for randomised inputs: reconstructs both sides and keeps a longest common subsequence", () => {
    let seed = 42;
    const rnd = (n: number) => (seed = (seed * 1664525 + 1013904223) % 4294967296) % n;
    for (let t = 0; t < 300; t++) {
      const mk = () => Array.from({ length: rnd(9) }, () => "abcd"[rnd(4)]);
      const a = mk(), b = mk();
      const ops = diffLines(a, b, norm);
      const back = apply(ops);
      expect(back.a, JSON.stringify([a, b])).toEqual(a);
      expect(back.b).toEqual(b);
      expect(ops.filter((o) => o.kind === "same").length).toBe(lcs(a, b));
    }
  });
  it("handles empty sides and identical texts", () => {
    expect(diffLines([], ["x"], norm)).toEqual([{ kind: "add", text: "x" }]);
    expect(diffLines(["x"], [], norm)).toEqual([{ kind: "del", text: "x" }]);
    expect(diffLines([], [], norm)).toEqual([]);
  });
  const d = (v: Record<string, string>) => run(diffEngines, "text-diff-checker", { view: "context", ignore_space: "no", ignore_case: "no", ...v });
  it("engine summary and marked output", () => {
    const r = d({ original: "apple\nbanana\ncherry\ndate", changed: "apple\nblueberry\ncherry\ndate\nelderberry" });
    expect(primary(r)).toBe("2 lines added, 1 removed");
    expect(sec(r, "Lines unchanged")).toBe(3);
    expect(sec(r, "Line similarity")).toBe("66.7%"); // 2 × 3 ÷ (4 + 5) = 0.667
    expect(out(r).texts![0].value).toBe("  apple\n- banana\n+ blueberry\n  cherry\n  date\n+ elderberry");
  });
  it("identical texts, windows line endings and trailing newline", () => {
    expect(primary(d({ original: "a\nb\n", changed: "a\r\nb" }))).toBe("The two texts are identical");
    expect(out(d({ original: "a\nb", changed: "a\nb" })).texts ?? []).toEqual([]);
  });
  it("ignore options", () => {
    expect(primary(d({ original: "Hello  World", changed: "hello world", ignore_case: "yes", ignore_space: "yes" }))).toBe("The two texts are identical");
    expect(primary(d({ original: "Hello", changed: "hello" }))).toBe("1 line added, 1 removed");
    expect(primary(d({ original: "a  b", changed: "a b", ignore_space: "yes" }))).toBe("The two texts are identical");
  });
  it("context view collapses distant unchanged lines; full view keeps them", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const changed = [...lines]; changed[9] = "CHANGED";
    const ctxView = out(d({ original: lines.join("\n"), changed: changed.join("\n") })).texts![0].value;
    expect(ctxView).toContain("  …");
    expect(ctxView).not.toContain("line 1\n");
    expect(ctxView).toContain("- line 10\n+ CHANGED");
    const full = out(d({ original: lines.join("\n"), changed: changed.join("\n"), view: "full" })).texts![0].value;
    expect(full.split("\n")).toHaveLength(21);
  });
  it("limits size", () => {
    expect(errs(d({ original: Array(2501).fill("x").join("\n"), changed: "x" }))).toMatch(/at most 2,500 lines/);
  });
});

describe("cron expression explainer", () => {
  const stamps = (expr: string, from: string, n = 10) => nextRuns(parseCron(expr).fields, Date.parse(`${from}T00:00:00Z`), n).map((ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " "));
  const explain = (expression: string, start = "2026-01-01") => run(cronEngines, "cron-expression-explainer", { expression, start });
  const desc = (expr: string) => describeCron(parseCron(expr).fields);

  it("weekday mornings (2026-01-01 is a Thursday)", () => {
    expect(stamps("30 9 * * 1-5", "2026-01-01")).toEqual(["2026-01-01 09:30", "2026-01-02 09:30", "2026-01-05 09:30", "2026-01-06 09:30", "2026-01-07 09:30", "2026-01-08 09:30", "2026-01-09 09:30", "2026-01-12 09:30", "2026-01-13 09:30", "2026-01-14 09:30"]);
    expect(primary(explain("30 9 * * 1-5"))).toBe("At 09:30, on Monday through Friday");
  });
  it("steps, lists, names and macros", () => {
    expect(stamps("*/15 * * * *", "2026-01-01", 5)).toEqual(["2026-01-01 00:00", "2026-01-01 00:15", "2026-01-01 00:30", "2026-01-01 00:45", "2026-01-01 01:00"]);
    expect(stamps("0 0 * JAN MON", "2026-01-01", 5)).toEqual(["2026-01-05 00:00", "2026-01-12 00:00", "2026-01-19 00:00", "2026-01-26 00:00", "2027-01-04 00:00"]);
    expect(stamps("0 0 * * 7", "2026-01-01", 2)).toEqual(["2026-01-04 00:00", "2026-01-11 00:00"]); // 7 = Sunday
    expect(stamps("0 0 * * 0", "2026-01-01", 1)).toEqual(["2026-01-04 00:00"]);
    expect(stamps("5 4 * * sun", "2026-01-01", 1)).toEqual(["2026-01-04 04:05"]);
    expect(parseCron("@daily").normalised).toBe("0 0 * * *");
    expect(parseCron("@HOURLY").normalised).toBe("0 * * * *");
    expect(parseCron("  0   0  1  1  *  ").normalised).toBe("0 0 1 1 *");
    expect(stamps("0 12 1-3 * *", "2026-01-01", 4)).toEqual(["2026-01-01 12:00", "2026-01-02 12:00", "2026-01-03 12:00", "2026-02-01 12:00"]);
    expect(stamps("10-50/20 * * * *", "2026-01-01", 4)).toEqual(["2026-01-01 00:10", "2026-01-01 00:30", "2026-01-01 00:50", "2026-01-01 01:10"]);
    expect(stamps("5/20 * * * *", "2026-01-01", 4)).toEqual(["2026-01-01 00:05", "2026-01-01 00:25", "2026-01-01 00:45", "2026-01-01 01:05"]);
  });
  it("when both day fields are restricted the job runs when EITHER matches (Vixie cron)", () => {
    const runs = stamps("0 0 13 * 5", "2026-01-01", 6);
    expect(runs).toEqual(["2026-01-02 00:00", "2026-01-09 00:00", "2026-01-13 00:00", "2026-01-16 00:00", "2026-01-23 00:00", "2026-01-30 00:00"]);
    // a "*"-prefixed day field switches to AND: "*/2" (odd days) AND Monday → only Mondays that fall on an odd date
    expect(stamps("0 0 */2 * 1", "2026-01-01", 3)).toEqual(["2026-01-05 00:00", "2026-01-19 00:00", "2026-02-09 00:00"]);
    expect(stamps("0 0 * * 1", "2026-01-01", 2)).toEqual(["2026-01-05 00:00", "2026-01-12 00:00"]); // plain * and a weekday: every Monday
    expect(stamps("0 0 15 * *", "2026-01-01", 2)).toEqual(["2026-01-15 00:00", "2026-02-15 00:00"]);
  });
  it("finds leap days and reports schedules that never happen", () => {
    expect(stamps("0 0 29 2 *", "2026-01-01", 1)).toEqual(["2028-02-29 00:00"]);
    expect(stamps("0 0 30 2 *", "2026-01-01")).toEqual([]);
    expect(sec(explain("0 0 30 2 *"), "Next run")).toBe("none in the next 8 years");
    expect(stamps("0 0 31 4,6,9,11 *", "2026-01-01")).toEqual([]);
  });
  it("describes common schedules in plain English", () => {
    expect(desc("* * * * *")).toBe("Every minute, every day");
    expect(desc("*/15 * * * *")).toBe("Every 15 minutes, every day");
    expect(desc("0 * * * *")).toBe("At the start of every hour, every day");
    expect(desc("30 * * * *")).toBe("At minute 30 past every hour, every day");
    expect(desc("0 0 * * *")).toBe("At 00:00, every day");
    expect(desc("0 9,17 * * *")).toBe("At 09:00 and 17:00, every day");
    expect(desc("0 */6 * * *")).toBe("At minute 0 past every 6th hour, every day");
    expect(desc("30 9 * * 1-5")).toBe("At 09:30, on Monday through Friday");
    expect(desc("0 0 * * 6,0")).toBe("At 00:00, on Saturday and Sunday");
    expect(desc("0 0 1 * *")).toBe("At 00:00, on day 1 of the month");
    expect(desc("0 0 1,15 * *")).toBe("At 00:00, on day 1 and 15 of the month");
    expect(desc("0 0 1 1 *")).toBe("At 00:00, on day 1 of the month in January");
    expect(desc("0 0 * 1-3 *")).toBe("At 00:00, every day in January through March");
    expect(desc("0 0 13 * 5")).toBe("At 00:00, on day 13 of the month and on Friday");
    expect(desc("0,30 * * * *")).toBe("At minutes 0 and 30 past every hour, every day");
  });
  it("rejects unsupported or invalid expressions with a specific reason", () => {
    const bad = (e: string) => { try { parseCron(e); } catch (x) { if (x instanceof CronError) return x.message; throw x; } throw new Error(`"${e}" should be rejected`); };
    expect(bad("* * * * * *")).toMatch(/6 fields.*seconds/);
    expect(bad("* * * *")).toMatch(/exactly 5 fields.*You entered 4/);
    expect(bad("61 * * * *")).toMatch(/Field 1 \(minute\): 61 is outside the minute range 0–59/);
    expect(bad("0 24 * * *")).toMatch(/Field 2 \(hour\).*0–23/);
    expect(bad("0 0 0 * *")).toMatch(/Field 3 \(day of month\).*1–31/);
    expect(bad("0 0 * 13 *")).toMatch(/Field 4 \(month\)/);
    expect(bad("0 0 * * 8")).toMatch(/Field 5 \(day of week\)/);
    expect(bad("*/0 * * * *")).toMatch(/step.*1 or more/);
    expect(bad("5-1 * * * *")).toMatch(/runs backwards/);
    expect(bad("1,,2 * * * *")).toMatch(/stray comma/);
    expect(bad("0 0 L * *")).toMatch(/Quartz/);
    expect(bad("0 0 * * 5#2")).toMatch(/Quartz/);
    expect(bad("? * * * *")).toMatch(/Quartz/);
    expect(bad("0 0 * FOO *")).toMatch(/isn't a valid month/);
    expect(bad("@reboot")).toMatch(/startup/);
    expect(bad("")).toMatch(/exactly 5 fields/);
    expect(bad("1/2/3 * * * *")).toMatch(/more than one "\/"/);
  });
  it("accepts month and weekday names including those containing L or W", () => {
    expect(stamps("0 0 * JUL WED", "2026-01-01", 1)).toEqual(["2026-07-01 00:00"]); // 2026-07-01 is a Wednesday
    expect(stamps("0 0 * * MON-FRI", "2026-01-01", 2)).toEqual(["2026-01-01 00:00", "2026-01-02 00:00"]);
  });
  it("engine output: description, expansion table and run list; errors are field messages", () => {
    const r = explain("30 9 * * 1-5");
    expect(primary(r)).toBe("At 09:30, on Monday through Friday");
    expect(out(r).table!.rows[0]).toEqual(["minute", "30", "30"]);
    expect(out(r).table!.rows[4]).toEqual(["day of week", "1-5", "1, 2, 3, 4, 5"]);
    expect(out(r).texts![0].value.split("\n")).toHaveLength(10);
    expect(sec(r, "First run on or after 2026-01-01")).toBe("2026-01-01 09:30 UTC");
    expect(errs(explain("61 * * * *"))).toMatch(/^expression: Field 1/);
    expect(errs(run(cronEngines, "cron-expression-explainer", { expression: "* * * * *", start: "not-a-date" }))).toMatch(/valid date/);
  });
  it("without a start date it uses the supplied current time (strictly in the future)", () => {
    const r = run(cronEngines, "cron-expression-explainer", { expression: "0 * * * *", start: "" });
    expect(sec(r, "Next run")).toBe("2026-01-01 13:00 UTC"); // test clock is 2026-01-01 12:00 UTC
    const r2 = run(cronEngines, "cron-expression-explainer", { expression: "30 12 * * *", start: "" });
    expect(sec(r2, "Next run")).toBe("2026-01-01 12:30 UTC");
  });
});

describe("HTML entities", () => {
  it("decodes numeric and common named entities, leaves the rest, and never double-decodes", () => {
    const { out: text, decoded, unknown } = decodeEntities("&amp;&lt;&#169;&#xA9;&euro;&bogus;&#0;&#xD800;&#1114112;");
    expect(text).toBe("&<©©€&bogus;&#0;&#xD800;&#1114112;");
    expect(decoded).toBe(5);
    expect(unknown).toEqual(["&bogus;", "&#0;", "&#xD800;", "&#1114112;"]);
    expect(decodeEntities("&amp;lt;").out).toBe("&lt;");
    expect(decodeEntities("&AMP;").out).toBe("&AMP;"); // entity names are case-sensitive
    expect(decodeEntities("AT&T and a&b; ").out).toBe("AT&T and a&b; ");
    expect(decodeEntities("&#128512;&#x1F600;").out).toBe("😀😀");
  });
  it("encodes the five special characters, optionally all non-ASCII", () => {
    expect(encodeEntities(`<a href="x">Tom & 'J'</a>`, false)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;J&#39;&lt;/a&gt;");
    expect(encodeEntities("é©", false)).toBe("é©");
    expect(encodeEntities("é©😀", true)).toBe("&#233;&#169;&#128512;");
    expect(encodeEntities("plain text 123", true)).toBe("plain text 123");
  });
  it("round-trips arbitrary text", () => {
    for (const t of ["", "<script>alert('x')</script>", "a & b &amp; c", "&lt;already&gt;", "naïve café ☃ 😀", `"quoted" & 'single'`]) {
      for (const all of [false, true]) expect(decodeEntities(encodeEntities(t, all)).out, JSON.stringify(t)).toBe(t);
    }
  });
  it("engine: both directions and counts", () => {
    const e = run(more, "html-entity-encoder-decoder", { mode: "encode", text: "<b>Tom & Jerry</b>", scope: "minimal" });
    expect(out(e).texts![0].value).toBe("&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;");
    expect(sec(e, "Characters escaped")).toBe(5);
    const d = run(more, "html-entity-encoder-decoder", { mode: "decode", text: "Tom &amp; Jerry &copy; &nope;" });
    expect(out(d).texts![0].value).toBe("Tom & Jerry © &nope;");
    expect(sec(d, "Entities decoded")).toBe(2);
    expect(sec(d, "Left unchanged (not recognised)")).toBe("&nope;");
    expect(errs(run(more, "html-entity-encoder-decoder", { mode: "encode", text: "x".repeat(500_001), scope: "minimal" }))).toMatch(/over 500,000/);
  });
});

describe("slug generator", () => {
  const sl = (t: string, o: Partial<{ separator: string; lowercase: boolean; maxLength: number }> = {}) => slugify(t, { separator: "-", lowercase: true, ...o });
  it("slugifies realistic titles", () => {
    expect(sl("10 Crème Brûlée Tips & Tricks — Café Edition!")).toBe("10-creme-brulee-tips-and-tricks-cafe-edition");
    expect(sl("  Hello,   World!!  ")).toBe("hello-world");
    expect(sl("Straße und Ærø")).toBe("strasse-und-aero");
    expect(sl("It's a dog's life")).toBe("its-a-dogs-life");
    expect(sl("C++ vs C#")).toBe("c-vs-c");
    expect(sl("2026/10/13 — report_v2.pdf")).toBe("2026-10-13-report-v2-pdf");
    expect(sl("Ǆ Łódź Đurđevdan")).toMatch(/^dz?|^ǆ|^/);
  });
  it("options: separator, case, maximum length (on a word boundary)", () => {
    expect(sl("Hello World", { separator: "_" })).toBe("hello_world");
    expect(sl("Hello World", { lowercase: false })).toBe("Hello-World");
    expect(sl("10 Creme Brulee Tips and Tricks", { maxLength: 20 })).toBe("10-creme-brulee-tips");
    expect(sl("A very long title with many words", { maxLength: 12 })).toBe("a-very-long");
    expect(sl("Supercalifragilistic", { maxLength: 8 })).toBe("supercal");
    expect(sl("a-b-c", { separator: "_" })).toBe("a_b_c");
  });
  it("never starts or ends with a separator", () => {
    for (const t of ["---x---", "!!x!!", "__x__", " x "]) { expect(sl(t)).toBe("x"); expect(sl(t, { separator: "_" })).toBe("x"); }
  });
  it("engine reports non-Latin-only text", () => {
    expect(errs(run(more, "slug-generator", { text: "नमस्ते", separator: "-", case: "lower" }))).toMatch(/No letters or digits are left/);
    expect(primary(run(more, "slug-generator", { text: "Crème Brûlée", separator: "-", case: "lower" }))).toBe("creme-brulee");
    expect(sec(run(more, "slug-generator", { text: "Crème Brûlée", separator: "-", case: "lower" }), "Example URL")).toBe("https://example.com/blog/creme-brulee");
  });
});

describe("URL parser", () => {
  const parse = (url: string) => run(more, "url-parser", { url });
  const part = (r: ReturnType<typeof parse>, name: string) => out(r).table!.rows.find((x) => x[0] === name)![1];
  it("splits every component", () => {
    const r = parse("https://user@example.com:8080/docs/page?name=Ada%20Lovelace&tag=a&tag=b#section-2");
    expect(primary(r)).toBe("example.com");
    expect(part(r, "Scheme")).toBe("https");
    expect(part(r, "Username")).toBe("user");
    expect(part(r, "Port")).toBe("8080");
    expect(part(r, "Path")).toBe("/docs/page");
    expect(part(r, "Query string")).toBe("?name=Ada%20Lovelace&tag=a&tag=b");
    expect(part(r, "Fragment")).toBe("#section-2");
    expect(part(r, "Origin")).toBe("https://example.com:8080");
    expect(out(r).texts![0].value).toBe("name = Ada Lovelace\ntag = a\ntag = b");
    expect(out(r).notes!.join(" ")).toMatch(/Repeated parameter: tag/);
  });
  it("default ports, missing scheme, and empty query", () => {
    expect(part(parse("https://example.com/x"), "Port")).toBe("443 (default)");
    expect(part(parse("http://example.com"), "Port")).toBe("80 (default)");
    const bare = parse("example.com/x?y=1");
    expect(primary(bare)).toBe("example.com");
    expect(part(bare, "Scheme")).toBe("https");
    expect(sec(bare, "Note")).toMatch(/https:\/\/ was assumed/);
    expect(out(parse("https://example.com/")).texts ?? []).toEqual([]);
    expect(sec(parse("https://example.com/a?b=1&c="), "Query parameters")).toBe(2);
  });
  it("never echoes a password and warns about credentials", () => {
    const r = parse("https://admin:s3cret@host.com/");
    expect(JSON.stringify(out(r))).not.toContain("s3cret");
    expect(part(r, "Password")).toBe("(present)");
    expect(out(r).notes!.join(" ")).toMatch(/credentials/);
  });
  it("rejects non-URLs", () => {
    expect(errs(parse("not a url"))).toMatch(/valid URL/);
    expect(errs(parse("   "))).toMatch(/Enter a URL/);
    expect(errs(parse("http://"))).toMatch(/valid URL/);
  });
});

describe("contrast checker (WCAG 2.x)", () => {
  const ratioOf = (fg: string, bg: string) => String(primary(run(more, "contrast-checker", { foreground: fg, background: bg })));
  const verdict = (fg: string, bg: string, label: string) => sec(run(more, "contrast-checker", { foreground: fg, background: bg }), label);
  it("reference ratios", () => {
    expect(ratioOf("#000000", "#ffffff")).toBe("21.00:1");
    expect(ratioOf("#ffffff", "#ffffff")).toBe("1.00:1");
    expect(ratioOf("#ffffff", "#000000")).toBe("21.00:1"); // order does not matter
    expect(ratioOf("#767676", "#ffffff")).toBe("4.54:1"); // the lightest grey that passes AA on white
    expect(ratioOf("#aaaaaa", "#ffffff")).toBe("2.32:1");
    expect(ratioOf("#0000ff", "#ffffff")).toBe("8.59:1"); // pure blue on white
    expect(ratioOf("#ff0000", "#ffffff")).toBe("3.99:1"); // pure red on white is 3.9985:1 — truncated, never rounded up toward a pass
  });
  it("thresholds, and never rounds a near-miss up to a pass", () => {
    expect(verdict("#767676", "#fff", "Normal text — AA (4.5:1)")).toBe("Pass");
    expect(verdict("#777777", "#fff", "Normal text — AA (4.5:1)")).toBe("Fail"); // 4.48:1
    expect(ratioOf("#777777", "#fff")).toMatch(/^4\.4[78]:1$/);
    expect(verdict("#777777", "#fff", "Large text — AA (3:1)")).toBe("Pass");
    expect(verdict("#777777", "#fff", "Normal text — AAA (7:1)")).toBe("Fail");
    expect(verdict("#595959", "#fff", "Normal text — AAA (7:1)")).toBe("Pass"); // 7.0:1
    expect(verdict("#aaaaaa", "#fff", "Large text — AA (3:1)")).toBe("Fail");
    expect(verdict("#000", "#fff", "Graphics and UI components — AA (3:1)")).toBe("Pass");
  });
  it("accepts rgb(), hsl() and names, and blends translucent colours", () => {
    expect(ratioOf("rgb(0, 0, 0)", "white")).toBe("21.00:1");
    expect(ratioOf("hsl(0, 0%, 100%)", "black")).toBe("21.00:1");
    expect(ratioOf("rgba(0,0,0,0.5)", "#ffffff")).toBe("3.94:1"); // 127.5 rounds to 128 → #808080
    expect(ratioOf("#00000080", "#ffffff")).toBe("4.00:1"); // alpha 128/255 blends to 127 → #7f7f7f
  });
  it("names the field that is wrong", () => {
    expect(errs(run(more, "contrast-checker", { foreground: "nonsense", background: "#fff" }))).toMatch(/^foreground: Text colour:/);
    expect(errs(run(more, "contrast-checker", { foreground: "#fff", background: "#gg0000" }))).toMatch(/^background: Background colour:/);
  });
});
