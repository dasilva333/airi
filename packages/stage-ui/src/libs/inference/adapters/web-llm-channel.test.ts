import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSingleOwnerWebLlmAdapter, isMainWindow } from './web-llm-channel'

// Mock createWebLlmAdapter
const mockLoadModel = vi.fn(async (_target: any, opts?: any) => {
  opts?.onProgress?.({ phase: 'download', percent: 50, message: 'Downloading...' })
  opts?.onProgress?.({ phase: 'download', percent: 100, message: 'Loaded' })
})
const mockGenerate = vi.fn(async (_req: any, opts?: any) => {
  opts?.onToken?.('Hello')
  opts?.onToken?.(' world')
  return 'Hello world'
})
const mockTerminate = vi.fn()

let mockState = 'idle'
let mockManifest: { modelId: string } | null = null

vi.mock('./web-llm', () => ({
  createWebLlmAdapter: () => ({
    loadModel: async (target: any, opts?: any) => {
      mockState = 'loading'
      await mockLoadModel(target, opts)
      mockState = 'ready'
      mockManifest = { modelId: target.modelId }
    },
    generate: async (req: any, opts?: any) => {
      mockState = 'running'
      const res = await mockGenerate(req, opts)
      mockState = 'ready'
      return res
    },
    terminate: () => {
      mockState = 'terminated'
      mockTerminate()
    },
    get state() { return mockState },
    get manifest() { return mockManifest },
    get deviceLossCount() { return 0 },
  }),
}))

describe('isMainWindow', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('detects main window for root and empty hash', () => {
    Object.defineProperty(window, 'location', {
      value: { hash: '' },
      writable: true,
    })
    expect(isMainWindow()).toBe(true)

    Object.defineProperty(window, 'location', {
      value: { hash: '#/' },
      writable: true,
    })
    expect(isMainWindow()).toBe(true)

    Object.defineProperty(window, 'location', {
      value: { hash: '#' },
      writable: true,
    })
    expect(isMainWindow()).toBe(true)
  })

  it('detects secondary windows for #/chat and other routes', () => {
    Object.defineProperty(window, 'location', {
      value: { hash: '#/chat' },
      writable: true,
    })
    expect(isMainWindow()).toBe(false)

    Object.defineProperty(window, 'location', {
      value: { hash: '#/actor' },
      writable: true,
    })
    expect(isMainWindow()).toBe(false)
  })
})

describe('singleOwnerWebLlmAdapter (Leader / Client coordination)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = 'idle'
    mockManifest = null
  })

  it('leader executes loadModel and generate directly', async () => {
    const leader = await createSingleOwnerWebLlmAdapter({ forceLeader: true })
    expect(leader.state).toBe('idle')

    const progressLogs: any[] = []
    await leader.loadModel({ modelId: 'test-qwen' }, {
      onProgress: p => progressLogs.push(p.percent),
    })

    expect(mockLoadModel).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'test-qwen' }),
      expect.anything(),
    )
    expect(progressLogs).toEqual([50, 100])
    expect(leader.state).toBe('ready')
    expect(leader.manifest).toEqual({ modelId: 'test-qwen' })

    const tokens: string[] = []
    const result = await leader.generate({ modelId: 'test-qwen', messages: [] }, {
      onToken: t => tokens.push(t),
    })

    expect(tokens).toEqual(['Hello', ' world'])
    expect(result).toBe('Hello world')

    leader.terminate()
  })

  it('client window proxies loadModel and generate to leader across BroadcastChannel', async () => {
    // 1. Start leader
    const leader = await createSingleOwnerWebLlmAdapter({ forceLeader: true })

    // 2. Start client in secondary window
    Object.defineProperty(window, 'location', {
      value: { hash: '#/chat' },
      writable: true,
    })

    const client = await createSingleOwnerWebLlmAdapter()
    expect(client).toBeDefined()

    // 3. Client calls loadModel
    const clientProgress: any[] = []
    await client.loadModel({ modelId: 'qwen-proxy' }, {
      onProgress: p => clientProgress.push(p.percent),
    })

    expect(mockLoadModel).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'qwen-proxy' }),
      expect.anything(),
    )
    expect(clientProgress).toEqual([50, 100])
    expect(client.state).toBe('ready')
    expect(client.manifest).toEqual({ modelId: 'qwen-proxy' })

    // 4. Client calls generate
    const clientTokens: string[] = []
    const clientResult = await client.generate({ modelId: 'qwen-proxy', messages: [] }, {
      onToken: t => clientTokens.push(t),
    })

    expect(clientTokens).toEqual(['Hello', ' world'])
    expect(clientResult).toBe('Hello world')

    client.terminate()
    leader.terminate()
  })
})
