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

### ai_articles

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | no | Primary key |
| `headline` | text | no | Article title |
| `publication` | text | no | Source name (e.g. "CNBC") |
| `published_at` | timestamptz | no | All complete articles have valid timestamps |
| `ai_preview` | text | no | One-line AI summary |
| `consensus_signal` | text | no | BUY, SELL, MIXED, or NO_RATING |
| `extracted_tickers` | text[] | yes | Can be null or empty array |
| `source_url` | text | no | Original article URL |
| `brief` | text | no | Full AI brief (detail view only) |
| `citations` | jsonb | no | Array of citation objects |
| `analyst_data` | jsonb | yes | Per-ticker Finnhub data |
| `inference_watch` | text[] | yes | "What to watch" bullets |
| `inference_risks` | text[] | yes | "Key risks" bullets |
| `inference_questions` | text[] | yes | "Open questions" bullets |
| `finnhub_fetched_at` | timestamptz | yes | NULL on ~60% of articles (by design) |
| `processing_status` | text | no | "complete", "pending", etc. |

### digest_subscribers

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | no | Primary key |
| `user_id` | uuid | no | References anonymous user UUID |
| `email` | text | no | Unique |
| `frequency` | text | no | "daily" or "weekly" |
| `feed_token` | text | yes | Stateless session token for email links |
| `unsubscribe_token` | text | yes | Token for one-click unsubscribe |
| `is_active` | boolean | no | Unsubscribe sets to false |
| `last_sent_at` | timestamptz | yes | NULL until first digest sent |

### digest_sent_articles

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | serial | no | Primary key |
| `subscriber_id` | uuid | no | FK to digest_subscribers |
| `article_id` | uuid | no | FK to ai_articles |
| `click_token` | text | no | Unique token embedded in email link |
| `digest_batch` | text | no | Batch ID (e.g. "digest-20260407-0700") |

**Unique constraint:** `(subscriber_id, article_id)` — upsert must use `ignoreDuplicates: false` to update click_token on re-send.

### article_clicks

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `subscriber_id` | uuid | no | FK to digest_subscribers |
| `article_id` | uuid | no | FK to ai_articles |
| `sent_article_id` | int | no | FK to digest_sent_articles |
| `source` | text | no | "email" |
