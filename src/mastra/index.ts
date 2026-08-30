// src/mastra/index.ts
//
// Mastra instance — wires a regular `@mastra/core/agent.Agent` (hello-agent)
// with native Mastra Memory, local libSQL storage, and a SimpleAuth-backed
// HTTP server.
//
// Verified against the actual installed API:
//
//   - `Mastra` is the ONLY export from `@mastra/core` (per
//     `node_modules/@mastra/core/dist/index.d.ts`). `SimpleAuth` lives on the
//     `@mastra/core/auth` subpath.
//
//   - `Mastra` config (`@mastra/core/dist/mastra/index.d.ts:84-86`):
//       agents: { [K in keyof TAgents]: TAgents[K] | ToolLoopAgentLike | DurableAgentLike }
//       storage?: MastraCompositeStore
//       server?: ServerConfig  (port, host, auth, cors, apiRoutes, …)
//     The route key in `agents` is what `/api/agents/:key/...` resolves to.
//
//   - `LibSQLStore` (from `@mastra/libsql/dist/storage/index.d.ts`) requires
//     { id: string, url: string, authToken?: string }. `id` is required;
//     `authToken` is optional for local `file:` URLs. We use a local file URL
//     (see `MASTRA_DB_PATH` in `config.ts`) so no remote DB is involved.
//     `disableInit: true` is set so the deployer doesn't auto-create tables
//     on first use — `scripts/seed-db.ts` is the single source of schema
//     bootstrapping.
//
//   - `Memory` (`@mastra/memory/dist/index.d.ts`) is constructed per-agent
//     (see `agents/memory.ts`); `lastMessages: N` makes Mastra inject the
//     last N thread messages into the system prompt on every generate/stream
//     call. `workingMemory: { enabled: true }` lets the agent persist a
//     per-resource profile across threads via the `updateWorkingMemory` tool.
//
//   - `AgentConfigBase.memory` is natively typed as
//     `DynamicArgument<MastraMemory, TRequestContext>` on
//     `@mastra/core/dist/agent/types.d.ts:662-664` — no force-cast required.
//     `Agent.hasOwnMemory()` returns true when memory is attached, which is
//     what Studio reads to surface the "memory on" state.
//
//   - `server.apiRoutes` (`@mastra/core/dist/server/types.d.ts`) accepts a
//     `HonoApiRoute[]` with `path`, `method`, `handler` or `createHandler`.
//     Built-in `/api/agents/:id/stream`, `/api/agents/:id/generate`,
//     `/api/agents/:id/resume-stream` already cover all agent-level flows
//     we need (the last is runId-based for Mastra Memory resumes). Any
//     future custom route MUST NOT start with `/api/` because
//     `MastraServer.validateCustomRoutePaths` (verified in
//     `.mastra/output/index.mjs:44977-44982`) reserves `apiPrefix` (= `/api`
//     in dev/prod) for built-in routes — a `/api/...` path throws
//     `Custom API route "/api/..." must not start with "/api"...` and the
//     server crashes at startup. Use `/custom/...` instead.
//
// Server notes:
//   - `port: 4111` is the Mastra default; we set it explicitly for clarity.
//   - `host: '0.0.0.0'` lets the dev server be reached from outside the
//     container (e.g. from a Coolify-served frontend).
//   - The `studioHost` / `studioProtocol` / `studioPort` options decouple the
//     bind host from the Studio client's API base URL. Behind the
//     Coolify/Traefik TLS-terminating proxy, the public origin is
//     `https://mastra.influtics.com`, so we set the three `studio*` options
//     to match. See `@mastra/deployer/dist/server/index.js:4601-4603` and
//     CHANGELOG note for PR #14682 ("decouple the server bind configuration
//     from the Studio API URL").

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

// Local libSQL file. The parent directory is the Coolify persistent volume
// mount at `/data` in production, or `.mastra/` (already gitignored) in dev.
// No remote DB is involved — see `config.ts` for path resolution rules.
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: `file:${config.MASTRA_DB_PATH}`,
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
    // Studio API base URL — public origin behind the Coolify/Traefik TLS proxy.
    // Without these, the Studio SPA's `MASTRA_SERVER_HOST` etc. inherit the
    // bind host (`0.0.0.0`) and the browser tries `http://0.0.0.0:4111/api`,
    // fails to resolve, and renders the "black screen" with the
    // `<!doctype … is not valid JSON` error. See header comment.
    studioHost: 'mastra.influtics.com',
    studioProtocol: 'https',
    studioPort: 443,
    auth,
  },
})
