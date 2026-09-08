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

import { useSyncEngineStore } from '../sync-engine'
import {
  base64UrlEncode,
  buildCloudflareOAuthUrl,
  CLOUDFLARE_EDGE_VAULT_KEY,
  CLOUDFLARE_EDGE_VAULT_NAMESPACE,
  CLOUDFLARE_OAUTH_CLIENT_ID,
  CLOUDFLARE_TOKEN_ENDPOINT,
  deriveCodeChallenge,
  formatEdgeVaultPayload,
  getCorsProxiedEndpoints,
  parseEdgeVaultPayload,
  parseOAuthCallbackInput,
  resolveAccountId,
  sanitizeWorkersSubdomain,
} from './cloudflare-auth'

export interface CloudflareOAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn?: number
  accountId?: string
}

const TOKEN_ENDPOINT = CLOUDFLARE_TOKEN_ENDPOINT

async function generateWebPkce(): Promise<{ codeVerifier: string, codeChallenge: string }> {
  const randomBytes = new Uint8Array(32)
  window.crypto.getRandomValues(randomBytes)
  const codeVerifier = base64UrlEncode(randomBytes)
  const codeChallenge = await deriveCodeChallenge(codeVerifier, window.crypto.subtle)
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

  const isHubOpen = ref(false)
  const isConnectOpen = ref(false)

  const isElectron = typeof window !== 'undefined' && !!(window as any).electron
  const invokeCloudflareOAuth = isElectron ? useElectronEventaInvoke(discordServiceCloudflareOAuth) : null
  const invokeGetSubdomain = isElectron ? useElectronEventaInvoke(discordServiceGetCloudflareSubdomain) : null
  const invokeSetSubdomain = isElectron ? useElectronEventaInvoke(discordServiceSetCloudflareSubdomain) : null
  const invokeSaveEdgeVault = isElectron ? useElectronEventaInvoke(cloudflareServiceSaveEdgeVault) : null
  const invokeFetchEdgeVault = isElectron ? useElectronEventaInvoke(cloudflareServiceFetchEdgeVault) : null
  const invokeDeployCorsProxy = isElectron ? useElectronEventaInvoke(cloudflareServiceDeployCorsProxy) : null

  function getCorsProxiedUrls(rawUrl: string): string[] {
    const isViteDev = Boolean(
      import.meta.env?.DEV
        && !isElectron
        && typeof window !== 'undefined'
        && !(window as any)?.Capacitor?.isNativePlatform?.()
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        && window.location.port,
    )

    return getCorsProxiedEndpoints(rawUrl, {
      isElectron,
      isViteDev,
      cfSubdomain: cfSubdomain.value,
    })
  }

  async function fetchWithCfProxy(rawUrl: string, init?: RequestInit): Promise<Response> {
    const urls = getCorsProxiedUrls(rawUrl)
    let lastError: any = null
    for (const u of urls) {
      try {
        const res = await fetch(u, init)
        if (res.ok) {
          return res
        }
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          return res
        }
      }
      catch (e) {
        lastError = e
      }
    }
    throw lastError || new Error(`Failed to fetch ${rawUrl} via CORS proxy`)
  }

  async function autoRestoreEdgeVault(): Promise<{ success: boolean, bucket?: string, error?: string }> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken || !accountId) {
      return { success: false, error: 'Not authenticated with Cloudflare' }
    }

    try {
      const syncStore = useSyncEngineStore()
      const vault = await fetchFromEdgeVault()
      if (vault && vault.s3Endpoint && vault.s3Bucket) {
        syncStore.s3Endpoint = vault.s3Endpoint
        syncStore.s3Bucket = vault.s3Bucket
        syncStore.s3Region = vault.s3Region || 'auto'
        syncStore.s3AccessKeyId = vault.s3AccessKeyId || ''
        syncStore.s3SecretAccessKey = vault.s3SecretAccessKey || ''
        syncStore.activeProvider = 's3'
        syncStore.syncEnabled = true
        console.info('[useCloudflareStore] Auto-restored Edge Vault credentials into SyncEngineStore, bucket:', vault.s3Bucket)
        return { success: true, bucket: vault.s3Bucket }
      }
      return { success: false, error: 'No Edge Vault credentials found in Cloudflare KV' }
    }
    catch (err: any) {
      console.warn('[useCloudflareStore] Auto-restore Edge Vault failed:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }

  async function exchangeAuthCode(code: string, customVerifier?: string) {
    if (!code)
      return null

    const effectiveVerifier = customVerifier
      || (typeof window !== 'undefined' ? (localStorage.getItem('cf_oauth_verifier') || sessionStorage.getItem('cf_oauth_verifier') || '') : '')

    const redirectUri = 'http://localhost:8976/oauth/callback'
    const isViteDev = Boolean(
      import.meta.env?.DEV
        && !isElectron
        && typeof window !== 'undefined'
        && !(window as any)?.Capacitor?.isNativePlatform?.()
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        && window.location.port,
    )

    const endpointsToTry: string[] = []

    if (isElectron) {
      endpointsToTry.push(TOKEN_ENDPOINT)
    }
    else if (isViteDev) {
      endpointsToTry.push('/api/cf-oauth-token')
      endpointsToTry.push(TOKEN_ENDPOINT)
    }
    else {
      // In native mobile or web production, use CORS proxy worker, then direct endpoint
      if (cfSubdomain.value) {
        endpointsToTry.push(`https://airi-cors-proxy.${cfSubdomain.value}.workers.dev/cors-proxy?url=${encodeURIComponent(TOKEN_ENDPOINT)}`)
      }
      endpointsToTry.push(`https://airi-cors-proxy.r1ch4rd.workers.dev/cors-proxy?url=${encodeURIComponent(TOKEN_ENDPOINT)}`)
      endpointsToTry.push(TOKEN_ENDPOINT)
    }

    let tokenData: any = null
    let lastError: any = null

    for (const endpoint of endpointsToTry) {
      try {
        const tokenRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLOUDFLARE_OAUTH_CLIENT_ID,
            code_verifier: effectiveVerifier,
            code,
            redirect_uri: redirectUri,
          }),
        })

        const contentType = tokenRes.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
          // HTML index.html fallback from SPA webview, try next endpoint
          continue
        }

        const rawText = await tokenRes.text()
        try {
          const parsed = JSON.parse(rawText)
          if (parsed.access_token) {
            tokenData = parsed
            break
          }
          else if (parsed.error_description || parsed.error) {
            throw new Error(parsed.error_description || parsed.error)
          }
        }
        catch (e: any) {
          if (e.message && !e.message.includes('JSON')) {
            throw e
          }
        }
      }
      catch (err: any) {
        lastError = err
      }
    }

    if (!tokenData?.access_token) {
      throw lastError || new Error('Failed to exchange OAuth token with Cloudflare.')
    }

    let accountId = resolveAccountId(tokenData)
    if (!accountId) {
      try {
        const accRes = await fetch(`${getCfApiBaseUrl()}/accounts`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        if (accRes.ok) {
          const accData: any = await accRes.json()
          accountId = resolveAccountId(tokenData, accData)
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

    void getCloudflareSubdomain().catch(() => {})
    void autoRestoreEdgeVault().catch(() => {})
    return cfOAuthTokens.value
  }

  // Auto-detect OAuth code passed in URL hash / search params from mobile / web redirects
  if (typeof window !== 'undefined') {
    const parseUrlParams = () => {
      const searchParams = new URLSearchParams(window.location.search)
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
      const hashParams = new URLSearchParams(hashQuery)

      return searchParams.get('cf_code') || hashParams.get('cf_code')
    }

    const pendingCode = parseUrlParams()
    if (pendingCode) {
      console.info('[useCloudflareStore] Found OAuth code in URL on initialization, completing token exchange...')
      if (window.history.replaceState) {
        const cleanHash = window.location.hash.split('?')[0] || '#/'
        window.history.replaceState(null, '', window.location.pathname + cleanHash)
      }
      void exchangeAuthCode(pendingCode).then(async () => {
        console.info('[useCloudflareStore] Successfully completed URL OAuth exchange!')
        await autoRestoreEdgeVault()

        const pendingFlow = localStorage.getItem('cf_oauth_pending_flow')
        const returnRoute = localStorage.getItem('cf_oauth_return_route')
        localStorage.removeItem('cf_oauth_pending_flow')
        localStorage.removeItem('cf_oauth_return_route')

        if (pendingFlow) {
          isHubOpen.value = true
          if (typeof window !== 'undefined') {
            const targetRoute = returnRoute && returnRoute !== '#' && returnRoute !== '#/' && returnRoute !== '/'
              ? returnRoute
              : '#/settings'
            const targetHash = targetRoute.startsWith('#')
              ? targetRoute
              : (targetRoute.startsWith('/') ? `#${targetRoute}` : `/#/${targetRoute}`)
            if (window.location.hash !== targetHash) {
              window.location.hash = targetHash
            }
          }
        }
      }).catch((err) => {
        console.warn('[useCloudflareStore] Automatic URL OAuth exchange failed:', err?.message || err)
      })
    }
  }

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
          void autoRestoreEdgeVault().catch(() => {})
        }
        return res
      }

      // Web Browser & Mobile PKCE Popup / Redirect Flow
      const { codeVerifier, codeChallenge } = await generateWebPkce()
      const randomState = base64UrlEncode(window.crypto.getRandomValues(new Uint8Array(16)))
      const redirectUri = 'http://localhost:8976/oauth/callback'

      const authUrl = buildCloudflareOAuthUrl({
        redirectUri,
        state: randomState,
        codeChallenge,
      })

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cf_oauth_verifier', codeVerifier)
        sessionStorage.setItem('cf_oauth_state', randomState)
        localStorage.setItem('cf_oauth_verifier', codeVerifier)
        localStorage.setItem('cf_oauth_state', randomState)
        localStorage.setItem('cf_oauth_return_route', window.location.hash || window.location.pathname || '')
        localStorage.setItem('cf_oauth_pending_flow', 'true')
      }

      // Open popup or navigate for web/mobile authorization
      const popup = window.open(authUrl.toString(), 'CloudflareAuth', 'width=600,height=750')
      if (!popup) {
        window.location.href = authUrl.toString()
        return
      }

      return new Promise((resolve, reject) => {
        let isResolved = false
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('airi_cf_oauth_channel') : null

        const cleanup = () => {
          clearInterval(checkInterval)
          if (typeof window !== 'undefined') {
            window.removeEventListener('message', handleMessage)
            window.removeEventListener('storage', handleStorage)
          }
          if (channel) {
            channel.close()
          }
          try {
            popup?.close()
          }
          catch {}
        }

        const checkInterval = setInterval(() => {
          if (popup?.closed) {
            cleanup()
            isAuthenticating.value = false
            resolve(cfOAuthTokens.value)
          }
        }, 800)

        const handleAuthCode = async (code: string) => {
          if (isResolved || !code)
            return
          isResolved = true
          cleanup()

          try {
            const tokens = await exchangeAuthCode(code, codeVerifier)
            isAuthenticating.value = false
            resolve(tokens)
          }
          catch (err: any) {
            authError.value = err?.message || String(err)
            isAuthenticating.value = false
            reject(err)
          }
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'CLOUDFLARE_OAUTH_CODE' || event.data?.type === 'CLOUDFLARE_AUTH_CALLBACK') {
            handleAuthCode(event.data.code)
          }
        }

        const handleStorage = (event: StorageEvent) => {
          if (event.key === 'airi_cf_oauth_callback' && event.newValue) {
            try {
              const parsed = JSON.parse(event.newValue)
              if (parsed.code) {
                handleAuthCode(parsed.code)
              }
            }
            catch {}
          }
        }

        if (typeof window !== 'undefined') {
          window.addEventListener('message', handleMessage)
          window.addEventListener('storage', handleStorage)
        }
        if (channel) {
          channel.onmessage = (event) => {
            if (event.data?.code) {
              handleAuthCode(event.data.code)
            }
          }
        }
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
    const isViteDev = Boolean(
      import.meta.env?.DEV
        && !isElectron
        && typeof window !== 'undefined'
        && !(window as any)?.Capacitor?.isNativePlatform?.()
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        && window.location.port,
    )

    if (isViteDev) {
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
        const res = await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
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

    const cleanSubdomain = sanitizeWorkersSubdomain(subdomain)

    if (isElectron && invokeSetSubdomain) {
      const res = await invokeSetSubdomain({ apiToken, accountId, subdomain: cleanSubdomain })
      if (!res.success || !res.subdomain) {
        throw new Error(res.error || 'Subdomain registration failed.')
      }
      cfSubdomain.value = res.subdomain
      return res.subdomain
    }

    // Non-Electron (Web & Mobile) REST API PUT
    const res = await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subdomain: cleanSubdomain }),
    })
    if (!res.ok) {
      const errData: any = await res.json().catch(() => ({}))
      throw new Error(errData.errors?.[0]?.message || 'Failed to claim workers.dev subdomain.')
    }
    cfSubdomain.value = cleanSubdomain
    return cleanSubdomain
  }

  async function deployCorsProxy(): Promise<boolean> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken || !accountId)
      return false

    if (isElectron && invokeDeployCorsProxy) {
      try {
        const res = await invokeDeployCorsProxy({ apiToken, accountId })
        return Boolean(res.success)
      }
      catch (e) {
        console.warn('[useCloudflareStore] Failed to deploy CORS proxy via Electron:', e)
        return false
      }
    }

    return true
  }

  async function saveToEdgeVault(vaultData: Record<string, any>) {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken || !accountId)
      throw new Error('Cloudflare access token missing.')

    if (isElectron && invokeSaveEdgeVault) {
      const res = await invokeSaveEdgeVault({ apiToken, accountId, vaultData })
      if (!res.success) {
        throw new Error(res.error || 'Failed to save to Edge Key Vault.')
      }
      return res
    }

    // Non-Electron (Web & Mobile) REST API with CORS proxy
    try {
      const listRes = await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      let nsId = ''
      if (listRes.ok) {
        const listData: any = await listRes.json()
        const existing = listData.result?.find((n: any) => n.title === CLOUDFLARE_EDGE_VAULT_NAMESPACE)
        if (existing?.id) {
          nsId = existing.id
        }
      }
      if (!nsId) {
        const createRes = await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: CLOUDFLARE_EDGE_VAULT_NAMESPACE }),
        })
        if (createRes.ok) {
          const createData: any = await createRes.json()
          nsId = createData.result?.id
        }
      }
      if (nsId) {
        await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${nsId}/values/${CLOUDFLARE_EDGE_VAULT_KEY}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'text/plain',
          },
          body: formatEdgeVaultPayload(vaultData),
        })
      }
      return { success: true }
    }
    catch (e) {
      console.warn('[useCloudflareStore] Failed to save Edge Vault via REST:', e)
      return { success: false, error: String(e) }
    }
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

    // Non-Electron (Web & Mobile) REST fetch with CORS proxy
    try {
      const listRes = await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      if (listRes.ok) {
        const listData: any = await listRes.json()
        const vaultNs = listData.result?.find((n: any) => n.title === CLOUDFLARE_EDGE_VAULT_NAMESPACE)
        if (vaultNs?.id) {
          const valRes = await fetchWithCfProxy(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${vaultNs.id}/values/${CLOUDFLARE_EDGE_VAULT_KEY}`, {
            headers: { Authorization: `Bearer ${apiToken}` },
          })
          if (valRes.ok) {
            const raw = await valRes.text()
            return parseEdgeVaultPayload(raw)
          }
        }
      }
    }
    catch (e) {
      console.warn('[useCloudflareStore] REST KV query failed:', e)
    }

    return null
  }

  async function verifyAndSetApiToken(token: string): Promise<string> {
    const cleanToken = token.trim()
    if (!cleanToken) {
      throw new Error('API Token is required')
    }

    const apiBase = getCfApiBaseUrl()
    let verified = false
    let accountId = ''

    // 1. Try /user/tokens/verify
    try {
      const verifyRes = await fetch(`${apiBase}/user/tokens/verify`, {
        headers: { Authorization: `Bearer ${cleanToken}` },
      })
      if (verifyRes.ok) {
        const verifyData: any = await verifyRes.json()
        if (verifyData.result?.status === 'active' || verifyData.success) {
          verified = true
        }
      }
    }
    catch (e) {
      console.warn('[useCloudflareStore] Direct /user/tokens/verify check:', e)
    }

    // 2. Fetch accounts list to confirm validity and find accountId
    try {
      const accRes = await fetch(`${apiBase}/accounts`, {
        headers: { Authorization: `Bearer ${cleanToken}` },
      })
      if (accRes.ok) {
        const accData: any = await accRes.json()
        if (accData.success && accData.result?.length > 0) {
          verified = true
          accountId = accData.result[0]?.id || ''
        }
      }
      else if (!verified) {
        const errData: any = await accRes.json().catch(() => ({}))
        throw new Error(errData.errors?.[0]?.message || 'Invalid Cloudflare API token or unauthorized.')
      }
    }
    catch (e: any) {
      if (!verified) {
        throw new Error(e?.message || 'Failed to verify Cloudflare API token. Check network or token permissions.')
      }
    }

    if (!verified) {
      throw new Error('Cloudflare API token verification failed. Please ensure the token is active.')
    }

    cfApiToken.value = cleanToken
    cfOAuthTokens.value = null
    if (accountId) {
      cfAccountId.value = accountId
    }

    void getCloudflareSubdomain().catch(() => {})
    void autoRestoreEdgeVault().catch(() => {})
    return cleanToken
  }

  async function handleManualCallbackInput(input: string, customVerifier?: string): Promise<CloudflareOAuthTokens | null> {
    const code = parseOAuthCallbackInput(input)
    const tokens = await exchangeAuthCode(code, customVerifier)
    isAuthenticating.value = false
    return tokens
  }

  function logout() {
    cfOAuthTokens.value = null
    cfApiToken.value = ''
    cfAccountId.value = ''
    authError.value = null
    isHubOpen.value = false
    isConnectOpen.value = false
  }

  return {
    cfOAuthTokens,
    cfAccountId,
    cfApiToken,
    cfSubdomain,
    isAuthenticating,
    authError,
    isAuthenticated,
    isHubOpen,
    isConnectOpen,
    activeAccessToken,
    activeAccountId,
    authenticateWithCloudflare,
    verifyAndSetApiToken,
    handleManualCallbackInput,
    exchangeAuthCode,
    getCloudflareSubdomain,
    setCloudflareSubdomain,
    deployCorsProxy,
    saveToEdgeVault,
    fetchFromEdgeVault,
    autoRestoreEdgeVault,
    logout,
  }
})
