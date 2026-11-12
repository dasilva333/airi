import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CloudflareImageProvider } from './cloudflare'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
let provider: CloudflareImageProvider

beforeEach(() => {
  provider = new CloudflareImageProvider()
})

afterEach(() => {
  provider.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function completed(jobId: string) {
  await vi.waitFor(async () => {
    expect((await provider.getStatus(jobId)).status).not.toBe('running')
  })
  return provider.getStatus(jobId)
}

describe('cloudflare Workers AI image provider', () => {
  it('generates image via standard JSON endpoint for FLUX.1 Schnell and parses result.image', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({
      result: { image: png },
      success: true,
      errors: [],
      messages: [],
    }))
    vi.stubGlobal('fetch', request)

    await provider.initialize({
      cloudflareAccountId: 'test-account-id',
      cloudflareApiToken: 'test-token',
      cloudflareImageWidth: '1024',
      cloudflareImageHeight: '1024',
    })

    const job = await provider.generate({ prompt: 'A cozy anime room.' })
    expect(await completed(job.jobId)).toMatchObject({
      status: 'succeeded',
      imageUrl: `data:image/png;base64,${png}`,
    })

    expect(String(request.mock.calls[0]![0])).toBe(
      'https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/run/@cf/black-forest-labs/flux-1-schnell',
    )
    const init = request.mock.calls[0]![1]!
    expect(init.headers).toEqual({
      'authorization': 'Bearer test-token',
      'content-type': 'application/json',
      'accept': 'application/json',
    })
    // width and height must be omitted for FLUX.1 Schnell to prevent Cloudflare 400 Bad input error
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: 'A cozy anime room.',
      steps: 4,
    })
  })

  it('includes width and height for models that support custom dimensions (e.g. SDXL)', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({
      result: { image: png },
      success: true,
    }))
    vi.stubGlobal('fetch', request)

    await provider.initialize({
      cloudflareAccountId: 'test-account-id',
      cloudflareApiToken: 'test-token',
    })

    const job = await provider.generate({
      prompt: 'A meadow.',
      model: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      width: 1024,
      height: 768,
    })
    await completed(job.jobId)

    const init = request.mock.calls[0]![1]!
    const body = JSON.parse(String(init.body))
    expect(body.width).toBe(1024)
    expect(body.height).toBe(768)
  })

  it('handles binary image response from Cloudflare API', async () => {
    const rawBytes = Uint8Array.from(atob(png), c => c.charCodeAt(0))
    const request = vi.fn<typeof fetch>(async () => new Response(rawBytes, {
      headers: { 'content-type': 'image/png' },
    }))
    vi.stubGlobal('fetch', request)

    await provider.initialize({
      cloudflareAccountId: 'test-account-id',
      cloudflareApiToken: 'test-token',
    })

    const job = await provider.generate({ prompt: 'A sunset view.' })
    expect(await completed(job.jobId)).toMatchObject({
      status: 'succeeded',
      imageUrl: `data:image/png;base64,${png}`,
    })
  })

  it('uses multipart/form-data for FLUX.2 models with fixed 4 steps for Klein 4B', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({
      result: { image: png },
      success: true,
    }))
    vi.stubGlobal('fetch', request)

    await provider.initialize({
      cloudflareAccountId: 'test-account-id',
      cloudflareApiToken: 'test-token',
    })

    const job = await provider.generate({
      prompt: 'A futuristic city.',
      model: '@cf/black-forest-labs/flux-2-klein-4b',
      width: 1024,
      height: 1024,
      extra: { steps: 20 }, // Should be fixed to 4 steps or omitted on Klein
    })

    expect(await completed(job.jobId)).toMatchObject({ status: 'succeeded' })

    const call = request.mock.calls[0]!
    expect(String(call[0])).toBe(
      'https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/run/@cf/black-forest-labs/flux-2-klein-4b',
    )
    const init = call[1]!
    expect(init.headers).toEqual({ authorization: 'Bearer test-token' })
    expect(init.body).toBeInstanceOf(FormData)
    const body = init.body as FormData
    expect(body.get('prompt')).toBe('A futuristic city.')
    expect(body.get('width')).toBe('1024')
    expect(body.get('height')).toBe('1024')
    // Klein model steps are fixed; steps should NOT be set to 20
    expect(body.get('steps')).toBeNull()
  })

  it('supports FLUX.2 Dev with multipart/form-data and configurable steps', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({
      result: { image: png },
      success: true,
    }))
    vi.stubGlobal('fetch', request)

    await provider.initialize({
      cloudflareAccountId: 'test-account-id',
      cloudflareApiToken: 'test-token',
    })

    const job = await provider.generate({
      prompt: 'Cinematic portrait.',
      model: '@cf/black-forest-labs/flux-2-dev',
      width: 1024,
      height: 768,
      extra: { steps: 25 },
    })

    expect(await completed(job.jobId)).toMatchObject({ status: 'succeeded' })

    const call = request.mock.calls[0]!
    const init = call[1]!
    expect(init.body).toBeInstanceOf(FormData)
    const body = init.body as FormData
    expect(body.get('prompt')).toBe('Cinematic portrait.')
    expect(body.get('width')).toBe('1024')
    expect(body.get('height')).toBe('768')
    expect(body.get('steps')).toBe('25')
  })

  it('supports effective credentials fallback from Cloudflare hub', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({
      result: { image: png },
      success: true,
    }))
    vi.stubGlobal('fetch', request)

    // Passes effective credentials when specific artistry ones are empty
    await provider.initialize({
      cloudflareAccountId: '',
      cloudflareApiToken: '',
      cloudflareEffectiveAccountId: 'hub-account-123',
      cloudflareEffectiveApiToken: 'hub-token-abc',
    })

    const job = await provider.generate({ prompt: 'Mountain lake.' })
    expect(await completed(job.jobId)).toMatchObject({ status: 'succeeded' })

    expect(String(request.mock.calls[0]![0])).toBe(
      'https://api.cloudflare.com/client/v4/accounts/hub-account-123/ai/run/@cf/black-forest-labs/flux-1-schnell',
    )
    expect(request.mock.calls[0]![1]!.headers).toMatchObject({
      authorization: 'Bearer hub-token-abc',
    })
  })

  it('bubbles up detailed error message from Cloudflare Workers AI response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      success: false,
      errors: [{ code: 10000, message: 'Daily neuron allowance exhausted. Resets at 00:00 UTC.' }],
      messages: [],
    }, { status: 429 })))

    await provider.initialize({
      cloudflareAccountId: 'test-acc',
      cloudflareApiToken: 'test-token',
    })

    const job = await provider.generate({ prompt: 'A cat.' })
    expect(await completed(job.jobId)).toEqual({
      status: 'failed',
      error: 'Cloudflare Workers AI returned HTTP 429: Daily neuron allowance exhausted. Resets at 00:00 UTC.',
    })
  })

  it('throws clear error when credentials are not configured', async () => {
    await provider.initialize({})
    await expect(provider.generate({ prompt: 'Test' })).rejects.toThrow(
      'Configure your Cloudflare Account ID and API Token',
    )
  })

  it('supports job cancellation', async () => {
    let abortListener: (() => void) | undefined
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        abortListener?.()
        reject(new Error('aborted'))
      })
    })))

    await provider.initialize({
      cloudflareAccountId: 'test-acc',
      cloudflareApiToken: 'test-token',
    })

    const job = await provider.generate({ prompt: 'Takes time' })
    expect((await provider.getStatus(job.jobId)).status).toBe('running')

    await provider.cancel(job.jobId)
    expect(await provider.getStatus(job.jobId)).toEqual({
      status: 'failed',
      error: 'Image generation was cancelled.',
    })
  })
})
