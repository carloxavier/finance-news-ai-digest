-- Run with: psql "$DATABASE_URL" -f supabase/functions/__tests__/calculate_relevance_test.sql
-- On failure, a DO block raises an exception and psql exits non-zero.

\set ON_ERROR_STOP on
\echo === calculate_relevance tests ===

-- Test 1: peak score (mega-cap, max mag, fresh, topic+ticker match)
DO $$
DECLARE v float;
BEGIN
  v := calculate_relevance(5, 1.0, 0.0, 18.0, 1.0, 0.5);
  IF v < 1.49 OR v > 1.51 THEN
    RAISE EXCEPTION 'Test 1 FAILED: expected ≈1.5, got %', v;
  END IF;
END $$;

-- Test 2: bottom score (small-cap, low mag, week-old, no personal match)
DO $$
DECLARE v float;
BEGIN
  v := calculate_relevance(2, 0.2, 168.0, 18.0, 0.1, 0.0);
  IF v > 0.001 THEN
    RAISE EXCEPTION 'Test 2 FAILED: expected near zero, got %', v;
  END IF;
END $$;

-- Test 3: freshness beats cap tier within same personal bucket
DO $$
DECLARE fresh_large float; stale_mega float;
BEGIN
  fresh_large := calculate_relevance(3, 0.7, 6.0,  18.0, 1.0, 0.0);
  stale_mega  := calculate_relevance(5, 1.0, 48.0, 18.0, 0.1, 0.0);
  IF fresh_large <= stale_mega THEN
    RAISE EXCEPTION 'Test 3 FAILED: fresh large (%) should beat stale mega in unsubscribed topic (%)',
      fresh_large, stale_mega;
  END IF;
END $$;

-- Test 4: thematic decays slower than breaking for same age
DO $$
DECLARE brk float; thm float;
BEGIN
  brk := calculate_relevance(3, 1.0, 24.0, 18.0, 1.0, 0.0);
  thm := calculate_relevance(3, 1.0, 24.0, 72.0, 1.0, 0.0);
  IF thm <= brk THEN
    RAISE EXCEPTION 'Test 4 FAILED: thematic (%) should decay slower than breaking (%) at same age',
      thm, brk;
  END IF;
END $$;

-- Test 5: ticker match adds real lift
DO $$
DECLARE without_tk float; with_tk float;
BEGIN
  without_tk := calculate_relevance(3, 0.7, 0.0, 18.0, 1.0, 0.0);
  with_tk    := calculate_relevance(3, 0.7, 0.0, 18.0, 1.0, 0.5);
  IF with_tk <= without_tk * 1.4 THEN
    RAISE EXCEPTION 'Test 5 FAILED: ticker match should boost score by 50%%. without=%, with=%',
      without_tk, with_tk;
  END IF;
END $$;

-- Test 6: zero half-life guard (never div by zero)
DO $$
DECLARE v float;
BEGIN
  v := calculate_relevance(3, 1.0, 1.0, 0.0, 1.0, 0.0);
  -- The GREATEST(p_half_life_hours, 1.0) guard means effective half-life is 1h.
  -- At age=1h with half-life=1h, decay factor = e^-1 ≈ 0.368
  IF v < 0.15 OR v > 0.3 THEN
    RAISE EXCEPTION 'Test 6 FAILED: zero half-life should be clamped to 1.0, got score %', v;
  END IF;
END $$;

\echo === All calculate_relevance tests passed ===
