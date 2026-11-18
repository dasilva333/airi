/**
 * Shared WASM threading resolution for local inference engines.
 *
 * Without COOP/COEP headers (`crossOriginIsolated === false`), SharedArrayBuffer
 * is unavailable and WASM workers must run single-threaded (`1`).
 */

export function isWasmThreadingAvailable(): boolean {
  try {
    return (globalThis as { crossOriginIsolated?: unknown }).crossOriginIsolated === true
  }
  catch {
    return false
  }
}

export function resolveWasmThreads(threads?: number | 'auto' | string): number {
  if (!isWasmThreadingAvailable())
    return 1
  const hw = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4
  if (typeof threads === 'number' && Number.isFinite(threads) && threads > 0)
    return Math.min(hw, 32, Math.max(1, Math.floor(threads)))
  if (typeof threads === 'string' && threads !== 'auto' && threads.trim() !== '') {
    const parsed = Number(threads)
    if (Number.isFinite(parsed) && parsed > 0)
      return Math.min(hw, 32, Math.max(1, Math.floor(parsed)))
  }
  if (hw <= 1)
    return 1
  return Math.min(4, Math.max(2, Math.floor(hw / 2)))
}
