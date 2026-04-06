# Finance AI Digest — Project Guidelines

## General

- All frontend code lives in `src/app/`. Backend Edge Functions live in `supabase/functions/`.
- There is no auth — users are identified by a UUID stored in `localStorage` (`fad_user_id`).
- The Supabase project ID is `kamfamwjswkncftsdgxi`. RPC functions live in Supabase (not in this repo).
- Never trust the shape of data from RPC or REST responses. Always normalize at the boundary (see `normalizeArticle` in `supabase.ts`).
- When adding a new RPC call, document its response shape in `docs/supabase-rpc.md` and validate with `normalizeArticle` or an equivalent.

## Architecture

See detailed docs in `/docs/`:
- [architecture.md](../docs/architecture.md) — System diagram, email-to-app flow, invariants
- [supabase-rpc.md](../docs/supabase-rpc.md) — RPC response shapes, DB schema
- [deploy-edge-functions.md](../docs/deploy-edge-functions.md) — Edge Function deployment, testing, pitfalls

## Critical Rules

### Email Digest & Feed Consistency
1. **Both the web feed and email digest must use `get_subscriber_feed` RPC.** Never use `get_user_feed` for digest emails — it has different ranking and caching.
2. **Upserts to `digest_sent_articles` must use `ignoreDuplicates: false`.** Otherwise re-sent digests have mismatched click tokens and tracking breaks.
3. **`track-click` must pass `?t=<feed_token>` in the redirect URL.** Without it, users land on onboarding instead of their feed.

### Base URL
All app URLs must use `https://carloxavier.github.io/finance-news-ai-digest`. This is configured in:
- `vite.config.ts` (`base`)
- `routes.ts` (`basename`)
- `track-click/index.ts` (`FALLBACK_URL`)
- `send-digest/index.ts` (`SITE_BASE_URL`)

Never hardcode `finnopolis.com` as a redirect target.

### SQL / RPC
- Never use `DISTINCT ON` with a `LIMIT` unless the `ORDER BY` matches the intended sort. Use a subquery to deduplicate first, then sort and limit.
- Always pass article data through `normalizeArticle()` before rendering — field names vary between RPCs.

### Edge Functions
- All Edge Functions use `verify_jwt=false` (public endpoints for email links/webhooks).
- Deploy via Supabase MCP (`deploy_edge_function`). Local files in `supabase/functions/` are source of truth.
- Required secret for send-digest: `RESEND_API_KEY`.

## Design System

- Background: `#0D1B2A` (navy)
- Citation markers `[N]`: `#2563EB` (citation blue)
- Layer 1 (analyst data): Blue — sourced, trust-positive
- Layer 2 (AI inference): Amber — always labelled "AI INFERENCE - not sourced"
- Headlines: Instrument Serif
- Data / tickers / citations: IBM Plex Mono
- Body: Plus Jakarta Sans
- Date formats: always relative ("2h ago", "3d ago"), using `formatArticleDate()` from `supabase.ts`

## Frontend Patterns

- **Feed token persistence**: Once a user visits via `?t=token`, the token is saved to localStorage permanently. All subsequent visits use the subscriber feed path.
- **Date formatting**: Always use `formatArticleDate()` from `supabase.ts`. Never call `new Date()` directly on article date fields.
- **Null safety on arrays**: Always use `(array ?? [])` before `.slice()`, `.map()`, etc. — fields like `extracted_tickers` can be null.
