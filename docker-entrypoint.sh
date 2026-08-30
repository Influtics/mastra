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

echo "[entrypoint] starting Mastra (dev server — ships Studio)..."
# mastra dev mounts the Studio SPA at the studioBase path (default `/`) and
# runs the same Mastra instance the prod build would. We use it in the Coolify
# container because `mastra build` hardcodes `studio: false` in its bundled
# entry (see `.mastra/output/index.mjs` near `createNodeServer(mastra, …)`),
# so the prod bundle never mounts Studio and falls back to the API "Mastra
# Server" landing page. For a single-operator dev surface that's mounted at a
# public FQDN, the dev server is the right trade-off (Vite dev overhead is
# negligible at single-tenant traffic).
exec node_modules/.bin/mastra dev
