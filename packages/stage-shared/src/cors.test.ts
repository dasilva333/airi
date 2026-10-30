import { describe, expect, it } from 'vitest'

import { DEFAULT_CORS_BYPASS_URLS, DEFAULT_SKIP_CORS_HOSTS, isCorsBypassTarget } from './cors'

describe('cors bypass target detection', () => {
  it('excludes dead free providers (LanLan, MiMo) from default bypass list', () => {
    expect(DEFAULT_CORS_BYPASS_URLS).not.toContain('https://www.lanlan.tech/*')
    expect(DEFAULT_CORS_BYPASS_URLS).not.toContain('https://api.xiaomimimo.com/*')
    expect(DEFAULT_SKIP_CORS_HOSTS).not.toContain('lanlan.tech')
    expect(DEFAULT_SKIP_CORS_HOSTS).not.toContain('api.xiaomimimo.com')
  })

  it('includes Kilo in default bypass list and skip hosts', () => {
    expect(DEFAULT_CORS_BYPASS_URLS).toContain('https://api.kilo.ai/*')
    expect(DEFAULT_SKIP_CORS_HOSTS).toContain('api.kilo.ai')

    expect(isCorsBypassTarget('https://api.kilo.ai/api/gateway/v1/chat/completions')).toBe(true)
    expect(isCorsBypassTarget('https://api.kilo.ai/api/gateway/models')).toBe(true)
  })

  it('keeps localhost in DEFAULT_CORS_BYPASS_URLS for Electron desktop convenience while excluding from remote web proxy', () => {
    // Electron desktop uses DEFAULT_CORS_BYPASS_URLS on-device
    expect(DEFAULT_CORS_BYPASS_URLS).toContain('http://localhost:11434/*')
    expect(DEFAULT_CORS_BYPASS_URLS).toContain('http://127.0.0.1:11434/*')
    expect(DEFAULT_CORS_BYPASS_URLS).toContain('http://localhost:1234/*')

    // Web proxy interceptor strictly excludes loopback to avoid dead Cloudflare subrequests
    expect(isCorsBypassTarget('http://localhost:11434/api/tags')).toBe(false)
    expect(isCorsBypassTarget('http://127.0.0.1:11434/api/tags')).toBe(false)
    expect(isCorsBypassTarget('http://localhost:1234/v1/models')).toBe(false)
    expect(isCorsBypassTarget('http://0.0.0.0:11434/api/tags')).toBe(false)
  })
})
