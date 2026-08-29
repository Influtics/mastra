// scripts/seed-db.ts
//
// Idempotent libSQL schema bootstrap. The Mastra `LibSQLStore` is constructed
// with `disableInit: true` (see `src/mastra/index.ts`) so this script is the
// single source of truth for table creation in non-dev environments.
//
// Storage backend:
//   We use a local libSQL file at `MASTRA_DB_PATH` (default `/data/mastra.db`).
//   Coolify mounts a persistent volume at `/data` so the DB survives container
//   restarts. No external database (Turso / Postgres / etc.) is involved — keep
//   the deployment contract surface area minimal.
//
// Running:
//   pnpm bootstrap          (alias for `node --import tsx/esm scripts/seed-db.ts`)
//
// `mastra.getStorage()` returns the underlying `MastraCompositeStore` (a
// `LibSQLStore` in our case). `init()` is the documented entry point for
// explicit migrations — see the `disableInit` docblock in
// `node_modules/@mastra/libsql/dist/storage/index.d.ts` for the rationale.

import { mastra } from '../src/mastra/index.ts'

async function main() {
  const storage = mastra.getStorage()
  if (!storage) {
    console.error('[seed] No storage configured on Mastra instance')
    process.exit(1)
  }

  await storage.init()
  console.log('[seed] libSQL schema bootstrap complete')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
