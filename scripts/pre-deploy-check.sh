#!/usr/bin/env bash
# Pre-deploy gate for Edge Functions.
# Run this before `supabase functions deploy <name>` or any MCP-driven deploy.
# Usage: ./scripts/pre-deploy-check.sh [function-name]
# With no arg: runs the full test suite. With an arg: runs the tests
# colocated with that function's folder.

set -euo pipefail

FN="${1:-}"

run_sql_tests() {
  local SQL_TEST_DIR="supabase/functions/__tests__"
  if [[ ! -d "$SQL_TEST_DIR" ]]; then
    echo "  (no SQL test directory — skipping)"
    return 0
  fi

  local count
  count=$(find "$SQL_TEST_DIR" -name "*_test.sql" | wc -l | tr -d ' ')
  if [[ "$count" == "0" ]]; then
    echo "  (no SQL test files — skipping)"
    return 0
  fi

  if ! command -v psql &>/dev/null; then
    echo "⚠  psql not found — skipping SQL tests"
    return 0
  fi

  # Check if local Supabase is running and reachable
  local LOCAL_DB="postgresql://postgres:postgres@localhost:54322/postgres"
  if ! psql "$LOCAL_DB" -c '\q' 2>/dev/null; then
    echo "⚠  Local Supabase DB not reachable at :54322 — skipping SQL tests."
    echo "   Run 'supabase start' to enable them."
    return 0
  fi

  echo "→ Running $count SQL test file(s) against local Supabase"
  local file
  for file in "$SQL_TEST_DIR"/*_test.sql; do
    psql "$LOCAL_DB" -f "$file" -v ON_ERROR_STOP=1
  done
}

# Advisory: warn if there are uncommitted changes under supabase/migrations/.
# The migrations auto-deploy workflow applies every committed file in the
# directory on the next push to main, so uncommitted edits here matter.
check_pending_migrations() {
  local MIGRATIONS_DIR="supabase/migrations"
  if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    return 0
  fi

  local UNCOMMITTED
  UNCOMMITTED=$(git status --porcelain "$MIGRATIONS_DIR" 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$UNCOMMITTED" != "0" ]]; then
    echo "⚠  $UNCOMMITTED uncommitted file(s) in $MIGRATIONS_DIR"
    echo "   Review before pushing. The deploy-migrations workflow will apply"
    echo "   all committed migration files on the next main-branch push."
    git status --short "$MIGRATIONS_DIR"
  fi
}

if [[ -z "$FN" ]]; then
  echo "→ Running full test suite (no function specified)"
  npm test
  run_sql_tests
  check_pending_migrations
else
  TEST_DIR="supabase/functions/$FN"
  if [[ ! -d "$TEST_DIR" ]]; then
    echo "✗ Function folder not found: $TEST_DIR"
    exit 1
  fi

  TEST_FILES=$(find "$TEST_DIR" -name "*.test.ts" | wc -l | tr -d ' ')
  if [[ "$TEST_FILES" == "0" ]]; then
    echo "⚠  No test files found in $TEST_DIR — deploying without pre-flight tests."
    echo "   Consider adding a *.test.ts file alongside the Edge Function."
  else
    echo "→ Running $TEST_FILES test file(s) for $FN"
    npx vitest run "$TEST_DIR"
  fi

  run_sql_tests
  check_pending_migrations
fi

echo "✓ Pre-deploy checks passed"
