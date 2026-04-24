# Backlog

Markdown-based ticket tracking for deferred work. One file per ticket. This replaces the earlier Notion-based backlog.

## Why this lives in the repo

- **Code proximity** — the ticket sits next to the code it describes.
- **Git-tracked** — ticket creation, edits, and closure are all in the commit history.
- **Reviewable** — priority and scope decisions go through PR review like anything else.
- **Searchable** — standard grep finds tickets instantly; no external service required.
- **Closable via commit message** — reference a ticket in a commit and move its file to `done/` in the same PR.

## Filename convention

```
docs/backlog/<PRIORITY>-<kebab-case-slug>.md
```

Priority prefixes:

- `P1-` — blocking release or production; fix this before anything else.
- `P2-` — ship within the current sprint.
- `P3-` — real bug or security issue that must be fixed, but not blocking immediate work.
- `P4-` — quality / consistency / cleanup work. Do when touching the adjacent code.
- `P5-` — future work, nice-to-have, or significant refactors without urgent product value.

Examples:
- `P3-client-generated-user-id-authz.md`
- `P4-consolidate-feed-rpcs.md`

## Ticket structure

Every ticket has these sections at minimum:

```markdown
# <Priority> — <One-line summary>

**Filed**: YYYY-MM-DD
**Status**: open | in-progress | blocked | done

## Summary
One or two paragraphs explaining what and why.

## Scope
Concrete changes required.

## Acceptance
Bullet list of what "done" looks like.
```

Optional sections when useful: `Related tickets`, `Root cause`, `Proposed direction`, `Implementation sketch`, `Notes`.

## Closing a ticket

When a PR ships the fix:

1. Move the file from `docs/backlog/` to `docs/backlog/done/`.
2. Update the top of the file: set `Status: done` and add `Closed: YYYY-MM-DD (PR #XXX)`.
3. Reference the ticket filename in the PR description so the link is searchable later.

Don't delete closed tickets — `done/` is the project's institutional memory for "why did we do this refactor three months ago."

## Current tickets

### Open

- [P3 — client-generated user_id is an authZ bypass](./P3-client-generated-user-id-authz.md)
- [P4 — insufficient article freshness in digest](./P4-insufficient-article-freshness-in-digest.md)
- [P4 — retroactively commit all live-applied Supabase RPCs](./P4-retro-commit-live-applied-rpcs.md)
- [P4 — consolidate feed RPCs from four to two](./P4-consolidate-feed-rpcs.md)
- [P4 — normalize ticker → company name](./P4-normalize-ticker-company-names.md)
- [P4 — stop rendering single-publication name](./P4-stop-rendering-single-publication-name.md)
- [P4 — user_tickers ranking boost](./P4-user-tickers-ranking-boost.md)
- [P4 — add contract tests for track-click](./P4-track-click-contract-tests.md)
- [P5 — decide fate of news_sources table](./P5-decide-fate-of-news-sources.md)
- [P5 — decide fate of stats_weekly_snapshots table](./P5-decide-fate-of-stats-weekly-snapshots.md)
- [P5 — drop legacy brief column](./P5-drop-legacy-brief-column.md)
- [P5 — replace uniform --no-verify-jwt flag with supabase/config.toml](./P5-edge-function-verify-jwt-config.md)
- [P5 — rename misleading cron job archive-digest-sent](./P5-rename-archive-digest-sent-cron.md)
- [P5 — secure welcome email + signup rate limiting](./P5-secure-welcome-and-signup-rate-limiting.md)

### Done

- [P3 — article-ticker-company-name-missing](./done/P3-article-ticker-company-name-missing.md) — Closed 2026-04-20
- [P3 — inference-label-not-sourced-copy](./done/P3-inference-label-not-sourced-copy.md) — Closed 2026-04-20
- [P3 — ask-grok-about-article](./done/P3-ask-grok-about-article.md) — Closed 2026-04-21
- [P4 — lean-subscriber-by-token-rpc](./done/P4-lean-subscriber-by-token-rpc.md) — Closed 2026-04-21
- [P3 — simplify-email-link-tokens](./done/P3-simplify-email-link-tokens.md) — Closed 2026-04-20

## Migration note

This backlog was migrated from Notion on 2026-04-18. As of 2026-04-20,
all referenced deferred tickets have been filed into this folder. Notion
retains the historical record; GitHub is canonical for all new work.
