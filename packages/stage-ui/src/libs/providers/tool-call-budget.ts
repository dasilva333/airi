import type { Tool } from '@xsai/shared-chat'

export const DEFAULT_MAX_TOOL_STEPS = 20

// NOTICE: @xsai ends the tool loop after `maxSteps` rounds even when the last round only
// executed tools, so the model never gets to reply. Rounds beyond the budget leave room
// for the model to read the refusal and answer.
const ANSWER_ROUNDS = 3

export function toolStepLimitMessage(limit: number) {
  return `Tool step limit reached (${limit} per reply). Do not call any more tools; answer the user now with what you have.`
}

export function withToolStepBudget(tools: Tool[] | undefined, maxToolSteps: number): { tools: Tool[] | undefined, maxSteps: number } {
  const limit = Math.max(1, Math.floor(maxToolSteps))
  const maxSteps = limit + ANSWER_ROUNDS
  if (!tools?.length)
    return { tools, maxSteps }

  // NOTICE: @xsai runs one round's parallel calls in a single Promise.all over the same
  // `messages` array and appends the results only after all of them settle, so its length
  // is identical within a round and grows between rounds.
  const rounds = new Set<number>()
  return {
    maxSteps,
    tools: tools.map(tool => ({
      ...tool,
      execute: async (input, options) => {
        const round = options.messages.length
        if (!rounds.has(round)) {
          if (rounds.size >= limit)
            return toolStepLimitMessage(limit)
          rounds.add(round)
        }
        return tool.execute ? tool.execute(input, options) : undefined
      },
    })),
  }
}
