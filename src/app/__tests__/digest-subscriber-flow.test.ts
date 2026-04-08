import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * These tests verify the digest email flow handles ALL subscriber types,
 * including those who signed up from the landing page without completing
 * onboarding (no feed_token, no user_interests).
 *
 * The actual getSubscriberArticles lives in a Deno edge function, so we
 * re-implement the logic here with mocks to verify the contract.
 */

// --- Mock types matching the edge function ---

interface Article {
  id: string;
  headline: string;
  publication: string;
  published_at: string;
  ai_preview: string;
  consensus_signal: string;
  extracted_tickers: string[];
  inference_watch: string[];
}

interface MockSupabase {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: Article[] | null; error: unknown }>;
      };
    };
  };
}

// --- Re-implementation of getSubscriberArticles matching send-digest/index.ts ---

async function getSubscriberArticles(
  supabase: MockSupabase,
  feedToken: string | null,
): Promise<Article[]> {
  if (feedToken) {
    try {
      const { data, error } = await supabase.rpc('get_subscriber_feed', {
        p_token: feedToken,
        p_limit: 8,
      });

      if (!error && data && (data as any).error !== 'not_found') {
        const articles = (data as any).articles;
        if (Array.isArray(articles) && articles.length > 0) {
          return articles;
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: latest articles
  const { data: latestArticles, error: latestError } = await supabase
    .from('ai_articles')
    .select('id, headline, publication, published_at, ai_preview, consensus_signal, extracted_tickers, inference_watch')
    .order('published_at', { ascending: false })
    .limit(8);

  if (latestError || !latestArticles) return [];
  return latestArticles;
}

// --- Test fixtures ---

const LATEST_ARTICLES: Article[] = [
  {
    id: 'article-1',
    headline: 'Market Update',
    publication: 'Reuters',
    published_at: '2026-04-08T07:00:00Z',
    ai_preview: 'Markets moved today.',
    consensus_signal: 'BUY',
    extracted_tickers: ['SPY'],
    inference_watch: [],
  },
  {
    id: 'article-2',
    headline: 'Fed Minutes',
    publication: 'Bloomberg',
    published_at: '2026-04-07T07:00:00Z',
    ai_preview: 'Fed discussed rates.',
    consensus_signal: 'MIXED',
    extracted_tickers: [],
    inference_watch: [],
  },
];

const PERSONALIZED_ARTICLES: Article[] = [
  {
    id: 'article-3',
    headline: 'NVIDIA Q1 Beat',
    publication: 'CNBC',
    published_at: '2026-04-08T06:00:00Z',
    ai_preview: 'NVDA beat estimates.',
    consensus_signal: 'BUY',
    extracted_tickers: ['NVDA'],
    inference_watch: ['Watch for guidance revision'],
  },
];

// --- Tests ---

describe('digest subscriber article fetching', () => {
  let mockSupabase: MockSupabase;

  function createMockSupabase(opts: {
    rpcResult?: { data: unknown; error: unknown };
    rpcShouldThrow?: boolean;
    latestArticles?: Article[];
  }): MockSupabase {
    return {
      rpc: vi.fn().mockImplementation(async () => {
        if (opts.rpcShouldThrow) throw new Error('RPC failed');
        return opts.rpcResult ?? { data: null, error: { message: 'not found' } };
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: opts.latestArticles ?? LATEST_ARTICLES,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  describe('landing-page-only subscriber (no feed_token, no interests)', () => {
    it('returns latest articles when feed_token is null', async () => {
      mockSupabase = createMockSupabase({ latestArticles: LATEST_ARTICLES });

      const articles = await getSubscriberArticles(mockSupabase, null);

      expect(articles).toHaveLength(2);
      expect(articles[0].id).toBe('article-1');
      // Should NOT call RPC at all
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      // Should fall back to direct query
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_articles');
    });

    it('returns non-empty result (subscriber will NOT be skipped)', async () => {
      mockSupabase = createMockSupabase({ latestArticles: LATEST_ARTICLES });

      const articles = await getSubscriberArticles(mockSupabase, null);

      // This is the critical assertion: the send-digest loop skips subscribers
      // with 0 articles. Landing-page-only subscribers must NOT get skipped.
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  describe('subscriber with feed_token but no interests (empty RPC result)', () => {
    it('falls back to latest articles when RPC returns empty articles', async () => {
      mockSupabase = createMockSupabase({
        rpcResult: {
          data: { subscriber: {}, topics: [], articles: [] },
          error: null,
        },
        latestArticles: LATEST_ARTICLES,
      });

      const articles = await getSubscriberArticles(mockSupabase, 'valid-token');

      expect(mockSupabase.rpc).toHaveBeenCalled();
      expect(articles).toHaveLength(2);
      expect(articles[0].id).toBe('article-1');
    });

    it('falls back to latest articles when RPC returns not_found', async () => {
      mockSupabase = createMockSupabase({
        rpcResult: { data: { error: 'not_found' }, error: null },
        latestArticles: LATEST_ARTICLES,
      });

      const articles = await getSubscriberArticles(mockSupabase, 'invalid-token');

      expect(articles).toHaveLength(2);
    });

    it('falls back to latest articles when RPC throws', async () => {
      mockSupabase = createMockSupabase({
        rpcShouldThrow: true,
        latestArticles: LATEST_ARTICLES,
      });

      const articles = await getSubscriberArticles(mockSupabase, 'valid-token');

      expect(articles).toHaveLength(2);
    });
  });

  describe('fully onboarded subscriber (has feed_token + interests)', () => {
    it('returns personalized articles from RPC', async () => {
      mockSupabase = createMockSupabase({
        rpcResult: {
          data: {
            subscriber: { email: 'user@test.com' },
            topics: [{ slug: 'ai', display_name: 'AI' }],
            articles: PERSONALIZED_ARTICLES,
          },
          error: null,
        },
      });

      const articles = await getSubscriberArticles(mockSupabase, 'valid-token');

      expect(articles).toHaveLength(1);
      expect(articles[0].id).toBe('article-3');
      // Should NOT fall back to direct query
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });
});
