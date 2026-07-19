export interface Nan0InputPresence {
  at: number
  actorId?: string
}

interface AcceptedChatInput {
  role: string
  createdAt?: number
  metadata?: { actorId?: unknown }
}

let handler: ((input: Nan0InputPresence) => void) | null = null

export function setNan0InputPresenceHandler(next: (input: Nan0InputPresence) => void): () => void {
  handler = next
  return () => {
    if (handler === next)
      handler = null
  }
}

export function notifyNan0InputPresence(input: Nan0InputPresence): void {
  handler?.(input)
}

export function notifyNan0AcceptedInputPresence(
  message: AcceptedChatInput,
  duplicateInscription: boolean,
  fallbackAt = Date.now(),
): void {
  if (message.role !== 'user' || duplicateInscription)
    return

  notifyNan0InputPresence({
    at: typeof message.createdAt === 'number' && Number.isFinite(message.createdAt) ? message.createdAt : fallbackAt,
    actorId: typeof message.metadata?.actorId === 'string' ? message.metadata.actorId : undefined,
  })
}
