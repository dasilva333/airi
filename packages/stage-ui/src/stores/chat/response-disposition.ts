import type { ChatStreamEventContext } from '../../types/chat'

export function responseDispositionFor(
  context: ChatStreamEventContext,
): ChatStreamEventContext['responseDisposition'] | null {
  return context.responseDisposition ?? null
}
