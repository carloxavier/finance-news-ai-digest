# Deploying Supabase migrations

## Overview

Migrations in `supabase/migrations/` are applied automatically to prod via GitHub Actions (`.github/workflows/deploy-migrations.yml`) on merge to `main`. The workflow is path-filtered to only run when migration files change.

The local files in `supabase/migrations/` are the source of truth. Applying migrations directly via Supabase MCP or the SQL editor is a break-glass path only — the committed file is the canonical record.

**Supabase Project ID:** `kamfamwjswkncftsdgxi`

---

## Normal flow

1. Write a new migration file: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`
2. Open a PR. CI runs `sql-tests` where applicable.
3. Reviewer approves, merge to `main`.
4. GitHub Actions triggers `deploy-migrations.yml`. The workflow:
   - Links the CLI to the Supabase project
   - Prints the list of pending migrations (audit trail)
   - Runs `supabase db push --linked`
   - Prints the updated list

Runs take ~30 seconds. Watch the Actions tab to confirm.

---

## Manual deploy (break-glass)

Go to **Actions → Deploy Migrations → Run workflow**. Fill in `dry_run: true` to see the plan without applying, or leave it false to apply.

The Supabase CLI also still works locally:

```bash
supabase link --project-ref kamfamwjswkncftsdgxi
supabase db push --linked
```

---

## Handling failures

A failed migration leaves the DB in a partially-applied state. Options:

1. Push a fix-forward migration that corrects whatever broke
2. Open a psql session (via Supabase dashboard or local CLI) and manually finish the migration
3. In severe cases: revert the PR on `main` to avoid re-applying the broken migration on the next workflow run

Rollback is always manual. Migrations don't auto-down.

---

## Secrets required

- `SUPABASE_ACCESS_TOKEN` — personal access token (reused from Edge Function deploys)
- `SUPABASE_DB_PASSWORD` — project database password

Rotate these by regenerating in the Supabase dashboard and updating the GitHub secret.

---

## Migrations applied via MCP before this workflow existed

Four migrations from PR #15 (`20260424234737`–`20260424234740`) were applied manually via Supabase MCP on 2026-04-24 before the auto-deploy workflow existed. They were marked as "applied" in the `supabase_migrations.schema_migrations` table using `supabase migration repair --status applied`. No action needed — they will not re-run.

---

## Common gotchas

| Gotcha | What to know |
|---|---|
| **Filename ordering** | Supabase CLI sorts migrations by filename. Always use the `YYYYMMDDHHMMSS_` timestamp prefix so ordering is unambiguous. |
| **Per-file transactions** | `supabase db push` wraps each migration in a transaction. A failure mid-file rolls back that file, but earlier successful files in the same push stay applied. Design migrations to be independently re-runnable. |
| **CLI 15-minute timeout** | Long-running data migrations (backfilling millions of rows) can exceed the default Supabase CLI timeout. Not an issue at current scale. |
| **`schema_migrations` schema** | The tracker table lives in `supabase_migrations.schema_migrations`, not `public.schema_migrations`. |
| **`migration repair` vs. `db reset`** | `repair` marks versions as applied/reverted without running SQL — use surgically. `db reset` drops the schema and reapplies everything — never run against prod. |
