# Seeder workflow overview

The seeder is implemented as a Claude skill (`finance-ai-digest-seeder`)
maintained outside this repo. The skill source is **intentionally kept out
of the public GitHub repo** — it lives locally at
`~/Documents/Finnopolis/Skills/finance-ai-digest-seeder/` (backed up via
iCloud). It is packaged into a `.skill` bundle that Carlo installs locally;
the installed copy then runs daily via a Cowork scheduled task and populates
`ai_articles` with curated bundles synthesized from web sources.

## Pipeline

1. **Search & cluster** — query the web for recent financial news, score
   candidates by importance, group related stories into bundles.
2. **Cross-run dedup** (new in v2.2) — fetch the last 50 active articles and
   drop draft bundles that cover the same stories. See Step 2.4 in the
   skill's `SKILL.md` (local source at
   `~/Documents/Finnopolis/Skills/finance-ai-digest-seeder/`). The query
   lives in `references/schema.md` alongside it.
3. **Tag ranking fields** — assign `primary_entities`, `story_magnitude`,
   `story_type`, and `story_cluster_id` to each surviving bundle.
4. **Analyst consensus lookups** — fetch ratings and price targets per ticker.
5. **Pre-insert validator** — check banned words, hedged comparisons, naked
   moves, source quality, citation URL integrity, ranking fields.
6. **Insert** — write to `ai_articles` and rebuild topic feeds.

## Why dedup happens at the seeder, not just the ranker or send-digest

There are three layers of dedup logic in Finnopolis. They serve different
purposes:

| Layer | Where | What it dedupes |
|-------|-------|-----------------|
| Seeder | Step 2.4 of the seeder skill (local) | Different bundles covering the same story across separate seed runs |
| Ranker | `get_subscriber_feed` RPC | (Doesn't dedupe — sorts by relevance) |
| Send-digest | `supabase/functions/send-digest/selection.ts` | Same `article_id` sent to the same subscriber within the recent-send window |

The seeder layer is the only place that can detect "two bundles, different
ids, same story." Send-digest only knows article ids, so without seeder
dedup, two separate bundles for "TSLA Q1 earnings" both ship to the same
subscriber as if they were different stories — the email-side dedup keyed on
article id can't tell they're duplicates.

## Why this is a heuristic, not a clustering algorithm

The Step 2.4 check is intentionally simple: fetch the last 50 articles, hand
them to the LLM as "Recently covered," let the LLM judge whether each draft
duplicates one of them. There is no entity-narrowed SQL filter, no embedding
similarity, no `story_cluster_id` exact-match logic.

The simpler heuristic was chosen because earlier drafts of the cross-run
dedup design proposed entity-narrowing, cluster_id matching, and LLM judgment
for ambiguous cases — all layered. The duplicates we observed in April 2026
(ServiceNow Q1 ×5, TSLA Q1 ×4, IBM Q1 ×4) would all have been caught by the
heuristic alone. Layering becomes warranted if and only if the heuristic
fails empirically; until then, the cost of additional layers isn't justified.

If the heuristic ever fails to catch a duplicate that's then manually
archived, the verification query in the dev plan
(`SELECT … HAVING count(*) > 1`) will surface the pattern and we can layer
in cluster_id matching or embedding similarity at that point.

## Verification queries (run after a v2.2 seed run)

```sql
-- Check for any same-ticker duplicates among recent v2.2 seeds.
SELECT
  extracted_tickers[1] AS ticker,
  count(*) AS bundle_count,
  array_agg(headline ORDER BY processed_at) AS headlines
FROM ai_articles
WHERE processing_status = 'complete'
  AND model = 'hand-seeded-v2.2'
  AND processed_at > now() - interval '24 hours'
  AND array_length(extracted_tickers, 1) = 1
GROUP BY extracted_tickers[1]
HAVING count(*) > 1
ORDER BY count(*) DESC;
```

Expected: zero rows. If rows are returned, Step 2.4's heuristic missed a
duplicate — file a follow-up to investigate.

```sql
-- Confirm v2.2 articles tagged correctly with all ranking fields.
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE primary_entities IS NOT NULL
                     AND jsonb_typeof(primary_entities->0) = 'string') AS valid_entities,
  count(*) FILTER (WHERE story_magnitude BETWEEN 1 AND 5) AS valid_magnitude,
  count(*) FILTER (WHERE story_type IN ('breaking', 'thematic')) AS valid_type,
  count(*) FILTER (WHERE story_cluster_id ~ '^[0-9]{8}-[a-z0-9-]+-[a-z0-9-]+$') AS valid_cluster_id
FROM ai_articles
WHERE model = 'hand-seeded-v2.2';
```

All four "valid" counts should equal `total`.
