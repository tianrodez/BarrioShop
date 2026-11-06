#!/usr/bin/env bash
# Applies the Supabase-compatible harness, then the real migrations in
# filename order, then demo accounts and demo seed. Used by the `migrate`
# service in docker-compose.yml.
set -euo pipefail
export PGPASSWORD=barrioshop_local
PSQL=(psql -h db -U postgres -d barrioshop -v ON_ERROR_STOP=1 -q)

until pg_isready -h db -U postgres -d barrioshop -q; do sleep 0.5; done

echo "==> harness (local auth emulation)"
"${PSQL[@]}" -f /sql/tests/000_harness_setup.sql

for f in /sql/migrations/*.sql; do
  echo "==> applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "==> demo auth accounts"
"${PSQL[@]}" -f /sql/tests/900_demo_users.sql

echo "==> demo seed (La Espiga, Fruver El Campo, NEARBUY...)"
"${PSQL[@]}" -f /sql/seed_demo.sql

echo "==> migrations + demo data applied OK"
