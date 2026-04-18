# References

Cheat-sheet material. Bookmark or grep these when you need a quick answer rather than a conceptual explanation.

## FK Cascade Map

Quick reference for what happens when you delete a parent row. Use this before running any DELETE against a core table.

| Parent | Child | Child FK column | Delete rule | Rationale |
|---|---|---|---|---|
| `ai_articles` | `article_clicks` | `article_id` | **CASCADE** | Clicks are meaningless without their article. |
| `ai_articles` | `digest_sent_articles` | `article_id` | **CASCADE** | Email-delivery records are meaningless without the article. |
| `ai_articles` | `article_topics` | `article_id` | **NO ACTION** | Forces explicit cleanup so you don't forget to rebuild topic feeds. |
| `ai_articles` | `ai_agent_waitlist` | `article_id` | **NO ACTION** | The user's intent to join the waitlist survives the article being deleted — the article_id is historical context, not the primary signal. |
| `digest_subscribers` | `article_clicks` | `subscriber_id` | **CASCADE** | |
| `digest_subscribers` | `digest_sent_articles` | `subscriber_id` | **CASCADE** | |
| `digest_subscribers` | `email_events` | `subscriber_id` | **CASCADE** | |
| `digest_sent_articles` | `article_clicks` | `sent_article_id` | **SET NULL** | Allows digest-sent rows to be pruned (see the daily cron) without losing historical click data. |
| `topics` | `article_topics` | `topic_id` | **NO ACTION** | Don't delete topics directly — deactivate via `is_active = false` instead. |
| `topics` | `topic_feeds` | `topic_id` | **NO ACTION** | Same. |
| `topics` | `user_interests` | `topic_id` | **NO ACTION** | Same. |
| `topics` | `topics` | `parent_id` | **NO ACTION** | Self-reference; hierarchy unused today. |

### What's missing

No FK constraints exist on these conceptual relationships, which could be worth adding:

- `user_interests.user_id` → `digest_subscribers.user_id` (not a proper FK because not every user_id is a subscriber yet)
- `user_tickers.user_id` → `digest_subscribers.user_id` (same)
- `onboarding_survey.user_id` → same
- `user_feed_cache.user_id` → same

These are consequences of the client-generated-user-id model (see [P3](../backlog/P3-client-generated-user-id-authz.md)). If identity moves server-side, these could become real FKs.

---

## JSON Shapes

Two jsonb columns carry structured data that the schema itself doesn't enforce. Document their contracts here so producers and consumers stay aligned.

### citations shape

Stored in `ai_articles.citations`. Array of citation objects.

```json
[
  {
    "n": 1,
    "url": "https://www.cnbc.com/2026/04/16/netflix-nflx-earnings-q1-2026.html",
    "label": "Netflix Q1 revenue and EPS beat",
    "source": "CNBC"
  },
  {
    "n": 2,
    "url": "https://variety.com/2026/tv/news/netflix-earnings-q1-2026-1236723851/",
    "label": "Q1 results and regional breakdown",
    "source": "Variety"
  }
]
```

- `n` (integer, 1-indexed) — citation marker as referenced from `brief_bullets` with `[1]`, `[2]`, etc.
- `url` (string) — the source URL. Must not point to a restricted domain (see the seeder skill's restricted list).
- `label` (string) — short description of what this citation supports.
- `source` (string) — human-readable publication name (e.g., "CNBC", "Reuters" where permitted, "Netflix IR").

Typical length: 2–4 citations per bundle; max 6 by seeder convention.

### analyst_data shape

Stored in `ai_articles.analyst_data`. Object keyed by ticker symbol.

```json
{
  "NFLX": {
    "companyName": "Netflix, Inc.",
    "currentPrice": 107.37,
    "priceTarget": {
      "low": 80.0,
      "high": 151.4,
      "mean": 114.23
    },
    "targetGap": 6.4,
    "recommendation": {
      "strongBuy": 18,
      "buy": 20,
      "hold": 12,
      "sell": 1,
      "strongSell": 0
    }
  }
}
```

- `companyName` (string, optional) — human-readable company name. Added in v2 (April 2026). Older v1 rows may lack this field; the UI handles absence gracefully.
- `currentPrice` (number) — recent price at time of seeding. Precision: 2 decimals.
- `priceTarget.{low, high, mean}` (numbers) — analyst 12-month price target distribution.
- `targetGap` (number) — percentage implied upside/downside based on `((mean / currentPrice) - 1) * 100`.
- `recommendation.{strongBuy, buy, hold, sell, strongSell}` (integers) — count of analysts in each bucket.

`analyst_data` is `NULL` (not `{}`) for stories without ticker-level analyst data — macro stories, ETF-dominated stories, geopolitics, commodities.

#### Optional `metric` field

```json
"metric": {
  "peRatio": 28.4,
  "revenueGrowthTTM": 12.7
}
```

Some v1 rows include a `metric` object inside each ticker entry. **The seeder skill does NOT populate this field** — it's a v1 artifact. The TypeScript `AnalystData` type declares `metric` as optional (`metric?: {...}`), and the `AnalystDataSection` component renders it only when present. No action required; absence is fine. Will eventually be dropped entirely once all v1 rows have been archived/restored.

---

## Enums and CHECK Constraint Values

All enum-style fields in Finnopolis are implemented as `text` columns with CHECK constraints. This cheat sheet lists every allowed value by table and column.

### ai_articles.consensus_signal
`'BUY'`, `'SELL'`, `'MIXED'`, `'NO_RATING'`

Use `'NO_RATING'` (not NULL) for stories where analyst consensus data is absent or doesn't apply (macro, geopolitics, commodities, ETF-only).

### ai_articles.processing_status
`'pending'`, `'brief_done'`, `'complete'`, `'failed'`, `'archived'`

See [article lifecycle](./article-lifecycle.md) for meanings and transitions.

### article_clicks.source
`'email'`, `'web'`, `'push'`

Only `'email'` is written today. `'web'` and `'push'` are reserved but no code writes them (see [engagement-tables.md](./engagement-tables.md#article_clicks)).

### article_topics.tag_source
`'claude'`, `'tiingo'`, `'manual'`

Hand-seeded articles use `'manual'`. `'claude'` is reserved for the future AI tagging pipeline. `'tiingo'` for the legacy third-party tagging service.

### article_topics.relevance
Numeric, CHECK `>= 0.00 AND <= 1.00`.

Seeder skill convention:
- 0.85–0.95: primary topics
- 0.60–0.80: secondary topics
- Below 0.60: avoid — if a topic isn't at least 0.6 relevant, don't tag it

### digest_subscribers.frequency
`'daily'`, `'weekly'`

### email_events.event_type
`'delivered'`, `'opened'`, `'bounced'`, `'complained'`

Maps directly to the Resend webhook event types.

### news_sources.tier
`'tier1'`, `'tier2'`, `'blog'`, `'unknown'`

Tier definitions are editorial; see `news_sources.notes` for individual source reasoning when present.

### onboarding_survey.investing_style
`'buy_and_hold'`, `'active_trader'`, `'passive_index'`, `'beginner'`

### onboarding_survey.content_density
`'quick_hits'`, `'essentials'`, `'deep_coverage'`

### topics.dimension
`'industry'`, `'theme'`, `'company'`, `'geography'`

The four dimensions along which the topic taxonomy is organized. Most current topics are `'industry'` or `'theme'`; the `'company'` and `'geography'` dimensions are reserved for future expansion (e.g., company-specific pages like "/t/nvidia", region pages like "/t/emerging-markets").
