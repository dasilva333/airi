import type { ContextUpdate, WebSocketBaseEvent, WebSocketEvent, WebSocketEventOptionalSource, WebSocketEvents } from '@proj-airi/server-sdk'

import { Client, WebSocketEventSource } from '@proj-airi/server-sdk'
import { isStageCapacitor, isStageTamagotchi, isStageWeb } from '@proj-airi/stage-shared'
import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useWebSocketInspectorStore } from '../../devtools/websocket-inspector'

function isLocalhostUrl(urlStr: string): boolean {
  if (!urlStr)
    return false
  try {
    const parsed = new URL(urlStr)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1'
  }
  catch {
    return urlStr.includes('localhost') || urlStr.includes('127.0.0.1')
  }
}

export type ChannelServerStatus = 'disconnected' | 'connecting' | 'connected' | 'unreachable'

export const useModsServerChannelStore = defineStore('mods:channels:proj-airi:server', () => {
  const connected = ref(false)
  const status = ref<ChannelServerStatus>('disconnected')
  const client = ref<Client>()
  const initializing = ref<Promise<void> | null>(null)
  const pendingSend = ref<Array<WebSocketEvent>>([])
  const listenersInitialized = ref(false)
  const listenerDisposers = ref<Array<() => void>>([])
  let hasLoggedOfflineNotice = false

  const defaultWebSocketUrl = import.meta.env.VITE_AIRI_WS_URL || 'ws://localhost:6121/ws'
  const websocketUrl = useLocalStorage('settings/connection/websocket-url', defaultWebSocketUrl)
  const authToken = useLocalStorage('settings/connection/auth-token', '')

  const isSupported = computed(() => {
    // If on mobile (Capacitor), only connect if user configured an explicit non-localhost remote URL
    if (isStageCapacitor()) {
      const url = websocketUrl.value || defaultWebSocketUrl
      return !isLocalhostUrl(url)
    }
    return true
  })

  const callerId = isStageWeb() ? 'stage-web' : isStageTamagotchi() ? 'stage-tamagotchi' : isStageCapacitor() ? 'stage-pocket' : 'stage-web'
  const purpose = 'Primary application interface for AIRI.'

  const basePossibleEvents: Array<keyof WebSocketEvents> = [
    'context:update',
    'error',
    'module:announce',
    'module:configure',
    'module:authenticated',
    'spark:notify',
    'spark:emit',
    'spark:command',
    'input:text',
    'input:text:voice',
    'output:gen-ai:chat:message',
    'output:gen-ai:chat:complete',
    'output:gen-ai:chat:tool-call',
    'ui:configure',
  ]

  async function initialize(options?: { token?: string, possibleEvents?: Array<keyof WebSocketEvents> }) {
    if (!isSupported.value) {
      status.value = 'disconnected'
      return Promise.resolve()
    }

    if (connected.value && client.value)
      return Promise.resolve()
    if (initializing.value)
      return initializing.value

    const targetUrl = websocketUrl.value || defaultWebSocketUrl
    status.value = 'connecting'

    const possibleEvents = Array.from(new Set<keyof WebSocketEvents>([
      ...basePossibleEvents,
      ...(options?.possibleEvents ?? []),
    ]))

    initializing.value = new Promise<void>((resolve) => {
      // NOTICE: Safety Timeout (PipelineTTS)
      // If authentication via WebSocket fails to complete within 5000ms, we resolve the promise
      // anyway to prevent blocking the entire application startup sequence (App.vue).
      // This is critical because a hung server connection should not "deafen" the window
      // to cross-process broadcasts (ContextBridge).
      const timeout = setTimeout(() => {
        console.warn('[PipelineTTS:Server] Initialization timed out after 5000ms. Proceeding without immediate connection.')
        resolve()
      }, 5000)

      if (client.value) {
        try {
          client.value.close()
        }
        catch (err) {
          console.warn('Failed to close previous WebSocket client:', err)
        }
        client.value = undefined
      }

      client.value = new Client({
        name: isStageWeb() ? WebSocketEventSource.StageWeb : isStageTamagotchi() ? WebSocketEventSource.StageTamagotchi : WebSocketEventSource.StageWeb,
        url: targetUrl,
        token: options?.token ?? authToken.value,
        caller: callerId,
        purpose,
        possibleEvents,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        onAnyMessage: (event) => {
          useWebSocketInspectorStore().add('incoming', event)
        },
        onAnySend: (event) => {
          useWebSocketInspectorStore().add('outgoing', event)
        },
        onError: (_error) => {
          connected.value = false
          status.value = 'unreachable'
          initializing.value = null
          clearListeners()

          if (!hasLoggedOfflineNotice) {
            hasLoggedOfflineNotice = true
            console.info(`[ChannelServer] WebSocket server is offline at ${targetUrl}; running in standalone mode.`)
          }
          clearTimeout(timeout)
          resolve() // Still resolve to unblock app
        },
        onClose: () => {
          connected.value = false
          if (status.value !== 'unreachable') {
            status.value = 'disconnected'
          }
          initializing.value = null
          clearListeners()

          clearTimeout(timeout)
          resolve() // Still resolve to unblock app
        },
      })

      client.value.onEvent('module:authenticated', (event) => {
        if (event.data.authenticated) {
          clearTimeout(timeout)
          connected.value = true
          status.value = 'connected'
          hasLoggedOfflineNotice = false
          flush()
          initializeListeners()
          resolve()

          // eslint-disable-next-line no-console
          console.log('WebSocket server connection established and authenticated')

          return
        }

        connected.value = false
        status.value = 'disconnected'
      })
    })
  }

  async function ensureConnected() {
    await initializing.value
    if (!connected.value) {
      return await initialize()
    }
  }

  function clearListeners() {
    for (const disposer of listenerDisposers.value) {
      try {
        disposer()
      }
      catch (error) {
        console.warn('Failed to dispose channel listener:', error)
      }
    }
    listenerDisposers.value = []
    listenersInitialized.value = false
  }

  function initializeListeners() {
    if (!client.value)
      // No-op for now; keep placeholder for future shared listeners.
      // eslint-disable-next-line no-useless-return
      return
  }

  function send<C = undefined>(data: WebSocketEventOptionalSource<C>) {
    if (!isSupported.value)
      return

    if (!client.value && !initializing.value)
      void initialize()

    if (client.value && connected.value) {
      client.value.send(data as WebSocketEvent)
    }
    else {
      // Bound the queue size to avoid memory leaks when server is offline
      if (pendingSend.value.length < 50) {
        pendingSend.value.push(data as WebSocketEvent)
      }
    }
  }

  function flush() {
    if (client.value && connected.value) {
      for (const update of pendingSend.value) {
        client.value.send(update)
      }

      pendingSend.value = []
    }
  }

  function onContextUpdate(callback: (event: WebSocketBaseEvent<'context:update', ContextUpdate>) => void | Promise<void>) {
    if (!isSupported.value)
      return () => {}

    if (!client.value && !initializing.value)
      void initialize()

    client.value?.onEvent('context:update', callback as any)

    return () => {
      client.value?.offEvent('context:update', callback as any)
    }
  }

  function onEvent<E extends keyof WebSocketEvents>(
    type: E,
    callback: (event: WebSocketBaseEvent<E, WebSocketEvents[E]>) => void | Promise<void>,
  ) {
    if (!isSupported.value)
      return () => {}

    if (!client.value && !initializing.value)
      void initialize()

    client.value?.onEvent(type, callback as any)

    return () => {
      client.value?.offEvent(type, callback as any)
    }
  }

  function sendContextUpdate(message: Omit<ContextUpdate, 'id' | 'contextId'> & Partial<Pick<ContextUpdate, 'id' | 'contextId'>>) {
    const id = nanoid()
    send({ type: 'context:update', data: { id, contextId: id, ...message } })
  }

  function dispose() {
    flush()
    clearListeners()

    if (client.value) {
      client.value.close()
      client.value = undefined
    }
    connected.value = false
    status.value = 'disconnected'
    initializing.value = null
  }

  watch(websocketUrl, (newUrl, oldUrl) => {
    if (newUrl === oldUrl)
      return

    hasLoggedOfflineNotice = false
    if (client.value || initializing.value) {
      dispose()
      void initialize()
    }
  })

  return {
    connected,
    status,
    isSupported,
    websocketUrl,
    ensureConnected,

    initialize,
    send,
    sendContextUpdate,
    onContextUpdate,
    onEvent,
    dispose,
  }
})
