import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { divisorCount, divisorSum, factorString, factorize, isPrime, nextPrime, prevPrime, smallestFactor } from "@/lib/primes";
import { fail, num, ok, optNum, str } from "../helpers";

const fmt = (n: number) => formatNumber(n, { maxDecimals: 0 });
/** Whole numbers (BigInt-safe) shown with the same typographic minus as every other tool. */
const int = (x: bigint | number) => String(x).replace("-", "−");

export const engines: EngineMap = {
  "prime-number-checker": (v) => {
    const n = num(v, "number");
    if (!Number.isInteger(n)) return fail("Enter a whole number.", "number");
    const prime = isPrime(n);
    const prev = prevPrime(n), next = nextPrime(n);
    const secondary = [] as { label: string; value: ReturnType<typeof T> | ReturnType<typeof N> }[];
    if (n >= 2 && !prime) {
      const sf = smallestFactor(n);
      secondary.push({ label: "Smallest prime factor", value: sf ? N(sf) : T("larger than 10,000,000") });
      if (sf) secondary.push({ label: "Divisible by", value: T(`${fmt(sf)} × ${fmt(n / sf)} = ${fmt(n)}`) });
    }
    secondary.push({ label: "Previous prime", value: prev === null ? T("none") : N(prev) }, { label: "Next prime", value: next === null ? T("beyond the supported range") : N(next) });
    const verdict = n < 2 ? "Neither prime nor composite" : prime ? "Prime" : "Composite";
    return ok({
      primary: { label: `Is ${fmt(n)} prime?`, value: T(verdict) },
      secondary,
      steps: n < 2 ? ["Prime numbers are whole numbers greater than 1. 0 and 1 are neither prime nor composite."] : prime ? [`${fmt(n)} has no divisors other than 1 and itself (checked with the deterministic Miller–Rabin test).`] : [`${fmt(n)} has a divisor other than 1 and itself, so it is composite.`],
      notes: ["Exact for every whole number up to 9,007,199,254,740,991 (2⁵³ − 1)."],
    });
  },

  "prime-factorization-calculator": (v) => {
    const n = num(v, "number");
    if (!Number.isInteger(n)) return fail("Enter a whole number.", "number");
    if (n < 2) return fail("Enter a whole number of 2 or more — 0 and 1 have no prime factorisation.", "number");
    const f = factorize(n);
    const check = f.reduce((a, [p, e]) => a * p ** e, 1);
    if (check !== n) return fail("That number is too large to factorise reliably here. Try a number below 10¹⁵.", "number");
    return ok({
      primary: { label: `Prime factorisation of ${fmt(n)}`, value: T(f.length === 1 && f[0][1] === 1 ? `${fmt(n)} (prime)` : factorString(f)) },
      secondary: [
        { label: "Distinct prime factors", value: T(f.map(([p]) => fmt(p)).join(", ")) },
        { label: "Number of divisors", value: N(divisorCount(f)) },
        { label: "Sum of divisors", value: N(divisorSum(f)) },
      ],
      table: { caption: "Prime factors", columns: ["Prime", "Exponent", "Value"], rows: f.map(([p, e]) => [fmt(p), e, fmt(p ** e)]) },
      steps: [`Divide out the smallest primes repeatedly: ${f.map(([p, e]) => `${fmt(p)} appears ${e} time${e === 1 ? "" : "s"}`).join(", ")}`, `Check: ${f.map(([p, e]) => (e === 1 ? fmt(p) : `${fmt(p)}^${e}`)).join(" × ")} = ${fmt(n)}`],
    });
  },

  "divisibility-checker": (v) => {
    const raw = str(v, "number").replace(/[,\s_]/g, "");
    if (!/^-?\d{1,500}$/.test(raw)) return fail("Enter a whole number using digits only (up to 500 digits). Commas and spaces are ignored.", "number");
    const digits = raw.replace("-", "");
    const big = BigInt(digits);
    const custom = optNum(v, "custom");
    if (custom !== undefined && (!Number.isInteger(custom) || custom === 0)) return fail("The custom divisor must be a whole number other than zero.", "custom");
    const last = (k: number) => Number(digits.slice(-k));
    const digitSum = [...digits].reduce((a, c) => a + Number(c), 0);
    const alt = [...digits].reverse().reduce((a, c, i) => a + (i % 2 === 0 ? 1 : -1) * Number(c), 0);
    const by = (d: number) => big % BigInt(d) === 0n;
    const rows: [string, string, string][] = [
      ["2", by(2) ? "Yes" : "No", `The last digit is ${digits.slice(-1)} (${Number(digits.slice(-1)) % 2 === 0 ? "even" : "odd"}).`],
      ["3", by(3) ? "Yes" : "No", `The digit sum is ${digitSum}${digitSum % 3 === 0 ? ", a multiple of 3" : ", not a multiple of 3"}.`],
      ["4", by(4) ? "Yes" : "No", `The last two digits make ${last(2)}${last(2) % 4 === 0 ? ", divisible by 4" : ", not divisible by 4"}.`],
      ["5", by(5) ? "Yes" : "No", `The last digit is ${digits.slice(-1)}${["0", "5"].includes(digits.slice(-1)) ? " (0 or 5)" : " (not 0 or 5)"}.`],
      ["6", by(6) ? "Yes" : "No", `Needs to be divisible by both 2 and 3: ${by(2) ? "2 yes" : "2 no"}, ${by(3) ? "3 yes" : "3 no"}.`],
      ["8", by(8) ? "Yes" : "No", `The last three digits make ${last(3)}${last(3) % 8 === 0 ? ", divisible by 8" : ", not divisible by 8"}.`],
      ["9", by(9) ? "Yes" : "No", `The digit sum is ${digitSum}${digitSum % 9 === 0 ? ", a multiple of 9" : ", not a multiple of 9"}.`],
      ["10", by(10) ? "Yes" : "No", `The last digit is ${digits.slice(-1)}${digits.slice(-1) === "0" ? " (0)" : " (not 0)"}.`],
      ["11", by(11) ? "Yes" : "No", `The alternating digit sum is ${alt}${alt % 11 === 0 ? ", a multiple of 11" : ", not a multiple of 11"}.`],
      ["12", by(12) ? "Yes" : "No", `Needs to be divisible by both 3 and 4: ${by(3) ? "3 yes" : "3 no"}, ${by(4) ? "4 yes" : "4 no"}.`],
    ];
    if (custom !== undefined) {
      const d = BigInt(Math.abs(custom));
      rows.push([String(Math.abs(custom)), big % d === 0n ? "Yes" : "No", `Remainder when divided by ${Math.abs(custom)} is ${big % d}.`]);
    }
    const yes = rows.filter((r) => r[1] === "Yes").map((r) => r[0]);
    return ok({
      primary: { label: "Divisible by", value: T(yes.length ? yes.join(", ") : "none of these") },
      secondary: [{ label: "Number tested", value: T(digits.length > 40 ? `${digits.slice(0, 18)}…${digits.slice(-12)}` : (raw.startsWith("-") ? "−" : "") + digits) }, { label: "Digit sum", value: N(digitSum) }, { label: "Number of digits", value: N(digits.length) }],
      table: { caption: "Divisibility tests", columns: ["Divisor", "Divisible?", "Why"], rows },
      notes: ["Exact for numbers of any length up to 500 digits. The sign is ignored: a number and its negative have the same divisors."],
    });
  },

  "remainder-calculator": (v) => {
    const a = num(v, "dividend"), b = num(v, "divisor");
    if (!Number.isInteger(a) || !Number.isInteger(b)) return fail("Enter whole numbers for both the dividend and the divisor.", Number.isInteger(a) ? "divisor" : "dividend");
    if (b === 0) return fail("You can't divide by zero.", "divisor");
    const A = BigInt(a), B = BigInt(b);
    const q = A / B, r = A % B; // truncated division (toward zero), remainder takes the sign of the dividend
    const absB = B < 0n ? -B : B;
    const eu = ((A % absB) + absB) % absB; // Euclidean remainder: always in [0, |b|)
    const euQ = (A - eu) / B;
    const flooredQ = r !== 0n && (r < 0n) !== (B < 0n) ? q - 1n : q;
    const flooredR = A - flooredQ * B; // floor modulo: takes the sign of the divisor
    return ok({
      primary: { label: "Quotient and remainder", value: T(`${int(a)} ÷ ${int(b)} = ${int(q)} remainder ${int(r)}`) },
      secondary: [
        { label: "As a decimal", value: N(a / b, undefined, 10) },
        { label: "Remainder (never negative)", value: T(`${int(eu)}  (quotient ${int(euQ)})`) },
        { label: "Remainder with the divisor's sign (floor modulo)", value: T(`${int(flooredR)}  (quotient ${int(flooredQ)})`) },
      ],
      steps: [`${int(a)} = ${int(b)} × ${int(q)} + ${int(r)}`, `Check: ${int(b)} × ${int(q)} = ${int(B * q)}, and ${int(a)} − ${int(B * q)} = ${int(r)}`],
      notes: a < 0 || b < 0 ? ["Programming languages disagree on negative numbers: C, Java and JavaScript % give the truncated remainder shown first; Python gives the floor-modulo result."] : undefined,
    });
  },
};
