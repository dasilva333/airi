import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { ApiError, createForbiddenError } from '../../utils/error'
import { requireSameOrigin } from '../require-origin'

function makeApp() {
  const app = new Hono()
  app.onError((err, c) => {
    if (err instanceof ApiError)
      return c.json({ error: err.errorCode }, err.statusCode)
    return c.json({ error: 'INTERNAL' }, 500)
  })
  app.use('/api/*', requireSameOrigin)
  app.on(['GET', 'POST'], '/api/thing', c => c.json({ ok: true }))
  return app
}

describe('requireSameOrigin', () => {
  const app = makeApp()

  it('passes GET requests with any origin', async () => {
    const res = await app.fetch(new Request('http://localhost/api/thing', { headers: { Origin: 'https://evil.example' } }))
    expect(res.status).toBe(200)
  })

  it('passes mutations without an Origin header (non-browser clients)', async () => {
    const res = await app.fetch(new Request('http://localhost/api/thing', { method: 'POST' }))
    expect(res.status).toBe(200)
  })

  it('passes mutations from a trusted origin (localhost outside production)', async () => {
    const res = await app.fetch(new Request('http://localhost/api/thing', { method: 'POST', headers: { Origin: 'http://localhost:3000' } }))
    expect(res.status).toBe(200)
  })

  it('rejects mutations from an untrusted origin', async () => {
    const res = await app.fetch(new Request('http://localhost/api/thing', { method: 'POST', headers: { Origin: 'https://evil.example' } }))
    expect(res.status).toBe(403)
  })

  it('rejects mutations with Sec-Fetch-Site: cross-site even without Origin', async () => {
    const res = await app.fetch(new Request('http://localhost/api/thing', { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } }))
    expect(res.status).toBe(403)
  })

  it('passes mutations with Sec-Fetch-Site: same-origin', async () => {
    const res = await app.fetch(new Request('http://localhost/api/thing', { method: 'POST', headers: { 'Sec-Fetch-Site': 'same-origin' } }))
    expect(res.status).toBe(200)
  })

  it('createForbiddenError carries 403', () => {
    expect(createForbiddenError('x', 'CSRF_BLOCKED').statusCode).toBe(403)
  })
})
