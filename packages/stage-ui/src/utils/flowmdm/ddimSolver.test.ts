import type { InferenceSession } from 'onnxruntime-web'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as ort from 'onnxruntime-web'

vi.mock('onnxruntime-web', () => {
  class Tensor {
    type: string
    data: unknown
    shape: unknown
    constructor(type: string, data: unknown, shape: unknown) {
      this.type = type
      this.data = data
      this.shape = shape
    }
  }
  const create = vi.fn()
  return {
    InferenceSession: { create },
    Tensor,
    env: { wasm: {} },
  }
})

describe('getDenoisingSession', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete (globalThis as { navigator?: unknown }).navigator
    const mockBytes = new Uint8Array([1, 2, 3, 4])
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(mockBytes))
  })

  it('caches and returns same promise on repeated calls', async () => {
    (ort.InferenceSession.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's' })
    const mod = await import('./ddimSolver')
    const a = mod.getDenoisingSession()
    const b = mod.getDenoisingSession()
    const ra = await a
    const rb = await b
    expect(ra).toEqual({ id: 's' })
    expect(rb).toEqual({ id: 's' })
  })

  it('uses WASM when no gpu', async () => {
    (ort.InferenceSession.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'wasm' })
    const logs: string[] = []
    const mod = await import('./ddimSolver')
    const res = await mod.getDenoisingSession((m: string) => logs.push(m))
    expect(res).toEqual({ id: 'wasm' })
    expect(ort.InferenceSession.create as any).toHaveBeenCalledWith(expect.anything(), { executionProviders: ['wasm'] })
    expect(logs.some(l => l.includes('WASM'))).toBe(true)
  })

  it('uses WebGPU when available and succeeds', async () => {
    (ort.InferenceSession.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'gpu' })
    ;(globalThis as { navigator?: unknown }).navigator = { gpu: {} }
    const logs: string[] = []
    const mod = await import('./ddimSolver')
    const res = await mod.getDenoisingSession((m: string) => logs.push(m))
    expect(res).toEqual({ id: 'gpu' })
    expect(ort.InferenceSession.create as any).toHaveBeenCalledWith(expect.anything(), { executionProviders: ['webgpu'] })
    expect(logs.some(l => l.includes('WebGPU'))).toBe(true)
  })

  it('falls back to WASM when WebGPU fails', async () => {
    (ort.InferenceSession.create as any)
      .mockRejectedValueOnce(new Error('gpu fail'))
      .mockResolvedValueOnce({ id: 'wasm2' })
    ;(globalThis as { navigator?: unknown }).navigator = { gpu: {} }
    const logs: string[] = []
    const mod = await import('./ddimSolver')
    const res = await mod.getDenoisingSession((m: string) => logs.push(m))
    expect(res).toEqual({ id: 'wasm2' })
    expect(logs.some(l => l.includes('WebGPU EP failed'))).toBe(true)
  })

  it('falls back to WASM when WebGPU fails without message', async () => {
    (ort.InferenceSession.create as any)
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce({ id: 'wasm3' })
    ;(globalThis as { navigator?: unknown }).navigator = { gpu: {} }
    const logs: string[] = []
    const mod = await import('./ddimSolver')
    const res = await mod.getDenoisingSession((m: string) => logs.push(m))
    expect(res).toEqual({ id: 'wasm3' })
  })

  it('returns null and resets cache on total failure', async () => {
    (ort.InferenceSession.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    const logs: string[] = []
    const mod = await import('./ddimSolver')
    const res = await mod.getDenoisingSession((m: string) => logs.push(m))
    expect(res).toBeNull()
    expect(logs.some(l => l.includes('ONNX model load failed'))).toBe(true)
  })

  it('returns null on total failure without message', async () => {
    (ort.InferenceSession.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({})
    const logs: string[] = []
    const mod = await import('./ddimSolver')
    const res = await mod.getDenoisingSession((m: string) => logs.push(m))
    expect(res).toBeNull()
  })
})

describe('runDdimLoop', () => {
  it('fallback path when session null', async () => {
    const mod = await import('./ddimSolver')
    const logs: string[] = []
    const out = await mod.runDdimLoop(null, new Float32Array(263), 2, (m: string) => logs.push(m))
    expect(out).toBeInstanceOf(Float32Array)
    expect(out.length).toBe(2 * 263)
    expect(logs.some(l => l.includes('Denoising loop finished'))).toBe(true)
  }, 30000)

  it('session path runs denoising', async () => {
    const session = { run: vi.fn().mockResolvedValue({ denoised_motion: { data: new Float32Array(2 * 263).fill(0.5) } }) } as unknown as InferenceSession
    const mod = await import('./ddimSolver')
    const clip = new Float32Array(512)
    const out = await mod.runDdimLoop(session, clip, 2)
    expect(out).toBeInstanceOf(Float32Array)
    expect(out.length).toBe(2 * 263)
    expect(session.run).toHaveBeenCalled()
  }, 30000)
})
