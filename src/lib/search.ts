/**
 * Local tool search. Pure functions, no network. Scores title, aliases, keywords, common phrases,
 * description and category, with prefix and typo tolerance. ~80 entries, so it runs in well under a millisecond.
 */
export type SearchEntry = {
  i: string; // tool id
  t: string; // title
  c: string; // category id
  p: string; // path
  d: string; // short description
  a: string[]; // aliases
  k: string[]; // keywords
  h: string[]; // common phrases
};

const STOP = new Set([
  "how", "much", "many", "is", "are", "was", "what", "whats", "the", "a", "an", "of", "for", "do", "does", "i", "me", "my", "can", "in", "on",
  "at", "and", "or", "with", "from", "by", "get", "find", "calculate", "calculator", "calc", "online", "free", "tool", "tools", "convert",
  "converter", "check", "generate", "make", "create", "to", "into", "x", "y",
]);
const CATEGORY_NAMES: Record<string, string> = {
  math: "math", everyday: "everyday", student: "student", career: "career", money: "money", developer: "developer dev code", exams: "exams exam",
};

export function normalize(text: string): string {
  return text.toLowerCase().replace(/%/g, " percent ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
export const tokenize = (text: string): string[] => normalize(text).split(" ").filter(Boolean).map(stem);

/** Restricted Damerau–Levenshtein distance, bailing out above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    let rowMin = Infinity;
    for (const x of cur) rowMin = Math.min(rowMin, x);
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
}

type Prepared = {
  entry: SearchEntry;
  title: string[]; titleStr: string;
  aliasTokens: string[]; aliasStrs: string[];
  keywordTokens: string[]; keywordStrs: string[];
  phraseTokens: string[]; phraseStrs: string[];
  desc: Set<string>; cat: string[];
};

const cache = new WeakMap<SearchEntry[], Prepared[]>();
function prepare(entries: SearchEntry[]): Prepared[] {
  let hit = cache.get(entries);
  if (!hit) {
    hit = entries.map((entry) => ({
      entry,
      title: tokenize(entry.t),
      titleStr: normalize(entry.t),
      aliasTokens: entry.a.flatMap(tokenize), aliasStrs: entry.a.map(normalize),
      keywordTokens: entry.k.flatMap(tokenize), keywordStrs: entry.k.map(normalize),
      phraseTokens: entry.h.flatMap(tokenize), phraseStrs: entry.h.map(normalize),
      desc: new Set(tokenize(entry.d)),
      cat: tokenize(CATEGORY_NAMES[entry.c] ?? entry.c),
    }));
    cache.set(entries, hit);
  }
  return hit;
}

const fuzzyMax = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

function best(q: string, tokens: string[], exact: number, prefix: number, fuzzy: number): number {
  let score = 0;
  const f = fuzzyMax(q.length);
  for (const tok of tokens) {
    if (tok === q) return exact;
    if (q.length >= 2 && tok.startsWith(q)) score = Math.max(score, prefix);
    else if (f > 0 && tok.length >= 4 && editDistance(q, tok, f) <= f) score = Math.max(score, fuzzy);
  }
  return score;
}

function tokenScore(q: string, p: Prepared): number {
  return Math.max(
    best(q, p.title, 10, 7, 5),
    best(q, p.aliasTokens, 8, 5, 3),
    best(q, p.keywordTokens, 6, 4, 3),
    best(q, p.phraseTokens, 4, 2, 0),
    p.desc.has(q) ? 2 : 0,
    p.cat.includes(q) ? 3 : 0,
  );
}

export function search(entries: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const norm = normalize(query);
  if (norm.length === 0) return [];
  const required = tokenize(query).filter((t) => !STOP.has(t) && !/^\d+$/.test(t) && t.length >= 1);
  const results: { e: SearchEntry; score: number; idx: number }[] = [];
  prepare(entries).forEach((p, idx) => {
    let score = 0;
    if (required.length === 0) {
      // only generic words, e.g. "calculator" or "convert": match on the whole string
      if (norm.length >= 3 && (p.titleStr.includes(norm) || p.aliasStrs.some((a) => a.includes(norm)))) score = 5;
      else return;
    } else {
      let titleHits = 0;
      for (const q of required) {
        const s = tokenScore(q, p);
        if (s === 0) return; // every meaningful word must match something
        score += s;
        if (best(q, p.title, 10, 7, 5) >= 7) titleHits++;
      }
      if (titleHits === required.length) score += 8;
    }
    if (p.titleStr === norm) score += 40; // typing a tool's exact name must open that tool, not a longer title that merely contains it
    if (norm.length >= 3) {
      if (p.titleStr.includes(norm)) score += 20;
      if (p.titleStr.startsWith(norm)) score += 6;
      if (p.aliasStrs.some((a) => a.includes(norm))) score += 14;
      if (p.keywordStrs.some((a) => a.includes(norm))) score += 10;
      if (p.phraseStrs.some((a) => a.includes(norm) || norm.includes(a))) score += 8;
    }
    results.push({ e: p.entry, score, idx });
  });
  results.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return results.slice(0, limit).map((r) => r.e);
}

/** Group results by category for display. */
export function groupByCategory<T extends { c: string }>(items: T[]): { category: string; items: T[] }[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const it of items) {
    if (!map.has(it.c)) {
      map.set(it.c, []);
      order.push(it.c);
    }
    map.get(it.c)!.push(it);
  }
  return order.map((category) => ({ category, items: map.get(category)! }));
}
