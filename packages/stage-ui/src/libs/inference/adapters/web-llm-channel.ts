/**
 * Single-owner WebLLM coordinator using BroadcastChannel.
 *
 * Ensures only ONE WebLLM engine / GPUDevice is resident in VRAM across all
 * windows (main stage, chat, onboarding, dating sim).
 *
 * The elected Leader (typically mainWindow) hosts the physical createWebLlmAdapter(),
 * while secondary windows proxy their loadModel and generate calls over the
 * 'airi:inference:web-llm' BroadcastChannel.
 */

import type { WebLlmGenerateRequest } from '../../../workers/web-llm/contract'
import type { ProgressPayload } from '../protocol'
import type { WebLlmAdapter, WebLlmGenerateOptions, WebLlmLoadTarget } from './web-llm'

import { createRequestId, serializeWorkerError } from '../protocol'
import { createWebLlmAdapter } from './web-llm'

const CHANNEL_NAME = 'airi:inference:web-llm'
const PING_TIMEOUT_MS = 150

export type WebLlmChannelMessage
  = | { type: 'ping', senderId: string }
    | {
      type: 'pong'
      senderId: string
      leaderId: string
      state: WebLlmAdapter['state']
      manifest: { modelId: string } | null
      deviceLossCount: number
    }
    | { type: 'load', requestId: string, senderId: string, target: WebLlmLoadTarget }
    | { type: 'load-progress', requestId: string, payload: ProgressPayload }
    | { type: 'load-done', requestId: string }
    | { type: 'load-error', requestId: string, error: { name: string, message: string, stack?: string } }
    | { type: 'generate', requestId: string, senderId: string, request: WebLlmGenerateRequest }
    | { type: 'generate-token', requestId: string, text: string }
    | { type: 'generate-done', requestId: string, text: string }
    | { type: 'generate-error', requestId: string, error: { name: string, message: string, stack?: string } }
    | { type: 'cancel', requestId: string, senderId: string }
    | {
      type: 'state-change'
      leaderId: string
      state: WebLlmAdapter['state']
      manifest: { modelId: string } | null
      deviceLossCount: number
    }

export function isMainWindow(): boolean {
  if (typeof window === 'undefined')
    return false
  const hash = window.location.hash || ''
  return hash === '' || hash === '#/' || hash === '#'
}

/**
 * Creates a single-owner WebLLM adapter:
 * - If running in mainWindow (or if no leader is detected), acts as Leader hosting the real Web Worker.
 * - If running in a secondary window, acts as a Client proxying load/generate calls over BroadcastChannel.
 */
export async function createSingleOwnerWebLlmAdapter(options?: { forceLeader?: boolean }): Promise<WebLlmAdapter> {
  if (typeof BroadcastChannel === 'undefined') {
    return createWebLlmAdapter()
  }

  const channel = new BroadcastChannel(CHANNEL_NAME)
  const localId = createRequestId()

  let isLeader = options?.forceLeader || isMainWindow()
  let leaderState: WebLlmAdapter['state'] = 'idle'
  let leaderManifest: { modelId: string } | null = null
  let leaderDeviceLossCount = 0

  if (!isLeader) {
    // Ping to discover an existing leader
    const leaderFound = await new Promise<boolean>((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          channel.removeEventListener('message', handlePong)
          resolve(false)
        }
      }, PING_TIMEOUT_MS)

      function handlePong(event: MessageEvent<WebLlmChannelMessage>) {
        if (event.data?.type === 'pong') {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            channel.removeEventListener('message', handlePong)
            leaderState = event.data.state
            leaderManifest = event.data.manifest
            leaderDeviceLossCount = event.data.deviceLossCount
            resolve(true)
          }
        }
      }

      channel.addEventListener('message', handlePong)
      channel.postMessage({ type: 'ping', senderId: localId })
    })

    if (!leaderFound) {
      // No leader active; this window takes leadership
      isLeader = true
    }
  }

  if (isLeader) {
    // --- LEADER MODE ---
    const localAdapter = createWebLlmAdapter()
    const activeAborts = new Map<string, AbortController>()

    function broadcastState() {
      channel.postMessage({
        type: 'state-change',
        leaderId: localId,
        state: localAdapter.state,
        manifest: localAdapter.manifest,
        deviceLossCount: localAdapter.deviceLossCount,
      })
    }

    channel.addEventListener('message', async (event: MessageEvent<WebLlmChannelMessage>) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object')
        return

      if (msg.type === 'ping') {
        channel.postMessage({
          type: 'pong',
          senderId: localId,
          leaderId: localId,
          state: localAdapter.state,
          manifest: localAdapter.manifest,
          deviceLossCount: localAdapter.deviceLossCount,
        })
        return
      }

      if (msg.type === 'cancel') {
        const controller = activeAborts.get(msg.requestId)
        if (controller) {
          controller.abort('Cancelled by client window')
          activeAborts.delete(msg.requestId)
        }
        return
      }

      if (msg.type === 'load') {
        const abortController = new AbortController()
        activeAborts.set(msg.requestId, abortController)
        broadcastState()
        try {
          await localAdapter.loadModel(msg.target, {
            signal: abortController.signal,
            onProgress: (p) => {
              channel.postMessage({ type: 'load-progress', requestId: msg.requestId, payload: p })
            },
          })
          broadcastState()
          channel.postMessage({ type: 'load-done', requestId: msg.requestId })
        }
        catch (err) {
          broadcastState()
          const serialized = serializeWorkerError(err)
          channel.postMessage({
            type: 'load-error',
            requestId: msg.requestId,
            error: { name: serialized.name, message: serialized.message, stack: serialized.stack },
          })
        }
        finally {
          activeAborts.delete(msg.requestId)
        }
        return
      }

      if (msg.type === 'generate') {
        const abortController = new AbortController()
        activeAborts.set(msg.requestId, abortController)
        broadcastState()
        try {
          const text = await localAdapter.generate(msg.request, {
            signal: abortController.signal,
            onToken: (token) => {
              channel.postMessage({ type: 'generate-token', requestId: msg.requestId, text: token })
            },
          })
          broadcastState()
          channel.postMessage({ type: 'generate-done', requestId: msg.requestId, text })
        }
        catch (err) {
          broadcastState()
          const serialized = serializeWorkerError(err)
          channel.postMessage({
            type: 'generate-error',
            requestId: msg.requestId,
            error: { name: serialized.name, message: serialized.message, stack: serialized.stack },
          })
        }
        finally {
          activeAborts.delete(msg.requestId)
        }
      }
    })

    return {
      loadModel: async (target, opts) => {
        const res = await localAdapter.loadModel(target, opts)
        broadcastState()
        return res
      },
      generate: async (req, opts) => {
        const res = await localAdapter.generate(req, opts)
        broadcastState()
        return res
      },
      terminate: () => {
        localAdapter.terminate()
        broadcastState()
        channel.close()
      },
      get state() { return localAdapter.state },
      get manifest() { return localAdapter.manifest },
      get deviceLossCount() { return localAdapter.deviceLossCount },
    }
  }

  // --- CLIENT MODE ---
  channel.addEventListener('message', (event: MessageEvent<WebLlmChannelMessage>) => {
    const msg = event.data
    if (!msg || typeof msg !== 'object')
      return

    if (msg.type === 'state-change' || msg.type === 'pong') {
      leaderState = msg.state
      leaderManifest = msg.manifest
      leaderDeviceLossCount = msg.deviceLossCount
    }
  })

  async function loadModel(
    target: WebLlmLoadTarget,
    opts?: { onProgress?: (p: ProgressPayload) => void, signal?: AbortSignal },
  ): Promise<void> {
    const requestId = createRequestId()
    leaderState = 'loading'

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        channel.removeEventListener('message', handleMessage)
        if (opts?.signal)
          opts.signal.removeEventListener('abort', onAbort)
      }

      const onAbort = () => {
        channel.postMessage({ type: 'cancel', requestId, senderId: localId })
        cleanup()
        reject(new Error('Operation aborted'))
      }

      if (opts?.signal?.aborted) {
        onAbort()
        return
      }

      opts?.signal?.addEventListener('abort', onAbort)

      function handleMessage(event: MessageEvent<WebLlmChannelMessage>) {
        const msg = event.data
        if (!msg || typeof msg !== 'object' || !('requestId' in msg) || msg.requestId !== requestId)
          return

        if (msg.type === 'load-progress') {
          opts?.onProgress?.(msg.payload)
          return
        }

        if (msg.type === 'load-done') {
          cleanup()
          leaderState = 'ready'
          leaderManifest = { modelId: target.modelId }
          resolve()
          return
        }

        if (msg.type === 'load-error') {
          cleanup()
          leaderState = 'error'
          const err = new Error(msg.error.message)
          err.name = msg.error.name || 'Error'
          if (msg.error.stack)
            err.stack = msg.error.stack
          reject(err)
        }
      }

      channel.addEventListener('message', handleMessage)
      channel.postMessage({ type: 'load', requestId, senderId: localId, target })
    })
  }

  async function generate(
    request: WebLlmGenerateRequest,
    opts?: WebLlmGenerateOptions,
  ): Promise<string> {
    const requestId = createRequestId()
    leaderState = 'running'

    return new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        channel.removeEventListener('message', handleMessage)
        if (opts?.signal)
          opts.signal.removeEventListener('abort', onAbort)
      }

      const onAbort = () => {
        channel.postMessage({ type: 'cancel', requestId, senderId: localId })
        cleanup()
        reject(new Error('Operation aborted'))
      }

      if (opts?.signal?.aborted) {
        onAbort()
        return
      }

      opts?.signal?.addEventListener('abort', onAbort)

      function handleMessage(event: MessageEvent<WebLlmChannelMessage>) {
        const msg = event.data
        if (!msg || typeof msg !== 'object' || !('requestId' in msg) || msg.requestId !== requestId)
          return

        if (msg.type === 'generate-token') {
          opts?.onToken?.(msg.text)
          return
        }

        if (msg.type === 'generate-done') {
          cleanup()
          leaderState = 'ready'
          resolve(msg.text)
          return
        }

        if (msg.type === 'generate-error') {
          cleanup()
          leaderState = 'error'
          const err = new Error(msg.error.message)
          err.name = msg.error.name || 'Error'
          if (msg.error.stack)
            err.stack = msg.error.stack
          reject(err)
        }
      }

      channel.addEventListener('message', handleMessage)
      channel.postMessage({ type: 'generate', requestId, senderId: localId, request })
    })
  }

  return {
    loadModel,
    generate,
    terminate: () => {
      channel.close()
    },
    get state() { return leaderState },
    get manifest() { return leaderManifest },
    get deviceLossCount() { return leaderDeviceLossCount },
  }
}
