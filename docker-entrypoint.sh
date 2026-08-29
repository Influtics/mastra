#!/bin/sh
set -e

# POSIX-safe env-var check (BusyBox ash does not support bash's ${!var}).
for var in MASTRA_STUDIO_TOKEN ANTHROPIC_API_KEY; do
  eval "value=\"\$$var\""
  if [ -z "$value" ]; then
    echo "[entrypoint] FATAL: required env var $var is not set" >&2
    exit 1
  fi
done

echo "[entrypoint] required env vars present"
echo "[entrypoint] bootstrapping local libSQL schema at ${MASTRA_DB_PATH:-/data/mastra.db} (idempotent, IF NOT EXISTS)..."
mkdir -p "$(dirname "${MASTRA_DB_PATH:-/data/mastra.db}")"
node --import tsx/esm scripts/seed-db.ts

echo "[entrypoint] starting Mastra..."
exec node .mastra/output/index.mjs
