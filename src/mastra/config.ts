// src/mastra/config.ts
//
// Env loader with required-var validation. Keeps env-var wiring in one place
// so `src/mastra/index.ts` can stay focused on wiring the Mastra instance.
//
// Env-var expectations (per the actual installed packages — see comments
// in `src/mastra/index.ts`):
//   ANTHROPIC_API_KEY     — required. Bearer key for the Anthropic-compatible
//                           endpoint. Passed to `createAnthropic({ apiKey })`
//                           in `src/mastra/agents/hello-agent.ts`.
//   ANTHROPIC_MODEL       — OPTIONAL. Model id forwarded to
//                           `anthropic(config.ANTHROPIC_MODEL)`.
//                           Defaults to `claude-sonnet-4-5-20251001`.
//   ANTHROPIC_BASE_URL    — OPTIONAL. Override the Anthropic-compatible
//                           endpoint. Passed to `createAnthropic({ baseURL })`.
//                           Defaults to the minimax Anthropic-compatible
//                           proxy at `https://api.minimax.io/anthropic` the
//                           project has been using via the Claude Agent SDK
//                           subprocess. Set this to point at any other
//                           Anthropic-compatible gateway.
//   MASTRA_STUDIO_TOKEN   — required. Bearer token used by SimpleAuth to
//                           guard the Mastra HTTP server (Studio / API routes).
//   MASTRA_DB_PATH        — OPTIONAL. Absolute path of the libSQL file on
//                           disk. The parent directory must exist and be
//                           writable by the `node` process. In production
//                           (Coolify) this is `/data/mastra.db` — the
//                           Coolify persistent volume is mounted there. In
//                           dev it defaults to a repo-local
//                           `.mastra/storage.db`. Override if neither
//                           default fits.

import { homedir } from 'node:os'

export interface MastraEnv {
  ANTHROPIC_API_KEY: string
  ANTHROPIC_MODEL: string
  ANTHROPIC_BASE_URL?: string
  MASTRA_STUDIO_TOKEN: string
  MASTRA_DB_PATH: string
  // unused post-hello-agent switch; kept one release for deploy-contract stability
  MASTRA_AGENT_CWD: string
  // unused post-hello-agent switch; kept one release for deploy-contract stability
  MASTRA_CLAUDE_HOME: string
}

const REQUIRED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'MASTRA_STUDIO_TOKEN',
] as const

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20251001'

// `NODE_ENV=production` → persist at `/data/mastra.db` (Coolify volume mount).
// Anything else → persist at `<repo>/.mastra/storage.db` for developer ergonomics.
// Override with `MASTRA_DB_PATH=/custom/path.db` if neither default fits.
const DEFAULT_DB_PATH =
  process.env.NODE_ENV === 'production'
    ? '/data/mastra.db'
    : '.mastra/storage.db'

// Unused after the hello-agent switch from ClaudeSDKAgent to a regular
// Agent. Kept (with the marker below) for deploy-contract stability —
// see next line.
// unused post-hello-agent switch; kept one release for deploy-contract stability
const DEFAULT_AGENT_CWD =
  process.env.NODE_ENV === 'production' ? '/data/sessions/hello-agent' : process.cwd()

// unused post-hello-agent switch; kept one release for deploy-contract stability
//
// NOTE: must be a static ESM import, not `require('node:os')`. This package is
// `"type": "module"`, so `require` is not defined at runtime in ESM scope. The
// production bundle hid the bug because `mastra build` constant-folds
// `NODE_ENV === 'production'` to `true` and dead-code-eliminates this branch,
// and `tsc --noEmit` hid it because `@types/node` declares a global `require`.
// Only source-executing paths (vitest, `mastra dev`, `tsx`) actually evaluated
// it — and threw `ReferenceError: require is not defined in ES module scope`.
const DEFAULT_CLAUDE_HOME =
  process.env.NODE_ENV === 'production' ? '/data' : homedir()

export function loadConfig(env: NodeJS.ProcessEnv): MastraEnv & { baseURL: string } {
  for (const key of REQUIRED_ENV_VARS) {
    if (!env[key]) {
      throw new Error(`Missing required env var: ${key}`)
    }
  }

  return {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY!,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    // Defaults to the minimax Anthropic-compatible proxy the project has been
    // using via the Claude SDK subprocess. Override with ANTHROPIC_BASE_URL
    // to point at any other Anthropic-compatible endpoint.
    baseURL: env.ANTHROPIC_BASE_URL || 'https://api.minimax.io/anthropic',
    MASTRA_STUDIO_TOKEN: env.MASTRA_STUDIO_TOKEN!,
    MASTRA_DB_PATH: env.MASTRA_DB_PATH ?? DEFAULT_DB_PATH,
    MASTRA_AGENT_CWD: env.MASTRA_AGENT_CWD ?? DEFAULT_AGENT_CWD,
    MASTRA_CLAUDE_HOME: env.MASTRA_CLAUDE_HOME ?? DEFAULT_CLAUDE_HOME,
  }
}
