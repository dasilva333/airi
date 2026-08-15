import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
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

  async function authenticateWithCloudflare() {
    if (!invokeCloudflareOAuth) {
      const msg = 'Cloudflare OAuth authentication requires the Electron desktop application.'
      authError.value = msg
      throw new Error(msg)
    }

    isAuthenticating.value = true
    authError.value = null
    try {
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
        // Auto-fetch subdomain on login
        void getCloudflareSubdomain().catch(() => {})
      }
      return res
    }
    catch (err: any) {
      authError.value = err?.message || String(err)
      throw err
    }
    finally {
      isAuthenticating.value = false
    }
  }

  async function getCloudflareSubdomain(): Promise<string | null> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken || !invokeGetSubdomain)
      return cfSubdomain.value || null
    try {
      const res = await invokeGetSubdomain({ apiToken, accountId })
      if (res.success && res.subdomain) {
        cfSubdomain.value = res.subdomain
        return res.subdomain
      }
      return cfSubdomain.value || null
    }
    catch {
      return cfSubdomain.value || null
    }
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

  async function saveToEdgeVault(vaultData: Record<string, any>) {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken)
      throw new Error('Cloudflare access token missing.')
    if (!invokeSaveEdgeVault)
      throw new Error('Edge Key Vault saving unavailable in non-Electron environment.')
    const res = await invokeSaveEdgeVault({ apiToken, accountId, vaultData })
    if (!res.success) {
      throw new Error(res.error || 'Failed to save to Edge Key Vault.')
    }
    return res
  }

  async function fetchFromEdgeVault(): Promise<Record<string, any> | null> {
    const apiToken = activeAccessToken.value
    const accountId = activeAccountId.value
    if (!apiToken || !invokeFetchEdgeVault)
      return null
    try {
      const res = await invokeFetchEdgeVault({ apiToken, accountId })
      return res.success && res.vaultData ? res.vaultData : null
    }
    catch {
      return null
    }
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
    saveToEdgeVault,
    fetchFromEdgeVault,
    logout,
  }
})
