import type { WidgetsWindowManager } from '../../../windows/widgets'
import type { ArtistryProvider, ArtistryRequest } from './providers/base'

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import { useLogg } from '@guiiai/logg'

import { CloudflareImageProvider } from './providers/cloudflare'
import { ComfyUIProvider } from './providers/comfyui'
import { NanoBananaProvider } from './providers/nanobanana'
import { OpenAIImageProvider } from './providers/openai-image'
import { PollinationsProvider } from './providers/pollinations'
import { ReplicateProvider } from './providers/replicate'

const log = useLogg('artistry-bridge').useGlobalConfig()

function robustParse(input: any): any {
  if (typeof input === 'object' && input !== null)
    return input
  if (typeof input === 'string') {
    try {
      return JSON.parse(input)
    }
    catch {
      return {}
    }
  }
  return {}
}

const lastTriggerMap = new Map<string, string>()
const activeRunMap = new Map<string, string>()

function createRunId(widgetId: string) {
  return `${widgetId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

async function downloadImageAsBase64(url: string): Promise<string> {
  if (url.startsWith('data:image/')) {
    const commaIndex = url.indexOf(',')
    return commaIndex >= 0 ? url.slice(commaIndex + 1) : url
  }
  try {
    log.log(`[Artistry Bridge] Downloading image from: ${url}`)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    const bufferArray = await response.arrayBuffer()
    return Buffer.from(bufferArray).toString('base64')
  }
  catch (error: any) {
    log.error(`[Artistry Bridge] Failed to download image: ${error.message}`)
    throw error
  }
}

// Maintaining a registry of providers
export const artistryProviders = new Map<string, ArtistryProvider>()
artistryProviders.set('comfyui', new ComfyUIProvider())
artistryProviders.set('replicate', new ReplicateProvider())
artistryProviders.set('nanobanana', new NanoBananaProvider())
artistryProviders.set('openai-image', new OpenAIImageProvider())
artistryProviders.set('pollinations', new PollinationsProvider())
artistryProviders.set('cloudflare', new CloudflareImageProvider())

// Deduplication map for headless requests
const pendingHeadlessRequests = new Map<string, Promise<{ imageUrl?: string, base64?: string, error?: string }>>()

// Concurrency cap: only one headless generation job at a time
let activeHeadlessCount = 0
const MAX_CONCURRENT_HEADLESS = 1

export async function generateHeadless(params: {
  prompt: string
  model?: string
  provider?: string
  options?: Record<string, any>
  globals?: any
}): Promise<{ imageUrl?: string, base64?: string, error?: string }> {
  // Create a fingerprint for deduplication
  const fingerprint = JSON.stringify({
    p: params.prompt,
    m: params.model,
    pr: params.provider,
    o: params.options,
    g: {
      ...params.globals,
      image: params.globals?.image
        ? createHash('sha256').update(params.globals.image.slice(0, 1024)).digest('hex')
        : undefined,
    },
  })

  if (pendingHeadlessRequests.has(fingerprint)) {
    log.log(`[Headless] Deduplicating identical request: ${params.prompt.slice(0, 30)}...`)
    return pendingHeadlessRequests.get(fingerprint)!
  }

  if (activeHeadlessCount >= MAX_CONCURRENT_HEADLESS) {
    log.log(`[Headless] Concurrency cap reached (${activeHeadlessCount}/${MAX_CONCURRENT_HEADLESS}). Dropping request.`)
    return { error: 'Concurrency cap reached. A generation is already in progress.' }
  }

  const executionPromise = (async () => {
    const requestedProvider = (params.provider || 'replicate').trim().toLowerCase()
    const provider = artistryProviders.get(requestedProvider)
    if (!provider) {
      log.error(`[Headless] CRITICAL: Provider '${requestedProvider}' not found in registry!`)
      throw new Error(`Provider '${requestedProvider}' not found.`)
    }

    // Initialize the provider if globals are provided
    if (provider.initialize && params.globals) {
      log.log(`[Headless] Initializing provider ${requestedProvider} with globals...`)
      await provider.initialize(params.globals)
    }

    log.log(`[Headless] Globals keys: ${Object.keys(params.globals || {}).join(', ')}`)
    if (params.globals?.image)
      log.log(`[Headless] Source image length: ${params.globals.image.length}`)

    const request: ArtistryRequest = {
      prompt: params.prompt,
      negativePrompt: params.options?.negativePrompt,
      width: params.options?.width,
      height: params.options?.height,
      model: params.model,
      extra: {
        ...params.options,
        image: params.globals?.image,
        internalJobId: createRunId('headless'),
      },
    }

    log.log(`[Headless] Starting generation with provider: ${requestedProvider}, model: ${params.model || 'default'}`)
    const job = await provider.generate(request)
    log.log(`[Headless] Job created: ${job.jobId}`)

    // Polling/Wait for result
    if (!('setJobCallback' in provider)) {
      let isDone = false
      let lastStatus: any = {}
      const start = Date.now()
      const timeout = 1000 * 60 * 10 // 10 minutes timeout

      while (!isDone) {
        if (Date.now() - start > timeout) {
          log.error(`[Headless] Job ${job.jobId} timed out after 10 minutes.`)
          throw new Error('Image generation timed out after 10 minutes.')
        }

        log.log(`[Headless] Polling status for job: ${job.jobId}...`)
        lastStatus = await provider.getStatus(job.jobId)
        log.log(`[Headless] Status for job ${job.jobId}: ${lastStatus.status}`)

        if (lastStatus.status === 'succeeded' || lastStatus.status === 'failed') {
          isDone = true
        }
        if (!isDone) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      if (lastStatus.status === 'failed') {
        log.error(`[Headless] Job ${job.jobId} failed: ${lastStatus.error || 'Unknown error'}`)
        throw new Error(lastStatus.error || 'Generation failed')
      }

      log.log(`[Headless] Job ${job.jobId} succeeded. Image URL: ${lastStatus.imageUrl}`)
      const base64 = lastStatus.imageUrl ? await downloadImageAsBase64(lastStatus.imageUrl) : undefined
      return { imageUrl: lastStatus.imageUrl, base64 }
    }
    else {
      // For providers with callbacks (like ComfyUI), we wait for the result via the callback
      log.log(`[Headless] Using callback-based wait logic for provider: ${requestedProvider}`)
      return new Promise<{ imageUrl?: string, base64?: string }>((resolve, reject) => {
        const timeout = 1000 * 60 * 10 // 10 minutes timeout
        const timer = setTimeout(() => {
          reject(new Error('Image generation timed out after 10 minutes.'))
        }, timeout)

        ;(provider as any).setJobCallback(request.extra?.internalJobId, async (status: any) => {
          if (status.status === 'succeeded') {
            clearTimeout(timer)
            try {
              const base64 = status.imageUrl ? await downloadImageAsBase64(status.imageUrl) : undefined
              resolve({ imageUrl: status.imageUrl, base64 })
            }
            catch (e) {
              reject(e)
            }
          }
          else if (status.status === 'failed') {
            clearTimeout(timer)
            reject(new Error(status.error || 'Generation failed'))
          }
        })
      })
    }
  })()

  activeHeadlessCount++
  pendingHeadlessRequests.set(fingerprint, executionPromise)

  try {
    return await executionPromise
  }
  catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  finally {
    activeHeadlessCount--
    // Remove from map after completion so it can be re-triggered later
    pendingHeadlessRequests.delete(fingerprint)
  }
}

let cachedArtistryConfig: any = null

async function handleArtistryTrigger(params: {
  id: string
  componentName?: string
  componentProps?: any
  widgetsManager: WidgetsWindowManager
}) {
  if (params.componentName !== 'comfy' && params.componentName !== 'artistry')
    return

  log.log(`🔍 Intercepted widget update [${params.id}] for component: ${params.componentName}`)

  const props = robustParse(params.componentProps)
  const status = props.status
  const prompt = props.payload?.prompt || props.prompt

  const config = props._artistryConfig || {}
  if (Object.keys(config).length > 0) {
    cachedArtistryConfig = config
  }
  const configToUse = Object.keys(config).length > 0 ? config : (cachedArtistryConfig || {})

  const providerId = configToUse.provider || configToUse.Globals?.artistryProvider || 'comfyui'

  if (providerId === 'none')
    return

  // Extract options and remix ID fallback
  const options = configToUse.options || {}
  const remixId = props.payload?.remixId || props.remixId || options.remixId || (props.status === 'generating' && !prompt ? '48250602' : undefined)

  const mode = props.mode || (remixId ? 'remix' : 'generate')
  const triggerFingerprint = `${mode}:${remixId || ''}:${prompt || ''}`

  if (status === 'generating' && lastTriggerMap.get(params.id) !== triggerFingerprint && (prompt || remixId)) {
    log.log(`🎯 TRIGGER DETECTED [${params.id}]: ${triggerFingerprint} | Mode: ${mode} | Provider: ${providerId}`)
    lastTriggerMap.set(params.id, triggerFingerprint)
    const runId = createRunId(params.id)
    activeRunMap.set(params.id, runId)

    const provider = artistryProviders.get(providerId)
    if (!provider) {
      log.error(`🔴 Provider '${providerId}' not found.`)
      params.widgetsManager.updateWidget({
        id: params.id,
        componentProps: { status: 'error', actionLabel: `Provider '${providerId}' not available` },
      })
      return
    }

    const globalsToUse = configToUse.Globals

    // Initialize the provider with global config
    if (provider.initialize && globalsToUse) {
      await provider.initialize(globalsToUse)
    }

    try {
      // Build the abstract request
      const request: ArtistryRequest = {
        prompt: configToUse.promptPrefix ? `${configToUse.promptPrefix} ${prompt}` : prompt,
        model: configToUse.model,
        width: typeof options.width === 'number' ? options.width : undefined,
        height: typeof options.height === 'number' ? options.height : undefined,
        extra: {
          ...props.payload,
          ...options,
          internalJobId: runId, // Track each generation independently, even on the same widget.
          remixId,
        },
      }

      const updateIfActive = (statusUpdate: Record<string, any>) => {
        // NOTICE: the same widget can kick off another generation before the previous one fully
        // settles. Only the most recent run is allowed to keep updating the widget state.
        if (activeRunMap.get(params.id) !== runId)
          return

        params.widgetsManager.updateWidget({
          id: params.id,
          componentProps: statusUpdate,
        })
      }

      let isDone = false

      if ('setJobCallback' in provider) {
        const callbackPromise = new Promise<void>((resolve) => {
          ;(provider as any).setJobCallback(runId, (statusUpdate: any) => {
            updateIfActive(statusUpdate)
            if (statusUpdate.status === 'succeeded' || statusUpdate.status === 'failed') {
              isDone = true
              resolve()
            }
          })
        })

        await provider.generate(request)
        const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Generation timed out')), 1000 * 60 * 10))
        await Promise.race([callbackPromise, timeoutPromise])
      }
      else {
        const job = await provider.generate(request)

        // Polling loop for providers that don't do callbacks (like Replicate)
        const pollStart = Date.now()
        const POLL_TIMEOUT = 1000 * 60 * 10 // 10 minutes
        while (!isDone) {
          if (Date.now() - pollStart > POLL_TIMEOUT) {
            updateIfActive({ status: 'error', actionLabel: 'Generation timed out' })
            break
          }
          const status = await provider.getStatus(job.jobId)
          if (status.status === 'succeeded' || status.status === 'failed') {
            isDone = true
          }

          updateIfActive(status)

          if (!isDone) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }

      log.log(`🎉 Job complete for ${params.id}. Sending final status: done`)
      updateIfActive({ status: 'done', progress: 100, actionLabel: undefined })
    }
    catch (error: any) {
      log.error(`🔴 Generation failed: ${error.message}`)
      if (activeRunMap.get(params.id) === runId) {
        params.widgetsManager.updateWidget({
          id: params.id,
          componentProps: { status: 'error', actionLabel: error.message },
        })
      }
    }
  }
}

export function setupArtistryBridge(params: { widgetsManager: WidgetsWindowManager }) {
  log.log('🚀 Initializing Artistry bridge (Spawn + Update Interceptor)...')

  const originalUpdateWidget = params.widgetsManager.updateWidget
  params.widgetsManager.updateWidget = async (payload) => {
    const snapshot = params.widgetsManager.getWidgetSnapshot(payload.id)
    await originalUpdateWidget.call(params.widgetsManager, payload)
    await handleArtistryTrigger({
      id: payload.id,
      componentName: snapshot?.componentName,
      componentProps: payload.componentProps,
      widgetsManager: params.widgetsManager,
    })
  }

  const originalPushWidget = params.widgetsManager.pushWidget
  params.widgetsManager.pushWidget = async (payload) => {
    if (payload.componentName === 'comfy' || payload.componentName === 'artistry') {
      log.log(`🖼️  Enabling 'Living Wall' mode for ${payload.id}. Forcing infinite TTL. (Component: ${payload.componentName})`)
      payload.ttlMs = 0
    }

    const resultId = await originalPushWidget.call(params.widgetsManager, payload)

    await handleArtistryTrigger({
      id: resultId,
      componentName: payload.componentName,
      componentProps: payload.componentProps,
      widgetsManager: params.widgetsManager,
    })

    return resultId
  }
}
