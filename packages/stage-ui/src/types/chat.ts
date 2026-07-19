import type { ContextUpdate, MetadataEventSource, WebSocketEventInputs } from '@proj-airi/server-sdk'
import type { AssistantMessage, CommonContentPart, CompletionToolCall, Message, SystemMessage, ToolMessage, UserMessage } from '@xsai/shared-chat'

export interface ChatSlicesText {
  type: 'text'
  text: string
}

export interface ChatSlicesToolCall {
  type: 'tool-call'
  toolCall: CompletionToolCall
  state?: 'executing' | 'done' | 'error'
  result?: string | CommonContentPart[]
  bridged?: boolean
}

export interface ChatSlicesToolCallResult {
  type: 'tool-call-result'
  id: string
  result?: string | CommonContentPart[]
}

export type ChatSlices = ChatSlicesText | ChatSlicesToolCall | ChatSlicesToolCallResult

export interface ChatAssistantMessage extends AssistantMessage {
  slices: ChatSlices[]
  tool_results: {
    id: string
    result?: string | CommonContentPart[]
  }[]
  id?: string
  createdAt?: number
  /**
   * The full raw LLM output including orchestration tokens (`<|ACTOR:|>`, `<|ACT:|>`, etc.)
   * and reasoning blocks. Stored separately from `content` (which is display-friendly) so
   * that past turns fed back to the LLM retain the tokens, preventing behavioral drift.
   */
  rawContent?: string
  categorization?: {
    speech: string
    reasoning: string
  }
  grounding?: {
    queries: string[]
    chunks: { title: string, uri: string }[]
  }
  error?: { message: string, detail: string }
}

export type ChatMessage = ChatAssistantMessage | SystemMessage | ToolMessage | UserMessage

export interface ErrorMessage {
  role: 'error'
  content: string
}

export interface DirectorMessage {
  role: 'director'
  content: string
  intensity: number
  title?: string
  prompt?: string
  target?: 'user' | 'assistant'
}

export interface ContextMessage extends ContextUpdate<Record<string, unknown>, string | CommonContentPart[]> {
  metadata?: {
    source: MetadataEventSource
  }
  createdAt: number
}

export type ChatHistoryItem = (ChatMessage | ErrorMessage | DirectorMessage) & { context?: ContextMessage } & { createdAt?: number, id?: string }

export interface ChatStreamEventContext {
  sessionId: string
  message: ChatHistoryItem
  contexts: Record<string, ContextMessage[]>
  composedMessage: Array<Message>
  input?: WebSocketEventInputs
  assistantMessageId?: string
  assistantMessageCreatedAt?: number
  responseDisposition?: {
    decision: 'SILENCE' | 'ACT' | 'WAIT'
    reason: string
    thoughtId: string
    decisionId: string
  }
  nan0ToolAuthority?: {
    schemaVersion: 1
    finalDecision: 'SPEAK' | 'SILENCE' | 'ACT' | 'WAIT' | 'BODY_EXPRESSION'
    thoughtId: string
    decisionId: string
    turnId: string
    actionIntentId: string | null
    capabilityId: string | null
    lifecyclePolicyId: string | null
    authorizedToolNames: string[]
  }
}

export type ChatStreamEvent
  = | { type: 'before-compose', message: string, sessionId: string, context: Omit<ChatStreamEventContext, 'composedMessage'> }
    | { type: 'after-compose', message: string, sessionId: string, context: ChatStreamEventContext }
    | { type: 'before-send', message: string, sessionId: string, context: ChatStreamEventContext }
    | { type: 'after-send', message: string, sessionId: string, context: ChatStreamEventContext }
    | { type: 'token-literal', literal: string, sessionId: string, context: ChatStreamEventContext }
    | { type: 'token-special', special: string, sessionId: string, context: ChatStreamEventContext }
    | { type: 'stream-end', sessionId: string, context: ChatStreamEventContext }
    | { type: 'assistant-end', message: string, sessionId: string, context: ChatStreamEventContext }
    | { type: 'assistant-message', message: ChatAssistantMessage, sessionId: string, messageText: string, context: ChatStreamEventContext }
    | { type: 'session-updated', sessionId: string, message: ChatHistoryItem }
    | { type: 'session-refreshed', sessionId: string, messages?: ChatHistoryItem[] }
    | { type: 'session-deleted', sessionId: string }
    | { type: 'index-refreshed', userId: string }
    | { type: 'journal-refreshed', userId: string }

export type StreamingAssistantMessage = ChatAssistantMessage & { context?: ContextMessage } & { createdAt?: number, id?: string }
