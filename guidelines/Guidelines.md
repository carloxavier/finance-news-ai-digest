# Finance AI Digest — Project Guidelines

## General

- All frontend code lives in `src/app/`. Backend Edge Functions live in `supabase/functions/`.
- There is no auth — users are identified by a UUID stored in `localStorage` (`fad_user_id`).
- The Supabase project ID is `kamfamwjswkncftsdgxi`. RPC functions live in Supabase (not in this repo).
- Never trust the shape of data from RPC or REST responses. Always normalize at the boundary (see `normalizeArticle` in `supabase.ts`).
- When adding a new RPC call, document its response shape in `docs/supabase-rpc.md` and validate with `normalizeArticle` or an equivalent.

## Design System

- Background: `#0D1B2A` (navy)
- Citation markers `[N]`: `#2563EB` (citation blue)
- Layer 1 (analyst data): Blue — sourced, trust-positive
- Layer 2 (AI inference): Amber — always labelled "AI INFERENCE - not sourced"
- Headlines: Instrument Serif
- Data / tickers / citations: IBM Plex Mono
- Body: Plus Jakarta Sans
- Date formats: always relative ("2h ago", "3d ago"), using `formatArticleDate()` from `supabase.ts`
