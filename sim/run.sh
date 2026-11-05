#!/usr/bin/env bash
# Six-month Gossoko simulation on an isolated local Supabase (Docker).
# Never touches the live project. Usage: sim/run.sh [up|run|down]   (default: up + run)
#   SIM_DAYS=30 sim/run.sh   shorter run
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
STACK=${SIM_STACK:-${TMPDIR:-/tmp}/gossoko-sim-stack}
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
EXCLUDE=studio,imgproxy,vector,logflare,realtime,mailpit,edge-runtime

up() {
  if [ ! -f "$STACK/supabase/config.toml" ]; then
    mkdir -p "$STACK" && (cd "$STACK" && supabase init --force >/dev/null)
    sed -i '' -e 's/^project_id = .*/project_id = "gossoko-sim"/' \
      -e 's/5432\([0-9]\)/5542\1/g' \
      -e 's/^schemas = \["public", "graphql_public"\]/schemas = ["public", "graphql_public", "gossoko"]/' \
      -e 's/^sign_in_sign_ups = .*/sign_in_sign_ups = 100000/' -e 's/^token_refresh = .*/token_refresh = 100000/' \
      "$STACK/supabase/config.toml"
  fi
  rm -rf "$STACK/supabase/migrations" && mkdir -p "$STACK/supabase/migrations"
  cp "$ROOT"/sim/00_sim_schema.sql "$STACK/supabase/migrations/20260101000000_sim_schema.sql"
  cp "$ROOT"/supabase/migrations/*.sql "$STACK/supabase/migrations/"
  cp "$ROOT"/supabase/seed.sql "$STACK/supabase/seed.sql"
  (cd "$STACK" && { supabase status >/dev/null 2>&1 || supabase start -x "$EXCLUDE" >/dev/null; } && supabase db reset >/dev/null)
  docker rm -f gossoko-sim-fn >/dev/null 2>&1 || true
  docker run -d --name gossoko-sim-fn -p 55430:8000 \
    -v "$ROOT/supabase/functions/gossoko-admin:/fn:ro" \
    -e SUPABASE_URL=http://host.docker.internal:55421 -e SUPABASE_ANON_KEY=$ANON -e SUPABASE_SERVICE_ROLE_KEY=$SERVICE \
    denoland/deno:2.1.4 run -A /fn/index.ts >/dev/null
  for _ in $(seq 60); do curl -s -o /dev/null -X POST localhost:55430 && break; sleep 1; done
}
run() { SIM_ANON=$ANON npx vitest run -c sim/vitest.config.ts; }
down() { docker rm -f gossoko-sim-fn >/dev/null 2>&1 || true; (cd "$STACK" && supabase stop --no-backup >/dev/null 2>&1) || true; }

case "${1:-all}" in
  up) up ;; run) run ;; down) down ;;
  all) up && run ;;
esac
