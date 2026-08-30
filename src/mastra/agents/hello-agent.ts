// src/mastra/agents/hello-agent.ts
//
// Hello-agent — a minimal Claude Agent SDK wrapper registered as a Mastra
// agent. The actual installed API surface (verified against
// `node_modules/@mastra/claude/dist/index.d.ts` and
// `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`):
//
//   - `@mastra/claude` exports a SINGLE class, `ClaudeSDKAgent`, which is a
//     subclass of `@mastra/core/agent`'s `Agent`. There is no `anthropic(...)`
//     model factory — the model is passed in via `sdkOptions.model` and
//     forwarded to the Claude SDK `query()` call on every run.
//
//   - Constructor: `new ClaudeSDKAgent({ id, name?, description, sdkOptions? })`.
//     `id` and `description` are required; `id` is a free-form string used as
//     the Mastra registration key (so we set it to the route key
//     `'hello-agent'`).
//
//   - Run with `agent.generate(messages, options)` (full output) or
//     `agent.stream(messages, options)` (streamed chunks). The Mastra HTTP
//     server exposes both at `/api/agents/:id/generate` and `/api/agents/:id/stream`.
//
//   - The Anthropic API key is read by the Claude Agent SDK subprocess from
//     `process.env.ANTHROPIC_API_KEY` (see Options.env / env-spread comments
//     in the SDK .d.ts). We therefore spread `process.env` into `sdkOptions.env`
//     so the subprocess inherits it.
//
// Notes for future tasks:
//   - The Claude SDK uses `systemPrompt` (string | string[] | preset-object)
//     in its `sdkOptions`, NOT `instructions` like `@mastra/core/agent`'s
//     `Agent`. If a future task needs per-agent instructions, override via
//     `sdkOptions.systemPrompt`.

import { ClaudeSDKAgent } from '@mastra/claude'
import { loadConfig } from '../config.js'

const config = loadConfig(process.env)

export const helloAgent = new ClaudeSDKAgent({
  id: 'hello-agent',
  name: 'Hello Agent',
  description:
    'A friendly Claude Agent SDK starter. Greets users, summarises the project, and answers short questions.',
  sdkOptions: {
    model: config.ANTHROPIC_MODEL,
    systemPrompt:
      'You are a friendly assistant for the Influtics Mastra integration. ' +
      'Greet the user, briefly explain what you can help with, and ask how you can assist.',
    // The Claude SDK uses `cwd` as the project key under which it persists
    // session files at `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`.
    // Pinning cwd to a stable, persistent directory (MASTRA_AGENT_CWD,
    // default /data/sessions/hello-agent) means a fresh container can resume
    // sessions a previous one started — the encoded project key is the same.
    cwd: config.MASTRA_AGENT_CWD,
    env: {
      ...process.env,
      CLAUDE_AGENT_SDK_CLIENT_APP: 'mastra-influtics/0.1.0',
      // Override HOME so the SDK writes ~/.claude/projects/... under /data
      // (the Coolify volume mount). Without this, sessions land in the
      // container's ephemeral /home and are lost on every restart.
      HOME: config.MASTRA_CLAUDE_HOME,
    },
  },
})
