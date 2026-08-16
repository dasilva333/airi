import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  cloudflareServiceDeployCorsProxy,
  cloudflareServiceFetchEdgeVault,
  cloudflareServiceSaveEdgeVault,
  discordServiceCloudflareOAuth,
  discordServiceGetCloudflareSubdomain,
  discordServiceSetCloudflareSubdomain,
} from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface CloudflareOAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn?: number
  accountId?: string
}

const CLOUDFLARE_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const AUTH_ENDPOINT = 'https://dash.cloudflare.com/oauth2/auth'
const TOKEN_ENDPOINT = 'https://dash.cloudflare.com/oauth2/token'

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateWebPkce(): Promise<{ codeVerifier: string, codeChallenge: string }> {
  const randomBytes = new Uint8Array(32)
  window.crypto.getRandomValues(randomBytes)
  const codeVerifier = base64UrlEncode(randomBytes)
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hash = await window.crypto.subtle.digest('SHA-256', data)
  const codeChallenge = base64UrlEncode(new Uint8Array(hash))
  return { codeVerifier, codeChallenge }
}

export const useCloudflareStore = defineStore('cloudflare', () => {
  // Fallback migration from legacy settings/discord/... keys if present
  let initialTokens: CloudflareOAuthTokens | null = null
  let initialAccountId = ''
  let initialApiToken = ''

  if (typeof localStorage !== 'undefined') {
    const rawTokens = localStorage.getItem('settings/discord/cfOAuthTokens')
    if (rawTokens) {
      try {
        initialTokens = JSON.parse(rawTokens)
      }
      catch {}
    }
    const rawAccountId = localStorage.getItem('settings/discord/cfAccountId')
    if (rawAccountId) {
      try {
        initialAccountId = JSON.parse(rawAccountId)
      }
      catch {
        initialAccountId = rawAccountId
      }
    }
    const rawApiToken = localStorage.getItem('settings/discord/cfApiToken')
    if (rawApiToken) {
      try {
        initialApiToken = JSON.parse(rawApiToken)
      }
      catch {
        initialApiToken = rawApiToken
      }
    }
  }

  const cfOAuthTokens = useLocalStorageManualReset<CloudflareOAuthTokens | null>(
    'settings/cloudflare/cfOAuthTokens',
    initialTokens,
  )
  const cfAccountId = useLocalStorageManualReset<string>(
    'settings/cloudflare/cfAccountId',
    initialAccountId,
  )
  const cfApiToken = useLocalStorageManualReset<string>(
    'settings/cloudflare/cfApiToken',
    initialApiToken,
  )
  const cfSubdomain = useLocalStorageManualReset<string>(
    'settings/cloudflare/cfSubdomain',
    '',
  )

  const isAuthenticating = ref(false)
  const authError = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(cfOAuthTokens.value?.accessToken || cfApiToken.value.trim()))
  const activeAccessToken = computed(() => cfOAuthTokens.value?.accessToken || cfApiToken.value.trim() || '')
  const activeAccountId = computed(() => cfAccountId.value || cfOAuthTokens.value?.accountId || '')

  const isElectron = typeof window !== 'undefined' && !!(window as any).electron
  const invokeCloudflareOAuth = isElectron ? useElectronEventaInvoke(discordServiceCloudflareOAuth) : null
  const invokeGetSubdomain = isElectron ? useElectronEventaInvoke(discordServiceGetCloudflareSubdomain) : null
  const invokeSetSubdomain = isElectron ? useElectronEventaInvoke(discordServiceSetCloudflareSubdomain) : null
  const invokeSaveEdgeVault = isElectron ? useElectronEventaInvoke(cloudflareServiceSaveEdgeVault) : null
  const invokeFetchEdgeVault = isElectron ? useElectronEventaInvoke(cloudflareServiceFetchEdgeVault) : null
  const invokeDeployCorsProxy = isElectron ? useElectronEventaInvoke(cloudflareServiceDeployCorsProxy) : null

  async function authenticateWithCloudflare() {
    isAuthenticating.value = true
    authError.value = null

    try {
      if (isElectron && invokeCloudflareOAuth) {
        const res = await invokeCloudflareOAuth()
        if (res) {
          cfOAuthTokens.value = {
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            expiresIn: res.expiresIn,
            accountId: res.accountId,
          }
          if (res.accountId) {
            cfAccountId.value = res.accountId
          }
          void getCloudflareSubdomain().catch(() => {})
        }
        return res
      }

      // Web Browser & Mobile PKCE Popup / Redirect Flow
      const { codeVerifier, codeChallenge } = await generateWebPkce()
      const randomState = base64UrlEncode(window.crypto.getRandomValues(new Uint8Array(16)))
      const redirectUri = 'http://localhost:8976/oauth/callback'

      const authUrl = new URL(AUTH_ENDPOINT)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('client_id', CLOUDFLARE_OAUTH_CLIENT_ID)
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('scope', 'account:read user:read workers:write workers_kv:write workers_routes:write workers_scripts:write offline_access')
      authUrl.searchParams.append('state', randomState)
      authUrl.searchParams.append('code_challenge', codeChallenge)
      authUrl.searchParams.append('code_challenge_method', 'S256')

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cf_oauth_verifier', codeVerifier)
        sessionStorage.setItem('cf_oauth_state', randomState)
      }

      // Open popup for web authorization
      const popup = window.open(authUrl.toString(), 'CloudflareAuth', 'width=600,height=750')
      if (!popup) {
        window.location.href = authUrl.toString()
        return
      }

      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkInterval)
            window.removeEventListener('message', handleMessage)
            isAuthenticating.value = false
            resolve(cfOAuthTokens.value)
          }
        }, 800)

        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'CLOUDFLARE_OAUTH_CODE') {
            clearInterval(checkInterval)
            window.removeEventListener('message', handleMessage)
            popup.close()

            const code = event.data.code
            try {
              const tokenEndpoint = isElectron
                ? TOKEN_ENDPOINT
                : (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? '/api/cf-oauth-token'
                    : (cfSubdomain.value ? `https://airi-cors-proxy.${cfSubdomain.value}.workers.dev/cors-proxy?url=${encodeURIComponent(TOKEN_ENDPOINT)}` : TOKEN_ENDPOINT))

              const tokenRes = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  client_id: CLOUDFLARE_OAUTH_CLIENT_ID,
                  code_verifier: codeVerifier,
                  code,
                  redirect_uri: redirectUri,
                }),
              })

              const tokenData: any = await tokenRes.json()
              if (tokenData.access_token) {
                let accountId = tokenData.account_id || ''
                if (!accountId) {
                  try {
                    const accRes = await fetch(`${getCfApiBaseUrl()}/accounts`, {
                      headers: { Authorization: `Bearer ${tokenData.access_token}` },
                    })
                    if (accRes.ok) {
                      const accData: any = await accRes.json()
                      if (accData.result?.[0]?.id) {
                        accountId = accData.result[0].id
                      }
                    }
                  }
                  catch (e) {
                    console.warn('[useCloudflareStore] Failed to auto-fetch account ID:', e)
                  }
                }

                cfOAuthTokens.value = {
                  accessToken: tokenData.access_token,
                  refreshToken: tokenData.refresh_token,
                  expiresIn: tokenData.expires_in,
                  accountId,
                }
                if (accountId) {
                  cfAccountId.value = accountId
                }
                // Auto-fetch subdomain on login
                void getCloudflareSubdomain().catch(() => {})
                resolve(cfOAuthTokens.value)
              }
              else {
                reject(new Error(tokenData.error_description || 'Token exchange failed.'))
              }
            }
            catch (e) {
              reject(e)
            }
          }
        }

        window.addEventListener('message', handleMessage)
      })
    }
    catch (err: any) {
      authError.value = err?.message || String(err)
      throw err
    }
    finally {
      isAuthenticating.value = false
    }
  }

  function getCfApiBaseUrl(): string {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return '/api/cloudflare'
    }
    return 'https://api.cloudflare.com/client/v4'
  }

  async function getCloudflareSubdomain(): Promise<string | null> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken)
      return cfSubdomain.value || null

    if (isElectron && invokeGetSubdomain) {
      try {
        const res = await invokeGetSubdomain({ apiToken, accountId })
        if (res.success && res.subdomain) {
          cfSubdomain.value = res.subdomain
          return res.subdomain
        }
      }
      catch {}
    }

    // Non-Electron (Web & Mobile) REST API fetch
    if (accountId) {
      try {
        const res = await fetch(`${getCfApiBaseUrl()}/accounts/${accountId}/workers/subdomain`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        })
        if (res.ok) {
          const data: any = await res.json()
          if (data.result?.subdomain) {
            cfSubdomain.value = data.result.subdomain
            return data.result.subdomain
          }
        }
      }
      catch (e) {
        console.warn('[useCloudflareStore] Failed to fetch subdomain via REST API:', e)
      }
    }

    return cfSubdomain.value || null
  }

  async function setCloudflareSubdomain(subdomain: string): Promise<string> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken)
      throw new Error('Cloudflare access token missing.')
    if (!invokeSetSubdomain)
      throw new Error('Subdomain registration unavailable in non-Electron environment.')
    const res = await invokeSetSubdomain({ apiToken, accountId, subdomain })
    if (!res.success || !res.subdomain) {
      throw new Error(res.error || 'Subdomain registration failed.')
    }
    cfSubdomain.value = res.subdomain
    return res.subdomain
  }

  async function deployCorsProxy(): Promise<{ workerUrl: string }> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken)
      throw new Error('Cloudflare access token missing.')

    if (isElectron && invokeDeployCorsProxy) {
      const res = await invokeDeployCorsProxy({ apiToken, accountId, targetSubdomain: cfSubdomain.value })
      if (!res.success || !res.workerUrl) {
        throw new Error(res.error || 'Failed to deploy Web CORS Reverse-Proxy Worker.')
      }
      return { workerUrl: res.workerUrl }
    }

    // On Web / Mobile, worker was deployed or is queried via subdomain
    const sub = cfSubdomain.value || await getCloudflareSubdomain()
    return { workerUrl: `https://airi-cors-proxy.${sub || 'r1ch4rd'}.workers.dev` }
  }

  async function saveToEdgeVault(vaultData: Record<string, any>) {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken)
      throw new Error('Cloudflare access token missing.')
    if (isElectron && invokeSaveEdgeVault) {
      const res = await invokeSaveEdgeVault({ apiToken, accountId, vaultData })
      if (!res.success) {
        throw new Error(res.error || 'Failed to save to Edge Key Vault.')
      }
      return res
    }
    return { success: true }
  }

  async function fetchFromEdgeVault(): Promise<Record<string, any> | null> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken || !accountId)
      return null

    if (isElectron && invokeFetchEdgeVault) {
      try {
        const res = await invokeFetchEdgeVault({ apiToken, accountId })
        return res.success && res.vaultData ? res.vaultData : null
      }
      catch {
        return null
      }
    }

    // Non-Electron (Web & Mobile) REST fetch
    try {
      // 1. Direct or Dev Proxy to Cloudflare KV REST API
      const apiBase = getCfApiBaseUrl()
      const listRes = await fetch(`${apiBase}/accounts/${accountId}/storage/kv/namespaces`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      if (listRes.ok) {
        const listData: any = await listRes.json()
        const vaultNs = listData.result?.find((n: any) => n.title === 'airi-edge-vault')
        if (vaultNs?.id) {
          const valRes = await fetch(`${apiBase}/accounts/${accountId}/storage/kv/namespaces/${vaultNs.id}/values/vault/credentials`, {
            headers: { Authorization: `Bearer ${apiToken}` },
          })
          if (valRes.ok) {
            const raw = await valRes.text()
            try {
              return JSON.parse(raw)
            }
            catch {
              return raw as any
            }
          }
        }
      }
    }
    catch (e) {
      console.warn('[useCloudflareStore] Direct REST KV query failed, trying CORS proxy fallback...', e)
    }

    // 2. Production Web CORS Proxy fallback
    if (cfSubdomain.value) {
      try {
        const proxyBase = `https://airi-cors-proxy.${cfSubdomain.value}.workers.dev/cors-proxy?url=`
        const kvListUrl = encodeURIComponent(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`)
        const listRes = await fetch(proxyBase + kvListUrl, {
          headers: { Authorization: `Bearer ${apiToken}` },
        })
        const listData: any = await listRes.json()
        const vaultNs = listData.result?.find((n: any) => n.title === 'airi-edge-vault')
        if (vaultNs?.id) {
          const valUrl = encodeURIComponent(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${vaultNs.id}/values/vault/credentials`)
          const valRes = await fetch(proxyBase + valUrl, {
            headers: { Authorization: `Bearer ${apiToken}` },
          })
          if (valRes.ok) {
            return await valRes.json()
          }
        }
      }
      catch {
        return null
      }
    }

    return null
  }

  function logout() {
    cfOAuthTokens.value = null
    authError.value = null
  }

  return {
    cfOAuthTokens,
    cfAccountId,
    cfApiToken,
    cfSubdomain,
    isAuthenticating,
    authError,
    isAuthenticated,
    activeAccessToken,
    activeAccountId,
    authenticateWithCloudflare,
    getCloudflareSubdomain,
    setCloudflareSubdomain,
    deployCorsProxy,
    saveToEdgeVault,
    fetchFromEdgeVault,
    logout,
  }
})
