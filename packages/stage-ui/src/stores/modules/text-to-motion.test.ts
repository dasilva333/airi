import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTextToMotionStore } from './text-to-motion'

vi.mock('../../utils/flowmdm/clipEncoder', () => ({
  getClipEmbedding: vi.fn(),
  isClipEncoderCached: vi.fn().mockResolvedValue(true),
  prewarmClipEncoder: vi.fn(),
}))

vi.mock('../../utils/flowmdm/ddimSolver', () => ({
  getDenoisingSession: vi.fn(),
  isDenoisingModelCached: vi.fn().mockResolvedValue(true),
  runDdimLoop: vi.fn(),
}))

vi.mock('../../utils/flowmdm/vrmaExporter', () => ({
  exportFlowMDMToVRMA: vi.fn().mockReturnValue(new Uint8Array([0x46, 0x54, 0x6C, 0x67])),
}))

describe('useTextToMotionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('rejects unsupported motion export formats before running generation', async () => {
    const store = useTextToMotionStore()

    await expect(
      store.generateMotion('wave hello', { format: 'vmd' as any }),
    ).rejects.toThrow('Unsupported motion export format "vmd"')

    await expect(
      store.generateMotion('wave hello', { format: 'motion_json' as any }),
    ).rejects.toThrow('Unsupported motion export format "motion_json"')
  })

  it('throws an explicit error when FlowMDM denoiser session fails to initialize', async () => {
    const { getClipEmbedding } = await import('../../utils/flowmdm/clipEncoder')
    const { getDenoisingSession } = await import('../../utils/flowmdm/ddimSolver')

    vi.mocked(getClipEmbedding).mockResolvedValueOnce(new Float32Array(512))
    vi.mocked(getDenoisingSession).mockResolvedValueOnce(null)

    const store = useTextToMotionStore()

    await expect(
      store.generateMotion('dance', { engine: 'flowmdm' }),
    ).rejects.toThrow('FlowMDM denoiser session could not be initialized.')
  })

  it('propagates CLIP encoding failure during FlowMDM generation', async () => {
    const { getClipEmbedding } = await import('../../utils/flowmdm/clipEncoder')
    vi.mocked(getClipEmbedding).mockRejectedValueOnce(
      new Error('CLIP text encoder failed to produce embedding: network timeout'),
    )

    const store = useTextToMotionStore()

    await expect(
      store.generateMotion('jump', { engine: 'flowmdm' }),
    ).rejects.toThrow('CLIP text encoder failed to produce embedding: network timeout')
  })
})
