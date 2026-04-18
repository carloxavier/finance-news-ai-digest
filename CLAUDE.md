# Claude Code — repo orientation

Read this first. It tells you where everything lives so you don't need to
rediscover it each session.

## Project

Finance AI Digest — a Vite + React + TypeScript frontend (GitHub Pages) plus
Supabase backend (Postgres, Edge Functions, pg_cron) and Resend for email.
Supabase project ID: `kamfamwjswkncftsdgxi`.

## Code layout

- `src/app/` — frontend (routes, components, utils, tests in `__tests__/`)
- `supabase/functions/` — Edge Functions (Deno). See
  [`supabase/functions/CLAUDE.md`](./supabase/functions/CLAUDE.md) for
  Edge-Function-specific rules.
- `public/` — static assets
- `docs/` — architecture, RPC contracts, data model, backlog (see below)
- `guidelines/Guidelines.md` — **project rules, invariants, test matrix,
  design system**. Read this whenever you're about to change code.

## Documentation map

When a task involves these topics, load the matching doc(s) before acting:

| Topic | Where to look |
|---|---|
| High-level system diagram, deployment, email-to-app flow | [`docs/architecture.md`](./docs/architecture.md) |
| RPC response shapes, how the frontend talks to Supabase | [`docs/supabase-rpc.md`](./docs/supabase-rpc.md) |
| Deploying / testing Edge Functions, known pitfalls | [`docs/deploy-edge-functions.md`](./docs/deploy-edge-functions.md) |
| **Database schema** — tables, columns, enums, FK cascade rules | [`docs/data-model/`](./docs/data-model/README.md) |
| Article `processing_status` state machine + feed RPCs | [`docs/data-model/article-lifecycle.md`](./docs/data-model/article-lifecycle.md) |
| JSONB shapes, enum cheat sheet, FK cascade map | [`docs/data-model/references.md`](./docs/data-model/references.md) |
| Deferred work (P3/P4/P5 tickets) | [`docs/backlog/`](./docs/backlog/README.md) |
| Core coding rules, invariants, what to test | [`guidelines/Guidelines.md`](./guidelines/Guidelines.md) |

## Working rules (condensed from `guidelines/Guidelines.md`)

- **No auth.** Users are a client-generated UUID in `localStorage`
  (`fad_user_id`). Server trusts the UUID — this is a known weak point, see
  the backlog.
- **Normalize at the boundary.** Every RPC/REST response passes through
  `normalizeArticle` inside `src/app/utils/supabase.ts` before the exported
  API function returns it. Callers receive already-normalized `Article`
  objects.
- **Three subscriber types** must keep working for any feed/digest change:
  landing-page-only, onboarded-no-email, fully-onboarded. See the test
  matrix in `guidelines/Guidelines.md`.
- **Schema changes must ship with a `docs/data-model/` update in the same
  commit.** The data-model docs are descriptive, not aspirational — they
  should match the live schema.
- **Tests**: Vitest, colocated in `__tests__/`. Run `npm test` before
  pushing anything that touches routes, utils, or Edge Functions.
- **Base URL**: `https://finnopolis.com`. Frontend navigation is relative
  (`basename: '/'`, Vite `base: '/'`). Absolute URLs are only needed in
  Edge Functions that emit email HTML or 302 redirects — those currently
  hardcode `SITE_BASE_URL` / `FALLBACK_URL`; keep them aligned.

## When you're stuck

- RPC returning unexpected shape → check `docs/supabase-rpc.md` and
  `docs/data-model/article-lifecycle.md`.
- About to delete rows from a core table → check the FK cascade map in
  `docs/data-model/references.md` first.
- Edge Function behavior unclear → `docs/deploy-edge-functions.md` and
  `supabase/functions/CLAUDE.md`.
