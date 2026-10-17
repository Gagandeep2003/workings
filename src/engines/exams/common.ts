import { formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";

export const f = (n: number) => formatNumber(n, { maxDecimals: 4 });
export const r4 = (n: number) => clean(Math.round(n * 1e4) / 1e4);

/** Net marks for an objective section: marks per right answer, a penalty per wrong one, nothing for skipped. */
export const net = (correct: number, wrong: number, marksCorrect: number, penalty: number) => clean(correct * marksCorrect - wrong * penalty);

export const accuracyPct = (correct: number, wrong: number): number | null => (correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : null);

/**
 * Percentile as defined by the NTA and the IIMs: the percentage of candidates who scored the same as you or lower.
 * `rank` is the "competition" rank, so tied candidates share the best rank and `rank − 1` people scored strictly higher.
 */
export const percentileFromRank = (rank: number, candidates: number): number => (100 * (candidates - rank + 1)) / candidates;
