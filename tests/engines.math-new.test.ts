import { describe, it, expect } from "vitest";
import { evaluateExpression, ExprError } from "@/lib/expr";
import { divisorCount, divisorSum, factorString, factorize, isPrime, nextPrime, prevPrime, simplifyRoot, smallestFactor } from "@/lib/primes";
import { engines as algebra } from "@/engines/math/algebra";
import { engines as numtheory } from "@/engines/math/numtheory";
import { engines as geometry } from "@/engines/math/geometry";
import { engines as statistics } from "@/engines/math/statistics";
import { engines as scientific } from "@/engines/math/scientific";
import { errs, out, primary, run, sec } from "./util";

const ev = (s: string, a: "deg" | "rad" = "deg") => evaluateExpression(s, a);
const evErr = (s: string) => { try { ev(s); } catch (e) { if (e instanceof ExprError) return e.message; throw e; } throw new Error(`"${s}" should have failed`); };

describe("expression evaluator", () => {
  it("follows the order of operations", () => {
    expect(ev("2+3*4")).toBe(14);
    expect(ev("(2+3)*4")).toBe(20);
    expect(ev("(12+8)*3^2/5")).toBe(36);
    expect(ev("10-4-3")).toBe(3); // left-associative
    expect(ev("100/10/5")).toBe(2);
    expect(ev("2^3^2")).toBe(512); // right-associative: 2^(3^2)
    expect(ev("-2^2")).toBe(-4);
    expect(ev("(-2)^2")).toBe(4);
    expect(ev("2^-2")).toBe(0.25);
    expect(ev("--3")).toBe(3);
    expect(ev("2*-3")).toBe(-6);
  });
  it("handles implicit multiplication, constants, factorial and percent", () => {
    expect(ev("2(3+4)")).toBe(14);
    expect(ev("(1+2)(3+4)")).toBe(21);
    expect(ev("2pi")).toBeCloseTo(2 * Math.PI, 10);
    expect(ev("pi*2")).toBeCloseTo(2 * Math.PI, 10);
    expect(ev("6/2(1+2)")).toBe(9); // documented: implicit multiplication binds like ×
    expect(ev("5!")).toBe(120);
    expect(ev("0!")).toBe(1);
    expect(ev("3!^2")).toBe(36);
    expect(ev("50%")).toBe(0.5);
    expect(ev("200*10%")).toBe(20);
    expect(ev("1e3+1")).toBe(1001);
    expect(ev("2e")).toBeCloseTo(2 * Math.E, 10);
    expect(ev("1,5".replace(",", "."))).toBe(1.5);
  });
  it("evaluates functions, in degrees and radians, without float noise", () => {
    expect(ev("sin(30)")).toBe(0.5);
    expect(ev("cos(60)")).toBe(0.5);
    expect(ev("tan(45)")).toBe(1);
    expect(ev("sin(180)")).toBe(0);
    expect(ev("cos(90)")).toBe(0);
    expect(ev("asin(1)")).toBe(90);
    expect(ev("atan(1)")).toBe(45);
    expect(ev("sin(pi/2)", "rad")).toBe(1);
    expect(ev("cos(pi)", "rad")).toBe(-1);
    expect(ev("log(1000)")).toBe(3);
    expect(ev("log(8,2)")).toBe(3);
    expect(ev("log2(1024)")).toBe(10);
    expect(ev("ln(e)")).toBe(1);
    expect(ev("sqrt(144)")).toBe(12);
    expect(ev("√(81)")).toBe(9);
    expect(ev("cbrt(-27)")).toBe(-3);
    expect(ev("root(32,5)")).toBe(2);
    expect(ev("root(-27,3)")).toBe(-3);
    expect(ev("pow(2,10)")).toBe(1024);
    expect(ev("abs(-7.5)")).toBe(7.5);
    expect(ev("floor(-2.5)")).toBe(-3);
    expect(ev("ceil(2.1)")).toBe(3);
    expect(ev("round(2.5)")).toBe(3);
    expect(ev("mod(-7,3)")).toBe(2);
    expect(ev("max(3,9)+min(3,9)")).toBe(12);
    expect(ev("exp(0)")).toBe(1);
  });
  it("accepts typographic operators", () => {
    expect(ev("6×7")).toBe(42);
    expect(ev("84÷2")).toBe(42);
    expect(ev("10−3")).toBe(7);
    expect(ev("2**3")).toBe(8);
  });
  it("gives specific, helpful errors and never throws a raw error", () => {
    expect(evErr("1/0")).toMatch(/Division by zero/);
    expect(evErr("2+")).toMatch(/ends unexpectedly/);
    expect(evErr("(1+2")).toMatch(/Missing closing bracket/);
    expect(evErr("1+2)")).toMatch(/Unexpected/);
    expect(evErr("sqrt(-1)")).toMatch(/negative number/);
    expect(evErr("ln(0)")).toMatch(/greater than zero/);
    expect(evErr("(-8)^0.5")).toMatch(/fractional power/);
    expect(evErr("0^-1")).toMatch(/negative power/);
    expect(evErr("171!")).toMatch(/up to 170/);
    expect(evErr("2.5!")).toMatch(/whole number/);
    expect(evErr("2x3")).toMatch(/Use \* or ×/);
    expect(evErr("sin30")).toMatch(/Write sin with brackets, like sin\(30\)/);
    expect(evErr("sin")).toMatch(/with brackets/);
    expect(evErr("foo(1)")).toMatch(/Unknown function "foo"/);
    expect(evErr("bar")).toMatch(/Unknown name/);
    expect(evErr("2 3")).toMatch(/forget an operator/);
    expect(evErr("2 @ 3")).toMatch(/Unexpected character "@"/);
    expect(evErr("max(1)")).toMatch(/takes 2 argument/);
    expect(evErr("asin(2)")).toMatch(/between −1 and 1/);
    expect(evErr("tan(90)")).toMatch(/undefined/);
    expect(evErr("")).toMatch(/Type an expression/);
    expect(evErr("9^9^9")).toMatch(/too large/);
  });
  it("never evaluates code", () => {
    for (const evil of ["process.exit()", "constructor", "__proto__", "this", "Math.PI", "alert(1)", "(()=>1)()", "globalThis"]) expect(() => ev(evil)).toThrow(ExprError);
  });
  it("engine wraps errors as field messages with a position", () => {
    const r = run(scientific, "scientific-calculator", { expression: "2+*3", angle: "deg" });
    expect(errs(r)).toMatch(/^expression: .*\(at character 3\)\.$/);
    expect(primary(run(scientific, "scientific-calculator", { expression: "sin(30)+cos(60)", angle: "deg" }))).toBe(1);
  });
});

describe("prime library", () => {
  it("tests primality exactly, including awkward cases", () => {
    const primes = [2, 3, 5, 7, 11, 13, 97, 7919, 104729, 2147483647, 1000000007, 998244353, 9007199254740881];
    const composites = [0, 1, 4, 9, 25, 91, 561, 1105, 1729, 2047, 3215031751, 9007199254740991, 4294967297, 1000000007 * 3];
    for (const p of primes) expect(isPrime(p), String(p)).toBe(true);
    for (const c of composites) expect(isPrime(c), String(c)).toBe(false);
    expect(isPrime(-7)).toBe(false);
    expect(isPrime(2.5)).toBe(false);
  });
  it("agrees with a sieve for every number below 5,000", () => {
    const n = 5000, sieve = new Array(n + 1).fill(true); sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= n; i++) if (sieve[i]) for (let j = i * i; j <= n; j += i) sieve[j] = false;
    for (let i = 0; i <= n; i++) expect(isPrime(i), String(i)).toBe(sieve[i]);
  });
  it("finds neighbouring primes", () => {
    expect(nextPrime(100)).toBe(101); expect(prevPrime(100)).toBe(97);
    expect(nextPrime(2)).toBe(3); expect(prevPrime(3)).toBe(2); expect(prevPrime(2)).toBeNull(); expect(nextPrime(-5)).toBe(2); expect(nextPrime(0)).toBe(2);
    expect(nextPrime(7919)).toBe(7927);
  });
  it("factorises correctly (reference values)", () => {
    expect(factorize(360)).toEqual([[2, 3], [3, 2], [5, 1]]);
    expect(factorize(97)).toEqual([[97, 1]]);
    expect(factorize(2)).toEqual([[2, 1]]);
    expect(factorize(600851475143)).toEqual([[71, 1], [839, 1], [1471, 1], [6857, 1]]); // Project Euler #3
    expect(factorize(2147483647)).toEqual([[2147483647, 1]]);
    expect(factorize(1e15)).toEqual([[2, 15], [5, 15]]);
    expect(factorize(999999999989 * 1)).toEqual([[999999999989, 1]]);
  });
  it("product of the factors always rebuilds the number", () => {
    for (let n = 2; n < 3000; n += 7) expect(factorize(n).reduce((a, [p, e]) => a * p ** e, 1)).toBe(n);
    for (const n of [123456789, 987654321, 1234567890123, 99999999977 * 3]) expect(factorize(n).reduce((a, [p, e]) => a * p ** e, 1)).toBe(n);
  });
  it("derives divisor statistics and simplified radicals", () => {
    const f = factorize(360);
    expect(divisorCount(f)).toBe(24);
    expect(divisorSum(f)).toBe(1170);
    expect(factorString(f)).toBe("2³ × 3² × 5");
    expect(simplifyRoot(72, 2)).toEqual({ coefficient: 6, radicand: 2 });
    expect(simplifyRoot(54, 3)).toEqual({ coefficient: 3, radicand: 2 });
    expect(simplifyRoot(50, 2)).toEqual({ coefficient: 5, radicand: 2 });
    expect(simplifyRoot(17, 2)).toEqual({ coefficient: 1, radicand: 17 });
    expect(smallestFactor(91)).toBe(7);
    expect(smallestFactor(97)).toBeNull();
  });
});

describe("number-theory tools", () => {
  it("prime checker gives verdicts and neighbours", () => {
    expect(primary(run(numtheory, "prime-number-checker", { number: 97 }))).toBe("Prime");
    const c = run(numtheory, "prime-number-checker", { number: 91 });
    expect(primary(c)).toBe("Composite");
    expect(sec(c, "Smallest prime factor")).toBe(7);
    expect(sec(c, "Divisible by")).toBe("7 × 13 = 91");
    expect(sec(c, "Previous prime")).toBe(89);
    expect(sec(c, "Next prime")).toBe(97);
    expect(primary(run(numtheory, "prime-number-checker", { number: 1 }))).toBe("Neither prime nor composite");
    expect(primary(run(numtheory, "prime-number-checker", { number: 0 }))).toBe("Neither prime nor composite");
    expect(primary(run(numtheory, "prime-number-checker", { number: 2 }))).toBe("Prime");
    expect(errs(run(numtheory, "prime-number-checker", { number: 2.5 }))).toMatch(/whole number/);
  });
  it("prime factorisation shows exponent form and divisor stats", () => {
    const r = run(numtheory, "prime-factorization-calculator", { number: 360 });
    expect(primary(r)).toBe("2³ × 3² × 5");
    expect(sec(r, "Number of divisors")).toBe(24);
    expect(sec(r, "Sum of divisors")).toBe(1170);
    expect(primary(run(numtheory, "prime-factorization-calculator", { number: 97 }))).toBe("97 (prime)");
    expect(errs(run(numtheory, "prime-factorization-calculator", { number: 1 }))).toMatch(/2 or more/);
  });
  it("divisibility rules agree with real division", () => {
    const r = run(numtheory, "divisibility-checker", { number: "123456" });
    expect(primary(r)).toBe("2, 3, 4, 6, 8, 12");
    for (const n of [0, 1, 7, 12, 99, 121, 1001, 123456789, 987654321012]) {
      const res = run(numtheory, "divisibility-checker", { number: String(n) });
      const expected = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].filter((d) => n % d === 0).join(", ") || "none of these";
      expect(primary(res), String(n)).toBe(expected);
    }
  });
  it("handles very long numbers and custom divisors exactly", () => {
    const big = "1" + "0".repeat(60);
    expect(primary(run(numtheory, "divisibility-checker", { number: big }))).toBe("2, 4, 5, 8, 10");
    expect(primary(run(numtheory, "divisibility-checker", { number: "9".repeat(50) }))).toBe("3, 9, 11"); // 10^50 − 1, and 10^50 ≡ 1 (mod 11)
    expect(primary(run(numtheory, "divisibility-checker", { number: "12,345 678", custom: 7 }))).toMatch(/./);
    const r = run(numtheory, "divisibility-checker", { number: "1001", custom: 13 });
    expect(out(r).table!.rows.at(-1)).toEqual(["13", "Yes", "Remainder when divided by 13 is 0."]);
    expect(errs(run(numtheory, "divisibility-checker", { number: "12a" }))).toMatch(/digits only/);
    expect(errs(run(numtheory, "divisibility-checker", { number: "5", custom: 0 }))).toMatch(/other than zero/);
  });
  it("remainder shows three conventions for negatives", () => {
    expect(primary(run(numtheory, "remainder-calculator", { dividend: 17, divisor: 5 }))).toBe("17 ÷ 5 = 3 remainder 2");
    const neg = run(numtheory, "remainder-calculator", { dividend: -7, divisor: 3 });
    expect(primary(neg)).toBe("−7 ÷ 3 = −2 remainder −1"); // truncated, like JavaScript %
    expect(sec(neg, "Remainder (never negative)")).toBe("2  (quotient −3)");
    expect(sec(neg, "Remainder with the divisor's sign (floor modulo)")).toBe("2  (quotient −3)");
    const negDiv = run(numtheory, "remainder-calculator", { dividend: 7, divisor: -3 });
    expect(primary(negDiv)).toBe("7 ÷ −3 = −2 remainder 1");
    expect(sec(negDiv, "Remainder (never negative)")).toBe("1  (quotient −2)");
    expect(sec(negDiv, "Remainder with the divisor's sign (floor modulo)")).toBe("−2  (quotient −3)");
    expect(errs(run(numtheory, "remainder-calculator", { dividend: 5, divisor: 0 }))).toMatch(/divide by zero/);
    expect(errs(run(numtheory, "remainder-calculator", { dividend: 5.5, divisor: 2 }))).toMatch(/whole numbers/);
  });
  it("remainder matches JavaScript's % and the identity a = b·q + r for many pairs", () => {
    for (const [a, b] of [[17, 5], [-17, 5], [17, -5], [-17, -5], [0, 3], [4, 9], [1e15, 7]]) {
      const r = run(numtheory, "remainder-calculator", { dividend: a, divisor: b });
      const m = /= (−?\d+) remainder (−?\d+)/.exec(String(primary(r)))!;
      const n = (t: string) => Number(t.replace("−", "-"));
      expect(n(m[2]), `${a} % ${b}`).toBe(a % b === 0 ? 0 : a % b);
      expect(b * n(m[1]) + n(m[2])).toBe(a);
    }
  });
});

describe("algebra tools", () => {
  const quad = (a: number, b: number, c: number) => run(algebra, "quadratic-equation-solver", { a, b, c });
  it("solves with real roots and shows vertex, discriminant and exact form", () => {
    const r = quad(1, -5, 6);
    expect(primary(r)).toBe("x₁ = 2,  x₂ = 3");
    expect(sec(r, "Discriminant (b² − 4ac)")).toBe(1);
    expect(sec(r, "Vertex")).toBe("(2.5, −0.25)");
    expect(sec(r, "Exact form")).toBe("x = 3 or x = 2");
    expect(sec(r, "Factored form")).toBe("1(x − 2)(x − 3)");
    expect(sec(quad(2, -3, 1), "Exact form")).toBe("x = 1 or x = 1/2");
    expect(sec(quad(1, 1, -1), "Exact form")).toBe("x = (−1 ± √5) / 2");
    expect(sec(quad(1, 0, -8), "Exact form")).toBe("x = (± 2√2) / 1");
  });
  it("solves repeated and complex roots", () => {
    expect(primary(quad(1, -2, 1))).toBe("x = 1  (repeated)");
    expect(primary(quad(1, 2, 5))).toBe("x = −1 ± 2i");
    expect(primary(quad(4, 4, 1))).toBe("x = −0.5  (repeated)");
  });
  it("roots satisfy the equation, even for badly scaled coefficients", () => {
    for (const [a, b, c] of [[1, -3, 2], [2, 7, -4], [1, 1e8, 1], [1, -1e8, 1], [0.5, 0.25, -3], [-3, 2, 8]]) {
      const text = String(primary(quad(a, b, c))).replace(/(?<=\d),(?=\d{3})/g, "").replace(/−/g, "-"); // undo thousands separators (not the comma between roots) and the typographic minus
      const m = text.match(/x₁ = (-?[\d.e+-]+),\s+x₂ = (-?[\d.e+-]+)/)!;
      for (const root of [Number(m[1]), Number(m[2])]) {
        const resid = Math.abs(a * root * root + b * root + c);
        expect(resid / Math.max(1, Math.abs(a * root * root), Math.abs(b * root)), `${a},${b},${c} root ${root}`).toBeLessThan(1e-6);
      }
    }
  });
  it("rejects a = 0", () => {
    expect(errs(quad(0, 2, 3))).toMatch(/can't be zero/);
  });

  const lin = (v: Record<string, string | number>) => run(algebra, "linear-equation-solver", v);
  it("solves one equation", () => {
    expect(primary(lin({ mode: "one", a: 2, b: 3, c: 11 }))).toBe(4);
    expect(primary(lin({ mode: "one", a: -4, b: 1, c: 9 }))).toBe(-2);
    expect(primary(lin({ mode: "one", a: 0, b: 5, c: 5 }))).toBe("Every real x is a solution");
    expect(errs(lin({ mode: "one", a: 0, b: 5, c: 6 }))).toMatch(/no solution/);
  });
  it("solves a 2×2 system and classifies degenerate ones", () => {
    expect(primary(lin({ mode: "two", a1: 2, b1: 1, c1: 8, a2: 1, b2: -1, c2: 1 }))).toBe("x = 3,  y = 2");
    expect(primary(lin({ mode: "two", a1: 1, b1: 1, c1: 1, a2: 2, b2: 2, c2: 5 }))).toBe("No solution");
    expect(primary(lin({ mode: "two", a1: 1, b1: 1, c1: 1, a2: 2, b2: 2, c2: 2 }))).toBe("Infinitely many solutions");
    const r = lin({ mode: "two", a1: 3, b1: -2, c1: 7, a2: 1, b2: 4, c2: -7 }); // x = 1, y = −2
    expect(primary(r)).toBe("x = 1,  y = −2");
  });

  it("logarithms: values, change of base and domain errors", () => {
    const log = (v: Record<string, string | number>) => run(algebra, "logarithm-calculator", v);
    expect(primary(log({ mode: "log", x: 1000, base: 10 }))).toBe(3);
    expect(primary(log({ mode: "log", x: 256, base: 2 }))).toBe(8);
    expect(primary(log({ mode: "log", x: 1, base: 7 }))).toBe(0);
    const r = log({ mode: "log", x: 100, base: 10 });
    expect(sec(r, "Natural log, ln(x)") as number).toBeCloseTo(Math.log(100), 9);
    expect(sec(r, "Binary log, log₂(x)") as number).toBeCloseTo(Math.log2(100), 9);
    expect(primary(log({ mode: "antilog", y: 3, base: 10 }))).toBe(1000);
    expect(primary(log({ mode: "antilog", y: -2, base: 2 }))).toBe(0.25);
    expect(errs(log({ mode: "log", x: 0, base: 10 }))).toMatch(/not defined/);
    expect(errs(log({ mode: "log", x: -5, base: 10 }))).toMatch(/not defined/);
    expect(errs(log({ mode: "log", x: 5, base: 1 }))).toMatch(/not equal to 1/);
    expect(errs(log({ mode: "log", x: 5, base: -2 }))).toMatch(/positive/);
  });

  it("exponents: exact integers, fractions, and undefined cases", () => {
    const pow = (base: number, exponent: number) => run(algebra, "exponent-calculator", { base, exponent });
    expect(primary(pow(2, 10))).toBe(1024);
    expect(sec(pow(2, 10), "Exact integer")).toBe("1,024");
    expect(sec(pow(7, 25), "Exact integer")).toBe((7n ** 25n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    expect(primary(pow(2, -3))).toBe(0.125);
    expect(sec(pow(2, -3), "As a fraction")).toBe("1 / 8");
    expect(sec(pow(-2, -3), "As a fraction")).toBe("−1 / 8");
    expect(primary(pow(9, 0.5))).toBe(3);
    expect(primary(pow(5, 0))).toBe(1);
    expect(primary(pow(-3, 3))).toBe(-27);
    expect(sec(pow(10, 6), "Scientific notation")).toBe("1 × 10⁶");
    expect(sec(pow(2, -20), "Scientific notation")).toBe("9.53674316 × 10⁻⁷");
    expect(errs(pow(-8, 0.5))).toMatch(/no real result/);
    expect(errs(pow(0, -1))).toMatch(/dividing by zero/);
    expect(errs(pow(10, 400))).toMatch(/too large/);
  });

  it("roots: simplified radicals, perfect powers and negatives", () => {
    const root = (number: number, index = 2) => run(algebra, "square-root-calculator", { number, index });
    expect(primary(root(72))).toBeCloseTo(8.485281374, 8);
    expect(sec(root(72), "Simplified radical form")).toBe("6√2");
    expect(sec(root(81), "Perfect power?")).toBe("Yes — 9^2 = 81");
    expect(primary(root(27, 3))).toBe(3);
    expect(primary(root(-27, 3))).toBe(-3);
    expect(sec(root(54, 3), "Simplified radical form")).toBe("3∛2");
    expect(primary(root(32, 5))).toBe(2);
    expect(primary(root(0))).toBe(0);
    expect(sec(root(17), "Perfect power?")).toMatch(/No — the root is irrational/);
    expect(primary(root(-4))).toBe("2i");
    expect(errs(root(-4, 4))).toMatch(/even root of a negative/);
    expect(primary(root(2)) as number).toBeCloseTo(Math.SQRT2, 10);
  });
});

describe("geometry tools", () => {
  it("Pythagoras: hypotenuse, leg, triples, validation", () => {
    const h = run(geometry, "pythagorean-theorem-calculator", { unknown: "hyp", leg_a: 3, leg_b: 4 });
    expect(primary(h)).toBe(5);
    expect(sec(h, "Area")).toBe(6);
    expect(sec(h, "Perimeter")).toBe(12);
    expect(sec(h, "Pythagorean triple")).toMatch(/Yes/);
    expect(sec(h, "Acute angles")).toBe("36.869898° and 53.130102°");
    expect(primary(run(geometry, "pythagorean-theorem-calculator", { unknown: "leg", leg_a: 5, hyp: 13 }))).toBe(12);
    expect(primary(run(geometry, "pythagorean-theorem-calculator", { unknown: "hyp", leg_a: 1, leg_b: 1 })) as number).toBeCloseTo(Math.SQRT2, 9);
    expect(errs(run(geometry, "pythagorean-theorem-calculator", { unknown: "leg", leg_a: 13, hyp: 13 }))).toMatch(/shorter than the hypotenuse/);
    expect(errs(run(geometry, "pythagorean-theorem-calculator", { unknown: "leg", leg_a: 14, hyp: 13 }))).toMatch(/shorter than the hypotenuse/);
  });
  it("triangle SSS: area, angles, type", () => {
    const right = run(geometry, "triangle-calculator", { mode: "sss", a: 3, b: 4, c: 5 });
    expect(primary(right)).toBe(6);
    expect(sec(right, "Type")).toBe("scalene, right-angled");
    expect(sec(right, "Inradius")).toBe(1); // area ÷ semi-perimeter = 6 ÷ 6
    expect(sec(right, "Circumradius")).toBe(2.5); // hypotenuse ÷ 2
    const t = run(geometry, "triangle-calculator", { mode: "sss", a: 5, b: 6, c: 7 });
    expect(primary(t) as number).toBeCloseTo(Math.sqrt(9 * 4 * 3 * 2), 5); // Heron: √216
    const angles = String(sec(t, "Angle A, B, C")).match(/[\d.]+/g)!.map(Number);
    expect(angles[0] + angles[1] + angles[2]).toBeCloseTo(180, 3);
    expect(sec(run(geometry, "triangle-calculator", { mode: "sss", a: 4, b: 4, c: 4 }), "Type")).toBe("equilateral, acute-angled");
    expect(sec(run(geometry, "triangle-calculator", { mode: "sss", a: 5, b: 5, c: 6 }), "Type")).toBe("isosceles, acute-angled");
    expect(sec(run(geometry, "triangle-calculator", { mode: "sss", a: 5, b: 5, c: 8 }), "Type")).toBe("isosceles, obtuse-angled"); // 25 + 25 < 64
    expect(sec(run(geometry, "triangle-calculator", { mode: "sss", a: 2, b: 2, c: 3.5 }), "Type")).toBe("isosceles, obtuse-angled");
    expect(errs(run(geometry, "triangle-calculator", { mode: "sss", a: 1, b: 2, c: 3 }))).toMatch(/can't form a triangle/);
  });
  it("triangle SAS and ASA agree with trigonometry", () => {
    const sas = run(geometry, "triangle-calculator", { mode: "sas", sas_a: 5, sas_b: 7, sas_angle: 60 });
    expect(primary(sas) as number).toBeCloseTo(0.5 * 5 * 7 * Math.sin(Math.PI / 3), 4);
    expect(String(sec(sas, "Side a, b, c"))).toContain("6.244998"); // c = √39
    const asa = run(geometry, "triangle-calculator", { mode: "asa", asa_A: 50, asa_B: 60, asa_c: 8 });
    const A = (50 * Math.PI) / 180, C = (70 * Math.PI) / 180;
    expect(parseFloat(String(sec(asa, "Side a, b, c")))).toBeCloseTo((8 * Math.sin(A)) / Math.sin(C), 4); // a = c·sin A ÷ sin C
    expect(String(sec(asa, "Angle A, B, C"))).toBe("50°,  60°,  70°");
    expect(errs(run(geometry, "triangle-calculator", { mode: "sas", sas_a: 1, sas_b: 1, sas_angle: 180 }))).toMatch(/less than 180/);
    expect(errs(run(geometry, "triangle-calculator", { mode: "asa", asa_A: 100, asa_B: 80, asa_c: 1 }))).toMatch(/less than 180/);
  });
  it("circle: any known measure gives all the others", () => {
    const r = run(geometry, "circle-calculator", { known: "radius", value: 7, unit: "units" });
    expect(primary(r) as number).toBeCloseTo(Math.PI * 49, 5);
    expect(sec(r, "Diameter")).toBe(14);
    expect(sec(r, "Circumference") as number).toBeCloseTo(14 * Math.PI, 5);
    const fromC = run(geometry, "circle-calculator", { known: "circumference", value: 100, unit: "cm" });
    expect(sec(fromC, "Radius") as number).toBeCloseTo(100 / (2 * Math.PI), 6);
    const fromA = run(geometry, "circle-calculator", { known: "area", value: Math.PI * 25, unit: "units" });
    expect(sec(fromA, "Radius")).toBe(5);
    expect(sec(run(geometry, "circle-calculator", { known: "diameter", value: 10, unit: "units" }), "Radius")).toBe(5);
    expect(errs(run(geometry, "circle-calculator", { known: "radius", value: 0, unit: "units" }))).toMatch(/greater than zero/);
  });
  it("area and volume formulas", () => {
    const av = (v: Record<string, string | number>) => run(geometry, "area-volume-calculator", { unit: "units", ...v });
    expect(primary(av({ shape: "cylinder", radius: 3, height: 10 })) as number).toBeCloseTo(Math.PI * 90, 5);
    expect(sec(av({ shape: "cylinder", radius: 3, height: 10 }), "Total surface area") as number).toBeCloseTo(2 * Math.PI * 3 * 13, 4);
    expect(primary(av({ shape: "cube", side: 3 }))).toBe(27);
    expect(sec(av({ shape: "cube", side: 3 }), "Surface area")).toBe(54);
    expect(primary(av({ shape: "cuboid", length: 10, width: 4, height: 5 }))).toBe(200);
    expect(sec(av({ shape: "cuboid", length: 10, width: 4, height: 5 }), "Surface area")).toBe(220);
    expect(primary(av({ shape: "sphere", radius: 3 })) as number).toBeCloseTo((4 / 3) * Math.PI * 27, 5);
    const cone = av({ shape: "cone", radius: 3, height: 4 });
    expect(primary(cone) as number).toBeCloseTo((Math.PI * 9 * 4) / 3, 5);
    expect(sec(cone, "Slant height")).toBe(5);
    expect(sec(cone, "Curved surface area") as number).toBeCloseTo(Math.PI * 15, 5);
    expect(primary(av({ shape: "trapezoid", parallel_a: 5, parallel_b: 9, height: 4 }))).toBe(28);
    expect(primary(av({ shape: "triangle", base: 6, height: 4 }))).toBe(12);
    expect(primary(av({ shape: "parallelogram", base: 6, height: 4 }))).toBe(24);
    const rect = av({ shape: "rectangle", length: 10, width: 4 });
    expect(primary(rect)).toBe(40);
    expect(sec(rect, "Perimeter")).toBe(28);
    expect(sec(rect, "Diagonal") as number).toBeCloseTo(Math.hypot(10, 4), 6);
    expect(errs(av({ shape: "hexagon" }))).toMatch(/Choose a shape/);
  });
});

describe("statistics tools", () => {
  const sd = (values: string, kind = "sample") => run(statistics, "standard-deviation-calculator", { values, kind });
  it("sample and population standard deviation by hand", () => {
    // mean 6, squared deviations 4+4+0+1+9+1+9 = 28 → population var 4 → σ 2; sample var 28/6 → s 2.1602
    const s = sd("4 8 6 5 3 7 9");
    expect(primary(s) as number).toBeCloseTo(Math.sqrt(28 / 6), 6);
    expect(sec(s, "Population standard deviation (σ)")).toBe(2);
    expect(sec(s, "Mean")).toBe(6);
    expect(sec(s, "Sum of squared deviations")).toBe(28);
    expect(primary(sd("4 8 6 5 3 7 9", "population"))).toBe(2);
  });
  it("accepts commas, new lines and decimals; flags bad input", () => {
    expect(sec(sd("1, 2, 3\n4, 5"), "Mean")).toBe(3);
    expect(primary(sd("2,2,2,2"))).toBe(0);
    expect(errs(sd("5"))).toMatch(/at least 2/);
    expect(errs(sd("1 2 x"))).toMatch(/./);
  });
  it("is numerically stable for large offsets", () => {
    const base = 1e9;
    expect(primary(sd(`${base + 1} ${base + 2} ${base + 3}`, "population")) as number).toBeCloseTo(Math.sqrt(2 / 3), 6);
  });
  it("percentage error", () => {
    const pe = (measured: number, true_value: number) => run(statistics, "percentage-error-calculator", { measured, true_value });
    expect(primary(pe(9.6, 9.81)) as number).toBeCloseTo((0.21 / 9.81) * 100, 6);
    expect(sec(pe(9.6, 9.81), "Signed error") as number).toBeCloseTo(-(0.21 / 9.81) * 100, 6);
    expect(primary(pe(110, 100))).toBe(10);
    expect(sec(pe(90, 100), "Signed error")).toBe(-10);
    expect(primary(pe(-90, -100))).toBe(10);
    expect(sec(pe(5, 5), "Direction")).toBe("Exactly equal to the true value");
    expect(errs(pe(1, 0))).toMatch(/can't be zero/);
  });
});
