import { describe, expect, it } from 'vitest'

import {
  base64UrlEncode,
  buildCloudflareOAuthUrl,
  CLOUDFLARE_AUTH_ENDPOINT,
  CLOUDFLARE_DEFAULT_REDIRECT_URI,
  CLOUDFLARE_DEFAULT_SCOPES,
  CLOUDFLARE_OAUTH_CLIENT_ID,
  deriveCodeChallenge,
  formatEdgeVaultPayload,
  getCorsProxiedEndpoints,
  parseEdgeVaultPayload,
  parseOAuthCallbackInput,
  resolveAccountId,
  sanitizeWorkersSubdomain,
} from './cloudflare-auth'

describe('cloudflare-auth functional seams', () => {
  describe('base64UrlEncode', () => {
    it('handles empty buffer', () => {
      expect(base64UrlEncode(new Uint8Array(0))).toBe('')
    })

    it('encodes binary data to URL-safe base64 without padding', () => {
      // 0xfb, 0xff, 0xbf encodes to "+/+/ " in standard base64 -> "-_-_" in base64url
      const buffer = new Uint8Array([0xFB, 0xFF, 0xBF])
      const encoded = base64UrlEncode(buffer)
      expect(encoded).toBe('-_-_')
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')
    })
  })

  describe('deriveCodeChallenge', () => {
    it('computes standard SHA-256 base64url digest for verifier', async () => {
      const verifier = 'test-code-verifier-1234567890-abcdefg'
      const challenge = await deriveCodeChallenge(verifier)
      expect(typeof challenge).toBe('string')
      expect(challenge.length).toBeGreaterThan(0)
      expect(challenge).not.toContain('=')
      expect(challenge).not.toContain('+')
      expect(challenge).not.toContain('/')

      // Deterministic output for same verifier
      const secondRun = await deriveCodeChallenge(verifier)
      expect(secondRun).toBe(challenge)
    })
  })

  describe('buildCloudflareOAuthUrl', () => {
    it('constructs standard authorization URL with defaults', () => {
      const urlStr = buildCloudflareOAuthUrl({
        state: 'random_state_123',
        codeChallenge: 'derived_challenge_abc',
      })

      const url = new URL(urlStr)
      expect(url.origin + url.pathname).toBe(CLOUDFLARE_AUTH_ENDPOINT)
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('client_id')).toBe(CLOUDFLARE_OAUTH_CLIENT_ID)
      expect(url.searchParams.get('redirect_uri')).toBe(CLOUDFLARE_DEFAULT_REDIRECT_URI)
      expect(url.searchParams.get('scope')).toBe(CLOUDFLARE_DEFAULT_SCOPES)
      expect(url.searchParams.get('state')).toBe('random_state_123')
      expect(url.searchParams.get('code_challenge')).toBe('derived_challenge_abc')
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    })

    it('supports custom client ID, redirect URI, and scopes', () => {
      const urlStr = buildCloudflareOAuthUrl({
        clientId: 'custom-client-id',
        redirectUri: 'https://example.com/callback',
        scopes: 'workers:write offline_access',
        state: 'state_xyz',
        codeChallenge: 'challenge_123',
      })

      const url = new URL(urlStr)
      expect(url.searchParams.get('client_id')).toBe('custom-client-id')
      expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback')
      expect(url.searchParams.get('scope')).toBe('workers:write offline_access')
    })
  })

  describe('parseOAuthCallbackInput', () => {
    it('extracts raw code as-is when no query params exist', () => {
      expect(parseOAuthCallbackInput('plain_auth_code_xyz')).toBe('plain_auth_code_xyz')
      expect(parseOAuthCallbackInput('  clean_code  ')).toBe('clean_code')
    })

    it('extracts code from standard query string or URL', () => {
      expect(parseOAuthCallbackInput('http://localhost:8976/oauth/callback?code=cf_code_999&state=abc'))
        .toBe('cf_code_999')
      expect(parseOAuthCallbackInput('code=extracted_code_555&other=param'))
        .toBe('extracted_code_555')
    })

    it('extracts code from hash URL route (#/?code=...)', () => {
      expect(parseOAuthCallbackInput('https://airi.moeru.ai/#/?code=hash_code_777&state=s1'))
        .toBe('hash_code_777')
    })

    it('decodes URI-encoded codes', () => {
      expect(parseOAuthCallbackInput('code=test%2Fcode%3D123'))
        .toBe('test/code=123')
    })

    it('throws when input is empty or whitespace only', () => {
      expect(() => parseOAuthCallbackInput('')).toThrow('Please enter the authorization code or redirect URL.')
      expect(() => parseOAuthCallbackInput('   ')).toThrow('Please enter the authorization code or redirect URL.')
    })
  })

  describe('sanitizeWorkersSubdomain', () => {
    it('leaves valid alphanumeric and hyphenated subdomains intact', () => {
      expect(sanitizeWorkersSubdomain('my-team-123')).toBe('my-team-123')
      expect(sanitizeWorkersSubdomain('airi-relay')).toBe('airi-relay')
    })

    it('strips special characters, dots, and converts uppercase to lowercase', () => {
      expect(sanitizeWorkersSubdomain(' My_Team.Dev! ')).toBe('myteamdev')
      expect(sanitizeWorkersSubdomain('AIRI-Subdomain-01')).toBe('airi-subdomain-01')
    })

    it('throws error when no valid characters remain', () => {
      expect(() => sanitizeWorkersSubdomain('!@#$%^&*()_+=.')).toThrow('Subdomain must contain valid alphanumeric characters.')
      expect(() => sanitizeWorkersSubdomain('')).toThrow('Subdomain must contain valid alphanumeric characters.')
    })
  })

  describe('resolveAccountId', () => {
    it('prioritizes account_id from token exchange payload', () => {
      const accountId = resolveAccountId(
        { account_id: 'token_acc_123' },
        { result: [{ id: 'membership_acc_456' }] },
      )
      expect(accountId).toBe('token_acc_123')
    })

    it('falls back to the first membership account if token payload lacks account_id', () => {
      const accountId = resolveAccountId(
        {},
        { result: [{ id: 'membership_acc_456' }, { id: 'membership_acc_789' }] },
      )
      expect(accountId).toBe('membership_acc_456')
    })

    it('returns empty string when neither source contains account ID', () => {
      expect(resolveAccountId(undefined, undefined)).toBe('')
      expect(resolveAccountId({}, { result: [] })).toBe('')
    })
  })

  describe('edge Vault serialization', () => {
    it('formats and parses Edge Vault credentials round-trip', () => {
      const credentials = {
        s3Endpoint: 'https://r2.cloudflarestorage.com',
        s3Bucket: 'airi-backup-bucket',
        s3Region: 'auto',
        s3AccessKeyId: 'ACCESS_KEY_001',
        s3SecretAccessKey: 'SECRET_KEY_999',
      }

      const formatted = formatEdgeVaultPayload(credentials)
      expect(typeof formatted).toBe('string')

      const parsed = parseEdgeVaultPayload(formatted)
      expect(parsed).toEqual(credentials)
    })

    it('returns null for missing, non-string, or malformed JSON payloads', () => {
      expect(parseEdgeVaultPayload(null)).toBeNull()
      expect(parseEdgeVaultPayload(undefined)).toBeNull()
      expect(parseEdgeVaultPayload('')).toBeNull()
      expect(parseEdgeVaultPayload('not-valid-json {{}')).toBeNull()
    })
  })

  describe('getCorsProxiedEndpoints', () => {
    const rawUrl = 'https://api.cloudflare.com/client/v4/accounts/acc123/workers/subdomain'

    it('returns direct URL only in Electron environment', () => {
      const endpoints = getCorsProxiedEndpoints(rawUrl, { isElectron: true })
      expect(endpoints).toEqual([rawUrl])
    })

    it('includes Vite dev proxy when isViteDev is true and URL matches API base', () => {
      const endpoints = getCorsProxiedEndpoints(rawUrl, { isElectron: false, isViteDev: true })
      expect(endpoints[0]).toBe('/api/cloudflare/accounts/acc123/workers/subdomain')
      expect(endpoints).toContain(rawUrl)
    })

    it('includes user custom subdomain proxy when cfSubdomain is provided', () => {
      const endpoints = getCorsProxiedEndpoints(rawUrl, {
        isElectron: false,
        cfSubdomain: 'my-custom-subdomain',
      })
      expect(endpoints.some(u => u.includes('airi-cors-proxy.my-custom-subdomain.workers.dev'))).toBe(true)
      expect(endpoints.some(u => u.includes('airi-cors-proxy.r1ch4rd.workers.dev'))).toBe(true)
      expect(endpoints[endpoints.length - 1]).toBe(rawUrl)
    })
  })
})
