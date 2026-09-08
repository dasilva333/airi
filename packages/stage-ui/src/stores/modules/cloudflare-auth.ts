/**
 * Pure functional seams for Cloudflare OAuth 2.0 PKCE authentication,
 * Edge Vault credential sync, and workers.dev subdomain management.
 */

export const CLOUDFLARE_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
export const CLOUDFLARE_AUTH_ENDPOINT = 'https://dash.cloudflare.com/oauth2/auth'
export const CLOUDFLARE_TOKEN_ENDPOINT = 'https://dash.cloudflare.com/oauth2/token'
export const CLOUDFLARE_DEFAULT_REDIRECT_URI = 'http://localhost:8976/oauth/callback'
export const CLOUDFLARE_DEFAULT_SCOPES = 'account:read user:read workers:write workers_kv:write workers_routes:write workers_scripts:write offline_access'
export const CLOUDFLARE_EDGE_VAULT_NAMESPACE = 'airi-edge-vault'
export const CLOUDFLARE_EDGE_VAULT_KEY = 'vault/credentials'

/**
 * Converts a Uint8Array buffer into RFC 7636 Base64URL string without padding.
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(buffer).toString('base64')

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Derives a SHA-256 code challenge from a code verifier string.
 */
export async function deriveCodeChallenge(codeVerifier: string, subtleCrypto?: SubtleCrypto): Promise<string> {
  const cryptoSubtle = subtleCrypto
    || (typeof window !== 'undefined' && window.crypto?.subtle ? window.crypto.subtle : undefined)

  if (cryptoSubtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hash = await cryptoSubtle.digest('SHA-256', data)
    return base64UrlEncode(new Uint8Array(hash))
  }

  // Node.js fallback
  const nodeCrypto = await import('node:crypto')
  const hash = nodeCrypto.createHash('sha256').update(codeVerifier).digest()
  return base64UrlEncode(new Uint8Array(hash))
}

export interface BuildOAuthUrlOptions {
  clientId?: string
  redirectUri?: string
  scopes?: string
  state: string
  codeChallenge: string
  endpoint?: string
}

/**
 * Constructs the standard Cloudflare OAuth 2.0 PKCE authorization URL.
 */
export function buildCloudflareOAuthUrl(options: BuildOAuthUrlOptions): string {
  const endpoint = options.endpoint || CLOUDFLARE_AUTH_ENDPOINT
  const url = new URL(endpoint)
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('client_id', options.clientId || CLOUDFLARE_OAUTH_CLIENT_ID)
  url.searchParams.append('redirect_uri', options.redirectUri || CLOUDFLARE_DEFAULT_REDIRECT_URI)
  url.searchParams.append('scope', options.scopes || CLOUDFLARE_DEFAULT_SCOPES)
  url.searchParams.append('state', options.state)
  url.searchParams.append('code_challenge', options.codeChallenge)
  url.searchParams.append('code_challenge_method', 'S256')
  return url.toString()
}

/**
 * Safely extracts the authorization code from manual user input, redirect URL, or query/hash params.
 */
export function parseOAuthCallbackInput(input: string): string {
  const raw = input.trim()
  if (!raw) {
    throw new Error('Please enter the authorization code or redirect URL.')
  }

  // 1. Check if the string contains a code query parameter
  if (raw.includes('code=')) {
    try {
      const url = new URL(raw.startsWith('http') ? raw : `http://${raw}`)
      const code = url.searchParams.get('code')
      if (code) {
        return code
      }
      // Check hash params if search params had none (e.g. #/?code=...)
      if (url.hash && url.hash.includes('code=')) {
        const hashQuery = url.hash.includes('?') ? url.hash.split('?')[1] : url.hash.slice(1)
        const hashParams = new URLSearchParams(hashQuery)
        const hashCode = hashParams.get('code')
        if (hashCode) {
          return hashCode
        }
      }
    }
    catch {
      // Fall through to regex extraction
    }

    const match = raw.match(/code=([^&#]+)/)
    if (match?.[1]) {
      return decodeURIComponent(match[1])
    }
  }

  // 2. Direct authorization code returned as-is
  return raw
}

/**
 * Normalizes and sanitizes a workers.dev subdomain string.
 */
export function sanitizeWorkersSubdomain(subdomain: string): string {
  const clean = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '')
  if (!clean) {
    throw new Error('Subdomain must contain valid alphanumeric characters.')
  }
  return clean
}

/**
 * Resolves the primary Cloudflare Account ID from token exchange response or account memberships.
 */
export function resolveAccountId(tokenData?: { account_id?: string }, accountsData?: { result?: Array<{ id: string }> }): string {
  if (tokenData?.account_id) {
    return tokenData.account_id
  }
  if (accountsData?.result?.[0]?.id) {
    return accountsData.result[0].id
  }
  return ''
}

export interface EdgeVaultCredentials {
  s3Endpoint?: string
  s3Bucket?: string
  s3Region?: string
  s3AccessKeyId?: string
  s3SecretAccessKey?: string
  [key: string]: any
}

/**
 * Formats Edge Vault credentials into a JSON payload for Cloudflare KV storage.
 */
export function formatEdgeVaultPayload(credentials: EdgeVaultCredentials): string {
  return JSON.stringify(credentials)
}

/**
 * Parses raw Cloudflare KV response into typed Edge Vault credentials.
 */
export function parseEdgeVaultPayload(raw: string | null | undefined): EdgeVaultCredentials | null {
  if (!raw || typeof raw !== 'string') {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed
    }
  }
  catch {}
  return null
}

export interface CorsProxyOptions {
  isElectron?: boolean
  isViteDev?: boolean
  cfSubdomain?: string
}

/**
 * Constructs an ordered list of fallback URLs to access Cloudflare REST APIs via CORS proxies.
 */
export function getCorsProxiedEndpoints(rawUrl: string, options: CorsProxyOptions = {}): string[] {
  const urls: string[] = []

  // Electron has no browser CORS restrictions; direct fetch is preferred
  if (options.isElectron) {
    urls.push(rawUrl)
    return urls
  }

  // Vite dev server local proxy
  if (options.isViteDev && rawUrl.startsWith('https://api.cloudflare.com/client/v4')) {
    urls.push(rawUrl.replace('https://api.cloudflare.com/client/v4', '/api/cloudflare'))
  }

  // User-deployed private CORS proxy worker
  if (options.cfSubdomain) {
    urls.push(`https://airi-cors-proxy.${options.cfSubdomain}.workers.dev/cors-proxy?url=${encodeURIComponent(rawUrl)}`)
  }

  // Community / default fallback CORS proxy worker
  urls.push(`https://airi-cors-proxy.r1ch4rd.workers.dev/cors-proxy?url=${encodeURIComponent(rawUrl)}`)

  // Direct fetch fallback
  urls.push(rawUrl)

  return urls
}
