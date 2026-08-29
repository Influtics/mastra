// src/mastra/config.ts
//
// Env loader with required-var validation. Keeps env-var wiring in one place
// so `src/mastra/index.ts` can stay focused on wiring the Mastra instance.
//
// Env-var expectations (per the actual installed packages — see comments
// in `src/mastra/index.ts`):
//   ANTHROPIC_API_KEY     — read by the Claude Agent SDK subprocess.
//   ANTHROPIC_MODEL       — model id passed into ClaudeSDKAgent sdkOptions.
//   MASTRA_STUDIO_TOKEN   — bearer token used by SimpleAuth to guard the
//                           Mastra HTTP server (Studio / API routes).
//   MASTRA_DB_PATH        — absolute path of the libSQL file on disk. The
//                           parent directory must exist and be writable by
//                           the `node` process. In production (Coolify) this
//                           is `/data/mastra.db` — the Coolify persistent
//                           volume is mounted there. In dev it defaults to a
//                           repo-local `.mastra/storage.db` so the DB lives
//                           next to other build artifacts.

export interface MastraEnv {
  ANTHROPIC_API_KEY: string
  ANTHROPIC_MODEL: string
  MASTRA_STUDIO_TOKEN: string
  MASTRA_DB_PATH: string
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

export function loadConfig(env: NodeJS.ProcessEnv): MastraEnv {
  for (const key of REQUIRED_ENV_VARS) {
    if (!env[key]) {
      throw new Error(`Missing required env var: ${key}`)
    }
  }

  return {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY!,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    MASTRA_STUDIO_TOKEN: env.MASTRA_STUDIO_TOKEN!,
    MASTRA_DB_PATH: env.MASTRA_DB_PATH ?? DEFAULT_DB_PATH,
  }
}
