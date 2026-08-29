// src/mastra/index.ts
//
// Mastra instance — wires the Claude SDK hello-agent, libsql storage, and a
// SimpleAuth-backed HTTP server. Verified against the actual installed API:
//
//   - `Mastra` is the ONLY export from `@mastra/core` (per
//     `node_modules/@mastra/core/dist/index.d.ts`). `SimpleAuth` lives on the
//     `@mastra/core/auth` subpath.
//
//   - `Mastra` config (`@mastra/core/dist/mastra/types.d.ts`):
//       agents: { [routeKey]: Agent | ToolLoopAgentLike | DurableAgentLike }
//       storage?: MastraCompositeStore
//       server?: ServerConfig  (port, host, auth, cors, …)
//     The route key in `agents` is what `/api/agents/:key/...` resolves to.
//
//   - `LibSQLStore` (from `@mastra/libsql/dist/storage/index.d.ts`) requires:
//       { id: string, url: string, authToken?: string }
//     `id` is required; `authToken` is optional for local `file:` URLs but
//     required for remote `libsql://` Turso URLs. `disableInit: true` is set
//     so the deployer doesn't auto-create tables on first use — the seed
//     script (`scripts/seed-turso.ts`) is the single source of schema
//     bootstrapping.
//
//   - `SimpleAuth` (`@mastra/core/dist/server/simple-auth.d.ts`) takes a
//     `tokens` map: `{ [token]: user }`. We register one token (the bearer
//     token from env) mapped to a single developer user. SimpleAuth is
//     exempt from the EE license requirement, so it works without one.
//
// Server notes:
//   - `port: 4111` is the Mastra default; we set it explicitly for clarity.
//   - `host: '0.0.0.0'` lets the dev server be reached from outside the
//     container (e.g. from a Coolify-served frontend).

import { Mastra } from '@mastra/core'
import { SimpleAuth, type User } from '@mastra/core/auth'
import { LibSQLStore } from '@mastra/libsql'

import { helloAgent } from './agents/hello-agent.js'
import { loadConfig } from './config.js'

const config = loadConfig(process.env)

// `User` is the default SimpleAuth user shape. `id` is the only required field;
// `email` / `name` are surfaced in Studio's user menu when present.
const studioUser: User = {
  id: 'studio-operator',
  email: 'studio-operator@influtics.local',
  name: 'Studio Operator',
}

const auth = new SimpleAuth<User>({
  tokens: {
    [config.MASTRA_STUDIO_TOKEN]: studioUser,
  },
})

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: config.TURSO_DATABASE_URL,
  authToken: config.TURSO_AUTH_TOKEN,
  disableInit: true,
})

export const mastra = new Mastra({
  agents: {
    'hello-agent': helloAgent,
  },
  storage,
  server: {
    port: 4111,
    host: '0.0.0.0',
    auth,
  },
})
