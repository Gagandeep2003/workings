/** Number theory helpers. Exact for integers up to Number.MAX_SAFE_INTEGER (2^53 − 1). */

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]; // deterministic for n < 3.3 × 10^24

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** Deterministic Miller–Rabin primality test. */
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  if (n < 25) return true;
  const big = BigInt(n);
  let d = big - 1n;
  let s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  for (const a of MR_BASES) {
    if (a % big === 0n) continue;
    let x = modPow(a, d, big);
    if (x === 1n || x === big - 1n) continue;
    let composite = true;
    for (let i = 1; i < s; i++) {
      x = (x * x) % big;
      if (x === big - 1n) { composite = false; break; }
    }
    if (composite) return false;
  }
  return true;
}

export function nextPrime(n: number): number | null {
  let c = Math.floor(n) + 1;
  if (c <= 2) return 2;
  if (c % 2 === 0) c++;
  for (; c <= Number.MAX_SAFE_INTEGER; c += 2) if (isPrime(c)) return c;
  return null;
}

export function prevPrime(n: number): number | null {
  let c = Math.ceil(n) - 1;
  if (c < 2) return null;
  if (c === 2) return 2;
  if (c % 2 === 0) c--;
  for (; c >= 3; c -= 2) if (isPrime(c)) return c;
  return 2;
}

/**
 * Smallest prime factor found by trial division up to `limit`. Returns null if none exists below the limit
 * (the number may still be composite — callers combine this with `isPrime`).
 */
export function smallestFactor(n: number, limit = 10_000_000): number | null {
  if (n < 4) return null;
  if (n % 2 === 0) return 2;
  if (n % 3 === 0) return 3;
  const max = Math.min(Math.floor(Math.sqrt(n)), limit);
  for (let d = 5; d <= max; d += 6) {
    if (n % d === 0) return d;
    if (n % (d + 2) === 0) return d + 2;
  }
  return null;
}

/** Prime factorisation as ordered [prime, exponent] pairs. Fast for numbers below ~10^15. */
export function factorize(n: number): [number, number][] {
  const out: [number, number][] = [];
  let rest = n;
  const take = (p: number) => {
    let e = 0;
    while (rest % p === 0) { rest /= p; e++; }
    if (e) out.push([p, e]);
  };
  take(2);
  take(3);
  for (let d = 5; d * d <= rest; d += 6) {
    if (rest === 1) break;
    if (rest > 1 && d * d <= rest && rest % d === 0) take(d);
    if (rest > 1 && (d + 2) * (d + 2) <= rest && rest % (d + 2) === 0) take(d + 2);
    if (rest > 3 && isPrime(rest)) break; // the remaining cofactor is prime: stop early
  }
  if (rest > 1) out.push([rest, 1]);
  return out;
}

export const divisorCount = (f: [number, number][]) => f.reduce((a, [, e]) => a * (e + 1), 1);

export function divisorSum(f: [number, number][]): number {
  return f.reduce((a, [p, e]) => a * ((p ** (e + 1) - 1) / (p - 1)), 1);
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const superscript = (n: number) => String(n).split("").map((c) => SUP[Number(c)]).join("");

export function factorString(f: [number, number][]): string {
  return f.map(([p, e]) => (e === 1 ? String(p) : `${p}${superscript(e)}`)).join(" × ");
}

/** Largest perfect-power part of `n` for a given root index: n = coefficient^index × radicand. */
export function simplifyRoot(n: number, index: number): { coefficient: number; radicand: number } {
  if (n === 0) return { coefficient: 0, radicand: 1 };
  let coefficient = 1;
  let radicand = 1;
  for (const [p, e] of factorize(Math.abs(n))) {
    coefficient *= p ** Math.floor(e / index);
    radicand *= p ** (e % index);
  }
  return { coefficient, radicand };
}

export const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
