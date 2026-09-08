import crypto from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { hexToUint8Array, verifyDiscordSignature } from './ed25519'

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('apps/stage-edge ed25519', () => {
  describe('hexToUint8Array', () => {
    it('returns empty Uint8Array for falsy or empty inputs', () => {
      expect(hexToUint8Array(null)).toEqual(new Uint8Array(0))
      expect(hexToUint8Array(undefined)).toEqual(new Uint8Array(0))
      expect(hexToUint8Array('')).toEqual(new Uint8Array(0))
    })

    it('correctly converts hex string to Uint8Array', () => {
      const hex = '0001020aff'
      const result = hexToUint8Array(hex)
      expect(Array.from(result)).toEqual([0, 1, 2, 10, 255])
    })
  })

  describe('verifyDiscordSignature', () => {
    it('returns false when signature, timestamp, or public key is missing', async () => {
      const reqNoSig = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: { 'x-signature-timestamp': '1700000000' },
      })
      expect(await verifyDiscordSignature(reqNoSig, '{"type":1}', 'abc')).toBe(false)

      const reqNoTime = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: { 'x-signature-ed25519': 'abc' },
      })
      expect(await verifyDiscordSignature(reqNoTime, '{"type":1}', 'abc')).toBe(false)

      const reqValidHeaders = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'abc',
          'x-signature-timestamp': '1700000000',
        },
      })
      expect(await verifyDiscordSignature(reqValidHeaders, '{"type":1}', null)).toBe(false)
      expect(await verifyDiscordSignature(reqValidHeaders, '{"type":1}', '')).toBe(false)
    })

    it('successfully verifies a valid Ed25519 signed Discord payload', async () => {
      // Generate standard Web Crypto Ed25519 keypair
      const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair
      const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      const publicKeyHex = uint8ArrayToHex(new Uint8Array(rawPublicKey))

      const timestamp = '1725800000'
      const body = JSON.stringify({ type: 1 })
      const encoder = new TextEncoder()
      const signedData = encoder.encode(timestamp + body)

      const signatureBuffer = await crypto.subtle.sign('Ed25519', keyPair.privateKey, signedData)
      const signatureHex = uint8ArrayToHex(new Uint8Array(signatureBuffer))

      const req = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': signatureHex,
          'x-signature-timestamp': timestamp,
        },
      })

      const isValid = await verifyDiscordSignature(req, body, publicKeyHex)
      expect(isValid).toBe(true)
    })

    it('rejects tampered body content', async () => {
      const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair
      const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      const publicKeyHex = uint8ArrayToHex(new Uint8Array(rawPublicKey))

      const timestamp = '1725800000'
      const originalBody = JSON.stringify({ type: 1 })
      const tamperedBody = JSON.stringify({ type: 2 })

      const encoder = new TextEncoder()
      const signedData = encoder.encode(timestamp + originalBody)
      const signatureBuffer = await crypto.subtle.sign('Ed25519', keyPair.privateKey, signedData)
      const signatureHex = uint8ArrayToHex(new Uint8Array(signatureBuffer))

      const req = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': signatureHex,
          'x-signature-timestamp': timestamp,
        },
      })

      const isValid = await verifyDiscordSignature(req, tamperedBody, publicKeyHex)
      expect(isValid).toBe(false)
    })

    it('gracefully handles malformed keys or signatures without unhandled exceptions', async () => {
      const req = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'invalid-hex-non-hex-chars!',
          'x-signature-timestamp': '1725800000',
        },
      })

      const isValid = await verifyDiscordSignature(req, '{}', 'bad-key')
      expect(isValid).toBe(false)
    })
  })
})
