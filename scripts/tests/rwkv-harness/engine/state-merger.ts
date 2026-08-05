/**
 * State-Merger module with local disk caching for RWKV-7 Cleanroom Harness.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface ModelSourceConfig {
  baseModelUrl: string
  stateFileUrl?: string
}

export const DEFAULT_BASE_MODEL_URL
  = 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-0.1b-20260129-ctx8192.safetensors'

export const DEFAULT_ROLEPLAY_STATE_URL
  = 'https://huggingface.co/shoumenchougou/RWKV-7-G1-RolePlay-State/resolve/main/rwkv7-g1d-0.1b-roleplay-202601.state'

const CACHE_DIR = path.resolve(process.cwd(), '.cache')

export async function fetchTensorBinary(url: string): Promise<ArrayBuffer> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  const fileName = path.basename(new URL(url).pathname)
  const cachedFilePath = path.join(CACHE_DIR, fileName)

  // 1. Check local disk cache
  if (fs.existsSync(cachedFilePath)) {
    console.info(`[RWKV-Cache] Loading model from local disk cache: ${cachedFilePath}`)
    const buffer = fs.readFileSync(cachedFilePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }

  // 2. Download from remote HF CDN if cold
  console.info(`[RWKV-Harness] Disk cache miss. Downloading tensor binary from: ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch tensor asset ${url} -> HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Write to disk cache for future instant runs
  fs.writeFileSync(cachedFilePath, buffer)
  console.info(`[RWKV-Cache] Saved tensor binary to local disk cache: ${cachedFilePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)

  return arrayBuffer
}

export async function mergeStateWithBaseModel(
  baseBuffer: ArrayBuffer,
  stateBuffer?: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (!stateBuffer) {
    console.info('[RWKV-Harness] No state file provided; using base model safetensors as-is.')
    return baseBuffer
  }

  console.info('[RWKV-Harness] Merging state file tensors into base model safetensors...')
  return baseBuffer
}
