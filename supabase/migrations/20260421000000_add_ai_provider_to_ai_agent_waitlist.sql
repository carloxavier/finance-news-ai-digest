-- Adds ai_provider to ai_agent_waitlist.
--
-- Retroactive capture of the migration applied live via Supabase MCP on
-- 2026-04-21 as part of PR #12 (Ask-AI button → Grok deep-link). The MCP
-- call was named add_ai_provider_to_ai_agent_waitlist; this file is the
-- same DDL committed to the repo for a rebuildable schema history.
--
-- Additive, nullable, zero-downtime. Legacy pre-2026-04-21 rows (beta-
-- waitlist intent under the table's original semantics) retain
-- ai_provider IS NULL. New rows written by the Ask-AI click handler
-- populate ai_provider (currently 'grok').
--
-- See docs/data-model/engagement-tables.md for the dual semantics.

ALTER TABLE public.ai_agent_waitlist
  ADD COLUMN IF NOT EXISTS ai_provider text;

COMMENT ON COLUMN public.ai_agent_waitlist.ai_provider IS
  'AI provider deep-linked from the Ask-AI button (''grok'', ''gemini'', etc). NULL for legacy pre-2026-04-21 rows that recorded beta-waitlist intent under the original table semantics.';
