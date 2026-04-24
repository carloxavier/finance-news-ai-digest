/**
 * Pure selection logic for the digest email.
 *
 * This file has NO Supabase/Resend/Deno-runtime imports so it can be
 * unit-tested from Node via Vitest. The surrounding Edge Function
 * handler imports `selectArticlesForDigest` and supplies the I/O
 * (fetching candidates, fetching the already-sent set, writing
 * digest_sent_articles).
 *
 * Keep this file free of runtime-specific types. Changes here should
 * be covered by `selection.test.ts`.
 */

export interface Article {
  id: string;
  headline: string;
  publication: string;
  published_at: string;
  ai_preview: string;
  consensus_signal: string;
  extracted_tickers: string[];
  inference_watch: string[];
}

export interface SelectionConfig {
  /** Final article count target for the digest. */
  targetSize: number;
  /** Minimum articles required to send. Below this, skip the digest. */
  minFloor: number;
}

export interface SelectionStats {
  candidateCount: number;
  alreadySentCount: number;
  dedupRemoved: number;
}

export type SelectionResult =
  | { kind: "send"; articles: Article[]; stats: SelectionStats }
  | { kind: "skip"; articles: []; stats: SelectionStats };

/**
 * Applies dedup and truncation to produce the final article list for a
 * subscriber's digest. Decides whether the digest should be sent at all.
 *
 * Rules (keep these in sync with the test file):
 * 1. Remove any article whose id appears in `alreadySentIds`.
 * 2. Truncate the remaining list to `config.targetSize`, preserving
 *    the input order from `candidates`.
 * 3. If the truncated list has fewer than `config.minFloor` entries,
 *    return `{ kind: "skip" }`. Otherwise return `{ kind: "send" }`.
 *
 * This function does NOT read or write `digest_sent_articles`. The
 * caller fetches `alreadySentIds` and persists the send record.
 */
export function selectArticlesForDigest(
  candidates: Article[],
  alreadySentIds: Set<string>,
  config: SelectionConfig,
): SelectionResult {
  const fresh = candidates.filter((a) => !alreadySentIds.has(a.id));
  const truncated = fresh.slice(0, config.targetSize);

  const stats: SelectionStats = {
    candidateCount: candidates.length,
    alreadySentCount: alreadySentIds.size,
    dedupRemoved: candidates.length - fresh.length,
  };

  if (truncated.length < config.minFloor) {
    return { kind: "skip", articles: [], stats };
  }

  return { kind: "send", articles: truncated, stats };
}
