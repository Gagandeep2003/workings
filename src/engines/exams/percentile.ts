import type { EngineMap, Engine } from "@/tools/types";
import { N, P } from "@/lib/format";
import { fail, num, ok, str } from "../helpers";
import { f, percentileFromRank } from "./common";

/**
 * Percentile from the counts that define it. This deliberately does NOT convert raw marks to a percentile:
 * that mapping changes with every session, year and candidate pool, so any fixed table would be invented.
 */
function percentileEngine(opts: { decimals: number; what: string; poolWord: string }): Engine {
  return (v) => {
    const mode = str(v, "mode");
    const pool = num(v, "candidates");
    if (!Number.isInteger(pool) || pool < 1) return fail(`Enter the number of ${opts.poolWord} as a whole number of at least 1.`, "candidates");
    const round = (x: number) => Math.round(x * 10 ** opts.decimals) / 10 ** opts.decimals;

    if (mode === "rank") {
      const rank = num(v, "rank");
      if (rank > pool) return fail(`Your rank (${f(rank)}) can't be larger than the number of ${opts.poolWord} (${f(pool)}).`, "rank");
      const p = percentileFromRank(rank, pool);
      return ok({
        primary: { label: "Percentile", value: P(round(p), opts.decimals) },
        secondary: [{ label: "Candidates at or below your score", value: N(pool - rank + 1) }, { label: "Candidates strictly above you", value: N(rank - 1) }],
        steps: [`Percentile = 100 × (${f(pool)} − ${f(rank)} + 1) ÷ ${f(pool)} = ${f(round(p))}`],
        notes: [`This is the percentile for the ${opts.what}. If several candidates share a score, they share a rank and the same percentile.`],
      });
    }
    if (mode === "count") {
      const below = num(v, "below");
      if (below > pool) return fail(`The number scoring at or below you (${f(below)}) can't be larger than the total (${f(pool)}).`, "below");
      const p = (100 * below) / pool;
      return ok({
        primary: { label: "Percentile", value: P(round(p), opts.decimals) },
        secondary: [{ label: "Equivalent best rank", value: N(pool - below + 1) }],
        steps: [`Percentile = 100 × ${f(below)} ÷ ${f(pool)} = ${f(round(p))}`],
        notes: [`This is the percentile for the ${opts.what}.`],
      });
    }
    const pct = num(v, "percentile");
    if (pct < 0 || pct > 100) return fail("A percentile must be between 0 and 100.", "percentile");
    const below = Math.ceil((pct / 100) * pool - 1e-9);
    const rank = Math.max(1, pool - below + 1);
    return ok({
      primary: { label: "Approximate rank", value: N(rank) },
      secondary: [{ label: "Candidates at or below that score", value: N(below) }, { label: "Candidates ahead of you", value: N(rank - 1) }],
      steps: [`Candidates at or below = ⌈${f(pct)} ÷ 100 × ${f(pool)}⌉ = ${f(below)}`, `Rank = ${f(pool)} − ${f(below)} + 1 = ${f(rank)}`],
      notes: [`This is the best rank within the ${opts.what} that matches the percentile. Ties and rounding of the published percentile mean the real rank can differ by some places.`],
    });
  };
}

export const engines: EngineMap = {
  "jee-main-percentile-calculator": percentileEngine({ decimals: 7, what: "session you entered the figures for", poolWord: "candidates who appeared in your session" }),
  "cat-percentile-calculator": percentileEngine({ decimals: 2, what: "candidate pool you entered", poolWord: "candidates who appeared" }),
};
