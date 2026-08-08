<script setup lang="ts">
import { Button, FieldCheckbox, FieldInput } from '@proj-airi/ui'
import { format } from 'date-fns'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { useChatSessionStore } from '../../stores/chat/session-store'
import { buildSystemPrompt, useAiriCardStore } from '../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../stores/modules/consciousness'
import { useDiscordStore } from '../../stores/modules/discord'
import { useProvidersStore } from '../../stores/providers'
import { BrainModelPicker } from '../scenarios/chat'

const { t } = useI18n()
const discordStore = useDiscordStore()
const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()

const { activeCardId, activeCard } = storeToRefs(airiCardStore)
const { activeSessionId } = storeToRefs(chatSessionStore)

const {
  token,
  serviceStatus,
  isConnected,
  isConnecting,
  eventLog,
  configured,
  executionMode,
  ownerUsername,
  ownerUserId,
  cfAccountId,
  cfApiToken,
  cfOAuthTokens,
  cloudRelayInstances,
  visionEnabled,
  dmsEnabled,
} = storeToRefs(discordStore)

// Active Tab state: 'bot' | 'relay' | 'acl'
const activeTab = ref<'bot' | 'relay' | 'acl'>('bot')

// Dev console collapsed state
const devConsoleOpen = ref(false)

// Simulate dialog state
const simulateOpen = ref(false)
const simulateUsername = ref('TestUser')
const simulateContent = ref('Hello from simulated event!')

// Cloud Relay Form State
const showManualTokenInput = ref(false)
const selectedMemoryMode = ref<'fixed' | 'unlimited'>('unlimited')
const isDeployingRelay = ref(false)
const isOAuthAuthenticating = ref(false)

// Step 1: Deploy Session Selection Modal State
const deployModalOpen = ref(false)
const deployTargetSessionId = ref<string>('')
const deployNewSessionName = ref('Cloud Relay Session')

// Step 2: Review & Inspect Details Modal State
const inspectModalOpen = ref(false)
const selectedConsciousnessProvider = ref(consciousnessStore.activeProvider || 'openai')
const selectedConsciousnessModel = ref(consciousnessStore.activeModel || 'gpt-4o-mini')
const selectedHistoryDepth = ref<'prompt' | '10' | '50' | 'all'>('prompt')
const showSystemPromptPreview = ref(false)

const characterSessions = computed(() => {
  if (!activeCardId.value)
    return []
  const characterIndex = chatSessionStore.getCharacterIndex(activeCardId.value)
  if (!characterIndex)
    return []

  return Object.values(characterIndex.sessions).sort((a, b) => b.updatedAt - a.updatedAt)
})

const selectedSessionMeta = computed(() => {
  if (!deployTargetSessionId.value || deployTargetSessionId.value === 'new') {
    return {
      title: deployNewSessionName.value || 'New Dedicated Relay Session',
      messageCount: 0,
      universeId: 'global',
    }
  }
  return chatSessionStore.getSessionMeta(deployTargetSessionId.value) || {
    title: 'Selected Session',
    messageCount: 0,
    universeId: 'global',
  }
})

const targetSessionMessageCount = computed(() => {
  if (!deployTargetSessionId.value || deployTargetSessionId.value === 'new')
    return 0
  const msgs = chatSessionStore.getSessionMessages(deployTargetSessionId.value)
  if (msgs && msgs.length > 0)
    return msgs.length
  return selectedSessionMeta.value?.messageCount || 0
})

const availableHistoryDepths = computed(() => {
  const count = targetSessionMessageCount.value
  const options: Array<{ value: 'prompt' | '10' | '50' | 'all', label: string, desc: string }> = [
    {
      value: 'prompt',
      label: 'System Prompt Only',
      desc: 'Clean Slate — deploy persona without uploading past dialogue history',
    },
  ]

  if (count > 10) {
    options.push({
      value: '10',
      label: 'Last 10 Messages',
      desc: 'Include recent conversation context for quick continuity',
    })
  }

  if (count > 50) {
    options.push({
      value: '50',
      label: 'Last 50 Messages',
      desc: 'Include extended conversation context for deep coherence',
    })
  }

  if (count > 0) {
    options.push({
      value: 'all',
      label: `All Session History (${count} message${count > 1 ? 's' : ''})`,
      desc: 'Transfer complete timeline dialogue history to Cloudflare KV',
    })
  }

  return options
})

watch(availableHistoryDepths, (opts: Array<{ value: 'prompt' | '10' | '50' | 'all' }>) => {
  if (!opts.some((o: { value: string }) => o.value === selectedHistoryDepth.value)) {
    selectedHistoryDepth.value = 'prompt'
  }
}, { immediate: true })

const assembledSystemPrompt = computed(() => {
  return buildSystemPrompt(activeCard.value)
})

function handleProceedToInspection() {
  if (!deployTargetSessionId.value)
    return
  deployModalOpen.value = false
  inspectModalOpen.value = true
}

async function handleLaunchDeployment() {
  if (isDeployingRelay.value)
    return

  isDeployingRelay.value = true
  const toastId = toast.loading('1/3: Assembling character prompt & memory context...')

  try {
    const cardName = activeCard.value?.name || 'AIRI'
    const scriptName = `airi-${cardName.toLowerCase().replace(/[^a-z0]/g, '')}` || 'airi-cloud-relay'

    // Get configuration for selected consciousness provider via providersStore
    const providerId = selectedConsciousnessProvider.value || consciousnessStore.activeProvider || 'google'
    const providerConfig = providersStore.getProviderConfig(providerId) || {}
    const apiKey: string = (providerConfig.apiKey || providerConfig.token || providerConfig.secretKey || '') as string
    const baseUrl: string = (providerConfig.baseUrl || providerConfig.url || providerConfig.endpoint || '') as string

    // Auto-prompt PKCE login if tokens are missing
    if (!cfApiToken.value && !cfOAuthTokens.value?.accessToken) {
      toast.loading('Authenticating with Cloudflare via OAuth...', { id: toastId })
      await discordStore.authenticateWithCloudflare()
    }

    // Extract initial conversation history based on selectedHistoryDepth
    let initialHistory: Array<{ role: string, content: string }> | undefined
    if (selectedHistoryDepth.value !== 'prompt' && deployTargetSessionId.value && deployTargetSessionId.value !== 'new') {
      const rawMessages = chatSessionStore.getSessionMessages(deployTargetSessionId.value) || []
      let sliced = rawMessages
      if (selectedHistoryDepth.value === '10') {
        sliced = rawMessages.slice(-10)
      }
      else if (selectedHistoryDepth.value === '50') {
        sliced = rawMessages.slice(-50)
      }

      initialHistory = sliced
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m: any) => ({
          role: m.role as string,
          content: typeof m.content === 'string' ? m.content : (m.rawContent || String(m.content)),
        }))
    }

    toast.loading('2/3: Provisioning Cloudflare KV Namespace & Worker deployment...', { id: toastId })

    const res = await discordStore.deployCloudRelay({
      scriptName,
      characterPrompt: assembledSystemPrompt.value,
      characterName: cardName,
      llmBaseUrl: baseUrl,
      llmApiKey: apiKey,
      llmModel: selectedConsciousnessModel.value,
      memoryMode: selectedMemoryMode.value,
      cardId: activeCardId.value || 'default',
      sessionId: deployTargetSessionId.value,
      initialHistory,
    })

    toast.success(`🎉 ${cardName} is now LIVE 24/7 on Cloudflare Edge! (${res.workerUrl})`, { id: toastId })
    inspectModalOpen.value = false
  }
  catch (err: any) {
    console.error('[DiscordControlPlane] Deployment failed:', err)
    toast.error(`Deployment failed: ${err?.message || err}`, { id: toastId })
  }
  finally {
    isDeployingRelay.value = false
  }
}

function formatSessionDate(timestamp: number) {
  return format(timestamp, 'MMM d, yyyy HH:mm')
}

// ACL / Routing Form State
const globalFallbackMode = ref('ignore')

function handleStartStop() {
  if (isConnected.value || isConnecting.value) {
    discordStore.stopService()
  }
  else {
    discordStore.startService()
  }
}

function handleSimulate() {
  discordStore.simulateEvent({
    username: simulateUsername.value,
    content: simulateContent.value,
  })
  simulateOpen.value = false
}

function handleForceSync() {
  discordStore.forceCardSync({ name: '', avatarBase64: null })
}

async function handleCloudflareOAuth() {
  isOAuthAuthenticating.value = true
  try {
    await discordStore.authenticateWithCloudflare()
  }
  finally {
    isOAuthAuthenticating.value = false
  }
}

function getStatusColor(state: string) {
  switch (state) {
    case 'connected': return '#22c55e'
    case 'connecting': return '#f59e0b'
    case 'error': return '#ef4444'
    default: return '#6b7280'
  }
}

function getEventTypeColor(type: string) {
  switch (type) {
    case 'MESSAGE_CREATE': return '#22c55e'
    case 'MESSAGE_SEND': return '#3b82f6'
    case 'INTERACTION_CREATE': return '#8b5cf6'
    case 'READY':
    case 'SHARD_READY': return '#22c55e'
    case 'ERROR': return '#ef4444'
    case 'SIMULATE': return '#f59e0b'
    case 'FORCE_SYNC': return '#06b6d4'
    default: return '#9ca3af'
  }
}

function formatTimestamp(ts: number) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="discord-mission-control">
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Navigation Tabs: Bot Connection | Cloud Relay | Access & Routing    -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div class="mb-6 flex border-b border-neutral-200/80 dark:border-neutral-800">
      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all"
        :class="activeTab === 'bot' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="activeTab = 'bot'"
      >
        <div class="i-solar:plug-circle-bold-duotone text-base" />
        <span>🔌 Bot Connection</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all"
        :class="activeTab === 'relay' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="activeTab = 'relay'"
      >
        <div class="i-solar:cloud-bold-duotone text-base" />
        <span>🌐 Cloud Relay Studio</span>
        <span class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold uppercase">24/7 Edge</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-all"
        :class="activeTab === 'acl' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="activeTab = 'acl'"
      >
        <div class="i-solar:shield-keyhole-bold-duotone text-base" />
        <span>🔐 Access & Routing</span>
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 1: BOT CONNECTION (Desktop Gateway Service)                    -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'bot'" class="space-y-6">
      <!-- Section: Execution Target Mode Selector -->
      <section class="mc-section">
        <div class="mc-section-header">
          <h3>Execution Target Mode</h3>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="border rounded-xl p-3 text-left transition-all"
            :class="executionMode === 'local' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
            @click="executionMode = 'local'"
          >
            <div class="flex items-center gap-2 text-xs font-bold">
              <div class="i-solar:laptop-minimalistic-bold-duotone text-base text-primary-500" />
              <span>Local Desktop Runtime</span>
            </div>
            <div class="mt-1 text-[10px] text-neutral-400">
              Desktop app handles live Gateway WebSocket events directly while AIRI is running.
            </div>
          </button>

          <button
            type="button"
            class="border rounded-xl p-3 text-left transition-all"
            :class="executionMode === 'remote' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
            @click="executionMode = 'remote'"
          >
            <div class="flex items-center gap-2 text-xs font-bold">
              <div class="i-solar:cloud-bold-duotone text-base text-emerald-500" />
              <span>Cloud Relay (24/7 Edge)</span>
            </div>
            <div class="mt-1 text-[10px] text-neutral-400">
              Cloudflare Workers handle Discord Interactions webhooks round-the-clock even when PC is off.
            </div>
          </button>
        </div>
      </section>

      <section class="mc-section">
        <div class="mc-section-header">
          <h3>{{ t('settings.pages.modules.messaging-discord.connectivity.title') }}</h3>
        </div>

        <!-- Status Banner -->
        <div class="mc-status-banner" :class="`mc-status--${serviceStatus.state}`">
          <div class="mc-status-dot" :style="{ backgroundColor: getStatusColor(serviceStatus.state) }" />
          <div class="mc-status-info">
            <span class="mc-status-label">
              {{ t(`settings.pages.modules.messaging-discord.connectivity.${serviceStatus.state}`) }}
            </span>
            <span v-if="serviceStatus.ping !== null" class="mc-status-ping">
              {{ serviceStatus.ping }}ms
            </span>
          </div>
          <div v-if="serviceStatus.botUser" class="mc-bot-tag">
            {{ serviceStatus.botUser.tag }}
          </div>
        </div>

        <!-- Error Banner -->
        <div v-if="serviceStatus.error" class="mc-error-banner">
          <span class="mc-error-icon">⚠</span>
          <span>{{ serviceStatus.error }}</span>
        </div>

        <!-- Token Input -->
        <FieldInput
          v-model="token"
          type="password"
          :label="t('settings.pages.modules.messaging-discord.token')"
          :description="t('settings.pages.modules.messaging-discord.token-description')"
          :placeholder="t('settings.pages.modules.messaging-discord.token-placeholder')"
        />

        <!-- Primary Owner Username Input -->
        <FieldInput
          v-model="ownerUsername"
          label="Bot Owner / Primary Username"
          description="Your Discord handle (e.g. dasilva333). AIRI automatically resolves your account ID for owner privileges & memory sync."
          placeholder="e.g. dasilva333"
        />
        <div v-if="ownerUserId" class="text-[10px] text-neutral-400 font-mono">
          Resolved Owner ID: {{ ownerUserId }}
        </div>

        <!-- Start / Stop Button -->
        <div class="mc-action-row">
          <Button
            :label="isConnected || isConnecting
              ? t('settings.pages.modules.messaging-discord.actions.stop')
              : t('settings.pages.modules.messaging-discord.actions.start')"
            :variant="isConnected ? 'danger' : 'primary'"
            :disabled="!configured"
            @click="handleStartStop"
          />
        </div>
      </section>

      <!-- Section: Controls & Modalities -->
      <section class="mc-section">
        <div class="mc-section-header">
          <h3>{{ t('settings.pages.modules.messaging-discord.controls.title') }}</h3>
        </div>
        <div class="mc-controls-grid">
          <FieldCheckbox
            v-model="visionEnabled"
            :label="t('settings.pages.modules.messaging-discord.controls.vision')"
            :description="t('settings.pages.modules.messaging-discord.controls.vision-description')"
          />
          <FieldCheckbox
            v-model="dmsEnabled"
            label="Allow Direct Messages (DMs)"
            description="Enable or disable bot interactions (commands and chat) in private direct messages."
          />
        </div>
      </section>

      <!-- Section: Active Presence -->
      <section v-if="isConnected && serviceStatus.guilds.length > 0" class="mc-section">
        <div class="mc-section-header">
          <h3>{{ t('settings.pages.modules.messaging-discord.presence.title') }}</h3>
        </div>

        <div class="mc-guilds-list">
          <div
            v-for="guild in serviceStatus.guilds"
            :key="guild.id"
            class="mc-guild-item"
          >
            <img
              v-if="guild.icon"
              :src="guild.icon"
              :alt="guild.name"
              class="mc-guild-icon"
            >
            <div v-else class="mc-guild-icon mc-guild-icon--placeholder">
              {{ guild.name.charAt(0) }}
            </div>
            <span class="mc-guild-name">{{ guild.name }}</span>
            <span
              v-if="serviceStatus.activeChannelId"
              class="mc-active-badge"
            >
              Active
            </span>
          </div>
        </div>
      </section>

      <!-- Section: Debug Actions -->
      <section class="mc-section">
        <div class="mc-action-buttons">
          <Button
            :label="t('settings.pages.modules.messaging-discord.actions.force-sync')"
            variant="secondary"
            :disabled="!isConnected"
            @click="handleForceSync"
          />
          <Button
            :label="t('settings.pages.modules.messaging-discord.actions.simulate')"
            variant="secondary"
            @click="simulateOpen = !simulateOpen"
          />
          <Button
            :label="t('settings.pages.modules.messaging-discord.actions.restart')"
            variant="secondary"
            :disabled="!isConnected"
            @click="discordStore.stopService().then(() => discordStore.startService())"
          />
        </div>

        <!-- Simulate Dialog -->
        <div v-if="simulateOpen" class="mc-simulate-dialog">
          <FieldInput
            v-model="simulateUsername"
            :label="t('settings.pages.modules.messaging-discord.simulate-dialog.username')"
            :placeholder="t('settings.pages.modules.messaging-discord.simulate-dialog.username-placeholder')"
          />
          <FieldInput
            v-model="simulateContent"
            :label="t('settings.pages.modules.messaging-discord.simulate-dialog.content')"
            :placeholder="t('settings.pages.modules.messaging-discord.simulate-dialog.content-placeholder')"
          />
          <Button
            :label="t('settings.pages.modules.messaging-discord.simulate-dialog.send')"
            variant="primary"
            @click="handleSimulate"
          />
        </div>
      </section>

      <!-- Section: Developer Console -->
      <section class="mc-section">
        <div class="mc-section-header mc-section-header--clickable" @click="devConsoleOpen = !devConsoleOpen">
          <h3>{{ t('settings.pages.modules.messaging-discord.dev-console.title') }}</h3>
          <span class="mc-chevron" :class="{ 'mc-chevron--open': devConsoleOpen }">▶</span>
        </div>

        <div v-if="devConsoleOpen" class="mc-dev-console">
          <div v-if="eventLog.length > 0" class="mc-console-toolbar">
            <Button
              :label="t('settings.pages.modules.messaging-discord.actions.clear-log')"
              variant="secondary"
              @click="discordStore.clearEventLog()"
            />
          </div>
          <div v-if="eventLog.length === 0" class="mc-console-empty">
            {{ t('settings.pages.modules.messaging-discord.dev-console.empty') }}
          </div>
          <div v-else class="mc-console-log">
            <div
              v-for="(entry, idx) in [...eventLog].reverse()"
              :key="idx"
              class="mc-log-entry"
            >
              <span class="mc-log-time">{{ formatTimestamp(entry.timestamp) }}</span>
              <span
                class="mc-log-type"
                :style="{ color: getEventTypeColor(entry.type) }"
              >
                {{ entry.type }}
              </span>
              <span class="mc-log-summary">{{ entry.summary }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 2: CLOUD RELAY STUDIO (24/7 Edge Deployment)                    -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'relay'" class="space-y-6">
      <!-- Section 1: Cloudflare Edge Provisioning -->
      <section class="mc-section">
        <div class="mc-section-header">
          <div>
            <h3 class="text-sm font-bold">
              Cloudflare Edge Deployment Engine
            </h3>
            <p class="text-xs text-neutral-400">
              Deploy your active character to Cloudflare Workers for 24/7 response presence even when PC is powered off.
            </p>
          </div>
        </div>

        <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="i-solar:key-minimalistic-bold-duotone text-lg text-primary-500" />
              <h4 class="text-xs font-bold">
                Cloudflare Account Authentication
              </h4>
            </div>

            <button
              type="button"
              class="flex items-center gap-1 text-[11px] text-neutral-400 font-medium hover:text-primary-500"
              @click="showManualTokenInput = !showManualTokenInput"
            >
              <span>{{ showManualTokenInput ? 'Hide Manual Input' : 'Manual Input' }}</span>
              <div class="i-solar:alt-arrow-down-bold text-xs transition-transform" :class="{ 'rotate-180': showManualTokenInput }" />
            </button>
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <p class="text-[11px] text-neutral-400">
                Authenticate securely via browser using 1-click OAuth, or manually specify your Cloudflare credentials.
              </p>
              <div v-if="cfOAuthTokens" class="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-500 font-semibold">
                <span>✅ Authenticated via OAuth</span>
              </div>
            </div>

            <Button
              :label="isOAuthAuthenticating ? 'Authenticating...' : 'Authenticate with Cloudflare'"
              variant="primary"
              :disabled="isOAuthAuthenticating"
              @click="handleCloudflareOAuth"
            />
          </div>

          <!-- Collapsible Manual Input Form -->
          <div v-if="showManualTokenInput" class="mt-4 border-t border-neutral-200/60 pt-4 space-y-3 dark:border-neutral-800/60">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold">Manual Cloudflare API Token</span>
              <a
                href="https://dash.cloudflare.com/profile/api-tokens"
                target="_blank"
                rel="noopener"
                class="text-[10px] text-primary-500 hover:underline"
              >
                Get Cloudflare API Token ↗
              </a>
            </div>
            <FieldInput v-model="cfAccountId" label="Account ID" placeholder="32-char Cloudflare Account ID" />
            <FieldInput v-model="cfApiToken" type="password" label="API Token" placeholder="Workers & KV write token" />
          </div>
        </div>
      </section>

      <!-- Section 2: Memory Mode & Deployment Target -->
      <section class="mc-section">
        <div class="mc-section-header">
          <h3 class="text-sm font-bold">
            Edge Character Configuration
          </h3>
        </div>

        <div class="space-y-4">
          <!-- Memory Mode Selector -->
          <div>
            <label class="mb-1 block text-xs text-neutral-400 font-medium">Memory Window Mode</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="border rounded-xl p-3 text-left transition-all"
                :class="selectedMemoryMode === 'fixed' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
                @click="selectedMemoryMode = 'fixed'"
              >
                <div class="text-xs font-bold">
                  Fixed Mode (Assistant)
                </div>
                <div class="text-[10px] text-neutral-400">
                  Rolling 10-turn window. Fast & low cost.
                </div>
              </button>

              <button
                type="button"
                class="border rounded-xl p-3 text-left transition-all"
                :class="selectedMemoryMode === 'unlimited' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
                @click="selectedMemoryMode = 'unlimited'"
              >
                <div class="text-xs font-bold">
                  Unlimited Mode (Deep Coherence)
                </div>
                <div class="text-[10px] text-neutral-400">
                  Full conversation history with auto-compaction.
                </div>
              </button>
            </div>
          </div>

          <Button
            label="🚀 Deploy Character to Cloudflare Edge"
            variant="primary"
            :disabled="isDeployingRelay"
            @click="deployModalOpen = true"
          />
        </div>
      </section>

      <!-- Section 3: Active Deployed Relay Instances -->
      <section class="mc-section">
        <div class="mc-section-header">
          <h3 class="text-sm font-bold">
            Active Cloud Relay Instances
          </h3>
        </div>

        <div v-if="Object.keys(cloudRelayInstances).length > 0" class="space-y-3">
          <div
            v-for="(inst, key) in cloudRelayInstances"
            :key="key"
            class="border border-neutral-200/80 rounded-xl bg-white/70 p-4 space-y-2 dark:border-neutral-800/80 dark:bg-neutral-900/60"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 font-bold uppercase">
                  {{ inst.scriptName.slice(0, 4) }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs font-bold capitalize">
                      {{ inst.scriptName.replace(/-/g, ' ') }}
                    </h4>
                    <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-600 font-bold uppercase dark:text-emerald-400">Live ✅</span>
                    <span class="rounded-full bg-primary-500/15 px-2 py-0.5 text-[9px] text-primary-500 font-bold uppercase">
                      {{ inst.memoryMode === 'unlimited' ? 'Unlimited Memory' : 'Fixed 10-Turn' }}
                    </span>
                  </div>
                  <a :href="inst.workerUrl" target="_blank" class="text-[11px] text-primary-500 font-mono hover:underline">
                    {{ inst.workerUrl }} ↗
                  </a>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Button label="Sync Memories ↓" variant="secondary" />
                <Button label="Teardown" variant="danger" />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="border border-neutral-300 rounded-xl border-dashed p-6 text-center dark:border-neutral-800">
          <div class="i-solar:cloud-storage-bold-duotone mx-auto mb-1 text-2xl text-neutral-400" />
          <p class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
            No active Cloud Relay instances deployed yet.
          </p>
          <p class="text-[11px] text-neutral-400">
            Click "Deploy Character to Cloudflare Edge" above to launch your 24/7 character.
          </p>
        </div>
      </section>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 3: ACCESS & ROUTING (Channel ACL & Context Routing)            -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'acl'" class="space-y-6">
      <!-- Section 1: Global Routing Mode -->
      <section class="mc-section">
        <div class="mc-section-header">
          <h3 class="text-sm font-bold">
            Global Fallback Mode
          </h3>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <button
            type="button"
            class="border rounded-xl p-3 text-left transition-all"
            :class="globalFallbackMode === 'ignore' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
            @click="globalFallbackMode = 'ignore'"
          >
            <div class="text-xs font-bold">
              Strict Fallback (Ignore)
            </div>
            <div class="text-[10px] text-neutral-400">
              Unmapped channels are dropped. (Default / Safest)
            </div>
          </button>

          <button
            type="button"
            class="border rounded-xl p-3 text-left transition-all"
            :class="globalFallbackMode === 'shared' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
            @click="globalFallbackMode = 'shared'"
          >
            <div class="text-xs font-bold">
              Shared / Legacy
            </div>
            <div class="text-[10px] text-neutral-400">
              All channels share active desktop character & session.
            </div>
          </button>

          <button
            type="button"
            class="border rounded-xl p-3 text-left transition-all"
            :class="globalFallbackMode === 'auto-create' ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10' : 'border-neutral-200 dark:border-neutral-800'"
            @click="globalFallbackMode = 'auto-create'"
          >
            <div class="text-xs font-bold">
              Isolated Auto-Create
            </div>
            <div class="text-[10px] text-neutral-400">
              Auto-instantiate isolated sessions per channel/DM.
            </div>
          </button>
        </div>
      </section>

      <!-- Section 2: Channel Routing Matrix -->
      <section class="mc-section">
        <div class="mc-section-header flex items-center justify-between">
          <h3 class="text-sm font-bold">
            Channel & DM Context Routing Table
          </h3>
          <Button label="+ Add Channel Mapping" variant="secondary" />
        </div>

        <!-- Mock Routing Table -->
        <div class="overflow-hidden border border-neutral-200/80 rounded-xl bg-white/70 dark:border-neutral-800/80 dark:bg-neutral-900/60">
          <table class="w-full text-left text-xs">
            <thead class="border-b border-neutral-200/60 bg-neutral-50/50 text-[10px] text-neutral-400 font-bold uppercase dark:border-neutral-800 dark:bg-neutral-800/40">
              <tr>
                <th class="p-3">
                  Context Key / Channel
                </th>
                <th class="p-3">
                  Target Character
                </th>
                <th class="p-3">
                  Trigger Mode
                </th>
                <th class="p-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-200/40 dark:divide-neutral-800/40">
              <tr>
                <td class="p-3 font-mono">
                  channel-123456789 ( #lounge )
                </td>
                <td class="p-3 font-semibold">
                  AIRI
                </td>
                <td class="p-3">
                  <span class="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-500 font-bold">Mentions</span>
                </td>
                <td class="p-3 text-right">
                  <button type="button" class="text-xs text-neutral-400 hover:text-red-500">
                    Delete
                  </button>
                </td>
              </tr>
              <tr>
                <td class="p-3 font-mono">
                  dm-987654321 ( Direct Message )
                </td>
                <td class="p-3 font-semibold">
                  AIRI
                </td>
                <td class="p-3">
                  <span class="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-500 font-bold">All Messages</span>
                </td>
                <td class="p-3 text-right">
                  <button type="button" class="text-xs text-neutral-400 hover:text-red-500">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- DEPLOY SESSION SELECTION MODAL                                      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div
        v-if="deployModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <div class="max-w-lg w-full border border-neutral-200/80 rounded-2xl bg-white p-6 shadow-2xl space-y-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 flex items-center justify-center rounded-xl bg-primary-500/10 text-lg text-primary-500 font-bold">
                🚀
              </div>
              <div>
                <h3 class="text-sm font-bold">
                  Deploy Character to Cloudflare Edge
                </h3>
                <p class="text-[11px] text-neutral-400">
                  Select which Chat Session history to bind to this 24/7 Cloud Relay instance.
                </p>
              </div>
            </div>

            <button
              type="button"
              class="h-7 w-7 flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="deployModalOpen = false"
            >
              ✕
            </button>
          </div>

          <!-- Session Selection Options -->
          <div class="max-h-[50dvh] overflow-y-auto pr-1 space-y-3">
            <!-- Option: Start New Dedicated Relay Session -->
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 border border-emerald-500/30 rounded-2xl bg-emerald-500/10 py-3 text-xs text-emerald-600 font-bold transition-all active:scale-[0.98] hover:bg-emerald-500/20 dark:text-emerald-400"
              :class="{ 'ring-2 ring-emerald-500': deployTargetSessionId === 'new' }"
              @click="deployTargetSessionId = 'new'"
            >
              <div class="i-solar:add-circle-bold-duotone text-base" />
              <span>+ Start New Dedicated Relay Session</span>
            </button>

            <div v-if="deployTargetSessionId === 'new'" class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
              <FieldInput v-model="deployNewSessionName" label="New Session Name" placeholder="e.g. Cloud Relay Session" />
            </div>

            <div class="text-[11px] text-neutral-400 font-bold tracking-wider uppercase">
              Select Existing Timeline Session
            </div>

            <!-- Existing Sessions List -->
            <div
              v-for="session in characterSessions"
              :key="session.sessionId"
              :class="[
                'group relative flex flex-col gap-1 p-4 rounded-2xl border transition-all cursor-pointer text-left',
                deployTargetSessionId === session.sessionId
                  ? 'bg-primary-50/30 border-primary-500 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] dark:bg-primary-900/10 dark:border-primary-400'
                  : 'bg-neutral-50/50 border-neutral-200/80 dark:bg-neutral-900/40 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="deployTargetSessionId = session.sessionId"
            >
              <!-- Badges -->
              <div class="absolute right-4 top-4 flex items-center gap-2">
                <span
                  v-if="session.sessionId === activeSessionId"
                  class="rounded-full bg-primary-500 px-2 py-0.5 text-[9px] text-white font-black tracking-widest uppercase shadow-sm"
                >
                  Active GUI
                </span>
                <span
                  v-if="deployTargetSessionId === session.sessionId"
                  class="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] text-white font-black tracking-widest uppercase shadow-sm"
                >
                  Selected Target
                </span>
              </div>

              <span class="truncate pr-32 text-xs text-neutral-800 font-bold dark:text-neutral-200">
                {{ session.title || 'Untitled Timeline' }}
              </span>

              <div class="mt-1 flex items-center gap-4 text-[11px] text-neutral-400">
                <div class="flex items-center gap-1">
                  <div class="i-solar:calendar-minimalistic-bold-duotone opacity-70" />
                  <span>{{ formatSessionDate(session.createdAt) }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="i-solar:chat-line-bold-duotone opacity-70" />
                  <span>{{ session.messageCount || 0 }} messages</span>
                </div>
                <div class="flex items-center gap-1 text-primary-500 font-semibold">
                  <div class="i-solar:globus-bold opacity-70" />
                  <span>{{ session.universeId || 'global' }}</span>
                </div>
              </div>

              <div class="mt-1.5 text-[10px] text-neutral-400 italic">
                Last active {{ formatSessionDate(session.updatedAt) }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60">
            <Button label="Cancel" variant="secondary" @click="deployModalOpen = false" />
            <Button
              label="Next: Review & Inspect Details →"
              variant="primary"
              :disabled="!deployTargetSessionId"
              @click="handleProceedToInspection"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- STEP 2: REVIEW & INSPECT DETAILS MODAL                              -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div
        v-if="inspectModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <div class="max-w-xl w-full border border-neutral-200/80 rounded-2xl bg-white p-6 shadow-2xl space-y-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-500/10 text-lg text-emerald-500 font-bold">
                🔍
              </div>
              <div>
                <h3 class="text-sm font-bold">
                  Review & Inspect Details
                </h3>
                <p class="text-[11px] text-neutral-400">
                  Inspect persona assembly, memory window, and select your edge inference LLM.
                </p>
              </div>
            </div>

            <button
              type="button"
              class="h-7 w-7 flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="inspectModalOpen = false"
            >
              ✕
            </button>
          </div>

          <!-- Section 1: Session & Deployment Summary Card -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 space-y-2 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="i-solar:user-bold-duotone text-base text-primary-500" />
                <span class="text-xs font-bold">{{ activeCard?.name || 'Active Character' }}</span>
              </div>
              <span class="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] text-emerald-500 font-bold uppercase">
                {{ selectedMemoryMode === 'unlimited' ? 'Unlimited Memory' : 'Fixed 10-Turn Window' }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] text-neutral-400">
              <div>
                <span class="text-neutral-500 font-medium dark:text-neutral-400">Target Session: </span>
                <span class="text-neutral-800 font-bold dark:text-neutral-200">{{ selectedSessionMeta.title }}</span>
              </div>
              <div>
                <span class="text-neutral-500 font-medium dark:text-neutral-400">Discord Bot Tag: </span>
                <span class="text-neutral-800 font-bold dark:text-neutral-200">{{ serviceStatus.botUser?.tag || 'Configured Bot' }}</span>
              </div>
              <div class="col-span-2 flex items-center gap-1">
                <span class="text-neutral-500 font-medium dark:text-neutral-400">Target Discord Servers: </span>
                <span v-if="serviceStatus.guilds && serviceStatus.guilds.length > 0" class="text-neutral-800 font-bold dark:text-neutral-200">
                  {{ serviceStatus.guilds.map(g => g.name).join(', ') }} ({{ serviceStatus.guilds.length }} server{{ serviceStatus.guilds.length > 1 ? 's' : '' }})
                </span>
                <span v-else class="text-neutral-800 font-bold dark:text-neutral-200">
                  Global (All Connected Servers & DMs)
                </span>
              </div>
            </div>
          </div>

          <!-- Section 2: Consciousness (LLM Provider & Model Picker) -->
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-xs text-neutral-700 font-bold dark:text-neutral-200">
              <div class="i-solar:brain-bold-duotone text-base text-primary-500" />
              <span>Consciousness (Edge LLM Provider & Model)</span>
            </label>
            <p class="text-[11px] text-neutral-400">
              Select the LLM engine for 24/7 Cloud Relay inference. Credentials are automatically sourced from your AIRI Provider settings.
            </p>
            <div class="pt-1">
              <BrainModelPicker
                v-model:provider="selectedConsciousnessProvider"
                v-model:model="selectedConsciousnessModel"
                variant="button"
                title="Select Consciousness LLM for Edge Worker"
                side="bottom"
                class="w-full"
              />
            </div>
          </div>

          <!-- Section 3: History Seeding & Context Depth -->
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-xs text-neutral-700 font-bold dark:text-neutral-200">
              <div class="i-solar:history-bold-duotone text-base text-primary-500" />
              <span>Conversation History Seeding</span>
            </label>
            <p class="text-[11px] text-neutral-400">
              Choose how much dialogue history to seed into Cloudflare KV for context continuity.
            </p>

            <div class="grid grid-cols-1 gap-2 pt-1">
              <div
                v-for="option in availableHistoryDepths"
                :key="option.value"
                :class="[
                  'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                  selectedHistoryDepth === option.value
                    ? 'bg-primary-50/30 border-primary-500 dark:bg-primary-900/10 dark:border-primary-400'
                    : 'bg-neutral-50/50 border-neutral-200/80 dark:bg-neutral-900/40 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700',
                ]"
                @click="selectedHistoryDepth = option.value"
              >
                <div class="flex items-center gap-2.5">
                  <div
                    :class="[
                      'w-4 h-4 rounded-full border flex items-center justify-center transition-all',
                      selectedHistoryDepth === option.value
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-neutral-300 dark:border-neutral-700',
                    ]"
                  >
                    <div v-if="selectedHistoryDepth === option.value" class="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                  <div>
                    <div class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                      {{ option.label }}
                    </div>
                    <div class="text-[10px] text-neutral-400">
                      {{ option.desc }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Collapsible System Prompt Inspector -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3 space-y-2 dark:border-neutral-800 dark:bg-neutral-900/50">
            <button
              type="button"
              class="w-full flex items-center justify-between text-xs text-neutral-700 font-bold dark:text-neutral-200 hover:text-primary-500"
              @click="showSystemPromptPreview = !showSystemPromptPreview"
            >
              <div class="flex items-center gap-2">
                <div class="i-solar:document-text-bold-duotone text-base text-primary-500" />
                <span>Preview Assembled System Prompt</span>
              </div>
              <div class="flex items-center gap-1 text-[11px] text-neutral-400 font-normal">
                <span>{{ showSystemPromptPreview ? 'Hide' : 'Inspect Prompt' }}</span>
                <div class="i-solar:alt-arrow-down-bold text-xs transition-transform" :class="{ 'rotate-180': showSystemPromptPreview }" />
              </div>
            </button>

            <div v-if="showSystemPromptPreview" class="mt-2 max-h-48 overflow-y-auto rounded-lg bg-neutral-900 p-3 text-[10px] text-neutral-300 font-mono scrollbar-none space-y-1">
              <pre class="whitespace-pre-wrap break-all">{{ assembledSystemPrompt }}</pre>
            </div>
          </div>

          <!-- Modal Action Buttons -->
          <div class="flex items-center justify-between border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60">
            <button
              type="button"
              class="text-xs text-neutral-400 font-medium hover:text-neutral-200"
              @click="inspectModalOpen = false; deployModalOpen = true"
            >
              ← Back to Session Picker
            </button>

            <div class="flex items-center gap-3">
              <Button label="Cancel" variant="secondary" @click="inspectModalOpen = false" />
              <Button
                label="🚀 Launch Deployment to Cloudflare"
                variant="primary"
                :disabled="isDeployingRelay"
                @click="handleLaunchDeployment"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.discord-mission-control {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Sections ──────────────────────────────────────────────────────────── */

.mc-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mc-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mc-section-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
  margin: 0;
}

.mc-section-header--clickable {
  cursor: pointer;
  user-select: none;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  transition: background-color 0.15s ease;
}

.mc-section-header--clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

/* ── Status Banner ─────────────────────────────────────────────────────── */

.mc-status-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.3s ease;
}

.mc-status--connected {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.06);
}

.mc-status--connecting {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.06);
}

.mc-status--error {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.06);
}

.mc-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.mc-status--connected .mc-status-dot {
  animation: none;
  opacity: 1;
}

.mc-status--disconnected .mc-status-dot {
  animation: none;
  opacity: 0.5;
}

.mc-status-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.mc-status-label {
  font-weight: 500;
  font-size: 0.875rem;
}

.mc-status-ping {
  font-size: 0.75rem;
  opacity: 0.6;
  font-family: monospace;
}

.mc-bot-tag {
  font-size: 0.75rem;
  opacity: 0.5;
  font-family: monospace;
}

/* ── Error Banner ──────────────────────────────────────────────────────── */

.mc-error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  font-size: 0.8125rem;
  color: #fca5a5;
}

.mc-error-icon {
  flex-shrink: 0;
}

/* ── Action Rows ───────────────────────────────────────────────────────── */

.mc-action-row {
  display: flex;
  gap: 0.5rem;
}

.mc-action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ── Guild List ────────────────────────────────────────────────────────── */

.mc-guilds-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.mc-guild-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.mc-guild-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.mc-guild-icon--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(88, 101, 242, 0.3);
  color: #fff;
  font-weight: 600;
  font-size: 0.75rem;
}

.mc-guild-name {
  flex: 1;
  font-size: 0.875rem;
}

.mc-active-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

/* ── Simulate Dialog ───────────────────────────────────────────────────── */

.mc-simulate-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ── Developer Console ─────────────────────────────────────────────────── */

.mc-chevron {
  font-size: 0.625rem;
  transition: transform 0.2s ease;
  opacity: 0.5;
}

.mc-chevron--open {
  transform: rotate(90deg);
}

.mc-dev-console {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mc-console-toolbar {
  display: flex;
  justify-content: flex-end;
}

.mc-console-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.8125rem;
  opacity: 0.4;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.mc-console-log {
  max-height: 280px;
  overflow-y: auto;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.5rem;
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
}

.mc-log-entry {
  display: flex;
  gap: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  transition: background-color 0.1s ease;
}

.mc-log-entry:hover {
  background: rgba(255, 255, 255, 0.04);
}

.mc-log-time {
  flex-shrink: 0;
  opacity: 0.4;
  min-width: 55px;
}

.mc-log-type {
  flex-shrink: 0;
  font-weight: 600;
  min-width: 120px;
}

.mc-log-summary {
  opacity: 0.7;
  word-break: break-word;
}
</style>
