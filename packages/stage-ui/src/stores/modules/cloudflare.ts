import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { discordServiceCloudflareOAuth } from '@proj-airi/stage-shared'
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

  const isAuthenticating = ref(false)
  const authError = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(cfOAuthTokens.value?.accessToken || cfApiToken.value.trim()))
  const activeAccessToken = computed(() => cfOAuthTokens.value?.accessToken || cfApiToken.value.trim() || '')
  const activeAccountId = computed(() => cfAccountId.value || cfOAuthTokens.value?.accountId || '')

  const isElectron = typeof window !== 'undefined' && !!(window as any).electron
  const invokeCloudflareOAuth = isElectron ? useElectronEventaInvoke(discordServiceCloudflareOAuth) : null

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

  function logout() {
    cfOAuthTokens.value = null
    authError.value = null
  }

  return {
    cfOAuthTokens,
    cfAccountId,
    cfApiToken,
    isAuthenticating,
    authError,
    isAuthenticated,
    activeAccessToken,
    activeAccountId,
    authenticateWithCloudflare,
    logout,
  }
})
