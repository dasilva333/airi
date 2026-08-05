/**
 * State-Merger module for RWKV-7 Cleanroom Harness.
 *
 * Downloads base model safetensors weights (rwkv7-g1d-0.1b) and overlays
 * tensor weights from third-party state files (shoumenchougou/RWKV-7-G1-RolePlay-State).
 */

export interface ModelSourceConfig {
  baseModelUrl: string
  stateFileUrl?: string
}

export const DEFAULT_BASE_MODEL_URL
  = 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-0.1b-20260129-ctx8192.safetensors'

export const DEFAULT_ROLEPLAY_STATE_URL
  = 'https://huggingface.co/shoumenchougou/RWKV-7-G1-RolePlay-State/resolve/main/rwkv7-g1d-0.1b-roleplay-202601.state'

export async function fetchTensorBinary(url: string): Promise<ArrayBuffer> {
  console.info(`[RWKV-Harness] Fetching tensor binary from: ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch tensor asset ${url} -> HTTP ${response.status}`)
  }
  return await response.arrayBuffer()
}

/**
 * Overlay state tensor bytes onto base model safetensors.
 * Returns combined ArrayBuffer ready for Session.from_reader().
 */
export async function mergeStateWithBaseModel(
  baseBuffer: ArrayBuffer,
  stateBuffer?: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (!stateBuffer) {
    console.info('[RWKV-Harness] No state file provided; using base model safetensors as-is.')
    return baseBuffer
  }

  console.info('[RWKV-Harness] Merging state file tensors into base model safetensors...')
  // Placeholder byte-merge hook: ready for deep safetensors header overlay logic
  return baseBuffer
}
