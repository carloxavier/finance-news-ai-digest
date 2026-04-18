# Core Content Tables

Four tables make up the article system. `ai_articles` holds the article content itself. `topics` is the controlled vocabulary. `article_topics` is the many-to-many relationship between them. `topic_feeds` is a denormalized per-topic cache used by the public preview RPC and the topic-filtered surfaces.

## `ai_articles`

Every row represents a **synthesized brief** (a "bundle") covering one financial story from multiple sources. This is not a 1:1 mirror of any single source article — it's an original headline plus distilled bullets, citing the original sources. See the seeder skill (`/mnt/skills/user/finance-ai-digest-seeder/SKILL.md`) for the content authoring workflow.

### v1 vs v2

The `ai_articles` table has a mix of current (v2) and legacy (v1) columns from an earlier content model. v2 is the current model — authored by the `finance-ai-digest-seeder` skill, content lives in `brief_bullets`, sources live in `citations`. The v1 columns (`brief`, `source_url`, `publication`, `publication_url`) are retained for older rows predating April 2026 but should not be populated by new work. `historical_patterns` is vestigial (never used in either model). The legacy columns are candidates for DROP once all archived articles have been restored under v2 rules and all UI consumers stop reading them — see [P5 — Drop legacy brief column](../backlog/P5-drop-legacy-brief-column.md).

### Columns

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `headline` | text | NO | — | Original retail-voice headline, ≤12 words. Never copied from a source. |
| `ai_preview` | text | YES | — | One- or two-sentence summary, ≤200 chars. Rendered in feed cards. |
| `brief_bullets` | text[] | YES | — | **Authoritative article body.** Array of 3–5 self-contained bullets, each carrying its own `[N]` citation markers. Introduced April 2026 (v2). |
| `brief` | text | YES | — | **Legacy prose body (v1).** Always NULL for v2 seeds. Slated for removal once the archived-article backfill is complete. Do not write new values here. |
| `citations` | jsonb | YES | — | Array of `{n, url, label, source}` objects. See [citations JSON shape](./references.md#citations-shape). |
| `extracted_tickers` | text[] | YES | — | US-style ticker symbols mentioned in the story. Max 5. Empty array for pure-macro stories. |
| `analyst_data` | jsonb | YES | — | Wall Street analyst consensus per ticker. See [analyst_data JSON shape](./references.md#analyst_data-shape). NULL for stories without ticker-level consensus data (macro, ETFs, geopolitics). |
| `finnhub_fetched_at` | timestamptz | YES | — | When `analyst_data` was last populated. NULL when `analyst_data` is NULL. |
| `consensus_signal` | text | YES | — | Derived BUY/SELL/MIXED/NO_RATING summary. See [enum values](./references.md#ai_articlesconsensus_signal). |
| `inference_watch` | text[] | YES | — | Exactly 3 items. AI-generated "signals to watch" — events/catalysts the reader should monitor. |
| `inference_risks` | text[] | YES | — | Exactly 3 items. AI-generated structural/macro/competitive risks. |
| `inference_questions` | text[] | YES | — | Exactly 3 items. AI-generated open questions a professional investor would ask. |
| `processing_status` | text | NO | `'pending'` | State machine controlling visibility. See [the article lifecycle](./article-lifecycle.md). |
| `processing_error` | text | YES | — | Human-readable error when `processing_status = 'failed'`. Populated by the (future) automated pipeline. |
| `model` | text | YES | — | String label of the content authoring method. `'hand-seeded-v2'` for April 2026 skill output. Older values indicate legacy seeds. |
| `processed_at` | timestamptz | YES | `now()` | When the article row was last written. Updated on UPDATE. |
| `published_at` | timestamptz | YES | — | The real-world publication time of the underlying story. User-facing (shown in feed cards, sort key). |
| `source_url` | text | YES | — | **Legacy (v1).** Always NULL for bundles — the `citations` array is the source list. Slated for removal. |
| `publication` | text | YES | — | **Legacy (v1). Always NULL for bundles.** The bundle model is multi-source by design; rendering a single publication name misrepresents the content. Any surface still consuming this field is architecturally wrong — see [P4 — Stop rendering single-publication name](../backlog/P4-stop-rendering-single-publication-name.md). Slated for removal once all UI consumers are updated. |
| `publication_url` | text | YES | — | **Legacy (v1).** Same story as `publication`. Always NULL for bundles. Slated for removal. |
| `historical_patterns` | jsonb | YES | — | **Vestigial.** Always NULL in both v1 and v2. Candidate for DROP in a future schema cleanup — no known consumer or planned use. |

## `topics`

Controlled vocabulary for categorizing articles. 22 active topics at the time of writing, organized across four dimensions (industry, theme, company, geography).

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `slug` | text | NO | — | URL-safe identifier, e.g. `earnings`, `ai-infrastructure`. Stable — used throughout the codebase and in the seeder skill. |
| `display_name` | text | NO | — | Human-facing label, e.g. `Earnings`, `AI Infrastructure`. |
| `dimension` | text | NO | — | One of `industry`, `theme`, `company`, `geography`. See [enums](./references.md#topicsdimension). |
| `parent_id` | uuid | YES | — | **Not currently used.** Self-reference reserved for potential topic hierarchies (a topic being a child of another). No hierarchy is built today; all topics are flat. Don't populate without a concrete feature driving it. |
| `description` | text | YES | — | Short editorial description shown on topic landing pages. |
| `canonical_tickers` | text[] | YES | — | Representative tickers for the topic (e.g., `AAPL, MSFT` for `technology`). Informational — used by the seeder skill for quick reference when generating `extracted_tickers` values. |
| `is_active` | boolean | YES | `true` | When false, topic is hidden from topic selection UIs. Don't delete topics outright — deactivate. |
| `display_order` | integer | YES | — | Sort order on UIs that list topics (onboarding, settings). |
| `created_at` | timestamptz | YES | `now()` | |

The authoritative list of topic UUIDs lives in the seeder skill's `references/topics.md`.

## `article_topics`

Many-to-many join between articles and topics, with relevance weighting.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `article_id` | uuid | NO | — | FK → `ai_articles.id`. Delete rule is **NO ACTION**. |
| `topic_id` | uuid | NO | — | FK → `topics.id`. Delete rule is **NO ACTION**. |
| `relevance` | numeric | NO | — | 0.00–1.00 (CHECK constraint). Convention: 0.85–0.95 for primary topics, 0.60–0.80 for secondary. Used for feed ranking. |
| `is_primary` | boolean | NO | — | Max 2 primary topics per article. Primary topics rank higher in `get_user_feed`. |
| `tag_source` | text | NO | — | Provenance: `claude`, `tiingo`, or `manual`. All hand-seeded articles use `manual`. |
| `created_at` | timestamptz | YES | `now()` | |

**Important**: the `NO ACTION` delete rule on `article_id` means you must explicitly delete `article_topics` rows before deleting the parent article. This is intentional — it forces you to rebuild the topic feeds when removing articles, which a cascade wouldn't make obvious.

## `topic_feeds`

Denormalized cache of article IDs per topic, rebuilt by the `rebuild_topic_feed(uuid)` RPC.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `topic_id` | uuid | NO | — | FK → `topics.id`. One row per topic. |
| `article_ids` | uuid[] | NO | `'{}'` | Pre-sorted array of article IDs, capped at 200. Ranking: `is_primary DESC, relevance DESC, published_at DESC`. Filtered to `processing_status = 'complete'`. |
| `article_count` | integer | NO | `0` | `array_length(article_ids, 1)`, cached for cheap display on topic selection UIs. |
| `last_article_at` | timestamptz | YES | — | `max(published_at)` across the topic. Used for "freshness" badges. |
| `rebuilt_at` | timestamptz | NO | `now()` | When this row was last rebuilt. Used by `user_feed_cache` invalidation logic. |

**When to rebuild**:
- After inserting or updating any `article_topics` row
- After `processing_status` changes on any article (so archived articles drop out of the cache, and restored articles rejoin)
- After deleting articles

The `archive_stale_articles` and content-mutation skills handle this automatically. Manual SQL that changes article visibility must call `SELECT rebuild_topic_feed(...) FROM ...` explicitly.
