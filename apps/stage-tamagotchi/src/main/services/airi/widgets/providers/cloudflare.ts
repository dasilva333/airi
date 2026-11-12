import type { ArtistryJob, ArtistryJobStatus, ArtistryProvider, ArtistryRequest } from './base'

import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'

import { errorMessageFrom } from '@moeru/std'
import {
  CLOUDFLARE_IMAGE_DEFAULTS,
  getCloudflareModelDefaultSteps,
  isCloudflareFixedStepsModel,
  isCloudflareMultipartModel,
  isCloudflareOmitDimensionsModel,
} from '@proj-airi/stage-shared'

import * as v from 'valibot'

const configurationSchema = v.object({
  cloudflareAccountId: v.optional(v.pipe(v.string(), v.trim())),
  cloudflareApiToken: v.optional(v.pipe(v.string(), v.trim())),
  cloudflareEffectiveAccountId: v.optional(v.pipe(v.string(), v.trim())),
  cloudflareEffectiveApiToken: v.optional(v.pipe(v.string(), v.trim())),
  cloudflareImageModel: v.optional(v.pipe(v.string(), v.trim()), CLOUDFLARE_IMAGE_DEFAULTS.model),
  cloudflareImageSteps: v.optional(v.pipe(v.unknown(), v.transform(Number)), CLOUDFLARE_IMAGE_DEFAULTS.steps),
  cloudflareImageWidth: v.optional(v.pipe(v.string(), v.trim()), ''),
  cloudflareImageHeight: v.optional(v.pipe(v.string(), v.trim()), ''),
})

const extrasSchema = v.object({
  internalJobId: v.optional(v.string()),
  steps: v.optional(v.number()),
  num_inference_steps: v.optional(v.number()),
})

interface JobState {
  status: ArtistryJobStatus
  controller: AbortController
  cleanup?: ReturnType<typeof setTimeout>
}

/**
 * Runs native Cloudflare Workers AI image generation requests for Artistry.
 * Supports both JSON (FLUX.1, SDXL, Leonardo, DreamShaper) and multipart/form-data (FLUX.2 Klein/Dev) protocols.
 * Terminal results expire after one minute, and disposal aborts active requests.
 */
export class CloudflareImageProvider implements ArtistryProvider {
  readonly id = 'cloudflare'
  readonly name = 'Cloudflare Workers AI'
  private configuration?: v.InferOutput<typeof configurationSchema>
  private jobs = new Map<string, JobState>()

  async initialize(config: any) {
    this.configuration = undefined
    const configuration = v.parse(configurationSchema, config ?? {})
    this.configuration = configuration
  }

  async generate(request: ArtistryRequest): Promise<ArtistryJob> {
    const configuration = this.configuration
    const accountId = configuration?.cloudflareAccountId || configuration?.cloudflareEffectiveAccountId
    const apiToken = configuration?.cloudflareApiToken || configuration?.cloudflareEffectiveApiToken

    if (!accountId || !apiToken)
      throw new Error('Configure your Cloudflare Account ID and API Token (or connect via Cloudflare Hub) first.')

    const prompt = v.parse(v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(32000)), request.prompt)
    const extras = v.parse(extrasSchema, request.extra ?? {})
    const jobId = extras.internalJobId ?? randomUUID()
    if (this.jobs.has(jobId))
      throw new Error('This image generation job already exists.')

    const model = request.model?.trim() || configuration?.cloudflareImageModel || CLOUDFLARE_IMAGE_DEFAULTS.model

    // Determine inference steps
    let steps: number | undefined
    if (isCloudflareFixedStepsModel(model)) {
      steps = 4
    }
    else {
      const candidateSteps = extras.steps ?? extras.num_inference_steps ?? configuration?.cloudflareImageSteps
      steps = candidateSteps !== undefined && !Number.isNaN(candidateSteps) && candidateSteps > 0
        ? candidateSteps
        : getCloudflareModelDefaultSteps(model)
    }

    // Determine dimensions
    let { width, height } = request
    if (width === undefined && height === undefined) {
      width = configuration?.cloudflareImageWidth ? Number(configuration.cloudflareImageWidth) : undefined
      height = configuration?.cloudflareImageHeight ? Number(configuration.cloudflareImageHeight) : undefined
    }

    if (width !== undefined || height !== undefined) {
      const parsed = v.safeParse(v.object({
        width: v.pipe(v.number(), v.safeInteger(), v.minValue(16)),
        height: v.pipe(v.number(), v.safeInteger(), v.minValue(16)),
      }), { width, height })
      if (!parsed.success)
        throw new Error(`Invalid image size ${width ?? 'blank'}x${height ?? 'blank'}. Set both width and height to positive integers.`)
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model.replace(/^\/+/, '')}`

    // Format body based on model requirements: multipart/form-data for FLUX.2, application/json for others
    let body: string | FormData
    if (isCloudflareMultipartModel(model)) {
      const formData = new FormData()
      formData.append('prompt', prompt)
      if (width !== undefined)
        formData.append('width', String(width))
      if (height !== undefined)
        formData.append('height', String(height))
      if (!isCloudflareFixedStepsModel(model) && steps !== undefined)
        formData.append('steps', String(steps))
      body = formData
    }
    else {
      const payload: Record<string, any> = { prompt }
      if (!isCloudflareOmitDimensionsModel(model)) {
        if (width !== undefined)
          payload.width = width
        if (height !== undefined)
          payload.height = height
      }
      if (steps !== undefined) {
        payload.steps = steps
        if (model.includes('stable-diffusion') || model.includes('sdxl'))
          payload.num_steps = steps
      }
      body = JSON.stringify(payload)
    }

    const state: JobState = { status: { status: 'running' }, controller: new AbortController() }
    this.jobs.set(jobId, state)
    void this.run(jobId, state, endpoint, apiToken, body)
    return { jobId, providerJobId: jobId }
  }

  private async run(jobId: string, state: JobState, endpoint: string, apiToken: string, body: string | FormData) {
    const timeout = setTimeout(() => state.controller.abort(new Error('Image generation timed out.')), 300_000)
    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${apiToken}`,
      }
      if (typeof body === 'string') {
        headers['content-type'] = 'application/json'
        headers.accept = 'application/json'
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: state.controller.signal,
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorData: any = await response.json()
          if (errorData?.errors?.length) {
            errorDetail = errorData.errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join('; ')
          }
          else if (errorData?.messages?.length) {
            errorDetail = errorData.messages.join('; ')
          }
        }
        catch {
          try {
            const text = await response.text()
            if (text)
              errorDetail = text.slice(0, 300)
          }
          catch {
            // Preserve empty error detail
          }
        }
        throw new Error(`Cloudflare Workers AI returned HTTP ${response.status}${errorDetail ? `: ${errorDetail}` : '.'}`)
      }

      const contentType = response.headers.get('content-type') || ''
      let imageUrl: string

      if (contentType.includes('application/json')) {
        const json: any = await response.json().catch(() => {
          throw new Error('Cloudflare Workers AI returned an invalid JSON response.')
        })
        if (!json.success && json.errors?.length) {
          throw new Error(`Cloudflare Workers AI error: ${json.errors.map((e: any) => e.message || e.code).join('; ')}`)
        }
        const b64 = json.result?.image
        if (!b64)
          throw new Error('Cloudflare Workers AI response did not contain an image.')
        imageUrl = b64.startsWith('data:image/') ? b64 : `data:image/png;base64,${b64}`
      }
      else {
        const arrayBuffer = await response.arrayBuffer()
        const b64 = Buffer.from(arrayBuffer).toString('base64')
        const mime = contentType.includes('image/jpeg') ? 'image/jpeg' : 'image/png'
        imageUrl = `data:${mime};base64,${b64}`
      }

      state.controller.signal.throwIfAborted()
      this.finish(jobId, state, {
        status: 'succeeded',
        progress: 100,
        imageUrl,
      })
    }
    catch (error) {
      if (state.status.status === 'running') {
        this.finish(jobId, state, { status: 'failed', error: errorMessageFrom(error) ?? 'Image generation failed.' })
      }
    }
    finally {
      clearTimeout(timeout)
    }
  }

  private finish(jobId: string, state: JobState, status: ArtistryJobStatus) {
    state.status = status
    state.cleanup = setTimeout(() => this.jobs.delete(jobId), 60_000)
    state.cleanup.unref()
  }

  async getStatus(jobId: string): Promise<ArtistryJobStatus> {
    return this.jobs.get(jobId)?.status ?? { status: 'failed', error: 'The image job does not exist or has expired.' }
  }

  async cancel(jobId: string) {
    const state = this.jobs.get(jobId)
    if (!state || state.status.status !== 'running')
      return
    state.controller.abort()
    this.finish(jobId, state, { status: 'failed', error: 'Image generation was cancelled.' })
  }

  dispose() {
    for (const [jobId, state] of this.jobs) {
      void this.cancel(jobId)
      clearTimeout(state.cleanup)
    }
    this.jobs.clear()
    this.configuration = undefined
  }
}
