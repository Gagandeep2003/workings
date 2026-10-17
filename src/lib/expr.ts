/**
 * A small, safe arithmetic expression evaluator for the scientific calculator.
 * Hand-written recursive descent: it never uses eval() or Function(), and only knows the operators,
 * constants and functions listed below.
 *
 * Grammar (loosest to tightest binding):
 *   sum      := product (("+" | "-") product)*
 *   product  := unary (("*" | "/" | implicit) unary)*       implicit multiplication: 2(3+4), 2pi, (1+2)(3+4)
 *   unary    := ("-" | "+") unary | power
 *   power    := postfix ("^" unary)?                         right-associative: 2^3^2 = 2^9; -2^2 = -4
 *   postfix  := primary ("!" | "%")*
 *   primary  := number | constant | function "(" args ")" | "(" sum ")"
 */
import { clean } from "./numeric";

export class ExprError extends Error {
  constructor(message: string, public position?: number) {
    super(message);
  }
}

export type AngleMode = "deg" | "rad";

type Tok = { t: "num"; v: number; at: number } | { t: "id"; v: string; at: number } | { t: "op"; v: string; at: number } | { t: "end"; at: number };

const CONSTANTS: Record<string, number> = { pi: Math.PI, "π": Math.PI, tau: 2 * Math.PI, e: Math.E };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  const s = src.replace(/[−–]/g, "-").replace(/[×·∙]/g, "*").replace(/÷/g, "/").replace(/\*\*/g, "^");
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) { toks.push({ t: "num", v: Number(num[0]), at: i }); i += num[0].length; continue; }
    if (/[A-Za-zπ√]/.test(c)) {
      if (c === "√") { toks.push({ t: "id", v: "sqrt", at: i }); i++; continue; }
      let j = i;
      while (j < s.length && /[A-Za-z0-9π]/.test(s[j])) j++; // log10, log2 — and sin30, which gets a helpful message below
      const word = s.slice(i, j).toLowerCase();
      toks.push({ t: "id", v: word, at: i });
      i = j;
      continue;
    }
    if ("+-*/^()!%,".includes(c)) { toks.push({ t: "op", v: c, at: i }); i++; continue; }
    throw new ExprError(`Unexpected character "${c}"`, i);
  }
  toks.push({ t: "end", at: s.length });
  return toks;
}

const FACT_LIMIT = 170;
function factorial(x: number, at: number): number {
  if (!Number.isInteger(x) || x < 0) throw new ExprError("Factorial needs a whole number that is zero or more", at);
  if (x > FACT_LIMIT) throw new ExprError(`Factorial is only supported up to ${FACT_LIMIT}! (larger values overflow)`, at);
  let r = 1;
  for (let k = 2; k <= x; k++) r *= k;
  return r;
}

export function evaluateExpression(src: string, angle: AngleMode = "deg"): number {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const isOp = (v: string) => peek().t === "op" && (peek() as { v: string }).v === v;

  const toRad = (x: number) => (angle === "deg" ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angle === "deg" ? (x * 180) / Math.PI : x);
  const need = (cond: boolean, msg: string, at: number) => { if (!cond) throw new ExprError(msg, at); };
  /** sin(π) is 1.2e-16 in floating point, not 0. Snap results that are pure rounding noise (but keep genuinely tiny values for tiny angles). */
  const snap = (result: number, angle: number) => (Math.abs(result) < 1e-15 && Math.abs(angle) > 1e-6 ? 0 : result);

  const FUNCS: Record<string, { args: [number, number]; run: (a: number[], at: number) => number }> = {
    sin: { args: [1, 1], run: ([x]) => snap(Math.sin(toRad(x)), x) },
    cos: { args: [1, 1], run: ([x]) => snap(Math.cos(toRad(x)), x) },
    tan: { args: [1, 1], run: ([x], at) => { const c = Math.cos(toRad(x)); need(Math.abs(c) > 1e-14, "tan is undefined at this angle", at); return snap(Math.tan(toRad(x)), x); } },
    asin: { args: [1, 1], run: ([x], at) => { need(x >= -1 && x <= 1, "asin needs a value between −1 and 1", at); return fromRad(Math.asin(x)); } },
    acos: { args: [1, 1], run: ([x], at) => { need(x >= -1 && x <= 1, "acos needs a value between −1 and 1", at); return fromRad(Math.acos(x)); } },
    atan: { args: [1, 1], run: ([x]) => fromRad(Math.atan(x)) },
    sinh: { args: [1, 1], run: ([x]) => Math.sinh(x) },
    cosh: { args: [1, 1], run: ([x]) => Math.cosh(x) },
    tanh: { args: [1, 1], run: ([x]) => Math.tanh(x) },
    asinh: { args: [1, 1], run: ([x]) => Math.asinh(x) },
    acosh: { args: [1, 1], run: ([x], at) => { need(x >= 1, "acosh needs a value of at least 1", at); return Math.acosh(x); } },
    atanh: { args: [1, 1], run: ([x], at) => { need(x > -1 && x < 1, "atanh needs a value between −1 and 1 (exclusive)", at); return Math.atanh(x); } },
    ln: { args: [1, 1], run: ([x], at) => { need(x > 0, "ln needs a number greater than zero", at); return Math.log(x); } },
    log: { args: [1, 2], run: ([x, b], at) => {
      need(x > 0, "log needs a number greater than zero", at);
      if (b === undefined) return Math.log10(x);
      need(b > 0 && b !== 1, "A logarithm base must be positive and not 1", at);
      return Math.log(x) / Math.log(b);
    } },
    log2: { args: [1, 1], run: ([x], at) => { need(x > 0, "log2 needs a number greater than zero", at); return Math.log2(x); } },
    log10: { args: [1, 1], run: ([x], at) => { need(x > 0, "log10 needs a number greater than zero", at); return Math.log10(x); } },
    sqrt: { args: [1, 1], run: ([x], at) => { need(x >= 0, "The square root of a negative number is not a real number", at); return Math.sqrt(x); } },
    cbrt: { args: [1, 1], run: ([x]) => Math.cbrt(x) },
    root: { args: [2, 2], run: ([x, n], at) => {
      need(Number.isInteger(n) && n >= 1, "The root index must be a whole number of at least 1", at);
      if (x < 0) { need(n % 2 === 1, "An even root of a negative number is not a real number", at); return -Math.pow(-x, 1 / n); }
      return Math.pow(x, 1 / n);
    } },
    pow: { args: [2, 2], run: ([x, y], at) => { need(!(x < 0 && !Number.isInteger(y)), "A negative base needs a whole-number exponent", at); return Math.pow(x, y); } },
    exp: { args: [1, 1], run: ([x]) => Math.exp(x) },
    abs: { args: [1, 1], run: ([x]) => Math.abs(x) },
    floor: { args: [1, 1], run: ([x]) => Math.floor(x) },
    ceil: { args: [1, 1], run: ([x]) => Math.ceil(x) },
    round: { args: [1, 1], run: ([x]) => Math.round(x) },
    sign: { args: [1, 1], run: ([x]) => Math.sign(x) },
    fact: { args: [1, 1], run: ([x], at) => factorial(x, at) },
    mod: { args: [2, 2], run: ([x, y], at) => { need(y !== 0, "Cannot take a remainder when dividing by zero", at); return x - y * Math.floor(x / y); } },
    min: { args: [2, 2], run: ([x, y]) => Math.min(x, y) },
    max: { args: [2, 2], run: ([x, y]) => Math.max(x, y) },
  };

  function sum(): number {
    let v = product();
    while (isOp("+") || isOp("-")) {
      const op = (next() as { v: string }).v;
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  function startsPrimary(): boolean {
    const t = peek();
    return (t.t === "op" && t.v === "(") || t.t === "id";
  }

  function product(): number {
    let v = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const opTok = next() as { v: string; at: number };
        const r = unary();
        if (opTok.v === "/") { if (r === 0) throw new ExprError("Division by zero", opTok.at); v /= r; } else v *= r;
      } else if (startsPrimary()) {
        v *= unary(); // implicit multiplication
      } else break;
    }
    return v;
  }

  function unary(): number {
    if (isOp("-")) { next(); return -unary(); }
    if (isOp("+")) { next(); return unary(); }
    return power();
  }

  function power(): number {
    const base = postfix();
    if (isOp("^")) {
      const at = (next() as { at: number }).at;
      const exp = unary();
      if (base < 0 && !Number.isInteger(exp)) throw new ExprError("A negative number raised to a fractional power is not a real number", at);
      if (base === 0 && exp < 0) throw new ExprError("Zero cannot be raised to a negative power (division by zero)", at);
      return Math.pow(base, exp);
    }
    return base;
  }

  function postfix(): number {
    let v = primary();
    for (;;) {
      if (isOp("!")) { const at = (next() as { at: number }).at; v = factorial(v, at); }
      else if (isOp("%")) { next(); v /= 100; }
      else break;
    }
    return v;
  }

  function primary(): number {
    const t = next();
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") {
      const v = sum();
      if (!isOp(")")) throw new ExprError("Missing closing bracket )", peek().at);
      next();
      return v;
    }
    if (t.t === "id") {
      if (isOp("(")) {
        const fn = FUNCS[t.v];
        if (!fn) throw new ExprError(`Unknown function "${t.v}"`, t.at);
        next();
        const args: number[] = [];
        if (!isOp(")")) {
          args.push(sum());
          while (isOp(",")) { next(); args.push(sum()); }
        }
        if (!isOp(")")) throw new ExprError("Missing closing bracket )", peek().at);
        next();
        const [lo, hi] = fn.args;
        if (args.length < lo || args.length > hi) throw new ExprError(`${t.v}() takes ${lo === hi ? lo : `${lo} or ${hi}`} argument${hi === 1 ? "" : "s"}, but ${args.length} ${args.length === 1 ? "was" : "were"} given`, t.at);
        return fn.run(args, t.at);
      }
      if (t.v in CONSTANTS) return CONSTANTS[t.v];
      if (t.v in FUNCS) throw new ExprError(`Write ${t.v} with brackets, like ${t.v}(30)`, t.at);
      const glued = /^([a-z]+)(\d+(?:\.\d+)?)$/.exec(t.v);
      if (glued && glued[1] in FUNCS) throw new ExprError(`Write ${glued[1]} with brackets, like ${glued[1]}(${glued[2]})`, t.at);
      if (/^x(\d|$)/.test(t.v)) throw new ExprError('Use * or × for multiplication — "x" is not an operator here', t.at);
      throw new ExprError(`Unknown name "${t.v}". Constants available: pi, e, tau`, t.at);
    }
    if (t.t === "end") throw new ExprError("The expression ends unexpectedly — something is missing at the end", t.at);
    throw new ExprError(`Unexpected "${(t as { v: string }).v}"`, t.at);
  }

  if (peek().t === "end") throw new ExprError("Type an expression to calculate, for example 2*(3+4)^2");
  const value = sum();
  if (peek().t !== "end") {
    const t = peek() as { v: string | number; at: number };
    throw new ExprError(`Unexpected "${t.v}" — did you forget an operator such as + or ×?`, t.at);
  }
  if (!Number.isFinite(value)) throw new ExprError("The result is too large to represent");
  return clean(value);
}
