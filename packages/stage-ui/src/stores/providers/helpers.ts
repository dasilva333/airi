import type { ProviderValidationResult } from './types'

import { isUrl } from '@proj-airi/stage-shared'
import { isWebGPUSupported } from '@proj-airi/stage-shared/webgpu'

export function logWarn(...args: unknown[]) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('airi:debug') === '1') {
      console.warn(...args)
    }
  }
  catch {
    // Ignore
  }
}

export function normalizeProviderBaseUrl(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed)
    return ''

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

export function toV1SpeechBaseUrl(value: unknown): string {
  const normalized = normalizeProviderBaseUrl(value)
  if (!normalized)
    return ''

  return normalized.endsWith('/v1/') ? normalized : `${normalized}v1/`
}

export function toProviderRootBaseUrl(value: unknown): string {
  return toV1SpeechBaseUrl(value).replace(/\/v1\/$/, '/')
}

export function validateProviderBaseUrl(baseUrl: unknown): ProviderValidationResult | null {
  let msg = ''
  if (!baseUrl) {
    msg = 'Base URL is required.'
  }
  else if (typeof baseUrl !== 'string') {
    msg = 'Base URL must be a string.'
  }
  else if (!isUrl(baseUrl) || new URL(baseUrl).host.length === 0) {
    msg = 'Base URL is not absolute. Try to include a scheme (http:// or https://).'
  }
  else if (!baseUrl.endsWith('/')) {
    msg = 'Base URL must end with a trailing slash (/).'
  }

  if (msg) {
    return {
      errors: [new Error(msg)],
      reason: msg,
      valid: false,
    }
  }

  return null
}

export async function isBrowserAndMemoryEnough() {
  const webGPUAvailable = await isWebGPUSupported()
  if (webGPUAvailable) {
    return true
  }

  if ('navigator' in globalThis && globalThis.navigator != null && 'deviceMemory' in globalThis.navigator && typeof globalThis.navigator.deviceMemory === 'number') {
    const memory = globalThis.navigator.deviceMemory
    if (memory >= 8) {
      return true
    }
  }

  return false
}
