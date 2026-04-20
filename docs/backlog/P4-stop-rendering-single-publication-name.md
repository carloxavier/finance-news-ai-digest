# P4 — Stop rendering single-publication name (bundle model is multi-source)

**Filed**: 2026-04-18
**Status**: open

## Summary

The bundle content model guarantees every article has multiple
source citations (typically 2–4, up to 6). Several UI and email
surfaces still render `article.publication` as if there were one
canonical source:

- `src/app/components/ArticleDetail.tsx:121`
- `src/app/components/ExploreFeed.tsx:125`
- `src/app/components/Feed.tsx:271, 274`
- `src/app/components/Landing.tsx:832, 838`
- `supabase/functions/send-digest/index.ts:314`

This is wrong in two ways:

1. Architecturally misleading — showing "CNBC" alone hides the
   fact that the brief synthesizes three sources.
2. Silently broken for v2 seeds — the v2 seeder sets
   `publication = NULL`. On v2 articles these locations render
   nothing or a stray separator dot.

## Target behavior

Replace every `{publication}` render with:

- Feed / article detail / email: `Synthesized from N sources`
  (the ArticleDetail page already has this pattern; extend it).
- Click-through still shows the full citations array.

## Cleanup (follow-up)

After all surfaces are updated:
- Drop `publication`, `publication_url`, `source_url` from
  SELECT lists in `supabase.ts`, `send-digest/index.ts`, and
  RPC response shapes.
- Remove from the `Article` TS interface.
- DROP the columns in a schema migration (see
  `P5-drop-legacy-brief-column.md` for bundling).

## Acceptance

- All 6 render sites updated to "N sources" or equivalent.
- TS `Article` interface stops declaring
  `publication: string`.
- SELECT clauses no longer request `publication`.

## Priority

P4 — rendering degrades silently for v2 articles (currently 3).
Becomes harder to unwind as v2 corpus grows.
