import type { Nan0ActionAuthority, Nan0AutonomyEvaluationBatch, Nan0Decision, Nan0MetabolismEvaluationResult, Nan0Observation, Nan0PreparedTurn, Nan0TemporalAutonomyEvaluationBatch } from '@proj-airi/nan0-runtime'

export interface Nan0PreparedDecisionProxy {
  decisionId: string
  finalDecision: Nan0Decision
  allowed: boolean
  confidence: number
  speakability: number
  attentionScore: number
  pressureScore: number
  reasonCodes: string[]
  suppressionReason: string | null
  actionIntent: { type: string, target?: string } | null
  waitUntil: number | null
  bodyExpression: { kind: string, intensity: number } | null
}

export interface Nan0PreparedTurnProxy {
  thoughtId: string
  turnId: string
  sessionId: string
  inputEventId: string
  threadId: string
  outwardDirective: string
  decision: Nan0PreparedDecisionProxy
  actionAuthority: Nan0ActionAuthority | null
}

export interface Nan0AutonomyEvaluationProxy {
  intentionId: string
  evaluationId: string
  observationId: string
  prepared: Nan0PreparedTurnProxy | null
  outcome: 'SPEAK' | 'SILENCE' | 'WAIT' | 'ACT' | 'BODY_EXPRESSION' | 'provider-failure'
  nextEvaluationAt: number | null
}

export interface Nan0TemporalAutonomyEvaluationProxy {
  temporalEventId: string
  observationId: string
  prepared: Nan0PreparedTurnProxy | null
  outcome: 'SPEAK' | 'SILENCE' | 'WAIT' | 'ACT' | 'BODY_EXPRESSION' | 'provider-failure'
  nextEvaluationAt: number | null
}

export interface Nan0BridgeRequestMap {
  prepare: Nan0Observation
  complete: {
    turnId: string
    thoughtId: string
    decisionId: string
    content: string
    timestamp: number
    metadata: Record<string, unknown>
  }
  terminal: {
    turnId: string
    thoughtId: string
    decisionId: string
    decision: 'SILENCE' | 'ACT' | 'WAIT' | 'BODY_EXPRESSION'
    reason: string
    timestamp: number
    metadata: Record<string, unknown>
  }
  fail: {
    turnId: string
    thoughtId: string
    error: string
    timestamp: number
    metadata: Record<string, unknown>
  }
  evaluateAutonomy: {
    reason: 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual'
    hostReady: boolean
    sessionId?: string
    limit?: number
  }
  evaluateTemporalAutonomy: {
    reason: 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual'
    hostReady: boolean
    sessionId?: string
  }
  evaluateMetabolism: {
    reason: 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual' | 'external-input'
    hostReady: boolean
    sessionId?: string
    heartbeatTickId?: string
  }
  notifyInput: {
    at: number
    actorId?: string
  }
  deferAutonomy: {
    intentionId: string
    turnId: string
    thoughtId: string
    reason: string
    waitUntil?: number
  }
  deferTemporalAutonomy: {
    temporalEventId: string
    turnId: string
    thoughtId: string
    reason: string
  }
}

export interface Nan0BridgeResponseMap {
  prepare: Nan0PreparedTurnProxy
  complete: { persisted: boolean }
  terminal: { persisted: boolean }
  fail: { persisted: boolean }
  evaluateAutonomy: { evaluations: Nan0AutonomyEvaluationProxy[], nextEvaluationAt: number | null }
  evaluateTemporalAutonomy: { evaluations: Nan0TemporalAutonomyEvaluationProxy[], nextEvaluationAt: number | null }
  evaluateMetabolism: {
    observationId: string | null
    prepared: Nan0PreparedTurnProxy | null
    outcome: Nan0MetabolismEvaluationResult['outcome']
    nextEvaluationAt: number | null
    terminal: Nan0MetabolismEvaluationResult['terminal']
  }
  notifyInput: { persisted: boolean }
  deferAutonomy: { persisted: boolean }
  deferTemporalAutonomy: { persisted: boolean }
}

export type Nan0BridgeAction = keyof Nan0BridgeRequestMap

type Nan0OwnerHandler = <A extends Nan0BridgeAction>(
  action: A,
  payload: Nan0BridgeRequestMap[A],
) => Promise<Nan0BridgeResponseMap[A]>

interface RequestMessage {
  kind: 'request'
  requestId: string
  senderId: string
  action: Nan0BridgeAction
  payload: Nan0BridgeRequestMap[Nan0BridgeAction]
  sentAt: number
}

interface ResponseMessage {
  kind: 'response'
  requestId: string
  recipientId: string
  ok: boolean
  payload?: Nan0BridgeResponseMap[Nan0BridgeAction]
  error?: string
}

const CHANNEL_NAME = 'nan0-runtime-owner-v1'
const REQUEST_RETRY_MS = 500
// NOTICE: Owner-side private thought owns its 90s cancellation deadline. The
// bridge margin allows the owner to persist and return the terminal outcome.
const REQUEST_TIMEOUT_MS = 100_000
const OWNER_RESPONSE_CACHE_LIMIT = 256

let channel: BroadcastChannel | null = null
let ownerHandler: Nan0OwnerHandler | null = null
let ownerRendererId: string | null = null
const ownerRequests = new Map<string, Promise<ResponseMessage>>()
const pendingRequests = new Map<string, {
  rendererId: string
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}>()

export function toPreparedTurnProxy(prepared: Nan0PreparedTurn): Nan0PreparedTurnProxy {
  return {
    thoughtId: prepared.thoughtId,
    turnId: prepared.turnId,
    sessionId: prepared.sessionId,
    inputEventId: prepared.inputEventId,
    threadId: prepared.threadId,
    outwardDirective: prepared.systemContext,
    decision: {
      decisionId: prepared.decision.decisionId,
      finalDecision: prepared.decision.finalDecision,
      allowed: prepared.decision.allowed,
      confidence: prepared.decision.confidence,
      speakability: prepared.decision.speakability,
      attentionScore: prepared.decision.attentionScore,
      pressureScore: prepared.decision.pressureScore,
      reasonCodes: [...prepared.decision.reasonCodes],
      suppressionReason: prepared.decision.suppressionReason,
      actionIntent: prepared.decision.actionIntent
        ? { type: prepared.decision.actionIntent.type, target: prepared.decision.actionIntent.target }
        : null,
      waitUntil: prepared.decision.waitUntil,
      bodyExpression: prepared.decision.bodyExpression
        ? {
            kind: prepared.decision.bodyExpression.kind.slice(0, 120),
            intensity: Math.min(1, Math.max(0, Number(prepared.decision.bodyExpression.parameters.intensity ?? 1))),
          }
        : null,
    },
    actionAuthority: prepared.actionAuthority ? structuredClone(prepared.actionAuthority) : null,
  }
}

export function toAutonomyEvaluationProxy(batch: Nan0AutonomyEvaluationBatch): Nan0BridgeResponseMap['evaluateAutonomy'] {
  return {
    nextEvaluationAt: batch.nextEvaluationAt,
    evaluations: batch.evaluations.map(evaluation => ({
      intentionId: evaluation.intentionId,
      evaluationId: evaluation.evaluationId,
      observationId: evaluation.observationId,
      prepared: evaluation.prepared ? toPreparedTurnProxy(evaluation.prepared) : null,
      outcome: evaluation.outcome,
      nextEvaluationAt: evaluation.nextEvaluationAt,
    })),
  }
}

export function toTemporalAutonomyEvaluationProxy(batch: Nan0TemporalAutonomyEvaluationBatch): Nan0BridgeResponseMap['evaluateTemporalAutonomy'] {
  return {
    nextEvaluationAt: batch.nextEvaluationAt,
    evaluations: batch.evaluations.map(evaluation => ({
      temporalEventId: evaluation.temporalEventId,
      observationId: evaluation.observationId,
      prepared: evaluation.prepared ? toPreparedTurnProxy(evaluation.prepared) : null,
      outcome: evaluation.outcome,
      nextEvaluationAt: evaluation.nextEvaluationAt,
    })),
  }
}

export function toMetabolismEvaluationProxy(result: Nan0MetabolismEvaluationResult): Nan0BridgeResponseMap['evaluateMetabolism'] {
  return {
    observationId: result.observationId,
    prepared: result.prepared ? toPreparedTurnProxy(result.prepared) : null,
    outcome: result.outcome,
    nextEvaluationAt: result.nextEvaluationAt,
    terminal: structuredClone(result.terminal),
  }
}

function getChannel(): BroadcastChannel {
  if (channel)
    return channel

  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.addEventListener('message', (event: MessageEvent<RequestMessage | ResponseMessage>) => {
    const message = event.data
    if (message.kind === 'response') {
      const pending = pendingRequests.get(message.requestId)
      if (!pending || pending.rendererId !== message.recipientId)
        return

      pendingRequests.delete(message.requestId)
      if (message.ok)
        pending.resolve(message.payload)
      else
        pending.reject(new Error(message.error ?? 'Nan0 owner request failed.'))
      return
    }

    if (!ownerHandler || !ownerRendererId)
      return

    let response = ownerRequests.get(message.requestId)
    if (!response) {
      response = ownerHandler(message.action, message.payload as never)
        .then(payload => ({
          kind: 'response' as const,
          requestId: message.requestId,
          recipientId: message.senderId,
          ok: true,
          payload,
        }))
        .catch((error: unknown) => ({
          kind: 'response' as const,
          requestId: message.requestId,
          recipientId: message.senderId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      ownerRequests.set(message.requestId, response)
      if (ownerRequests.size > OWNER_RESPONSE_CACHE_LIMIT) {
        const oldestRequestId = ownerRequests.keys().next().value
        if (oldestRequestId)
          ownerRequests.delete(oldestRequestId)
      }
    }

    void response.then(result => getChannel().postMessage(result))
  })
  return channel
}

export function setNan0OwnerHandler(rendererId: string, handler: Nan0OwnerHandler): () => void {
  ownerRendererId = rendererId
  ownerHandler = handler
  getChannel()

  return () => {
    if (ownerRendererId !== rendererId)
      return
    ownerRendererId = null
    ownerHandler = null
    ownerRequests.clear()
  }
}

export function requestNan0Owner<A extends Nan0BridgeAction>(
  rendererId: string,
  action: A,
  payload: Nan0BridgeRequestMap[A],
): Promise<Nan0BridgeResponseMap[A]> {
  const requestId = crypto.randomUUID()
  const request: RequestMessage = {
    kind: 'request',
    requestId,
    senderId: rendererId,
    action,
    payload,
    sentAt: Date.now(),
  }

  return new Promise((resolve, reject) => {
    const broadcast = () => getChannel().postMessage(request)
    const retry = window.setInterval(broadcast, REQUEST_RETRY_MS)
    const timeout = window.setTimeout(() => {
      pendingRequests.delete(requestId)
      window.clearInterval(retry)
      reject(new Error(`Nan0 owner did not answer ${action} within ${REQUEST_TIMEOUT_MS}ms.`))
    }, REQUEST_TIMEOUT_MS)

    pendingRequests.set(requestId, {
      rendererId,
      resolve: (value) => {
        window.clearInterval(retry)
        window.clearTimeout(timeout)
        resolve(value as Nan0BridgeResponseMap[A])
      },
      reject: (error) => {
        window.clearInterval(retry)
        window.clearTimeout(timeout)
        reject(error)
      },
    })
    broadcast()
  })
}
