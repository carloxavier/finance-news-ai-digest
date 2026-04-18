# Supabase RPC Functions — Response Shapes

> **Why this file exists:** The Supabase RPC functions are defined server-side
> (not in this repo). The frontend must handle whatever shape they return.
> Document every RPC here so that the frontend's TypeScript interfaces and
> normalization logic stay in sync with the actual responses.
>
> **When to update:** Any time an RPC is created, modified, or a new field is
> added on the Supabase side, update this file FIRST, then update the frontend.

---

## get_subscriber_feed (PRIMARY — used by both web and email)

This is the **canonical feed RPC**. Both the web app (`Feed.tsx`) and the email digest (`send-digest` Edge Function) must use this RPC. Do not use `get_user_feed` for digest emails — it has different ranking logic and a stale cache.

**Call:** `POST /rest/v1/rpc/get_subscriber_feed`

**Params:**
```json
{ "p_token": "<feed_token>", "p_limit": 20 }
```

**Returns:** Single JSONB object (NOT an array)

```json
{
  "subscriber": { "email": "user@example.com", "frequency": "daily" },
  "topics": [
    { "slug": "semiconductors", "display_name": "Semiconductors" }
  ],
  "articles": [
    {
      "id": "uuid",
      "headline": "string",
      "publication": "string",
      "published_at": "2026-04-05T16:00:00+00:00",
      "ai_preview": "string",
      "consensus_signal": "BUY | SELL | MIXED | NO_RATING",
      "extracted_tickers": ["NVDA", "MU"],
      "source_url": "https://...",
      "inference_watch": ["Signal 1", "Signal 2"]
    }
  ]
}
```

**Error case:** Returns `{ "error": "not_found" }` if token is invalid.

**Frontend consumer:** `getSubscriberFeed()` in `supabase.ts` -> articles normalized via `normalizeArticle()`

**Edge Function consumer:** `getSubscriberArticles()` in `send-digest/index.ts` with `p_limit: 8`

**How it works internally:**
1. Looks up subscriber by `feed_token` in `digest_subscribers`
2. Joins `user_interests` → `article_topics` → `ai_articles` to find matching articles
3. Deduplicates (an article can match multiple topics)
4. Sorts by `published_at DESC`
5. Limits to `p_limit`

> **WARNING:** The articles inside this response are JSONB-built on the server.
> Field names may not exactly match the `get_user_feed` response. Always pass
> through `normalizeArticle()`.

---

## get_user_feed

Used by **direct visitors** (no feed token) who completed onboarding.

**Call:** `POST /rest/v1/rpc/get_user_feed`

**Params:**
```json
{ "p_user_id": "<uuid>", "p_limit": 20 }
```

**Returns:** Ranked article IDs (NOT full article objects)

```json
[
  { "article_id": "uuid" },
  { "article_id": "uuid" }
]
```

The frontend must then fetch full articles:
```
GET /rest/v1/ai_articles?id=in.(id1,id2,...)&select=id,headline,publication,...
```

**Frontend consumer:** `getUserFeed()` in `supabase.ts` -> normalized via `normalizeArticle()`

**How it works internally:**
1. Checks `user_feed_cache` for a valid cached result
2. If no cache: joins `user_interests` → `article_topics` → `ai_articles`
3. Ranks by `is_primary DESC, relevance DESC, published_at DESC`
4. Writes result to cache
5. Returns article IDs only

> **WARNING — do NOT use for email digest:** This RPC has different ranking logic
> (relevance-based, not purely chronological) and uses a cache that can go stale.
> The email digest must use `get_subscriber_feed` so articles match the web feed.

---

## get_articles_by_topics

**Call:** `POST /rest/v1/rpc/get_articles_by_topics`

**Params:**
```json
{ "topic_ids": ["uuid", "uuid"], "max_results": 20 }
```

**Returns:** `Article[]` (flat array)

**Frontend consumer:** `getUserFeed()` fallback path in `supabase.ts` -> normalized via `normalizeArticle()`

---

## Database Tables Referenced

Table schemas live in [`docs/data-model/`](./data-model/README.md) — that is the single source of truth for columns, types, nullability, and FK cascade rules. Do not duplicate schema details in this file; keep it focused on RPC call/response shapes. Relevant tables for the RPCs above:

| Table | Doc |
|---|---|
| `ai_articles` | [`data-model/content-tables.md`](./data-model/content-tables.md) |
| `digest_subscribers`, `user_interests`, `user_tickers`, `user_feed_cache` | [`data-model/user-tables.md`](./data-model/user-tables.md) |
| `digest_sent_articles`, `article_clicks` | [`data-model/engagement-tables.md`](./data-model/engagement-tables.md) |
| `topics`, `article_topics` | [`data-model/content-tables.md`](./data-model/content-tables.md) |

Key invariants that live in the data-model docs but are load-bearing for the RPC contract:

- `ai_articles.processing_status = 'complete'` is the only status visible to feed RPCs and email queries. See [`article-lifecycle.md`](./data-model/article-lifecycle.md).
- `digest_subscribers.feed_token` is NOT NULL (defaulted at INSERT) — every subscriber has one, so distinguishing subscriber types by `feed_token` nullability is wrong. Use `user_interests` existence instead.
- `digest_sent_articles` has a unique constraint on `(subscriber_id, article_id)` — upsert must use `ignoreDuplicates: false` so a re-send updates the click_token.
- Several `ai_articles` columns are nullable (`publication`, `source_url`, `brief`, `ai_preview`, `extracted_tickers`, `inference_*`, `analyst_data`). Always null-guard in renderers and email templates.
