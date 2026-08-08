<script setup lang="ts">
import { Button, FieldCheckbox, FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDiscordStore } from '../../stores/modules/discord'

const { t } = useI18n()
const discordStore = useDiscordStore()
const {
  token,
  serviceStatus,
  isConnected,
  isConnecting,
  eventLog,
  configured,
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
const cfAccountId = ref('')
const cfApiToken = ref('')
const selectedMemoryMode = ref<'fixed' | 'unlimited'>('unlimited')
const isDeployingRelay = ref(false)
const isOAuthAuthenticating = ref(false)

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

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Option A: 1-Click OAuth Login -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div class="mb-2 flex items-center gap-2">
              <div class="i-solar:key-minimalistic-bold-duotone text-lg text-primary-500" />
              <h4 class="text-xs font-bold">
                1-Click Cloudflare OAuth PKCE
              </h4>
            </div>
            <p class="mb-3 text-[11px] text-neutral-400">
              Authenticate securely via browser without manually creating API tokens.
            </p>
            <Button
              label="Authenticate with Cloudflare"
              variant="primary"
              :disabled="isOAuthAuthenticating"
            />
          </div>

          <!-- Option B: Manual Account ID & Token -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div class="flex items-center gap-2">
              <div class="i-solar:code-bold-duotone text-lg text-amber-500" />
              <h4 class="text-xs font-bold">
                Manual Cloudflare API Token
              </h4>
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

        <!-- Mock Deployed Instance Card -->
        <div class="border border-neutral-200/80 rounded-xl bg-white/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 font-bold">
                AIRI
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-xs font-bold">
                    AIRI — Cloud Relay
                  </h4>
                  <span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-600 font-bold uppercase dark:text-emerald-400">Live ✅</span>
                </div>
                <div class="text-[11px] text-neutral-400 font-mono">
                  https://airi-stage-edge.workers.dev
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button label="Sync Memories ↓" variant="secondary" />
              <Button label="Teardown" variant="danger" />
            </div>
          </div>
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
