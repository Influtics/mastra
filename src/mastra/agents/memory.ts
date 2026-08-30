// src/mastra/agents/memory.ts
//
// Per-agent Memory instance for `hello-agent`. Regular `@mastra/core` `Agent`
// natively accepts `memory: DynamicArgument<MastraMemory, TRequestContext>` on
// `AgentConfigBase.memory` — no force-cast needed (cf. the previous
// `ClaudeSDKAgent` setup which hardcoded `supportsMemory() === false` and
// forced us to cast the property onto the agent at runtime).
//
// Configuration:
//   - lastMessages: 20  — inject last 20 thread messages into system prompt on
//                         every generate/stream call. Cheap, no embedder.
//   - workingMemory: { enabled: true } — cross-thread "user profile" memory,
//                         written by the agent via the `updateWorkingMemory`
//                         tool. No template = generic markdown WM.
//   - NO semanticRecall — keeps us off the embedder/vector-store dependency
//                         path. Can add later by passing `embedder` + `vector`
//                         to the `Memory` constructor (LibSQLVector from
//                         @mastra/libsql is already available).
//
// Storage: the same `LibSQLStore` shape we already use for the Mastra
// instance storage, pointed at `MASTRA_DB_PATH`. The `id` is distinct so it
// doesn't collide with the instance-level storage registry. `disableInit: true`
// keeps the deployer from auto-creating tables — `scripts/seed-db.ts` is the
// single source of DDL.

import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'

import { loadConfig } from '../config.js'

const config = loadConfig(process.env)

export const helloAgentMemory = new Memory({
  storage: new LibSQLStore({
    id: 'hello-agent-storage',
    url: `file:${config.MASTRA_DB_PATH}`,
    disableInit: true,
  }),
  options: {
    lastMessages: 20,
    workingMemory: { enabled: true },
  },
})