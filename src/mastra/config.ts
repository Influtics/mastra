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
//   TURSO_DATABASE_URL    — libsql URL (`file:` or `libsql://`).
//   TURSO_AUTH_TOKEN      — required only for remote Turso URLs.

export interface MastraEnv {
  ANTHROPIC_API_KEY: string
  ANTHROPIC_MODEL: string
  MASTRA_STUDIO_TOKEN: string
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
}

const REQUIRED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'MASTRA_STUDIO_TOKEN',
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
] as const

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20251001'

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
    TURSO_DATABASE_URL: env.TURSO_DATABASE_URL!,
    TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN!,
  }
}
