import type { Env } from './index'

import crypto from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import worker from './index'

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('apps/stage-edge worker index', () => {
  const baseEnv: Env = {
    LLM_API_KEY: 'test-llm-key',
    DISCORD_PUBLIC_KEY: 'test-discord-public-key',
  }

  describe('oPTIONS CORS preflight', () => {
    it('returns status 204 with permissive CORS headers', async () => {
      const req = new Request('https://edge.airi.moeru.ai/cors-proxy', {
        method: 'OPTIONS',
      })
      const res = await worker.fetch(req, baseEnv)

      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(res.headers.get('Access-Control-Max-Age')).toBe('86400')
    })
  })

  describe('/health endpoint', () => {
    it('returns ok status and worker identity', async () => {
      const req = new Request('https://edge.airi.moeru.ai/health')
      const res = await worker.fetch(req, baseEnv)

      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data).toEqual({ status: 'ok', worker: '@proj-airi/stage-edge' })
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('/cors-proxy & /proxy endpoint', () => {
    it('returns 400 when url parameter is missing', async () => {
      const req = new Request('https://edge.airi.moeru.ai/cors-proxy')
      const res = await worker.fetch(req, baseEnv)

      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toContain('Missing target URL')
    })

    it('remaps x-target-authorization and strips forbidden headers', async () => {
      let interceptedReq: Request | null = null
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async (input: any, init?: any) => {
        interceptedReq = new Request(input, init)
        return new Response(JSON.stringify({ proxied: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      try {
        const req = new Request('https://edge.airi.moeru.ai/cors-proxy?url=https://api.cloudflare.com/client/v4/user', {
          headers: {
            'x-target-authorization': 'Bearer proxy-token-123',
            'x-target-url': 'https://api.cloudflare.com/client/v4/user',
            'origin': 'https://airi.moeru.ai',
            'referer': 'https://airi.moeru.ai/settings',
          },
        })

        const res = await worker.fetch(req, baseEnv)
        expect(res.status).toBe(200)
        expect(interceptedReq).not.toBeNull()
        expect(interceptedReq!.headers.get('Authorization')).toBe('Bearer proxy-token-123')
        expect(interceptedReq!.headers.get('x-target-authorization')).toBeNull()
        expect(interceptedReq!.headers.get('x-target-url')).toBeNull()
        expect(interceptedReq!.headers.get('origin')).toBeNull()
        expect(interceptedReq!.headers.get('referer')).toBeNull()
      }
      finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('/discord webhook handling', () => {
    it('returns 401 when signature verification fails', async () => {
      const req = new Request('https://edge.airi.moeru.ai/discord', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': 'bad-signature',
          'x-signature-timestamp': '1700000000',
        },
        body: JSON.stringify({ type: 1 }),
      })

      const res = await worker.fetch(req, baseEnv)
      expect(res.status).toBe(401)
      const text = await res.text()
      expect(text).toBe('Invalid signature')
    })

    it('handles Type 1 PING with Type 1 PONG response when signature is valid', async () => {
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
        body,
      })

      const env: Env = {
        ...baseEnv,
        DISCORD_PUBLIC_KEY: publicKeyHex,
      }

      const res = await worker.fetch(req, env)
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data).toEqual({ type: 1 })
    })

    it('returns Type 5 DEFERRED for Type 2 command and registers waitUntil execution', async () => {
      const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair
      const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      const publicKeyHex = uint8ArrayToHex(new Uint8Array(rawPublicKey))

      const timestamp = '1725800000'
      const interactionPayload = {
        type: 2,
        application_id: 'app_123',
        token: 'token_456',
        data: {
          options: [{ name: 'message', value: 'Hello AIRI!' }],
        },
      }
      const body = JSON.stringify(interactionPayload)
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
        body,
      })

      const env: Env = {
        ...baseEnv,
        DISCORD_PUBLIC_KEY: publicKeyHex,
      }

      let waitedPromise: Promise<any> | null = null
      const ctx = {
        waitUntil: (p: Promise<any>) => {
          waitedPromise = p
        },
      }

      const res = await worker.fetch(req, env, ctx)
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data).toEqual({ type: 5 })
      expect(waitedPromise).not.toBeNull()
    })
  })

  describe('unmatched routes', () => {
    it('returns 404 Not Found for unrecognized path', async () => {
      const req = new Request('https://edge.airi.moeru.ai/unknown-route')
      const res = await worker.fetch(req, baseEnv)
      expect(res.status).toBe(404)
    })
  })
})
