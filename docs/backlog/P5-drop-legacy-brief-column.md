# P5 — Drop legacy brief column and related publication fields

**Filed**: 2026-04-18
**Status**: open

## Summary

Schema cleanup. After the v2 corpus is rebuilt and all articles
have `brief_bullets` populated, drop the legacy columns:

- `brief` (text) — replaced by `brief_bullets text[]`.
- `publication`, `publication_url`, `source_url` — bundle model
  always multi-source, see `P4-stop-rendering-single-publication-name.md`.
- `historical_patterns` — unused, documented in data model as
  "intent unclear, scheduled for removal."

## Blockers before execution

- All v1 articles either backfilled to v2 shape or archived.
- `P4-stop-rendering-single-publication-name.md` complete.
- No remaining `.select("brief")` or `.select("publication")`
  call sites in edge functions or frontend.

## Acceptance

- `ALTER TABLE ai_articles DROP COLUMN brief, DROP COLUMN publication,
  DROP COLUMN publication_url, DROP COLUMN source_url, DROP COLUMN
  historical_patterns;` applied.
- Types in `src/app/utils/supabase.ts` updated.
- Data model docs updated.

## Priority

P5 — cleanup only. Genuinely deferrable.
