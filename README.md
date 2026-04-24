# Financial News Feed App

Vite + React + TypeScript frontend backed by Supabase (Postgres, Edge
Functions, pg_cron) and Resend for email delivery. The design was done using Figma
Make and then we moved to using Claude Design.

## Running the code

```
npm i
npm run dev      # dev server
npm test         # Vitest
```

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — repo orientation for Claude Code / new contributors
- [`guidelines/Guidelines.md`](./guidelines/Guidelines.md) — project rules, invariants, test matrix, design system
- [`docs/architecture.md`](./docs/architecture.md) — system diagram, email-to-app flow
- [`docs/supabase-rpc.md`](./docs/supabase-rpc.md) — RPC response shapes
- [`docs/deploy-edge-functions.md`](./docs/deploy-edge-functions.md) — Edge Function deployment
- [`docs/data-model/`](./docs/data-model/README.md) — database schema: tables, enums, FK cascade rules
- [`docs/backlog/`](./docs/backlog/README.md) — deferred work (P3/P4/P5 tickets)
