import { describe, expect, it } from 'vitest'

import { setupApp } from './index'

describe('code Assistant REST Ingestion (/api/assistant/state)', () => {
  const testToken = 'secret-token-123'

  it('rejects unauthenticated requests when auth token is configured', async () => {
    const { app, closeAllPeers } = setupApp({
      auth: { token: testToken },
    })

    try {
      // 1. GET without token -> 401
      const getRes = await app.request('/api/assistant/state', { method: 'GET' })
      expect(getRes.status).toBe(401)

      // 2. POST without token -> 401
      const postRes = await app.request('/api/assistant/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'work' }),
      })
      expect(postRes.status).toBe(401)

      // 3. POST with wrong token -> 401
      const wrongAuthRes = await app.request('/api/assistant/state', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer wrong-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'work' }),
      })
      expect(wrongAuthRes.status).toBe(401)
    }
    finally {
      closeAllPeers()
    }
  })

  it('allows authenticated GET requests with Bearer token or x-auth-token header', async () => {
    const { app, closeAllPeers } = setupApp({
      auth: { token: testToken },
    })

    try {
      // Bearer header
      const res1 = await app.request('/api/assistant/state', {
        method: 'GET',
        headers: { Authorization: `Bearer ${testToken}` },
      })
      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      expect(data1).toMatchObject({ ok: true, status: 'ready', authenticated: true })

      // Custom header
      const res2 = await app.request('/api/assistant/state', {
        method: 'GET',
        headers: { 'x-auth-token': testToken },
      })
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2).toMatchObject({ ok: true, status: 'ready', authenticated: true })
    }
    finally {
      closeAllPeers()
    }
  })

  it('rejects malformed bodies or invalid states with 400 Bad Request', async () => {
    const { app, closeAllPeers } = setupApp({
      auth: { token: testToken },
    })

    try {
      // Missing state
      const res1 = await app.request('/api/assistant/state', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ headline: 'No state provided' }),
      })
      expect(res1.status).toBe(400)

      // Invalid state
      const res2 = await app.request('/api/assistant/state', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'invalid_status' }),
      })
      expect(res2.status).toBe(400)
    }
    finally {
      closeAllPeers()
    }
  })

  it('accepts valid state payloads and responds with 200 OK', async () => {
    const { app, closeAllPeers } = setupApp({
      auth: { token: testToken },
    })

    try {
      const states = ['work', 'wait', 'done', 'idle', 'error'] as const

      for (const state of states) {
        const res = await app.request('/api/assistant/state', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            state,
            sessionId: 'session-42',
            assistant: 'gemini',
            headline: `Now in ${state}`,
            note: 'Detailed description',
            tool: state === 'work' ? 'npm test' : undefined,
          }),
        })

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json).toEqual({
          ok: true,
          handled: true,
          state,
        })
      }
    }
    finally {
      closeAllPeers()
    }
  })

  it('handles CORS preflight OPTIONS and responds with CORS headers', async () => {
    const { app, closeAllPeers } = setupApp({
      auth: { token: testToken },
    })

    try {
      const optionsRes = await app.request('/api/assistant/state', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      })
      expect(optionsRes.status).toBeLessThan(400)
      expect(optionsRes.headers.get('access-control-allow-origin')).toBe('*')
      expect(optionsRes.headers.get('access-control-allow-methods')).toContain('GET')

      const getRes = await app.request('/api/assistant/state', {
        method: 'GET',
        headers: { Authorization: `Bearer ${testToken}` },
      })
      expect(getRes.headers.get('access-control-allow-origin')).toBe('*')
    }
    finally {
      closeAllPeers()
    }
  })
})
