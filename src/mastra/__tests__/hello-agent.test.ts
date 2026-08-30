// src/mastra/__tests__/hello-agent.test.ts
//
// Smoke tests for hello-agent wiring. These don't make LLM calls — they just
// verify that `new Agent({...})` produced a correctly-shaped instance: memory
// is attached (so Studio shows "memory on"), memory carries the expected
// lastMessages + workingMemory options, and the model is an Anthropic provider
// call carrying the configured model id.
//
// ── Why dynamic imports instead of static ones ──────────────────────────────
// Importing `hello-agent.ts` runs `loadConfig(process.env)` at MODULE-LOAD
// time, which throws if `ANTHROPIC_API_KEY` / `MASTRA_STUDIO_TOKEN` are unset
// (they are unset in a plain shell; vitest does not load `.env`).
//
// A `beforeAll()` block CANNOT fix that: Vite's SSR transform hoists every
// static `import` to the top of the module, so the imported modules evaluate
// before any lifecycle hook runs. The env vars must therefore be assigned at
// top level and the agent modules pulled in with `await import(...)` AFTER —
// dynamic imports are not hoisted, so this ordering is guaranteed.
//
// ── Why the env vars below are set the way they are ─────────────────────────
// The two REQUIRED vars use `||=` so a real local/CI value is left untouched.
// `ANTHROPIC_MODEL` is the one optional override an assertion depends on, so it
// is deleted: a developer shell that exports `ANTHROPIC_MODEL=MiniMax-M3` (as
// this project's does, pointing at the minimax proxy) would otherwise make the
// model-id assertion fail locally while passing in a clean CI env. Clearing it
// pins the test to the documented default in `config.ts`. This only mutates the
// vitest worker's own process env.

import { describe, it, expect } from 'vitest'
import { tmpdir } from 'node:os'

process.env.ANTHROPIC_API_KEY ||= 'test-anthropic-key-not-used'
process.env.MASTRA_STUDIO_TOKEN ||= 'test-studio-token-not-used'
// Hermetic DB path so `npm test` works on a read-only CI filesystem: `memory.ts`
// opens `file:${MASTRA_DB_PATH}` at MODULE-LOAD time, which would otherwise
// create the dev default `.mastra/storage.db` in the repo. The `file:` prefix is
// hardcoded there, so this must be a filesystem path; PID + timestamp keeps
// concurrent runs from colliding.
process.env.MASTRA_DB_PATH = `${tmpdir()}/mastra-test-${process.pid}-${Date.now()}.db`
delete process.env.ANTHROPIC_MODEL

const { helloAgent } = await import('../agents/hello-agent.js')
const { helloAgentMemory } = await import('../agents/memory.js')

describe('hello-agent wiring', () => {
  it('has memory attached at construction, so Studio reports "memory on"', () => {
    // `hasOwnMemory()` is a real public method on Agent
    // (`@mastra/core/dist/agent/agent.d.ts:502`) — called, not mocked.
    expect(helloAgent.hasOwnMemory()).toBe(true)
  })

  it('memory is configured with lastMessages: 20, workingMemory on, semanticRecall off', () => {
    // `getMergedThreadConfig()` is Memory's public accessor for the resolved
    // thread config (`@mastra/memory/dist/index.d.ts:85`). Preferred over
    // reaching into the private `.threadConfig` field.
    const cfg = helloAgentMemory.getMergedThreadConfig()

    expect(cfg.lastMessages).toBe(20)
    expect(cfg.workingMemory?.enabled).toBe(true)
    // No embedder/vector store is wired, so semanticRecall must stay off.
    expect(cfg.semanticRecall).toBeFalsy()
  })

  it('model is wired to the Anthropic provider with the configured model id', async () => {
    // `getModel()` is Agent's public model accessor
    // (`@mastra/core/dist/agent/agent.d.ts:828`); it may return a promise.
    // `provider` and `modelId` are both part of the AI SDK language-model
    // interface, so this asserts real wiring without touching provider
    // internals.
    const model = await helloAgent.getModel()

    expect(model.provider).toContain('anthropic')
    expect(model.modelId).toContain('claude-sonnet-4-5')
  })
})
