#!/usr/bin/env bash
# Rebuilds a throwaway local Postgres, applies schema + migrations in order, and runs the privacy tests.
# Each test prints "== what it checks (expect …)" followed by the actual result.
# Needs PostgreSQL 16 installed locally. Usage: bash supabase/tests/run.sh [workdir]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/.."
W="${1:-$(mktemp -d)}"; B=/usr/lib/postgresql/16/bin; PORT=5499
mkdir -p "$W"; d="$W"; while [ "$d" != "/" ] && [ "$d" != "/tmp" ]; do chmod o+x "$d" 2>/dev/null; d=$(dirname "$d"); done
rm -rf "$W/data"; chown -R postgres "$W" 2>/dev/null
su postgres -c "$B/pg_ctl -D $W/data stop -m immediate" >/dev/null 2>&1
su postgres -c "$B/initdb -D $W/data -A trust >/dev/null && $B/pg_ctl -D $W/data -o '-p $PORT -k $W' -l $W/log start >/dev/null" || exit 1
sleep 2
q() { psql -h "$W" -p $PORT -U postgres -q "$@" 2>&1 | grep -v 'NOTICE\|^ act\|^-----\|^ *$\|(1 row)\|setup_demo_account'; }
q -v ON_ERROR_STOP=1 -f "$HERE/00_mock_supabase_auth.sql"
for f in schema.sql; do echo "### apply $f"; q -v ON_ERROR_STOP=1 -f "$ROOT/$f"; done
echo "### tests 10–11 (schema only)"; q -f "$HERE/10_privacy_basics.sql"; q -f "$HERE/11_privacy_floor.sql"
echo "### apply 002_real_use.sql"; q -v ON_ERROR_STOP=1 -f "$ROOT/002_real_use.sql"
echo "### test 20"; q -f "$HERE/20_real_use.sql"
echo "### apply 003_courses.sql (twice: must be re-runnable)"; q -v ON_ERROR_STOP=1 -f "$ROOT/003_courses.sql"; q -v ON_ERROR_STOP=1 -f "$ROOT/003_courses.sql"
echo "### test 30"; q -f "$HERE/30_courses.sql"
echo "### apply 004_staff_and_sample.sql (twice)"; q -v ON_ERROR_STOP=1 -f "$ROOT/004_staff_and_sample.sql"; q -v ON_ERROR_STOP=1 -f "$ROOT/004_staff_and_sample.sql"
echo "### test 40"; q -f "$HERE/40_staff_and_sample.sql"
echo "### apply 005_demo_story.sql (twice)"; q -v ON_ERROR_STOP=1 -f "$ROOT/005_demo_story.sql"; q -v ON_ERROR_STOP=1 -f "$ROOT/005_demo_story.sql"
echo "### test 50"; q -f "$HERE/50_demo_story.sql"
echo "### apply 006_dashboard_data.sql (twice)"; q -v ON_ERROR_STOP=1 -f "$ROOT/006_dashboard_data.sql"; q -v ON_ERROR_STOP=1 -f "$ROOT/006_dashboard_data.sql"
echo "### test 60"; q -f "$HERE/60_dashboard_data.sql"
su postgres -c "$B/pg_ctl -D $W/data stop -m fast" >/dev/null 2>&1
