import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@huggingface/transformers', () => {
  const tokenizer = vi.fn(async () => ({ input_ids: [1, 2] }))
  const textModel = vi.fn(async () => ({ text_embeds: { data: new Float32Array([0.5, 0.25]) } }))
  return {
    AutoTokenizer: { from_pretrained: vi.fn(async () => tokenizer) },
    CLIPTextModelWithProjection: { from_pretrained: vi.fn(async () => textModel) },
  }
})

describe('getClipEmbedding', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns embedding on success', async () => {
    const { getClipEmbedding } = await import('./clipEncoder')
    const onLog = vi.fn()
    const result = await getClipEmbedding('a cat', onLog)
    expect(result).toBeInstanceOf(Float32Array)
    expect(Array.from(result)).toEqual([0.5, 0.25])
    expect(onLog).toHaveBeenCalled()
  })

  it('throws descriptive error on failure rather than returning dummy embedding', async () => {
    const transformers = await import('@huggingface/transformers')
    vi.mocked(transformers.AutoTokenizer.from_pretrained).mockRejectedValueOnce(new Error('network timeout'))
    const { getClipEmbedding } = await import('./clipEncoder')
    const onLog = vi.fn()
    await expect(getClipEmbedding('x', onLog)).rejects.toThrow('CLIP text encoder failed to produce embedding: network timeout')
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining('[ERROR] CLIP load/encode failed: network timeout'))
  })
})
