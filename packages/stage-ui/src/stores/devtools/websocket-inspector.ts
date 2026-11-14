import type { WebSocketEvent } from '@proj-airi/server-sdk'

import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface WebSocketHistoryItem {
  id: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
  event: WebSocketEvent
}

// Bearer tokens never belong in a 1000-event devtools ring buffer that renders
// into a settings page. module:authenticate carries the gateway auth token;
// redact it (and token-shaped fields) before storing.
function redactSecrets(event: WebSocketEvent): WebSocketEvent {
  if (!event || typeof event !== 'object')
    return event
  const type = (event as any).type
  const data = (event as any).data
  if (type === 'module:authenticate' && data && typeof data === 'object' && 'token' in data) {
    return { ...(event as any), data: { ...(data as any), token: '[redacted]' } } as WebSocketEvent
  }
  return event
}

export const useWebSocketInspectorStore = defineStore('devtools:websocket-inspector', () => {
  const history = ref<WebSocketHistoryItem[]>([])
  const isEnabled = ref(true)
  const maxHistory = ref(1000)

  function add(direction: 'incoming' | 'outgoing', event: WebSocketEvent) {
    if (!isEnabled.value)
      return

    history.value.unshift({
      id: nanoid(),
      timestamp: Date.now(),
      direction,
      event: redactSecrets(event),
    })

    if (history.value.length > maxHistory.value) {
      history.value.pop()
    }
  }

  function clear() {
    history.value = []
  }

  return {
    history,
    isEnabled,
    maxHistory,
    add,
    clear,
  }
})
