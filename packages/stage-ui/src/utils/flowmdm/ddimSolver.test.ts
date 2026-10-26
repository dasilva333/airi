import type { InferenceSession } from 'onnxruntime-web'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as ort from 'onnxruntime-web'

import { alphasCumprod } from './constants'

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
  it('throws explicit error when session is null', async () => {
    const mod = await import('./ddimSolver')
    await expect(mod.runDdimLoop(null, new Float32Array(512), 2)).rejects.toThrow(
      'FlowMDM denoiser session is unavailable; motion was not generated.',
    )
  })

  it('commits clean predXStart directly on final step to avoid algebraic cancellation', async () => {
    let callCount = 0
    // Distinctive tensor varying across channels and frames
    const finalPrediction = new Float32Array(2 * 263)
    for (let i = 0; i < finalPrediction.length; i++) {
      finalPrediction[i] = (i % 263) * 0.1 + Math.floor(i / 263) * 2.0
    }
    const intermediatePrediction = new Float32Array(2 * 263).fill(1.0)

    const session = {
      run: vi.fn().mockImplementation(async () => {
        callCount++
        return {
          denoised_motion: {
            data: callCount === 50 ? finalPrediction : intermediatePrediction,
          },
        }
      }),
    } as unknown as InferenceSession

    const mod = await import('./ddimSolver')
    const clip = new Float32Array(512)
    const out = await mod.runDdimLoop(session, clip, 2)

    expect(session.run).toHaveBeenCalledTimes(50)
    expect(out).toBeInstanceOf(Float32Array)
    expect(out.length).toBe(2 * 263)
    // Every single value should exactly equal the clean prediction committed on step 50
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeCloseTo(finalPrediction[i], 5)
    }
  }, 30000)

  it('preserves real DDIM transition on penultimate step 20 -> 0 before final commit', async () => {
    let callCount = 0
    let step48InputNoisyMotion: Float32Array | null = null
    let step49InputNoisyMotion: Float32Array | null = null

    // Distinctive prediction at step 48 (tVal = 20)
    const step48Prediction = new Float32Array(2 * 263)
    for (let i = 0; i < step48Prediction.length; i++) {
      step48Prediction[i] = Math.sin(i * 0.05)
    }

    // Final clean prediction at step 49 (tVal = 0)
    const step49Prediction = new Float32Array(2 * 263)
    for (let i = 0; i < step49Prediction.length; i++) {
      step49Prediction[i] = Math.cos(i * 0.05)
    }

    const session = {
      run: vi.fn().mockImplementation(async (feeds: Record<string, any>) => {
        callCount++
        if (callCount === 49) {
          // Capture input to step 48 (tVal = 20)
          step48InputNoisyMotion = new Float32Array(feeds.noisy_motion.data)
          return { denoised_motion: { data: step48Prediction } }
        }
        if (callCount === 50) {
          // Capture input to step 49 (tVal = 0)
          step49InputNoisyMotion = new Float32Array(feeds.noisy_motion.data)
          return { denoised_motion: { data: step49Prediction } }
        }
        return { denoised_motion: { data: new Float32Array(2 * 263).fill(0.1) } }
      }),
    } as unknown as InferenceSession

    const mod = await import('./ddimSolver')
    const clip = new Float32Array(512)
    const out = await mod.runDdimLoop(session, clip, 2)

    expect(session.run).toHaveBeenCalledTimes(50)
    expect(step48InputNoisyMotion).not.toBeNull()
    expect(step49InputNoisyMotion).not.toBeNull()

    // Step 48: tVal = 20, sVal = 0. Verify step 49 input matches real DDIM update equation
    const alpha20 = alphasCumprod[20]
    const alpha0 = alphasCumprod[0]
    const sqrtAlpha20 = Math.sqrt(alpha20)
    const sqrtAlpha0 = Math.sqrt(alpha0)
    const sqrtOneMinusAlpha20 = Math.sqrt(1.0 - alpha20)
    const sqrtOneMinusAlpha0 = Math.sqrt(1.0 - alpha0)

    for (let i = 0; i < out.length; i++) {
      const xt = step48InputNoisyMotion![i]
      const x0 = step48Prediction[i]
      const eps = (xt - sqrtAlpha20 * x0) / sqrtOneMinusAlpha20
      const expectedStep49Input = sqrtAlpha0 * x0 + sqrtOneMinusAlpha0 * eps

      // Input to call 50 MUST strictly match the DDIM 20 -> 0 update
      expect(step49InputNoisyMotion![i]).toBeCloseTo(expectedStep49Input, 5)

      // It must NOT equal an early commit of step48Prediction
      expect(step49InputNoisyMotion![i]).not.toBe(step48Prediction[i])

      // Output of step 49 MUST strictly match the final clean prediction
      expect(out[i]).toBeCloseTo(step49Prediction[i], 5)
    }
  }, 30000)
})
