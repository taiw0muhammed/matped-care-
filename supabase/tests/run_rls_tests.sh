#!/usr/bin/env bash
# Build a throwaway database, apply the auth stub + migration, and run the
# RLS assertions. Exits non-zero if any check fails.
#
#   ./supabase/tests/run_rls_tests.sh
#
# Env overrides: PGHOST, PGPORT, PGUSER (superuser), TEST_DB.
set -euo pipefail

PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-matped_test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"

PSQL=(psql -X -q -v ON_ERROR_STOP=1 --port "$PGPORT" --user "$PGUSER")
if [ -n "${PGHOST:-}" ]; then PSQL+=(--host "$PGHOST"); fi

echo "== recreating $TEST_DB"
"${PSQL[@]}" -d postgres -c "drop database if exists $TEST_DB"
"${PSQL[@]}" -d postgres -c "create database $TEST_DB"

echo "== applying auth stub + migrations"
"${PSQL[@]}" -d "$TEST_DB" -f "$HERE/0000_local_auth_stub.sql"
for f in "$MIGRATIONS"/*.sql; do
  echo "   - $(basename "$f")"
  "${PSQL[@]}" -d "$TEST_DB" -f "$f"
done

echo "== running RLS assertions"
# Assertion failures are caught inside the test helpers, so the file always
# reaches its report; the final DO block raises if any check failed, so a
# non-zero exit here means RLS is broken. Unexpected structural errors
# (bad seed, missing table) abort early via ON_ERROR_STOP -- also non-zero.
if "${PSQL[@]}" -d "$TEST_DB" -f "$HERE/rls_test.sql"; then
  echo "RLS TESTS PASSED"
else
  echo "RLS TESTS FAILED" >&2
  exit 1
fi
