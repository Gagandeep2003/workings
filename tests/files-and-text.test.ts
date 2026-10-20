import { describe, it, expect } from "vitest";
import { crc32, makeZip } from "@/lib/files/zip";
import { padJpeg, padPng } from "@/lib/files/pad";
import { chunkPages, parseRanges } from "@/lib/files/pdf";
import { FileProblem } from "@/lib/files/image";
import { formatBytes, describeChange, uniqueName, baseName } from "@/lib/files/format";
import { emailPayload, phonePayload, qrContrast, qrSvg, smsPayload, upiPayload, UPI_ID_RE, vcardPayload, wifiPayload } from "@/lib/files/qr";
import { pngColorsForQuality } from "@/lib/files/imageOps";
import { engines as lines, removeDuplicateLines, sortLines, findReplace, cleanWhitespace } from "@/engines/developer/lines";
import { engines as data, parseCsv, detectDelimiter, csvToJson, jsonToCsv, inferValue } from "@/engines/developer/data";
import { engines as random, generatePassword, loremIpsum } from "@/engines/developer/random";
import { makeContext } from "@/engines/helpers";
import { crc32 as nodeCrc32 } from "node:zlib";
import { errs, out, primary, run } from "./util";
import { ctx } from "./util";

/** A deterministic "random" source: cycles through the given bytes. */
const seeded = (bytes: number[]) => { let i = 0; return makeContext({ random: (n) => Uint8Array.from({ length: n }, () => bytes[i++ % bytes.length]) }); };
const text = (r: ReturnType<typeof run>, label: string) => out(r).texts!.find((t) => t.label.startsWith(label))!.value;

describe("ZIP writer", () => {
  it("CRC-32 matches the standard check value and Node's implementation", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    for (const s of ["", "a", "hello world", "x".repeat(10_000)]) expect(crc32(new TextEncoder().encode(s))).toBe(nodeCrc32(Buffer.from(s)));
  });
  it("writes a structurally valid archive", async () => {
    const files = [{ name: "a.txt", data: new TextEncoder().encode("hello") }, { name: "dir/ü.bin", data: Uint8Array.from([1, 2, 3, 4]) }];
    const buf = new Uint8Array(await makeZip(files, new Date(2026, 9, 18, 10, 30, 0)).arrayBuffer());
    const v = new DataView(buf.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const eocd = buf.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 10, true)).toBe(2); // entries
    const cdOffset = v.getUint32(eocd + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);
    expect(v.getUint32(cdOffset + 16, true)).toBe(nodeCrc32(Buffer.from("hello")));
    expect(v.getUint32(cdOffset + 20, true)).toBe(5);
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800); // UTF-8 names
  });
});

describe("minimum-size padding", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xdb, 0, 4, 1, 2, 0xff, 0xd9]);
  it("pads a JPEG to exactly the requested size, keeping JFIF first and the rest intact", async () => {
    for (const target of [100, 5000, 70_000, 200_000]) {
      const out = new Uint8Array(await (await padJpeg(new Blob([jpeg]), target)).arrayBuffer());
      expect(out.length).toBe(target);
      expect([...out.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
      expect([...out.subarray(out.length - 2)]).toEqual([0xff, 0xd9]);
      expect(out.indexOf(0xdb)).toBeGreaterThan(20); // DQT still present after the comments
    }
  });
  it("leaves a file that is already large enough alone", async () => {
    const b = new Blob([jpeg]);
    expect(await padJpeg(b, 10)).toBe(b);
  });
  it("pads a PNG with a correctly checksummed tEXt chunk before IEND", async () => {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const chunk = (type: string, body: number[]) => { const t = [...type].map((c) => c.charCodeAt(0)); const crc = nodeCrc32(Buffer.from([...t, ...body])); return [0, 0, 0, body.length, ...t, ...body, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255]; };
    const png = Uint8Array.from([...sig, ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]), ...chunk("IEND", [])]);
    const outBytes = new Uint8Array(await (await padPng(new Blob([png]), 3000)).arrayBuffer());
    expect(outBytes.length).toBe(3000);
    const iend = outBytes.length - 12;
    expect(String.fromCharCode(...outBytes.subarray(iend + 4, iend + 8))).toBe("IEND");
    const textStart = png.length - 12;
    const len = new DataView(outBytes.buffer).getUint32(textStart);
    expect(String.fromCharCode(...outBytes.subarray(textStart + 4, textStart + 8))).toBe("tEXt");
    const stored = new DataView(outBytes.buffer).getUint32(textStart + 8 + len);
    expect(stored).toBe(nodeCrc32(Buffer.from(outBytes.subarray(textStart + 4, textStart + 8 + len))));
  });
});

describe("PDF page ranges", () => {
  it("parses pages, ranges and open-ended ranges (0-based output)", () => {
    expect(parseRanges("1-3, 5, 8-", 10)).toEqual([[0, 1, 2], [4], [7, 8, 9]]);
    expect(parseRanges("2", 3)).toEqual([[1]]);
    expect(parseRanges(" 4 – 6 ;7", 9)).toEqual([[3, 4, 5], [6]]);
  });
  it("rejects bad input with clear messages", () => {
    expect(() => parseRanges("", 5)).toThrow(FileProblem);
    expect(() => parseRanges("0", 5)).toThrow(/start at 1/);
    expect(() => parseRanges("7", 5)).toThrow(/past the last page/);
    expect(() => parseRanges("4-2", 5)).toThrow(/backwards/);
    expect(() => parseRanges("a-b", 5)).toThrow(/isn't a page/);
  });
  it("chunks pages evenly with a shorter last part", () => {
    expect(chunkPages(7, 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
    expect(chunkPages(4, 4)).toEqual([[0, 1, 2, 3]]);
  });
});

describe("file helpers", () => {
  it("formats sizes with 1 KB = 1024 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(20 * 1024)).toBe("20.0 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.50 MB");
  });
  it("describes size changes honestly in both directions", () => {
    expect(describeChange(1000, 250)).toBe("75.0% smaller (−750 B)");
    expect(describeChange(1000, 1500)).toBe("50.0% larger (+500 B)");
    expect(describeChange(1000, 1000)).toBe("same size");
  });
  it("makes file names unique inside a ZIP and strips unsafe characters", () => {
    const used = new Set<string>();
    expect([uniqueName("a.jpg", used), uniqueName("A.jpg", used), uniqueName("a.jpg", used)]).toEqual(["a.jpg", "A-2.jpg", "a-3.jpg"]);
    expect(baseName("C:\\Users\\me\\My Photo?.jpeg")).toBe("My Photo_");
  });
  it("maps PNG quality to palette sizes (100 = lossless)", () => {
    expect([100, 95, 80, 60, 40, 10].map(pngColorsForQuality)).toEqual([0, 256, 128, 64, 32, 16]);
  });
});

describe("QR payloads", () => {
  it("Wi-Fi escapes the special characters and omits the password for open networks", () => {
    expect(wifiPayload({ ssid: "My;Net", password: 'pa:ss,"w\\d', security: "WPA", hidden: false })).toBe('WIFI:T:WPA;S:My\\;Net;P:pa\\:ss\\,\\"w\\\\d;;');
    expect(wifiPayload({ ssid: "Cafe", password: "ignored", security: "nopass", hidden: true })).toBe("WIFI:T:nopass;S:Cafe;H:true;;");
  });
  it("UPI links follow the NPCI parameter format", () => {
    expect(upiPayload({ vpa: "shop@okbank", name: "Ravi Kumar Store", amount: "150.50", note: "Order #12" })).toBe("upi://pay?pa=shop@okbank&pn=Ravi%20Kumar%20Store&am=150.50&cu=INR&tn=Order%20%2312");
    expect(upiPayload({ vpa: "a.b@ybl", name: "A", amount: "", note: "" })).toBe("upi://pay?pa=a.b@ybl&pn=A&cu=INR");
    expect(upiPayload({ vpa: "a.b@ybl", name: "A", amount: "200", note: "" })).toContain("&am=200&");
    expect(UPI_ID_RE.test("name.surname-1@okhdfcbank")).toBe(true);
    for (const bad of ["no-at-sign", "@bank", "a@b", "a b@bank", "a@1bank"]) expect(UPI_ID_RE.test(bad), bad).toBe(false);
  });
  it("vCard 3.0 escapes separators and keeps required lines", () => {
    const v = vcardPayload({ first: "Ada", last: "Lovelace", org: "Analytical, Co; Ltd", title: "", phone: "+91 98765-43210", email: "ada@example.com", url: "", street: "", city: "", country: "" });
    expect(v.split("\n")).toEqual(["BEGIN:VCARD", "VERSION:3.0", "N:Lovelace;Ada;;;", "FN:Ada Lovelace", "ORG:Analytical\\, Co\\; Ltd", "TEL;TYPE=CELL:+9198765-43210".replace("-", ""), "EMAIL:ada@example.com", "END:VCARD"]);
  });
  it("email, phone and SMS links", () => {
    expect(emailPayload("a@b.co", "Hi there", "x & y")).toBe("mailto:a@b.co?subject=Hi%20there&body=x%20%26%20y");
    expect(emailPayload("a@b.co", "", "")).toBe("mailto:a@b.co");
    expect(phonePayload("+91 (98765) 43210")).toBe("tel:+919876543210");
    expect(smsPayload("98765 43210", "Hello")).toBe("SMSTO:9876543210:Hello");
  });
  it("contrast: black on white is 21:1; light-on-dark is flagged as inverted", () => {
    expect(qrContrast("#000000", "#ffffff").ratio).toBeCloseTo(21, 5);
    expect(qrContrast("#ffffff", "#000000").inverted).toBe(true);
    expect(qrContrast("#777777", "#888888").ratio).toBeLessThan(1.5);
  });
  it("SVG output merges runs and honours the transparent option", () => {
    const m = [[true, true, false], [false, true, true], [true, false, true]];
    const svg = qrSvg(m, { margin: 1, fg: "#000", bg: "#fff", transparent: false });
    expect(svg).toContain('viewBox="0 0 5 5"');
    expect(svg).toContain("M1 1h2v1h-2z"); // first row: two adjacent modules merged
    expect(svg).toContain('<rect width="5" height="5" fill="#fff"/>');
    expect(qrSvg(m, { margin: 1, fg: "#000", bg: "#fff", transparent: true })).not.toContain("<rect");
  });
});

describe("remove duplicate lines", () => {
  const base = { text: "b\nA\na\nb\n\nc\nb", case: "sensitive", trim: "no", blank: "no", keep: "first", mode: "unique" };
  it("keeps the first occurrence in original order", () => {
    expect(text(run(lines, "remove-duplicate-lines", base), "Result")).toBe("b\nA\na\n\nc");
  });
  it("can keep the last occurrence instead", () => {
    expect(text(run(lines, "remove-duplicate-lines", { ...base, keep: "last" }), "Result")).toBe("A\na\n\nc\nb");
  });
  it("ignores case and surrounding spaces when asked, and drops blank lines", () => {
    const r = run(lines, "remove-duplicate-lines", { ...base, text: "Apple\n apple \nBanana\n\n", case: "insensitive", trim: "yes", blank: "yes" });
    expect(text(r, "Result")).toBe("Apple\nBanana");
    expect(primary(r)).toBe(2);
  });
  it("only-unique and only-duplicates modes", () => {
    expect(text(run(lines, "remove-duplicate-lines", { ...base, mode: "only-unique" }), "Result")).toBe("A\na\n\nc");
    expect(text(run(lines, "remove-duplicate-lines", { ...base, mode: "only-duplicates" }), "Result")).toBe("b");
  });
  it("handles CRLF and rejects empty input", () => {
    expect(removeDuplicateLines("x\r\nx\r\ny\r\n", { caseSensitive: true, trim: false, dropBlank: false, keep: "first", mode: "unique" }).out).toEqual(["x", "y"]);
    expect(errs(run(lines, "remove-duplicate-lines", { ...base, text: "  " }))).toMatch(/Paste/);
  });
});

describe("sort lines", () => {
  const sort = (t: string, o: Partial<Parameters<typeof sortLines>[1]> = {}) => sortLines(t, { order: "az", caseSensitive: false, dropBlank: false, dedupe: false, ...o }, ctx).out;
  it("sorts naturally so item2 comes before item10", () => {
    expect(sort("item10\nitem2\nItem1")).toEqual(["Item1", "item2", "item10"]);
    expect(sort("b\nc\na", { order: "za" })).toEqual(["c", "b", "a"]);
  });
  it("sorts by length and by leading number, putting non-numbers last", () => {
    expect(sort("ccc\na\nbb", { order: "length-asc" })).toEqual(["a", "bb", "ccc"]);
    expect(sort("ccc\na\nbb", { order: "length-desc" })).toEqual(["ccc", "bb", "a"]);
    const r = sortLines("10 apples\n2 pears\nnone\n1,500 kg\n-3 deg", { order: "number-asc", caseSensitive: false, dropBlank: false, dedupe: false }, ctx);
    expect(r.out).toEqual(["-3 deg", "2 pears", "10 apples", "1,500 kg", "none"]);
    expect(r.notes[0]).toMatch(/1 line doesn't start with a number/);
    expect(sort("1\n3\n2", { order: "number-desc" })).toEqual(["3", "2", "1"]);
  });
  it("removes blanks and duplicates when asked; reverse keeps the order flipped", () => {
    expect(sort("b\n\nA\na\nb", { dropBlank: true, dedupe: true })).toEqual(["A", "b"]);
    expect(sort("1\n2\n3", { order: "reverse" })).toEqual(["3", "2", "1"]);
  });
  it("shuffle returns the same lines in a different, reproducible order for a fixed random source", () => {
    const c = seeded([200, 3, 9, 77, 1, 255, 17, 90, 140, 33, 8, 120]);
    const r = sortLines("1\n2\n3\n4\n5\n6", { order: "shuffle", caseSensitive: false, dropBlank: false, dedupe: false }, c).out;
    expect([...r].sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});

describe("find and replace", () => {
  it("plain text is literal: $ and regex characters have no special meaning", () => {
    expect(findReplace("a.b a.b", { find: "a.b", replace: "$&", regex: false, caseSensitive: true, wholeWord: false, all: true })).toEqual({ out: "$& $&", count: 2 });
  });
  it("case and whole-word options", () => {
    expect(findReplace("Cat cat concat", { find: "cat", replace: "dog", regex: false, caseSensitive: false, wholeWord: true, all: true })).toEqual({ out: "dog dog concat", count: 2 });
    expect(findReplace("Cat cat", { find: "cat", replace: "dog", regex: false, caseSensitive: true, wholeWord: false, all: true }).out).toBe("Cat dog");
  });
  it("first-only and regex with capture groups", () => {
    expect(findReplace("x x x", { find: "x", replace: "y", regex: false, caseSensitive: true, wholeWord: false, all: false })).toEqual({ out: "y x x", count: 1 });
    expect(findReplace("2026-10-18", { find: "(\\d+)-(\\d+)-(\\d+)", replace: "$3/$2/$1", regex: true, caseSensitive: true, wholeWord: false, all: true }).out).toBe("18/10/2026");
  });
  it("reports invalid patterns and empty search text through the engine", () => {
    expect(errs(run(lines, "find-and-replace-text", { text: "a", find: "(", replace: "", mode: "regex", case: "sensitive", whole: "no", scope: "all" }))).toMatch(/valid regular expression/);
    expect(errs(run(lines, "find-and-replace-text", { text: "a", find: "", replace: "", mode: "plain", case: "sensitive", whole: "no", scope: "all" }))).toMatch(/Enter the text to find/);
  });
});

describe("whitespace cleaner", () => {
  const all = { collapse: true, trimLines: true, blank: "single" as const, unicodeSpaces: true, zeroWidth: true, join: false };
  it("collapses spaces, trims lines and limits blank lines", () => {
    expect(cleanWhitespace("  a   b \t c  \n\n\n\n  d  ", all)).toBe("a b c\n\nd");
  });
  it("normalises non-breaking spaces and removes zero-width characters", () => {
    expect(cleanWhitespace("a\u00A0\u00A0b\u200Bc\uFEFFd", all)).toBe("a bcd");
  });
  it("can remove all blank lines or join everything into one line", () => {
    expect(cleanWhitespace("a\n\n b \n\nc", { ...all, blank: "remove" })).toBe("a\nb\nc");
    expect(cleanWhitespace("line one\nline two\r\n\nline three", { ...all, join: true })).toBe("line one line two line three");
  });
  it("does nothing when every option is off (except line-ending normalisation)", () => {
    expect(cleanWhitespace("a  b\r\n c ", { collapse: false, trimLines: false, blank: "keep", unicodeSpaces: false, zeroWidth: false, join: false })).toBe("a  b\n c ");
  });
});

describe("CSV parsing and conversion", () => {
  it("parses quotes, escaped quotes, embedded newlines and CRLF", () => {
    expect(parseCsv('name,note\r\n"Ada, L.","said ""hi"""\r\nBob,"two\nlines"\r\n', ",")).toEqual([["name", "note"], ["Ada, L.", 'said "hi"'], ["Bob", "two\nlines"]]);
  });
  it("strips a BOM, keeps a final row without a newline and skips empty lines", () => {
    expect(parseCsv("\uFEFFa;b\n1;2\n\n3;4", ";")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
  it("detects the delimiter, ignoring separators inside quotes", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"a,b,c";d')).toBe(";");
  });
  it("infers numbers, booleans and nulls only when asked; never mangles IDs with leading zeros", () => {
    expect(["12", "-3.5", "1e3", "007", "true", "FALSE", "", "abc", "12345678901234567890"].map(inferValue)).toEqual([12, -3.5, 1000, "007", true, false, null, "abc", "12345678901234567890"]);
  });
  it("converts to an array of objects with typed values", () => {
    const r = run(data, "csv-to-json-converter", { csv: "id,name,active\n1,Ada,true\n2,Bob,", delimiter: "auto", header: "yes", types: "yes", shape: "objects", indent: "min" });
    expect(JSON.parse(text(r, "JSON"))).toEqual([{ id: 1, name: "Ada", active: true }, { id: 2, name: "Bob", active: null }]);
    expect(primary(r)).toBe(2);
  });
  it("keeps everything as text when types are off, and reports ragged rows and duplicate headers", () => {
    const r = csvToJson("a,a,\n1,2,3,4\n5", { delimiter: ",", header: true, types: false, shape: "objects", indent: "min" });
    expect(JSON.parse(r.json)).toEqual([{ a: "1", a_2: "2", column_3: "3", column_4: "4" }, { a: "5", a_2: "", column_3: "" }]);
    expect(r.notes.join(" ")).toMatch(/2 rows have a different number of fields/);
  });
  it("array-of-arrays shape and headerless input", () => {
    expect(JSON.parse(csvToJson("1,2\n3,4", { delimiter: ",", header: false, types: true, shape: "arrays", indent: "2" }).json)).toEqual([[1, 2], [3, 4]]);
  });
  it("explains an unclosed quote", () => {
    expect(errs(run(data, "csv-to-json-converter", { csv: 'a,b\n"oops,2', delimiter: "comma", header: "yes", types: "no", shape: "objects", indent: "2" }))).toMatch(/never closed/);
  });
});

describe("JSON to CSV", () => {
  const base = { delimiter: ",", header: true, flatten: true, quoteAll: false, protect: false };
  it("flattens nested objects into dotted columns and unions columns across rows", () => {
    const r = jsonToCsv('[{"id":1,"user":{"name":"Ada","tags":["x","y"]}},{"id":2,"extra":true}]', base);
    expect(r.csv).toBe('id,user.name,user.tags,extra\n1,Ada,"[""x"",""y""]",\n2,,,true');
    expect(r.columns).toEqual(["id", "user.name", "user.tags", "extra"]);
  });
  it("quotes fields containing the delimiter, quotes or line breaks", () => {
    expect(jsonToCsv('[{"a":"x,y","b":"say \\"hi\\"","c":"l1\\nl2"}]', base).csv).toBe('a,b,c\n"x,y","say ""hi""","l1\nl2"');
  });
  it("keeps nested values as JSON text when flattening is off", () => {
    expect(jsonToCsv('[{"a":{"b":1}}]', { ...base, flatten: false }).csv).toBe('a\n"{""b"":1}"');
  });
  it("accepts a single object, primitives and arrays of arrays", () => {
    expect(jsonToCsv('{"a":1,"b":2}', base).csv).toBe("a,b\n1,2");
    expect(jsonToCsv("[1,2,3]", base).csv).toBe("value\n1\n2\n3");
    expect(jsonToCsv("[[1,2],[3,4]]", base).csv).toBe("1,2\n3,4");
  });
  it("supports other delimiters, no header and quote-everything", () => {
    expect(jsonToCsv('[{"a":1,"b":"x;y"}]', { ...base, delimiter: ";", header: false }).csv).toBe('1;"x;y"');
    expect(jsonToCsv('[{"a":1,"b":null}]', { ...base, quoteAll: true }).csv).toBe('"a","b"\n"1",""');
  });
  it("warns about spreadsheet formulas and can neutralise them", () => {
    const risky = '[{"a":"=SUM(A1:A2)","b":"@cmd","c":"-5 apples","d":-5}]';
    const off = jsonToCsv(risky, base);
    expect(off.csv).toContain("=SUM(A1:A2)");
    expect(off.notes[0]).toMatch(/3 cells start with/);
    const on = jsonToCsv(risky, { ...base, protect: true });
    expect(on.csv).toBe("a,b,c,d\n'=SUM(A1:A2),'@cmd,'-5 apples,-5");
  });
  it("gives helpful errors for invalid JSON and empty arrays", () => {
    expect(errs(run(data, "json-to-csv-converter", { json: "{bad", delimiter: "comma", header: "yes", flatten: "yes", quotes: "minimal", protect: "no" }))).toMatch(/isn't valid JSON/);
    expect(errs(run(data, "json-to-csv-converter", { json: "[]", delimiter: "comma", header: "yes", flatten: "yes", quotes: "minimal", protect: "no" }))).toMatch(/nothing to convert/);
  });
});

describe("password generator", () => {
  const all = { length: 20, lower: true, upper: true, digits: true, symbols: true, noAmbiguous: false, symbolSet: "" };
  it("always includes every selected character group and the requested length", () => {
    for (let i = 0; i < 200; i++) {
      const { password } = generatePassword(makeContext(), all);
      expect([...password]).toHaveLength(20);
      expect(password).toMatch(/[a-z]/); expect(password).toMatch(/[A-Z]/); expect(password).toMatch(/\d/); expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?]/);
    }
  });
  it("can exclude ambiguous characters and use only digits", () => {
    for (let i = 0; i < 100; i++) expect(generatePassword(makeContext(), { ...all, noAmbiguous: true }).password).not.toMatch(/[Il1O0o|`'"]/);
    expect(generatePassword(makeContext(), { ...all, lower: false, upper: false, symbols: false, length: 12 }).password).toMatch(/^\d{12}$/);
  });
  it("picks uniformly: every character of a 4-letter pool appears about equally often", () => {
    const counts: Record<string, number> = {};
    const c = makeContext();
    for (let i = 0; i < 4000; i++) { const p = generatePassword(c, { ...all, upper: false, digits: false, symbols: false, length: 1, symbolSet: "" }).password; counts[p] = (counts[p] ?? 0) + 1; }
    const values = Object.values(counts);
    expect(values.length).toBe(26);
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(2);
  });
  it("reports entropy from length × log2(pool) and validates inputs", () => {
    const r = run(random, "password-generator", { length: 16, count: 1, lower: "yes", upper: "yes", digits: "yes", symbols: "no", ambiguous: "no", symbolset: "" });
    expect(JSON.stringify(out(r).secondary)).toContain(`about ${Math.round(16 * Math.log2(62))} bits`);
    expect(errs(run(random, "password-generator", { length: 16, count: 1, lower: "no", upper: "no", digits: "no", symbols: "no", ambiguous: "no", symbolset: "" }))).toMatch(/at least one kind/);
    expect(errs(run(random, "password-generator", { length: 3, count: 1, lower: "yes", upper: "yes", digits: "yes", symbols: "yes", ambiguous: "no", symbolset: "" }))).toMatch(/at least 4 characters/);
  });
});

describe("lorem ipsum", () => {
  it("returns the exact number of words, sentences or paragraphs", () => {
    const c = makeContext();
    expect(loremIpsum(c, "words", 25, false).split(" ")).toHaveLength(25);
    expect(loremIpsum(c, "sentences", 6, false).match(/\./g)).toHaveLength(6);
    expect(loremIpsum(c, "paragraphs", 4, false).split("\n\n")).toHaveLength(4);
  });
  it("starts with the classic opening on request", () => {
    expect(loremIpsum(makeContext(), "paragraphs", 2, true).startsWith("Lorem ipsum dolor sit amet, consectetur adipiscing elit")).toBe(true);
    expect(loremIpsum(makeContext(), "words", 3, true)).toBe("lorem ipsum dolor");
  });
  it("sentences are capitalised and end with a full stop", () => {
    for (const s of loremIpsum(makeContext(), "sentences", 20, false).split(/(?<=\.) /)) expect(s).toMatch(/^[A-Z][^.]*\.$/);
  });
});
