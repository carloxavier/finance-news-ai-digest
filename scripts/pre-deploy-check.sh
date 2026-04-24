#!/usr/bin/env bash
# Pre-deploy gate for Edge Functions.
# Run this before `supabase functions deploy <name>` or any MCP-driven deploy.
# Usage: ./scripts/pre-deploy-check.sh [function-name]
# With no arg: runs the full test suite. With an arg: runs the tests
# colocated with that function's folder.

set -euo pipefail

FN="${1:-}"

if [[ -z "$FN" ]]; then
  echo "→ Running full test suite (no function specified)"
  npm test
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
    exit 0
  fi

  echo "→ Running $TEST_FILES test file(s) for $FN"
  npx vitest run "$TEST_DIR"
fi

echo "✓ Pre-deploy checks passed"
