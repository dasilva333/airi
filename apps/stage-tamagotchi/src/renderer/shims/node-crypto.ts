/**
 * Minimal shim for `node:crypto` in the renderer process.
 * Uses browser-native `globalThis.crypto`.
 */

export const webcrypto = globalThis.crypto

export function randomBytes(size: number) {
  const bytes = new Uint8Array(size)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

export function createHash() {
  throw new Error(
    '[AIRI] node:crypto.createHash is not supported in the renderer. Use @noble/hashes or browser-native crypto.subtle instead.',
  )
}

export default {
  createHash,
  randomBytes,
  webcrypto,
}
