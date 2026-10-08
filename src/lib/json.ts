/**
 * A small, strict JSON parser that keeps the original number/string literals, so formatting never
 * changes the data (JSON.stringify would turn 1.0 into 1 and 12345678901234567890 into 12345678901234567000).
 * It also reports errors with line and column numbers, which JSON.parse messages do not do consistently
 * across browsers.
 */

export type JsonNode =
  | { t: "object"; entries: { key: string; keyRaw: string; value: JsonNode }[] }
  | { t: "array"; items: JsonNode[] }
  | { t: "string"; raw: string }
  | { t: "number"; raw: string }
  | { t: "literal"; raw: "true" | "false" | "null" };

export type JsonError = { message: string; offset: number; line: number; column: number };

export type JsonStats = {
  rootType: string;
  depth: number;
  objects: number;
  arrays: number;
  keys: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  unsafeNumbers: number;
  duplicateKeys: string[];
};

export type JsonParseResult =
  | { ok: true; node: JsonNode; stats: JsonStats }
  | { ok: false; error: JsonError };

export function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < Math.min(offset, text.length); i++) {
    if (text[i] === "\n") {
      line++;
      last = i;
    }
  }
  return { line, column: offset - last };
}

class JsonSyntaxError extends Error {
  constructor(message: string, public offset: number) {
    super(message);
  }
}

const NUMBER_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const describe = (ch: string | undefined): string =>
  ch === undefined ? "the end of the text" : ch === "\n" ? "a new line" : `'${ch}'`;

export function parseJson(input: string, maxDepth = 256): JsonParseResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let pos = 0;
  const stats: JsonStats = {
    rootType: "", depth: 0, objects: 0, arrays: 0, keys: 0, strings: 0, numbers: 0,
    booleans: 0, nulls: 0, unsafeNumbers: 0, duplicateKeys: [],
  };

  const skipWs = () => {
    while (pos < text.length && (text[pos] === " " || text[pos] === "\t" || text[pos] === "\n" || text[pos] === "\r")) pos++;
  };

  const fail = (message: string, at = pos): never => {
    throw new JsonSyntaxError(message, at);
  };

  const parseString = (): string => {
    const start = pos;
    pos++; // opening quote
    while (pos < text.length) {
      const ch = text[pos];
      if (ch === '"') {
        pos++;
        return text.slice(start, pos);
      }
      if (ch === "\\") {
        const next = text[pos + 1];
        if (next === undefined) fail("The string ends right after a backslash — it is missing its closing quote", pos);
        if (next === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(pos + 2, pos + 6))) fail("A \\u escape needs exactly four hexadecimal digits (like \\u00e9)", pos);
          pos += 6;
        } else if ('"\\/bfnrt'.includes(next)) {
          pos += 2;
        } else {
          fail(`Invalid escape '\\${next}' — JSON only allows \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX`, pos);
        }
      } else if (ch < " ") {
        fail(ch === "\n" ? "A string cannot contain a raw line break — use \\n instead, or the closing quote is missing" : "A string cannot contain a raw control character — escape it (for example \\t)", pos);
      } else {
        pos++;
      }
    }
    return fail("The string is not closed — add a closing double quote", start);
  };

  const parseValue = (depth: number): JsonNode => {
    if (depth > maxDepth) fail(`Nesting is deeper than ${maxDepth} levels`);
    stats.depth = Math.max(stats.depth, depth);
    skipWs();
    const ch = text[pos];
    if (ch === undefined) fail("Unexpected end of JSON — something is missing (a value, closing bracket or brace?)");
    if (ch === "{") {
      pos++;
      stats.objects++;
      const entries: { key: string; keyRaw: string; value: JsonNode }[] = [];
      const seen = new Set<string>();
      skipWs();
      if (text[pos] === "}") {
        pos++;
        return { t: "object", entries };
      }
      for (;;) {
        skipWs();
        if (text[pos] !== '"') {
          if (text[pos] === "}") fail("A trailing comma is not allowed in JSON — remove the comma before the closing brace");
          if (text[pos] === "'") fail("Property names must use double quotes, not single quotes");
          fail(`Expected a double-quoted property name, found ${describe(text[pos])}`);
        }
        const keyRaw = parseString();
        const key = JSON.parse(keyRaw) as string;
        if (seen.has(key)) {
          if (!stats.duplicateKeys.includes(key)) stats.duplicateKeys.push(key);
        }
        seen.add(key);
        stats.keys++;
        skipWs();
        if (text[pos] !== ":") fail(`Expected ':' after the property name ${keyRaw}, found ${describe(text[pos])}`);
        pos++;
        const value = parseValue(depth + 1);
        entries.push({ key, keyRaw, value });
        skipWs();
        if (text[pos] === ",") {
          pos++;
          continue;
        }
        if (text[pos] === "}") {
          pos++;
          return { t: "object", entries };
        }
        fail(`Expected ',' or '}' after a property value, found ${describe(text[pos])}`);
      }
    }
    if (ch === "[") {
      pos++;
      stats.arrays++;
      const items: JsonNode[] = [];
      skipWs();
      if (text[pos] === "]") {
        pos++;
        return { t: "array", items };
      }
      for (;;) {
        skipWs();
        if (text[pos] === "]") fail("A trailing comma is not allowed in JSON — remove the comma before the closing bracket");
        items.push(parseValue(depth + 1));
        skipWs();
        if (text[pos] === ",") {
          pos++;
          continue;
        }
        if (text[pos] === "]") {
          pos++;
          return { t: "array", items };
        }
        fail(`Expected ',' or ']' after an array item, found ${describe(text[pos])}`);
      }
    }
    if (ch === '"') {
      stats.strings++;
      return { t: "string", raw: parseString() };
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      NUMBER_RE.lastIndex = pos;
      const m = NUMBER_RE.exec(text);
      if (!m) fail("Invalid number — JSON numbers look like -12, 3.14 or 1e6 (no '+', and digits are needed after '.')");
      const raw = (m as RegExpExecArray)[0];
      const after = text[pos + raw.length];
      if (/^-?0$/.test(raw) && after !== undefined && /\d/.test(after)) fail("Numbers cannot have leading zeros", pos);
      if (after !== undefined && /[0-9.eE+\-]/.test(after)) {
        fail(after === "." ? "Invalid number — a digit is needed after the decimal point" : `Invalid number: unexpected '${after}'`, pos + raw.length);
      }
      if (/^-?\d+$/.test(raw) && Math.abs(Number(raw)) > Number.MAX_SAFE_INTEGER) stats.unsafeNumbers++;
      stats.numbers++;
      pos += raw.length;
      return { t: "number", raw };
    }
    for (const word of ["true", "false", "null"] as const) {
      if (text.startsWith(word, pos)) {
        const next = text[pos + word.length];
        if (next !== undefined && /[A-Za-z0-9_]/.test(next)) break;
        pos += word.length;
        if (word === "null") stats.nulls++;
        else stats.booleans++;
        return { t: "literal", raw: word };
      }
    }
    if (/[A-Za-z]/.test(ch)) {
      const word = /^[A-Za-z_]+/.exec(text.slice(pos))?.[0] ?? ch;
      if (["undefined", "NaN", "Infinity"].includes(word)) fail(`'${word}' is not valid JSON — use null or a number instead`);
      fail(`Unexpected text '${word}' — strings need double quotes, and only true, false and null are allowed as bare words`);
    }
    if (ch === "'") fail("Strings must use double quotes, not single quotes");
    if (ch === "}" || ch === "]") fail(`Unexpected '${ch}' — there is no matching opening bracket, or a value is missing before it`);
    if (ch === ",") fail("Unexpected ',' — a value is missing before the comma");
    return fail(`Unexpected character ${describe(ch)}`);
  };

  try {
    const node = parseValue(1);
    skipWs();
    if (pos < text.length) fail("Unexpected text after the end of the JSON value — only one top-level value is allowed");
    stats.rootType = node.t === "literal" ? (node.raw === "null" ? "null" : "boolean") : node.t;
    return { ok: true, node, stats };
  } catch (e) {
    if (e instanceof JsonSyntaxError) {
      const { line, column } = lineColumn(text, e.offset);
      return { ok: false, error: { message: e.message, offset: e.offset, line, column } };
    }
    throw e;
  }
}

export type PrintOptions = { indent: string; sortKeys?: boolean };

/** Print a parsed document. indent "" produces minified output. */
export function printJson(node: JsonNode, { indent, sortKeys = false }: PrintOptions): string {
  const pretty = indent !== "";
  const out: string[] = [];
  const write = (n: JsonNode, level: number) => {
    switch (n.t) {
      case "string":
      case "number":
      case "literal":
        out.push(n.raw);
        return;
      case "array": {
        if (n.items.length === 0) return void out.push("[]");
        out.push("[");
        n.items.forEach((item, i) => {
          if (pretty) out.push("\n" + indent.repeat(level + 1));
          write(item, level + 1);
          if (i < n.items.length - 1) out.push(",");
        });
        if (pretty) out.push("\n" + indent.repeat(level));
        out.push("]");
        return;
      }
      case "object": {
        if (n.entries.length === 0) return void out.push("{}");
        const entries = sortKeys ? [...n.entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) : n.entries;
        out.push("{");
        entries.forEach((e, i) => {
          if (pretty) out.push("\n" + indent.repeat(level + 1));
          out.push(e.keyRaw, pretty ? ": " : ":");
          write(e.value, level + 1);
          if (i < entries.length - 1) out.push(",");
        });
        if (pretty) out.push("\n" + indent.repeat(level));
        out.push("}");
        return;
      }
    }
  };
  write(node, 0);
  return out.join("");
}

/** A short source excerpt with a caret under the error position. */
export function errorExcerpt(text: string, error: JsonError): string {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split("\n");
  const line = lines[error.line - 1] ?? "";
  const start = Math.max(0, error.column - 1 - 30);
  const slice = line.slice(start, start + 70);
  const caret = " ".repeat(error.column - 1 - start) + "^";
  return `${slice.replace(/\r$/, "")}\n${caret}`;
}
