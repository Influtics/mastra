// src/mastra/index.ts
//
// Mastra instance — wires the Claude SDK hello-agent, local libSQL storage,
// a Mastra Memory trace layer, a Claude SDK session-resume HTTP route, and a
// SimpleAuth-backed HTTP server. Verified against the actual installed API:
//
//   - `Mastra` is the ONLY export from `@mastra/core` (per
//     `node_modules/@mastra/core/dist/index.d.ts`). `SimpleAuth` lives on the
//     `@mastra/core/auth` subpath.
//
//   - `Mastra` config (`@mastra/core/dist/mastra/types.d.ts`):
//       agents: { [routeKey]: Agent | ToolLoopAgentLike | DurableAgentLike }
//       storage?: MastraCompositeStore
//       server?: ServerConfig  (port, host, auth, cors, apiRoutes, …)
//     The route key in `agents` is what `/api/agents/:key/...` resolves to.
//     `Mastra` has NO top-level `memory` option — memory must be assigned
//     per-agent (we force-cast below; see the comment there).
//
//   - `LibSQLStore` (from `@mastra/libsql/dist/storage/index.d.ts`) requires:
//       { id: string, url: string, authToken?: string }
//     `id` is required; `authToken` is optional for local `file:` URLs but
//     required for remote `libsql://` Turso URLs. We use a local file URL
//     (see `MASTRA_DB_PATH` in `config.ts`) so no remote DB is involved.
//     `disableInit: true` is set so the deployer doesn't auto-create tables
//     on first use — `scripts/seed-db.ts` is the single source of schema
//     bootstrapping.
//
//   - `SimpleAuth` (`@mastra/core/dist/server/simple-auth.d.ts`) takes a
//     `tokens` map: `{ [token]: user }`. We register one token (the bearer
//     token from env) mapped to a single developer user. SimpleAuth is
//     exempt from the EE license requirement, so it works without one.
//
//   - `Memory` (`@mastra/memory/dist/index.d.ts`) constructor takes
//     `{ storage, options }`. `options.lastMessages: N` makes Mastra inject
//     the last N thread messages into the system prompt on every generate/
//     stream call (subject to the agent's Memory wiring — see below).
//
//   - `ClaudeSDKAgent` (`@mastra/claude/dist/index.d.ts`) constructor takes
//     `{ id, name?, description, sdkOptions }`. It does NOT expose a `memory`
//     field, so we force-cast `(helloAgent as any).memory = memory` to wire
//     the parent `@mastra/core/agent.Agent`'s memory slot. Caveat: the Claude
//     Agent SDK subprocess is sealed — it reads only its own `systemPrompt`
//     and the current message — so MastraMemory threads are surfaced in
//     Studio traces but do NOT feed the model's context. Real model-level
//     memory lives in the Claude SDK session store at
//     `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`, exercised via
//     the custom `/api/agents/hello-agent/continue` route below.
//
//   - `server.apiRoutes` (`@mastra/core/dist/server/types.d.ts`) accepts a
//     `HonoApiRoute[]` with `path`, `method`, `handler` or `createHandler`
//     (the latter receives `{ mastra }` so we can call
//     `mastra.getAgent('hello-agent').resumeGenerate(...)`). The built-in
//     `/api/agents/:id/resume-stream` route is runId-based (Mastra Memory
//     model) — different from the sessionId/`continue` model the Claude SDK
//     uses, so we mount our own.
//
// Server notes:
//   - `port: 4111` is the Mastra default; we set it explicitly for clarity.
//   - `host: '0.0.0.0'` lets the dev server be reached from outside the
//     container (e.g. from a Coolify-served frontend).

import { Mastra } from '@mastra/core'
import { SimpleAuth, type User } from '@mastra/core/auth'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

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

// Mastra Memory trace layer. Persists conversation threads/messages to the
// same libSQL store so Studio surfaces the thread history and tools like
// `mastra.getMemory().recall(...)` work. `lastMessages: 20` instructs the
// parent Agent class to inject the last 20 thread messages into the system
// prompt on every call — but for `ClaudeSDKAgent` this only matters for the
// HTTP layer (Studio traces + thread history); the Claude subprocess itself
// is sealed. Working memory + semantic recall stay disabled for v1 — they
// need vector embeddings + a writable working-memory template, neither of
// which are wired yet. Keep this lean until we add a non-Claude agent that
// honors Mastra Memory end-to-end.
const memory = new Memory({
  storage,
  options: {
    lastMessages: 20,
    workingMemory: { enabled: false },
    semanticRecall: false,
  },
})

// Force-cast memory onto the agent. `ClaudeSDKAgent`'s typed constructor
// (`ClaudeAgentOptions`) doesn't expose `memory`, but the parent
// `@mastra/core/agent.Agent` does. Setting it here is what makes Studio
// surface thread persistence for `/api/agents/hello-agent/stream` calls.
;(helloAgent as { memory: typeof memory }).memory = memory

export const mastra = new Mastra({
  agents: {
    'hello-agent': helloAgent,
  },
  storage,
  server: {
    port: 4111,
    host: '0.0.0.0',
    auth,
    apiRoutes: [
      // Claude SDK session resume. The built-in
      // `/api/agents/:agentId/resume-stream` route is runId-based (Mastra
      // Memory model). Claude SDK sessions are a different beast: they live
      // at `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` and are
      // resumed by `sessionId` or by `continue: true` (latest session for
      // cwd). This route wraps `agent.resumeGenerate({ message, continue:
      // true })` so callers can keep a conversation going across calls
      // without managing sessionIds themselves.
      {
        path: '/api/agents/hello-agent/continue',
        method: 'POST',
        requiresAuth: true,
        createHandler: async ({ mastra }) => {
          return async (c) => {
            let body: {
              messages?: Array<{ role?: string; content?: string }>
            }
            try {
              body = (await c.req.json()) as typeof body
            } catch {
              return c.json({ error: 'invalid JSON body' }, 400)
            }
            const messages = body?.messages
            if (!Array.isArray(messages) || messages.length === 0) {
              return c.json(
                { error: 'messages array required (last entry is used)' },
                400,
              )
            }
            const last = messages[messages.length - 1]
            if (!last || typeof last.content !== 'string') {
              return c.json(
                { error: 'last message must have a string content field' },
                400,
              )
            }
            const agent = mastra.getAgent('hello-agent')
            if (!agent) {
              return c.json({ error: 'agent not found' }, 404)
            }
            const result = await agent.resumeGenerate(
              { message: last, continue: true } as Parameters<
                typeof agent.resumeGenerate
              >[0],
            )
            return c.json({ success: true, data: result })
          }
        },
      },
    ],
  },
})
