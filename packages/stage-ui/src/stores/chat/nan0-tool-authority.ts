import type { ChatStreamEventContext } from '../../types/chat'

interface ToolLike { function?: { name?: string }, name?: string }
export type ToolSource<T extends ToolLike> = T[] | (() => Promise<T[] | undefined>) | undefined

function filtered<T extends ToolLike>(tools: T[] | undefined, allowedNames: ReadonlySet<string>): T[] | undefined {
  if (!tools)
    return undefined
  return tools.filter(tool => allowedNames.has(tool.function?.name ?? tool.name ?? ''))
}

export function gateToolsWithNan0Authority<T extends ToolLike>(
  tools: ToolSource<T>,
  context: Pick<ChatStreamEventContext, 'nan0ToolAuthority' | 'responseDisposition'>,
): ToolSource<T> {
  const authority = context.nan0ToolAuthority
  if (!authority && !context.responseDisposition)
    return tools

  const provenanceComplete = authority?.schemaVersion === 1
    && Boolean(authority.thoughtId && authority.decisionId && authority.turnId)
  const actAuthorityComplete = (authority?.finalDecision === 'ACT' || authority?.finalDecision === 'SPEAK')
    && Boolean(authority.actionIntentId && authority.capabilityId && authority.lifecyclePolicyId)
  const allowedNames = new Set(
    provenanceComplete && actAuthorityComplete ? authority.authorizedToolNames : [],
  )

  return typeof tools === 'function'
    ? async () => filtered(await tools(), allowedNames)
    : filtered(tools, allowedNames)
}
