// src/mastra/agents/hello-agent.ts
//
// Hello-agent — a regular `@mastra/core/agent.Agent` registered as the
// Mastra `hello-agent` route. The model is an Anthropic-compatible endpoint
// constructed via `@ai-sdk/anthropic`'s `createAnthropic({ baseURL, apiKey })`,
// pointed at the minimax Anthropic-compatible proxy by default. Memory is
// wired natively on `AgentConfig.memory` (no force-cast), so `hasOwnMemory()`
// returns true and Studio surfaces the "memory on" state with lastMessages
// + workingMemory actually feeding the model context.
//
// API verified against the installed packages:
//   - `AgentConfigBase.memory: DynamicArgument<MastraMemory, TRequestContext>`
//     (`node_modules/@mastra/core/dist/agent/types.d.ts:662-664`).
//   - `AnthropicProviderSettings.baseURL` is supported on the
//     `createAnthropic(...)` constructor
//     (`node_modules/@mastra/core/dist/_types/@ai-sdk_anthropic-v6/dist/index.d.ts:1180-1213`).
//   - `Agent.hasOwnMemory()` (`node_modules/@mastra/core/dist/agent/agent.d.ts:502`)
//     is what Studio reads to decide "memory on".

import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'

import { helloAgentMemory } from './memory.js'
import { loadConfig } from '../config.js'

const config = loadConfig(process.env)

const anthropic = createAnthropic({
  baseURL: config.baseURL,
  apiKey: config.ANTHROPIC_API_KEY,
})

export const helloAgent = new Agent({
  id: 'hello-agent',
  name: 'Hello Agent',
  description:
    'A friendly Mastra Agent starter. Greets users, summarises the project, and answers short questions. Remembers context across turns (lastMessages) and across threads (workingMemory).',
  instructions:
    'You are a friendly assistant for the Influtics Mastra integration. ' +
    'Greet the user, briefly explain what you can help with, and ask how you can assist.',
  model: anthropic(config.ANTHROPIC_MODEL),
  memory: helloAgentMemory,
  tools: {},
})