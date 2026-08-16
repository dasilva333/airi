/**
 * Shared CORS bypass configurations and Web proxy interceptor.
 */

export const DEFAULT_CORS_BYPASS_URLS: string[] = [
  'https://api.cloudflare.com/*',
  'https://dash.cloudflare.com/*',
  'https://api.deepgram.com/*',
  'https://opencode.ai/*',
  'https://pioneer.ai/*',
  'https://integrate.api.nvidia.com/*',
  'https://text.pollinations.ai/*',
  'https://api.xiaomimimo.com/*',
  'http://localhost:11434/*',
  'http://127.0.0.1:11434/*',
  'http://localhost:1234/*',
  'http://127.0.0.1:1234/*',
]

export const DEFAULT_SKIP_CORS_HOSTS: string[] = [
  'api.cloudflare.com',
  'dash.cloudflare.com',
  'api.deepgram.com',
  'opencode.ai',
  'pioneer.ai',
  'integrate.api.nvidia.com',
  'text.pollinations.ai',
  'api.xiaomimimo.com',
  'localhost:11434',
  '127.0.0.1:11434',
  'localhost:1234',
  '127.0.0.1:1234',
]

/**
 * Checks if a target URL requires CORS bypass proxying.
 */
export function isCorsBypassTarget(url: string, customPatterns?: string[]): boolean {
  if (!url || typeof url !== 'string')
    return false

  // Never proxy proxy itself or local relative paths
  if (url.startsWith('/') || url.includes('/cors-proxy') || url.includes('/proxy'))
    return false

  try {
    const parsed = new URL(url)

    // Check host list
    const hostWithPort = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname
    if (DEFAULT_SKIP_CORS_HOSTS.includes(parsed.hostname) || DEFAULT_SKIP_CORS_HOSTS.includes(hostWithPort))
      return true

    // Check URL patterns
    const patterns = Array.isArray(customPatterns) && customPatterns.length > 0
      ? customPatterns
      : DEFAULT_CORS_BYPASS_URLS

    for (const pattern of patterns) {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2)
        if (url.startsWith(prefix))
          return true
      }
      else if (url === pattern || parsed.origin === pattern) {
        return true
      }
    }
  }
  catch {
    return false
  }

  return false
}

/**
 * Formats a target URL to route through the Web CORS Reverse-Proxy Worker.
 */
export function formatCorsProxyUrl(targetUrl: string, customProxyBase?: string): string {
  let proxyBase = customProxyBase

  if (!proxyBase && typeof window !== 'undefined') {
    // Try to get configured subdomain from localStorage
    const savedSubdomain = (window.localStorage.getItem('settings/cloudflare/cfSubdomain')
      || window.localStorage.getItem('settings/cloudflare/subdomain'))
      ?.replace(/^["']|["']$/g, '')
      ?.trim()

    if (savedSubdomain) {
      proxyBase = `https://airi-cors-proxy.${savedSubdomain}.workers.dev`
    }
  }

  if (!proxyBase) {
    proxyBase = 'https://airi-cors-proxy.r1ch4rd.workers.dev'
  }

  const cleanBase = proxyBase.replace(/\/+$/, '')
  return `${cleanBase}/cors-proxy?url=${encodeURIComponent(targetUrl)}`
}

/**
 * Installs a global transparent fetch interceptor on Web/Browser SPA
 * to route CORS-restricted endpoints through the user's deployed CORS proxy worker.
 */
export function setupWebCorsProxy(options?: {
  getProxyBase?: () => string | undefined
  getUserPatterns?: () => string[] | undefined
}): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function')
    return

  // Avoid multiple installations
  if ((window as any).__AIRI_CORS_PROXY_INSTALLED__)
    return
  (window as any).__AIRI_CORS_PROXY_INSTALLED__ = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let urlString = ''
    if (typeof input === 'string') {
      urlString = input
    }
    else if (input instanceof URL) {
      urlString = input.toString()
    }
    else if (input instanceof Request) {
      urlString = input.url
    }

    const userPatterns = options?.getUserPatterns?.()
    if (isCorsBypassTarget(urlString, userPatterns)) {
      const proxyBase = options?.getProxyBase?.()
      const proxiedUrl = formatCorsProxyUrl(urlString, proxyBase)

      // If input was a Request object, clone and adjust URL
      if (input instanceof Request) {
        const newHeaders = new Headers(input.headers)
        if (init?.headers) {
          const initHeaders = new Headers(init.headers)
          initHeaders.forEach((val, key) => newHeaders.set(key, val))
        }

        const newRequest = new Request(proxiedUrl, {
          method: init?.method || input.method,
          headers: newHeaders,
          body: init?.body !== undefined ? init.body : (input.method !== 'GET' && input.method !== 'HEAD' ? input.body : undefined),
          mode: 'cors',
          credentials: init?.credentials || input.credentials,
          signal: init?.signal || input.signal,
        })
        return originalFetch(newRequest)
      }

      return originalFetch(proxiedUrl, {
        ...init,
        mode: 'cors',
      })
    }

    return originalFetch(input, init)
  }
}
