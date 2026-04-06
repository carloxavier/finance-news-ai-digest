# Supabase RPC Functions — Response Shapes

> **Why this file exists:** The Supabase RPC functions are defined server-side
> (not in this repo). The frontend must handle whatever shape they return.
> Document every RPC here so that the frontend's TypeScript interfaces and
> normalization logic stay in sync with the actual responses.
>
> **When to update:** Any time an RPC is created, modified, or a new field is
> added on the Supabase side, update this file FIRST, then update the frontend.

---

## get_user_feed

**Call:** `POST /rest/v1/rpc/get_user_feed`

**Params:**
```json
{ "p_user_id": "<uuid>", "p_limit": 20 }
```

**Returns:** Ranked article IDs (NOT full article objects)

> **WARNING:** Despite the reference doc suggesting full articles, this RPC
> returns only IDs with a relevance score. A second query to `ai_articles`
> is required to get full article data. See `getSubscriberArticles()` in
> `supabase/functions/send-digest/index.ts` for the canonical two-step pattern.

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
```

**Frontend consumer:** `getUserFeed()` in `supabase.ts` -> normalized via `normalizeArticle()`

---

## get_subscriber_feed

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
      "source_url": "https://..."
    }
  ]
}
```

**Error case:** Returns `{ "error": "not_found" }` if token is invalid.

**Frontend consumer:** `getSubscriberFeed()` in `supabase.ts` -> articles normalized via `normalizeArticle()`

> **WARNING:** The articles inside this response are JSONB-built on the server.
> Field names may not exactly match the `get_user_feed` response. Always pass
> through `normalizeArticle()`.

---

## get_articles_by_topics

**Call:** `POST /rest/v1/rpc/get_articles_by_topics`

**Params:**
```json
{ "topic_ids": ["uuid", "uuid"], "max_results": 20 }
```

**Returns:** `Article[]` (flat array, same shape as `get_user_feed`)

**Frontend consumer:** `getUserFeed()` fallback path in `supabase.ts` -> normalized via `normalizeArticle()`

---

## Database Tables Referenced

### ai_articles

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | no | Primary key |
| `headline` | text | no | Article title |
| `publication` | text | no | Source name (e.g. "CNBC") |
| `published_at` | timestamptz | no | All 165 complete articles have valid timestamps |
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
| `finnhub_fetched_at` | timestamptz | **yes** | NULL on ~60% of articles (by design) |
| `processing_status` | text | no | "complete", "pending", etc. |

### digest_subscribers

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | no | Primary key |
| `user_id` | uuid | no | References anonymous user UUID |
| `email` | text | no | Unique |
| `frequency` | text | no | "daily" or "weekly" |
| `feed_token` | text | yes | Stateless session token for email links |
| `is_active` | boolean | no | Unsubscribe sets to false |
| `last_sent_at` | timestamptz | yes | NULL until first digest sent |
