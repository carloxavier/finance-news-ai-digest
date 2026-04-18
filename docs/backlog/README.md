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

- [P5 — Rename misleading cron job archive-digest-sent](./P5-rename-archive-digest-sent-cron.md)
- [P5 — Decide fate of news_sources table](./P5-decide-fate-of-news-sources.md)
- [P5 — Decide fate of stats_weekly_snapshots table](./P5-decide-fate-of-stats-weekly-snapshots.md)

> Several additional P3/P4/P5 tickets are referenced from elsewhere in the docs
> (e.g. `P3-client-generated-user-id-authz.md`, `P4-consolidate-feed-rpcs.md`)
> but have not yet been filed into this folder. Create them here when the
> corresponding work is picked up.

### Done

_None yet._

## Migration note

This backlog was migrated from Notion on 2026-04-18. The older "P4 — Align get_subscriber_feed ranking with get_user_feed" ticket is not ported separately because it was superseded by the broader [feed RPC consolidation ticket](./P4-consolidate-feed-rpcs.md), which includes the ranking alignment as part of its acceptance criteria.
