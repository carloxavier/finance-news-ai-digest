# Data Model

Single source of truth for every table, column, enum, and relationship in the Finnopolis Postgres database (Supabase project `kamfamwjswkncftsdgxi`).

This documentation is **descriptive** — it should match the live schema at all times. If you change the schema, update the relevant file in this directory in the same commit. For the workflow of how content is authored and seeded, see the `finance-ai-digest-seeder` skill; for how RPCs return data to the frontend, see [`../supabase-rpc.md`](../supabase-rpc.md); for deployment and the system diagram, see [`../architecture.md`](../architecture.md).

## Navigation

| File | Covers |
|---|---|
| [`article-lifecycle.md`](./article-lifecycle.md) | The `processing_status` state machine and the four feed RPCs |
| [`content-tables.md`](./content-tables.md) | `ai_articles`, `topics`, `article_topics`, `topic_feeds` |
| [`user-tables.md`](./user-tables.md) | `digest_subscribers`, `user_interests`, `user_tickers`, `user_feed_cache`, `onboarding_survey` |
| [`engagement-tables.md`](./engagement-tables.md) | `article_clicks`, `digest_sent_articles`, `email_events`, `ai_agent_waitlist` |
| [`reporting-views.md`](./reporting-views.md) | `article_engagement`, `churn_risk`, `subscriber_retention`, `topic_engagement` |
| [`reference-tables.md`](./reference-tables.md) | `news_sources`, `stats_weekly_snapshots` (both unused today) |
| [`references.md`](./references.md) | FK cascade map, JSON shapes for jsonb columns, enum cheat sheet |

## Conventions

- **Schema**: everything is in `public` unless otherwise noted.
- **Primary keys**: always a `uuid` column named `id`, default `gen_random_uuid()`.
- **Timestamps**: always `timestamp with time zone`. No naive timestamps anywhere.
- **Enums**: implemented as `text` columns with CHECK constraints, not Postgres `enum` types. This keeps migrations easy at the prototype stage. See the [enums cheat sheet](./references.md#enums-and-check-constraint-values).
- **Soft-delete pattern**: content is archived via `processing_status = 'archived'`, not deleted. See [article lifecycle](./article-lifecycle.md).
- **Cascade rules are deliberately asymmetric.** Cascade is used where the child row has no meaning without its parent (`article_clicks` tracks a click on an article — if the article is gone, the click is meaningless). NO ACTION is used where the child captures an independent user intent that should survive the parent (`ai_agent_waitlist.article_id` references the triggering article, but the user's intent to join the waitlist isn't cancelled if that article is later deleted). When removing an article, check the [FK cascade map](./references.md#fk-cascade-map) and clean up NO ACTION children explicitly.
- **Identity is a known weak point.** The `user_id` concept used across several tables is client-generated and server-trusted without validation. See [P3](../backlog/P3-client-generated-user-id-authz.md) and [`user-tables.md`](./user-tables.md) for details.
