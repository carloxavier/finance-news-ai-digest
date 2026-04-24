import { describe, it, expect } from "vitest";
import { selectArticlesForDigest, type Article } from "./selection.ts";

// --- Helpers ---

const makeArticle = (id: string, published_at = "2026-04-24T00:00:00Z"): Article => ({
  id,
  headline: `Article ${id}`,
  publication: "Test",
  published_at,
  ai_preview: "preview",
  consensus_signal: "BUY",
  extracted_tickers: [],
  inference_watch: [],
});

const config = { targetSize: 8, minFloor: 3 };

// --- Tests ---

describe("selectArticlesForDigest", () => {
  describe("happy path", () => {
    it("sends all candidates when pool size equals target and nothing is already-sent", () => {
      const candidates = Array.from({ length: 8 }, (_, i) => makeArticle(`a${i}`));
      const result = selectArticlesForDigest(candidates, new Set(), config);

      expect(result.kind).toBe("send");
      if (result.kind === "send") {
        expect(result.articles).toHaveLength(8);
        expect(result.articles[0].id).toBe("a0");
        expect(result.stats.dedupRemoved).toBe(0);
      }
    });

    it("truncates to targetSize when pool is larger", () => {
      const candidates = Array.from({ length: 20 }, (_, i) => makeArticle(`a${i}`));
      const result = selectArticlesForDigest(candidates, new Set(), config);

      expect(result.kind).toBe("send");
      if (result.kind === "send") {
        expect(result.articles).toHaveLength(8);
        // Input order is preserved — first 8.
        expect(result.articles.map((a) => a.id)).toEqual(
          ["a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7"],
        );
      }
    });
  });

  describe("dedup filtering", () => {
    it("removes already-sent articles before truncating", () => {
      const candidates = Array.from({ length: 10 }, (_, i) => makeArticle(`a${i}`));
      const alreadySent = new Set(["a0", "a1", "a2"]);

      const result = selectArticlesForDigest(candidates, alreadySent, config);

      expect(result.kind).toBe("send");
      if (result.kind === "send") {
        expect(result.articles).toHaveLength(7);
        expect(result.articles[0].id).toBe("a3"); // first novel
        expect(result.stats.dedupRemoved).toBe(3);
      }
    });

    it("preserves input order among fresh articles", () => {
      // Already-sent articles are scattered through the candidate list.
      const candidates = Array.from({ length: 12 }, (_, i) => makeArticle(`a${i}`));
      const alreadySent = new Set(["a2", "a5", "a9"]);

      const result = selectArticlesForDigest(candidates, alreadySent, config);

      expect(result.kind).toBe("send");
      if (result.kind === "send") {
        expect(result.articles.map((a) => a.id)).toEqual(
          ["a0", "a1", "a3", "a4", "a6", "a7", "a8", "a10"],
        );
        expect(result.stats.dedupRemoved).toBe(3);
      }
    });

    it("does not modify the input candidates array", () => {
      const candidates = Array.from({ length: 5 }, (_, i) => makeArticle(`a${i}`));
      const original = [...candidates];
      const alreadySent = new Set(["a1"]);

      selectArticlesForDigest(candidates, alreadySent, config);

      expect(candidates).toEqual(original);
    });
  });

  describe("minimum floor exhaustion", () => {
    it("sends exactly at the floor", () => {
      const candidates = Array.from({ length: 3 }, (_, i) => makeArticle(`a${i}`));
      const result = selectArticlesForDigest(candidates, new Set(), config);

      expect(result.kind).toBe("send");
      if (result.kind === "send") {
        expect(result.articles).toHaveLength(3);
      }
    });

    it("skips when 1 below the floor", () => {
      const candidates = Array.from({ length: 2 }, (_, i) => makeArticle(`a${i}`));
      const result = selectArticlesForDigest(candidates, new Set(), config);

      expect(result.kind).toBe("skip");
      expect(result.articles).toHaveLength(0);
    });

    it("skips when dedup leaves below floor even with big initial pool", () => {
      // 30 candidates, 28 already sent, only 2 fresh — below floor of 3.
      const candidates = Array.from({ length: 30 }, (_, i) => makeArticle(`a${i}`));
      const alreadySent = new Set(
        Array.from({ length: 28 }, (_, i) => `a${i}`),
      );

      const result = selectArticlesForDigest(candidates, alreadySent, config);

      expect(result.kind).toBe("skip");
      expect(result.stats.candidateCount).toBe(30);
      expect(result.stats.alreadySentCount).toBe(28);
      expect(result.stats.dedupRemoved).toBe(28);
    });

    it("skips on empty candidate pool", () => {
      const result = selectArticlesForDigest([], new Set(), config);

      expect(result.kind).toBe("skip");
      expect(result.stats.candidateCount).toBe(0);
      expect(result.stats.dedupRemoved).toBe(0);
    });
  });

  describe("stats accounting", () => {
    it("reports correct counts in the send case", () => {
      const candidates = Array.from({ length: 15 }, (_, i) => makeArticle(`a${i}`));
      const alreadySent = new Set(["a0", "a5"]);

      const result = selectArticlesForDigest(candidates, alreadySent, config);

      expect(result.stats).toEqual({
        candidateCount: 15,
        alreadySentCount: 2,
        dedupRemoved: 2,
      });
    });

    it("reports correct counts in the skip case", () => {
      const candidates = Array.from({ length: 4 }, (_, i) => makeArticle(`a${i}`));
      const alreadySent = new Set(["a0", "a1", "a2"]);

      const result = selectArticlesForDigest(candidates, alreadySent, config);

      expect(result.kind).toBe("skip");
      expect(result.stats).toEqual({
        candidateCount: 4,
        alreadySentCount: 3,
        dedupRemoved: 3,
      });
    });
  });

  describe("config variance", () => {
    it("respects a smaller target size", () => {
      const candidates = Array.from({ length: 10 }, (_, i) => makeArticle(`a${i}`));
      const result = selectArticlesForDigest(candidates, new Set(), {
        targetSize: 3,
        minFloor: 3,
      });

      expect(result.kind).toBe("send");
      if (result.kind === "send") {
        expect(result.articles).toHaveLength(3);
      }
    });

    it("respects a higher floor", () => {
      const candidates = Array.from({ length: 4 }, (_, i) => makeArticle(`a${i}`));
      const result = selectArticlesForDigest(candidates, new Set(), {
        targetSize: 8,
        minFloor: 5,
      });

      expect(result.kind).toBe("skip");
    });
  });
});
