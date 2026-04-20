# P3 — Article detail shows tickers with no company name

**Filed**: 2026-04-20
**Status**: done
**Closed**: 2026-04-20 (PR #XXX)

## Summary

On the article detail page, the analyst section renders tickers as
raw symbols only (e.g. `NFLX`, `TSM`, `PLD`) with no company name
next to them. Users without insider ticker knowledge have to guess
what company each row refers to. Reported by Carlo against
https://finnopolis.com/article/ff506402-a107-4101-8720-642565df63dd
on 2026-04-18.

The seeder v2 skill already writes `companyName` into the
`analyst_data` jsonb column per ticker (it's a required field in the
skill spec). The frontend just doesn't read it: `AnalystData` TS
interface in `src/app/utils/supabase.ts` doesn't declare the field,
and `AnalystDataSection.tsx:12-20` renders only `{ticker}` with no
companion text.

## Scope

- Add optional `companyName?: string` to the `AnalystData` interface.
- Render `companyName` inline next to the ticker symbol in
  `AnalystDataSection.tsx` when present; fall back to ticker-only
  when absent (legacy articles without `companyName`).

## Out of scope

- The ticker chips at `ArticleDetail.tsx:133-144` that render from
  `article.extracted_tickers` (a `text[]` array). Those have no
  company-name mapping available and require the tickers reference
  table tracked in
  [P4-normalize-ticker-company-names.md](./P4-normalize-ticker-company-names.md).

## Acceptance

- `AnalystData.companyName?: string` added to the type.
- Analyst section renders `{ticker} {companyName}` when present,
  `{ticker}` alone when absent.
- No broken UI on articles that have `analyst_data` but no
  `companyName` (pre-seeder-v2 articles).
- `npm test` and `npm run build` pass.

## Priority

P3 — user-visible content quality issue. Small scoped fix;
unblocks trust in the analyst section.

## Progress log

- **2026-04-20** — Work started. Scope: add `companyName?: string` to
  `AnalystData` TS type; render it inline next to the ticker symbol
  in `AnalystDataSection`. No seeder changes (seeder v2 already emits
  the field). Rendering is defensive: falls back to ticker-only when
  `companyName` is absent (legacy articles pre-seeder-v2).

  The ticker-only chips at `ArticleDetail.tsx:133–144` (plus the
  sibling chip rows in `Feed.tsx:298`, `ExploreFeed.tsx:146`, and
  `Landing.tsx:822`) are out of scope for this fix because
  `extracted_tickers` is a `text[]` array with no company-name
  mapping. Full fix lives in `P4-normalize-ticker-company-names.md`.
- **2026-04-20** — Completed. `companyName` added to `AnalystData` type,
  rendered next to ticker in `AnalystDataSection`. Ticker chips in
  `ArticleDetail` left unchanged; out of scope per ticket. `npm test`
  72/72 passing after the change. Manual browser verification pending
  in the PR review.
