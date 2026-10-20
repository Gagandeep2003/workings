import type { EngineContext, EngineMap } from "@/tools/types";
import { N, T } from "@/lib/format";
import { fail, ok, str, num } from "../helpers";
import { randomBelow } from "./lines";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";
const AMBIGUOUS = /[Il1O0o|`'"]/g;

export function generatePassword(ctx: EngineContext, o: { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; noAmbiguous: boolean; symbolSet: string }): { password: string; poolSize: number } {
  const clean = (s: string) => (o.noAmbiguous ? s.replace(AMBIGUOUS, "") : s);
  const sets = [o.lower && clean(LOWER), o.upper && clean(UPPER), o.digits && clean(DIGITS), o.symbols && clean(o.symbolSet || SYMBOLS)].filter(Boolean) as string[];
  const pool = [...new Set(sets.join(""))];
  const chars: string[] = sets.map((s) => [...s][randomBelow(ctx, [...s].length)]); // at least one from every chosen group
  while (chars.length < o.length) chars.push(pool[randomBelow(ctx, pool.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randomBelow(ctx, i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return { password: chars.join(""), poolSize: pool.length };
}

const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum at vero eos accusamus iusto odio dignissimos ducimus blanditiis praesentium voluptatum deleniti atque corrupti quos dolores quas molestias excepturi occaecati cupiditate provident similique mollitia animi perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta explicabo nemo ipsam quia voluptas aspernatur aut odit fugit consequuntur magni".split(" ");
const OPENING = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

function sentence(ctx: EngineContext, opening: boolean): string {
  if (opening) return `${OPENING}${["", ", sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"][randomBelow(ctx, 2)]}.`;
  const len = 7 + randomBelow(ctx, 10);
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(WORDS[randomBelow(ctx, WORDS.length)]);
  if (len > 9) words[3 + randomBelow(ctx, len - 6)] += ",";
  const s = words.join(" ").replace(/,$/, "");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

export function loremIpsum(ctx: EngineContext, unit: "paragraphs" | "sentences" | "words", count: number, startWithLorem: boolean): string {
  if (unit === "words") {
    const w: string[] = startWithLorem ? ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit"].slice(0, count) : [];
    while (w.length < count) w.push(WORDS[randomBelow(ctx, WORDS.length)]);
    return w.join(" ");
  }
  if (unit === "sentences") return Array.from({ length: count }, (_, i) => sentence(ctx, startWithLorem && i === 0)).join(" ");
  return Array.from({ length: count }, (_, p) => Array.from({ length: 3 + randomBelow(ctx, 4) }, (_, i) => sentence(ctx, startWithLorem && p === 0 && i === 0)).join(" ")).join("\n\n");
}

export const engines: EngineMap = {
  "password-generator": (v, ctx) => {
    const length = num(v, "length");
    const count = num(v, "count");
    const flags = { lower: str(v, "lower") === "yes", upper: str(v, "upper") === "yes", digits: str(v, "digits") === "yes", symbols: str(v, "symbols") === "yes" };
    const groups = Object.values(flags).filter(Boolean).length;
    if (groups === 0) return fail("Choose at least one kind of character.", "lower");
    if (length < groups) return fail(`A password with ${groups} kinds of characters needs at least ${groups} characters.`, "length");
    const symbolSet = str(v, "symbolset").trim();
    if (flags.symbols && symbolSet && /\s/.test(symbolSet)) return fail("Symbols can't include spaces.", "symbolset");
    const list: string[] = [];
    let pool = 0;
    for (let i = 0; i < count; i++) {
      const r = generatePassword(ctx, { length, ...flags, noAmbiguous: str(v, "ambiguous") === "yes", symbolSet });
      list.push(r.password); pool = r.poolSize;
    }
    const bits = Math.round(length * Math.log2(pool));
    const label = bits < 40 ? "Weak" : bits < 60 ? "Fair" : bits < 80 ? "Strong" : bits < 112 ? "Very strong" : "Excellent";
    return ok({
      primary: { label: count === 1 ? "Password" : "First password", value: T(list[0]) },
      secondary: [{ label: "Strength", value: T(`${label} (about ${bits} bits)`) }, { label: "Characters to choose from", value: N(pool) }],
      texts: count > 1 ? [{ label: "All passwords (copy this)", value: list.join("\n"), copyable: true }] : undefined,
      notes: ["Generated in your browser with the secure random generator built into it. Nothing is sent or stored.", "The strength figure is length × log2(character pool). It assumes the password is random, which these are; a password you invent yourself is weaker than its length suggests."],
    });
  },
  "lorem-ipsum-generator": (v, ctx) => {
    const unit = str(v, "unit") as "paragraphs" | "sentences" | "words";
    const count = num(v, "count");
    const text = loremIpsum(ctx, unit, count, str(v, "start") === "yes");
    const words = text.split(/\s+/).filter(Boolean).length;
    return ok({
      primary: { label: unit === "paragraphs" ? "Paragraphs" : unit === "sentences" ? "Sentences" : "Words", value: N(count) },
      secondary: [{ label: "Words", value: N(words) }, { label: "Characters", value: N(text.length) }],
      texts: [{ label: "Placeholder text (copy this)", value: text, copyable: true }],
    });
  },
};
