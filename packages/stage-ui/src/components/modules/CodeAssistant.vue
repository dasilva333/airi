<script setup lang="ts">
import type { CodeAssistantState } from '../../stores/modules/code-assistant'

import { Button, Select } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import CharacterAvatar from '../misc/CharacterAvatar.vue'

import { useDisplayModelsStore } from '../../stores/display-models'
import { useModsServerChannelStore } from '../../stores/mods/api/channel-server'
import { useAiriCardStore } from '../../stores/modules/airi-card'
import {

  resolveCaptionText,
  useCodeAssistantStore,
} from '../../stores/modules/code-assistant'

const store = useCodeAssistantStore()
const airiCardStore = useAiriCardStore()
const displayModelsStore = useDisplayModelsStore()
const serverChannelStore = useModsServerChannelStore()

const { cards, activeCardId } = storeToRefs(airiCardStore)
const { enabled, captionSurface, idleTimeoutSeconds, recordEventLedger, statusInfo } = storeToRefs(store)

// Active Tab: 'reactions' | 'connections'
const activeTab = ref<'reactions' | 'connections'>('reactions')

// Active selected character in editor
const selectedCharacterId = ref<string>(activeCardId.value || '')

watch(activeCardId, (newId) => {
  if (newId && !selectedCharacterId.value) {
    selectedCharacterId.value = newId
  }
}, { immediate: true })

const characterOptions = computed(() => {
  return Array.from(cards.value.entries()).map(([id, card]) => ({
    label: card.name || id,
    value: id,
  }))
})

const selectedCharacter = computed(() => {
  return cards.value.get(selectedCharacterId.value)
})

const selectedDisplayModelId = computed(() => {
  if (!selectedCharacterId.value)
    return undefined
  return airiCardStore.getCardDisplayModelId(selectedCharacterId.value)
})

// When character dropdown changes, switch active on-stage character as agreed
function handleSelectCharacter(value: string | number | undefined) {
  if (!value)
    return
  const newId = String(value)
  selectedCharacterId.value = newId
  if (newId && activeCardId.value !== newId) {
    airiCardStore.activeCardId = newId
    toast.info(`Switched active character to ${selectedCharacter.value?.name || newId}`)
  }
}

const isCharacterOnStage = computed(() => {
  return selectedCharacterId.value === activeCardId.value
})

// Current Character Reaction Config
const currentConfig = computed(() => {
  return store.getOrInitCharacterConfig(selectedCharacterId.value)
})

const isCharacterEnabled = computed({
  get: () => currentConfig.value.enabled,
  set: (val: boolean) => {
    store.updateCharacterConfig(selectedCharacterId.value, { enabled: val })
  },
})

// State Reactions List
const stateRows: Array<{ key: CodeAssistantState, label: string, dotClass: string }> = [
  { key: 'work', label: 'Working', dotClass: 'bg-emerald-500' },
  { key: 'wait', label: 'Needs you', dotClass: 'bg-amber-500' },
  { key: 'done', label: 'Complete', dotClass: 'bg-blue-500' },
  { key: 'idle', label: 'Idle', dotClass: 'bg-neutral-400 dark:bg-neutral-500' },
  { key: 'error', label: 'Error', dotClass: 'bg-rose-500' },
]

// Accordion expanded row for caption templates
const expandedState = ref<CodeAssistantState>('wait')

function toggleAccordion(state: CodeAssistantState) {
  expandedState.value = expandedState.value === state ? ('' as any) : state
}

// Capabilities from active display model
const modelCapabilities = ref<{
  expressionCapabilities: { rawKey: string, label: string }[]
  motionCapabilities: { rawKey: string, label: string }[]
}>({ expressionCapabilities: [], motionCapabilities: [] })

watch(selectedDisplayModelId, async (displayModelId) => {
  if (displayModelId) {
    try {
      modelCapabilities.value = await displayModelsStore.getOrLoadModelCapabilities(displayModelId)
    }
    catch {
      modelCapabilities.value = { expressionCapabilities: [], motionCapabilities: [] }
    }
  }
  else {
    modelCapabilities.value = { expressionCapabilities: [], motionCapabilities: [] }
  }
}, { immediate: true })

const expressionOptions = computed(() => [
  { label: 'None', value: '' },
  ...modelCapabilities.value.expressionCapabilities.map(e => ({
    label: e.label || e.rawKey,
    value: e.rawKey,
  })),
])

const motionOptions = computed(() => [
  { label: 'None', value: '' },
  ...modelCapabilities.value.motionCapabilities.map(m => ({
    label: m.label || m.rawKey,
    value: m.rawKey,
  })),
])

const soundOptions = [
  { label: 'None', value: 'None' },
  { label: 'Soft ding', value: 'Soft ding' },
  { label: 'Chime', value: 'Chime' },
  { label: 'Alert', value: 'Alert' },
  { label: 'Success fanfare', value: 'Success fanfare' },
]

const timeoutOptions = [
  { label: '30 seconds', value: 30 },
  { label: '60 seconds', value: 60 },
  { label: '90 seconds', value: 90 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
]

// Insert Variable Chip into active template
function insertVariable(variable: string) {
  const state = expandedState.value
  if (!state || !currentConfig.value.reactions[state])
    return
  const tpl = currentConfig.value.reactions[state].captionTemplate || ''
  currentConfig.value.reactions[state].captionTemplate = `${tpl} {${variable}}`.trim()
}

// Live preview sample calculation
const previewState = ref<CodeAssistantState>('wait')

const previewSamplePayload = computed(() => {
  const s = previewState.value
  return {
    state: s,
    headline: s === 'wait'
      ? 'Approval needed'
      : s === 'work'
        ? 'Running tests'
        : s === 'done'
          ? 'Build finished'
          : s === 'error'
            ? 'Compile failed'
            : 'Idle',
    note: s === 'wait' ? 'Run the test suite?' : undefined,
    tool: s === 'work' ? 'npm test' : undefined,
  }
})

const previewCaptionText = computed(() => {
  const rx = currentConfig.value.reactions[previewState.value]
  if (!rx || !rx.captionEnabled)
    return ''
  return resolveCaptionText(rx.captionTemplate, previewSamplePayload.value)
})

// Play individual reaction test
function handlePlayReaction(state: CodeAssistantState) {
  previewState.value = state
  store.testReaction(selectedCharacterId.value, state)
}

function handleStartLifecycle() {
  store.testLifecycle(selectedCharacterId.value)
}

function handleStopPreview() {
  store.stopPreview()
}

// Overflow menu state (Copy, Reset)
const showActionsMenu = ref(false)

function handleResetReactions() {
  store.resetCharacterConfig(selectedCharacterId.value)
  showActionsMenu.value = false
  toast.success(`Reset reactions for ${selectedCharacter.value?.name || 'character'}`)
}

function handleCopyFrom(fromId: string) {
  store.copyCharacterConfig(fromId, selectedCharacterId.value)
  showActionsMenu.value = false
  const fromName = cards.value.get(fromId)?.name || fromId
  toast.success(`Copied reactions from ${fromName}`)
}

// Copy auth token / webhook URL
const authToken = computed(() => serverChannelStore.authToken || 'airi_sec_8f921a8d')
const showToken = ref(false)
const showCopiedToast = ref(false)
const testHandshakeStatus = ref<'idle' | 'testing' | 'success' | 'failed'>('idle')

const curlExample = computed(() => {
  const token = authToken.value || 'YOUR_AUTH_TOKEN'
  return `curl -X POST http://127.0.0.1:6121/api/assistant/state \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"state": "work", "headline": "Running unit test suite"}'`
})

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  showCopiedToast.value = true
  toast.success('Copied to clipboard!')
  setTimeout(() => showCopiedToast.value = false, 2000)
}

function copyCurlExample() {
  copyToClipboard(curlExample.value)
}

async function testEndpointHandshake() {
  testHandshakeStatus.value = 'testing'
  try {
    const headers: Record<string, string> = {}
    if (authToken.value) {
      headers.Authorization = `Bearer ${authToken.value}`
    }
    const res = await fetch('http://127.0.0.1:6121/api/assistant/state', {
      method: 'GET',
      headers,
    })
    if (res.ok) {
      testHandshakeStatus.value = 'success'
      toast.success('Endpoint handshake successful (200 OK)')
    }
    else {
      testHandshakeStatus.value = 'failed'
      toast.error(`Endpoint responded with HTTP ${res.status}`)
    }
  }
  catch (err: any) {
    testHandshakeStatus.value = 'failed'
    toast.error(`Endpoint unreachable: ${err.message}`)
  }
}

// Quick Connector Dialog & Session tracking
const activeConnectorModal = ref<'claude' | 'antigravity' | null>(null)
const connectorTab = ref<'auto' | 'curl' | 'json'>('auto')

const claudeSession = computed(() => {
  return store.activeSessions.find(s => s.assistant === 'claude-code')
})

const isClaudeConnected = computed(() => {
  if (!claudeSession.value)
    return false
  return Date.now() - claudeSession.value.lastUpdated < 300000
})

const antigravitySession = computed(() => {
  return store.activeSessions.find(s => s.assistant === 'antigravity')
})

const isAntigravityConnected = computed(() => {
  if (!antigravitySession.value)
    return false
  return Date.now() - antigravitySession.value.lastUpdated < 300000
})

function sendSimulatedAgentEvent(source: 'claude-code' | 'antigravity') {
  store.handleAssistantState({
    source,
    assistant: source,
    state: 'wait',
    headline: source === 'claude-code' ? 'Claude Code Approval' : 'Antigravity Approval',
    note: 'Allow bash command "npm test"?',
    tool: 'run_command',
  })
  toast.success(`Dispatched simulated "${source}" approval event to stage!`)
}

const claudeJsonConfig = computed(() => {
  const token = authToken.value || 'YOUR_AUTH_TOKEN'
  return JSON.stringify({
    hooks: {
      UserPromptSubmit: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"claude-code","state":"work","headline":"Claude is thinking..."}' >/dev/null 2>&1 &`,
        },
      ],
      PreToolUse: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"claude-code","state":"wait","headline":"Tool approval requested"}' >/dev/null 2>&1 &`,
        },
      ],
      PostToolUse: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"claude-code","state":"work","headline":"Claude is executing..."}' >/dev/null 2>&1 &`,
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"claude-code","state":"done","headline":"Turn completed"}' >/dev/null 2>&1 &`,
        },
      ],
    },
  }, null, 2)
})

const antigravityJsonConfig = computed(() => {
  const token = authToken.value || 'YOUR_AUTH_TOKEN'
  return JSON.stringify({
    'airi-assistant-sync': {
      enabled: true,
      PreInvocation: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"antigravity","state":"work","headline":"Antigravity is thinking..."}' >/dev/null 2>&1 &`,
        },
      ],
      PreToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"antigravity","state":"wait","headline":"Tool approval requested"}' >/dev/null 2>&1 &`,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"antigravity","state":"work","headline":"Executing tool..."}' >/dev/null 2>&1 &`,
            },
          ],
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"source":"antigravity","state":"done","headline":"Task finished"}' >/dev/null 2>&1 &`,
        },
      ],
    },
  }, null, 2)
})
</script>

<template>
  <div class="code-assistant-mission-control flex flex-col gap-6 pb-12 font-normal">
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Page Header & Master Killswitch                                     -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <div class="h-11 w-11 flex shrink-0 items-center justify-center border border-primary-500/30 rounded-xl bg-primary-500/10 text-primary-500 dark:bg-primary-500/20">
          <div class="i-carbon:terminal text-2xl font-bold" />
        </div>
        <div class="flex flex-col">
          <h1 class="text-base text-neutral-900 font-bold dark:text-neutral-100">
            Code Assistant Notifications
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Your companion, in sync with your coding assistant.
          </p>
          <div class="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
            <div
              class="h-2 w-2 rounded-full"
              :class="[
                statusInfo.badge === 'ready' ? 'bg-emerald-500 animate-pulse' : '',
                statusInfo.badge === 'setup_needed' ? 'bg-amber-500' : '',
                statusInfo.badge === 'paused' ? 'bg-neutral-400' : '',
              ]"
            />
            <span :class="statusInfo.badge === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'">
              {{ statusInfo.text }}
            </span>
          </div>
        </div>
      </div>

      <!-- Master Enable Notifications Switch -->
      <div class="flex items-center gap-3">
        <label class="cursor-pointer select-none text-xs text-neutral-700 font-semibold dark:text-neutral-300" for="master-toggle">
          Enable notifications
        </label>
        <button
          id="master-toggle"
          type="button"
          role="switch"
          :aria-checked="enabled"
          class="relative h-6 w-11 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :class="enabled ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'"
          @click="enabled = !enabled"
        >
          <span
            class="block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform"
            :class="enabled ? 'translate-x-5.5' : 'translate-x-0.5'"
          />
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Two Navigation Tabs: Reactions | Connections                        -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div class="flex gap-2 border-b border-neutral-200/80 dark:border-neutral-800">
      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all"
        :class="activeTab === 'reactions'
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="activeTab = 'reactions'"
      >
        <div class="i-solar:chat-round-dots-bold-duotone text-base" />
        <span>Reactions</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all"
        :class="activeTab === 'connections'
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="activeTab = 'connections'"
      >
        <div class="i-solar:link-circle-bold-duotone text-base" />
        <span>Connections</span>
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 1: REACTIONS                                                    -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'reactions'" class="flex flex-col gap-6">
      <!-- 1. Character Reactions Anchor Card -->
      <div class="flex items-center justify-between gap-4 border border-neutral-200/80 rounded-2xl bg-neutral-50/60 p-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <div class="flex items-center gap-3.5">
          <CharacterAvatar
            v-if="selectedCharacter"
            :card-id="selectedCharacterId"
            :name="selectedCharacter.name || selectedCharacterId"
            :display-model-id="selectedDisplayModelId"
            shape="circle"
            size-class="h-10 w-10"
          />
          <div v-else class="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
              <span>Character reactions</span>
            </div>
            <div class="text-[11px] text-neutral-400">
              These reactions apply while this character is on stage.
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Character Switcher Dropdown -->
          <div class="w-40">
            <Select
              :model-value="selectedCharacterId"
              :options="characterOptions"
              class="w-full text-xs"
              @update:model-value="handleSelectCharacter"
            />
          </div>

          <div
            v-if="isCharacterOnStage"
            class="border border-emerald-500/30 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
          >
            On stage
          </div>

          <!-- Per-Character Toggle Switch -->
          <div class="ml-2 flex items-center gap-2 border-l border-neutral-200 pl-3 dark:border-neutral-800">
            <label class="cursor-pointer text-xs text-neutral-600 font-medium dark:text-neutral-300" for="char-toggle">
              Enable for {{ selectedCharacter?.name || 'character' }}
            </label>
            <button
              id="char-toggle"
              type="button"
              role="switch"
              :aria-checked="isCharacterEnabled"
              class="relative h-5 w-9 rounded-full transition-colors focus:outline-none"
              :class="isCharacterEnabled ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'"
              @click="isCharacterEnabled = !isCharacterEnabled"
            >
              <span
                class="block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                :class="isCharacterEnabled ? 'translate-x-4.5' : 'translate-x-0.5'"
              />
            </button>
          </div>

          <!-- Actions Overflow Menu (Copy/Reset) -->
          <div class="relative">
            <Button
              variant="secondary"
              color="neutral"
              class="px-2 py-1 text-xs"
              @click="showActionsMenu = !showActionsMenu"
            >
              <div class="i-solar:menu-dots-bold text-base" />
            </Button>

            <div
              v-if="showActionsMenu"
              class="absolute right-0 z-30 mt-2 w-52 flex flex-col border border-neutral-200 rounded-xl bg-white py-1.5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div class="px-3 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Reactions Actions
              </div>
              <button
                type="button"
                class="flex items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @click="handleResetReactions"
              >
                <div class="i-solar:restart-bold text-sm" />
                <span>Reset reactions</span>
              </button>
              <div class="my-1 border-t border-neutral-100 dark:border-neutral-800" />
              <div class="px-3 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Copy from...
              </div>
              <template v-for="c in characterOptions" :key="c.value">
                <button
                  v-if="c.value !== selectedCharacterId"
                  type="button"
                  class="truncate px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  @click="handleCopyFrom(c.value)"
                >
                  {{ c.label }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Main 2/3 and 1/3 Studio Layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- LEFT 2/3: State Reactions Matrix -->
        <div class="flex flex-col gap-4 border border-neutral-200/80 rounded-2xl bg-neutral-50/50 p-5 lg:col-span-2 dark:border-neutral-800/80 dark:bg-neutral-900/50">
          <div>
            <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
              <div class="i-solar:chat-round-line-bold-duotone text-base text-primary-500" />
              <span>State reactions</span>
            </div>
            <div class="mt-0.5 text-[11px] text-neutral-400">
              Choose an expression, motion and sound for each state.
            </div>
          </div>

          <!-- Table Matrix -->
          <div class="w-full flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            <!-- Table Header -->
            <div class="grid grid-cols-12 gap-2 pb-2 text-[11px] text-neutral-400 font-bold tracking-wider uppercase">
              <div class="col-span-3">
                State
              </div>
              <div class="col-span-3">
                Expression
              </div>
              <div class="col-span-3">
                Motion
              </div>
              <div class="col-span-1">
                Sound
              </div>
              <div class="col-span-1 text-center">
                Caption
              </div>
              <div class="col-span-1 text-center">
                Play
              </div>
            </div>

            <!-- Table Rows -->
            <div
              v-for="row in stateRows"
              :key="row.key"
              class="flex flex-col py-2.5 transition-colors"
              :class="expandedState === row.key ? 'bg-primary-500/5 dark:bg-primary-500/10 rounded-xl px-2' : ''"
            >
              <div class="grid grid-cols-12 items-center gap-2">
                <!-- State Dot + Label -->
                <div class="col-span-3 flex cursor-pointer select-none items-center gap-2" @click="toggleAccordion(row.key)">
                  <div class="h-2.5 w-2.5 shrink-0 rounded-full" :class="row.dotClass" />
                  <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">{{ row.label }}</span>
                  <div
                    class="i-solar:alt-arrow-down-linear text-[10px] text-neutral-400 transition-transform"
                    :class="expandedState === row.key ? 'transform rotate-180' : ''"
                  />
                </div>

                <!-- Expression Dropdown -->
                <div class="col-span-3">
                  <Select
                    v-model="currentConfig.reactions[row.key].expression"
                    :options="expressionOptions"
                    class="w-full text-xs"
                  />
                </div>

                <!-- Motion Dropdown -->
                <div class="col-span-3">
                  <Select
                    v-model="currentConfig.reactions[row.key].motion"
                    :options="motionOptions"
                    class="w-full text-xs"
                  />
                </div>

                <!-- Sound Dropdown -->
                <div class="col-span-1">
                  <Select
                    v-model="currentConfig.reactions[row.key].sound"
                    :options="soundOptions"
                    class="w-full text-xs"
                  />
                </div>

                <!-- Caption Toggle Switch -->
                <div class="col-span-1 flex items-center justify-center">
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="currentConfig.reactions[row.key].captionEnabled"
                    class="relative h-4.5 w-8 rounded-full transition-colors focus:outline-none"
                    :class="currentConfig.reactions[row.key].captionEnabled ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'"
                    @click="currentConfig.reactions[row.key].captionEnabled = !currentConfig.reactions[row.key].captionEnabled"
                  >
                    <span
                      class="block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform"
                      :class="currentConfig.reactions[row.key].captionEnabled ? 'translate-x-3.8' : 'translate-x-0.5'"
                    />
                  </button>
                </div>

                <!-- Play Audition Button -->
                <div class="col-span-1 flex items-center justify-center">
                  <button
                    type="button"
                    class="h-7 w-7 flex items-center justify-center rounded-lg bg-neutral-200/80 text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-primary-500/20 dark:text-neutral-400 hover:text-primary-500"
                    title="Audition reaction"
                    @click="handlePlayReaction(row.key)"
                  >
                    <div class="i-solar:play-bold text-xs" />
                  </button>
                </div>
              </div>

              <!-- Accordion Caption Drawer (Expanded) -->
              <div
                v-if="expandedState === row.key"
                class="mt-3 flex flex-col gap-2.5 border-t border-primary-500/20 px-1 pt-3"
              >
                <div class="flex items-center justify-between gap-4">
                  <label class="text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">
                    Caption template
                  </label>
                  <div class="flex items-center gap-1.5 text-[10px]">
                    <span class="text-neutral-400">Insert variable:</span>
                    <button
                      type="button"
                      class="rounded-md bg-neutral-200 px-2 py-0.5 text-neutral-600 font-mono transition-colors dark:bg-neutral-800 hover:bg-primary-500/20 dark:text-neutral-300 hover:text-primary-500"
                      @click="insertVariable('headline')"
                    >
                      Headline
                    </button>
                    <button
                      type="button"
                      class="rounded-md bg-neutral-200 px-2 py-0.5 text-neutral-600 font-mono transition-colors dark:bg-neutral-800 hover:bg-primary-500/20 dark:text-neutral-300 hover:text-primary-500"
                      @click="insertVariable('note')"
                    >
                      Note
                    </button>
                    <button
                      type="button"
                      class="rounded-md bg-neutral-200 px-2 py-0.5 text-neutral-600 font-mono transition-colors dark:bg-neutral-800 hover:bg-primary-500/20 dark:text-neutral-300 hover:text-primary-500"
                      @click="insertVariable('tool')"
                    >
                      Tool
                    </button>
                  </div>
                </div>

                <input
                  v-model="currentConfig.reactions[row.key].captionTemplate"
                  type="text"
                  placeholder="{headline}: {note}"
                  class="w-full border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-900 font-mono dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >

                <div class="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono">
                  <span class="text-primary-500 font-bold">Preview:</span>
                  <span>{{ resolveCaptionText(currentConfig.reactions[row.key].captionTemplate, previewSamplePayload) || 'None' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT 1/3: Reaction Preview Panel -->
        <div class="flex flex-col gap-4 border border-neutral-200/80 rounded-2xl bg-neutral-50/50 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
              <div class="i-solar:clapperboard-play-bold-duotone text-base text-primary-500" />
              <span>Reaction preview</span>
            </div>
            <div class="border border-amber-500/30 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
              {{ previewState === 'wait' ? '🟡 Needs you' : previewState }}
            </div>
          </div>

          <!-- Preview Canvas Viewport -->
          <div class="relative min-h-[200px] flex flex-col items-center justify-center overflow-hidden border border-neutral-800 rounded-2xl bg-neutral-950 p-5">
            <!-- Simulated Head-Tethered Comic Bubble -->
            <div
              v-if="previewCaptionText"
              class="relative mb-3 max-w-[240px] animate-fade-in border border-neutral-700 rounded-2xl bg-neutral-900/90 px-3.5 py-2 text-center text-xs text-white font-medium shadow-xl backdrop-blur-md"
            >
              <span>{{ previewCaptionText }}</span>
              <!-- Comic bubble pointer triangle -->
              <div class="absolute left-1/2 h-0 w-0 border-x-6 border-t-6 border-x-transparent border-t-neutral-900/90 -bottom-2 -translate-x-1/2" />
            </div>

            <!-- Stylized Avatar Render -->
            <div class="relative mt-2">
              <CharacterAvatar
                v-if="selectedCharacter"
                :card-id="selectedCharacterId"
                :name="selectedCharacter.name || selectedCharacterId"
                :display-model-id="selectedDisplayModelId"
                shape="circle"
                size-class="h-24 w-24"
              />
              <div class="absolute h-6 w-6 flex items-center justify-center rounded-full bg-primary-600 text-xs text-white shadow-md -bottom-1 -right-1">
                <div class="i-solar:sparkles-bold" />
              </div>
            </div>
          </div>

          <!-- Action Controls -->
          <div class="flex items-center gap-2">
            <Button
              variant="primary"
              color="primary"
              class="flex-1 py-2 text-xs font-bold"
              @click="handlePlayReaction(previewState)"
            >
              <div class="i-solar:play-bold mr-1.5" />
              <span>Play reaction</span>
            </Button>
            <Button
              variant="secondary"
              color="neutral"
              class="px-3 py-2 text-xs"
              title="Stop preview"
              @click="handleStopPreview"
            >
              <div class="i-solar:stop-bold" />
            </Button>
            <Button
              variant="secondary"
              color="neutral"
              class="px-2.5 py-2 text-xs font-medium"
              title="Run 12s sequential test lifecycle"
              @click="handleStartLifecycle"
            >
              <span>Test lifecycle →</span>
            </Button>
          </div>

          <div class="text-center text-[10px] text-neutral-400 font-medium">
            Preview only · No activity recorded
          </div>
        </div>
      </div>

      <!-- 3. Bottom Card: Captions & Behavior -->
      <div class="flex flex-col gap-4 border border-neutral-200/80 rounded-2xl bg-neutral-50/50 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/50">
        <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
          <div class="i-solar:chat-square-code-bold-duotone text-base text-primary-500" />
          <span>Captions & behavior</span>
        </div>

        <!-- Row 1: Show Captions In -->
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Show captions in</span>

          <div class="flex flex-col items-end gap-1">
            <div class="flex items-center gap-1 rounded-xl bg-neutral-200/60 p-1 dark:bg-neutral-800/60">
              <button
                type="button"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-all"
                :class="captionSurface === 'follow' ? 'bg-primary-600 text-white shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'"
                @click="captionSurface = 'follow'"
              >
                Follow settings
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-all"
                :class="captionSurface === 'above' ? 'bg-primary-600 text-white shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'"
                @click="captionSurface = 'above'"
              >
                Above character
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-all"
                :class="captionSurface === 'window' ? 'bg-primary-600 text-white shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'"
                @click="captionSurface = 'window'"
              >
                Floating window
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-all"
                :class="captionSurface === 'off' ? 'bg-primary-600 text-white shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'"
                @click="captionSurface = 'off'"
              >
                Off
              </button>
            </div>
            <div v-if="captionSurface === 'follow'" class="text-[10px] text-neutral-400">
              Currently: Above character
            </div>
          </div>
        </div>

        <!-- Row 2: Inactivity Reset & Event Ledger -->
        <div class="flex flex-col justify-between gap-4 border-t border-neutral-200/60 pt-3 sm:flex-row sm:items-center dark:border-neutral-800/60">
          <div class="flex items-center gap-3">
            <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Reset to idle after inactivity</span>
            <div class="w-36">
              <Select
                v-model="idleTimeoutSeconds"
                :options="timeoutOptions"
                class="w-full text-xs"
              />
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Record in Event Ledger</span>
              <button
                type="button"
                role="switch"
                :aria-checked="recordEventLedger"
                class="relative h-5 w-9 rounded-full transition-colors focus:outline-none"
                :class="recordEventLedger ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'"
                @click="recordEventLedger = !recordEventLedger"
              >
                <span
                  class="block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                  :class="recordEventLedger ? 'translate-x-4.5' : 'translate-x-0.5'"
                />
              </button>
            </div>
            <RouterLink
              to="/chat"
              class="flex items-center gap-1 text-xs text-primary-600 font-bold dark:text-primary-400 hover:underline"
            >
              <span>View assistant events →</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 2: CONNECTIONS                                                  -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'connections'" class="flex flex-col gap-6">
      <div class="flex flex-col gap-4 border border-neutral-200/80 rounded-2xl bg-neutral-50/50 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/50">
        <div>
          <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
            <div class="i-solar:bolt-circle-bold-duotone text-base text-primary-500" />
            <span>Agent Quick-Connectors</span>
          </div>
          <div class="mt-0.5 text-[11px] text-neutral-400">
            1-click integrations for popular command-line and desktop AI coding assistants.
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Claude Code Connector -->
          <div class="flex flex-col justify-between gap-4 border border-neutral-200/80 rounded-xl bg-white/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div class="flex items-start gap-3">
              <div class="h-9 w-9 flex shrink-0 items-center justify-center border border-amber-500/20 rounded-lg bg-amber-500/10 text-amber-500">
                <div class="i-carbon:terminal text-xl" />
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">Claude Code</span>
                  <span class="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] text-neutral-600 font-bold dark:bg-neutral-800 dark:text-neutral-400">CLI</span>
                </div>
                <p class="mt-0.5 text-[11px] text-neutral-500">
                  Connects via Claude Code hooks to notify AIRI when Claude starts thinking, needs tool approval, or finishes.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800/80">
              <span
                class="flex items-center gap-1.5 text-[10px] font-medium"
                :class="isClaudeConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="isClaudeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'"
                />
                {{ isClaudeConnected ? 'Receiving events' : 'Ready to connect' }}
              </span>

              <div class="flex items-center gap-2">
                <Button
                  variant="secondary"
                  color="neutral"
                  class="px-2.5 py-1 text-xs"
                  title="Dispatch simulated test event from Claude Code"
                  @click="sendSimulatedAgentEvent('claude-code')"
                >
                  <div class="i-solar:play-bold mr-1 text-xs" />
                  <span>Test</span>
                </Button>
                <Button
                  variant="primary"
                  color="primary"
                  class="px-3 py-1 text-xs font-bold"
                  @click="activeConnectorModal = 'claude'"
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>

          <!-- Google Antigravity Connector -->
          <div class="flex flex-col justify-between gap-4 border border-neutral-200/80 rounded-xl bg-white/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div class="flex items-start gap-3">
              <div class="h-9 w-9 flex shrink-0 items-center justify-center border border-purple-500/20 rounded-lg bg-purple-500/10 text-purple-500">
                <div class="i-solar:magic-stick-3-bold-duotone text-xl" />
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">Google Antigravity</span>
                  <span class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold">Active</span>
                </div>
                <p class="mt-0.5 text-[11px] text-neutral-500">
                  Hooks into Antigravity lifecycle events (PreInvocation, PreToolUse, PostToolUse, Stop).
                </p>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800/80">
              <span
                class="flex items-center gap-1.5 text-[10px] font-medium"
                :class="isAntigravityConnected ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-500'"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="isAntigravityConnected ? 'bg-purple-500 animate-pulse' : 'bg-neutral-400'"
                />
                {{ isAntigravityConnected ? 'Receiving events' : 'Ready to connect' }}
              </span>

              <div class="flex items-center gap-2">
                <Button
                  variant="secondary"
                  color="neutral"
                  class="px-2.5 py-1 text-xs"
                  title="Dispatch simulated test event from Antigravity"
                  @click="sendSimulatedAgentEvent('antigravity')"
                >
                  <div class="i-solar:play-bold mr-1 text-xs" />
                  <span>Test</span>
                </Button>
                <Button
                  variant="secondary"
                  color="neutral"
                  class="px-3 py-1 text-xs font-medium"
                  @click="activeConnectorModal = 'antigravity'"
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Manual Integration Card -->
      <div class="flex flex-col gap-4 border border-neutral-200/80 rounded-2xl bg-neutral-50/50 p-5 dark:border-neutral-800/80 dark:bg-neutral-900/50">
        <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
          <div class="i-solar:code-file-bold-duotone text-base text-primary-500" />
          <span>Manual Webhook Integration</span>
        </div>

        <div class="flex flex-col gap-3 text-xs">
          <!-- Endpoint URL -->
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">Endpoint URL</label>
            <div class="flex items-center gap-2">
              <input
                type="text"
                readonly
                value="http://127.0.0.1:6121/api/assistant/state"
                class="flex-1 select-all border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-[11px] text-neutral-800 font-mono dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
              >
              <Button
                variant="secondary"
                color="neutral"
                class="px-3 py-1.5 text-xs"
                @click="copyToClipboard('http://127.0.0.1:6121/api/assistant/state')"
              >
                Copy
              </Button>
            </div>
          </div>

          <!-- Authentication Token -->
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">Authentication Token</label>
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  :type="showToken ? 'text' : 'password'"
                  readonly
                  :value="authToken"
                  class="w-full select-all border border-neutral-200 rounded-lg bg-white px-3 py-1.5 pr-9 text-[11px] text-neutral-800 font-mono dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 text-neutral-400 -translate-y-1/2 hover:text-neutral-600 dark:hover:text-neutral-200"
                  :title="showToken ? 'Hide token' : 'Show token'"
                  @click="showToken = !showToken"
                >
                  <div :class="showToken ? 'i-solar:eye-closed-bold' : 'i-solar:eye-bold'" class="text-sm" />
                </button>
              </div>
              <Button
                variant="secondary"
                color="neutral"
                class="px-3 py-1.5 text-xs"
                @click="copyToClipboard(authToken)"
              >
                Copy
              </Button>
            </div>
          </div>

          <!-- Connection Test Handshake -->
          <div class="flex items-center justify-between pt-1">
            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                color="neutral"
                class="px-3 py-1.5 text-xs"
                :disabled="testHandshakeStatus === 'testing'"
                @click="testEndpointHandshake"
              >
                <div v-if="testHandshakeStatus === 'testing'" class="i-svg-spinners:ring-resize mr-1.5 text-xs" />
                <div v-else class="i-solar:radar-2-bold mr-1.5 text-xs text-primary-500" />
                <span>Test Connection</span>
              </Button>
              <span
                v-if="testHandshakeStatus === 'success'"
                class="flex items-center gap-1 text-[11px] text-emerald-600 font-medium dark:text-emerald-400"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Handshake successful (HTTP 200)
              </span>
              <span
                v-else-if="testHandshakeStatus === 'failed'"
                class="flex items-center gap-1 text-[11px] text-rose-600 font-medium dark:text-rose-400"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Endpoint offline or unreachable
              </span>
            </div>
          </div>

          <!-- cURL Example -->
          <div class="mt-1 flex flex-col gap-1">
            <label class="text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">cURL Example</label>
            <div class="group relative overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950 p-3 text-[11px] text-neutral-300 font-mono">
              <pre><code>{{ curlExample }}</code></pre>
              <button
                type="button"
                class="absolute right-2 top-2 rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 font-medium opacity-0 transition-opacity hover:bg-neutral-700 group-hover:opacity-100"
                @click="copyCurlExample"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Connector Setup Dialog Modal -->
    <div
      v-if="activeConnectorModal"
      class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      @click.self="activeConnectorModal = null"
    >
      <div class="relative max-w-xl w-full flex flex-col gap-4 border border-neutral-200 rounded-2xl bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <!-- Modal Header -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="h-10 w-10 flex shrink-0 items-center justify-center border rounded-xl"
              :class="activeConnectorModal === 'claude'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-purple-500/10 text-purple-500 border-purple-500/20'"
            >
              <div :class="activeConnectorModal === 'claude' ? 'i-carbon:terminal text-xl' : 'i-solar:magic-stick-3-bold-duotone text-xl'" />
            </div>
            <div class="flex flex-col">
              <h2 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
                Connect {{ activeConnectorModal === 'claude' ? 'Claude Code' : 'Google Antigravity' }}
              </h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ activeConnectorModal === 'claude'
                  ? 'Notify your AIRI companion when Claude is thinking, executing tools, or waiting for approval.'
                  : 'Notify your AIRI companion when Antigravity invokes tools, runs commands, or finishes turns.'
                }}
              </p>
            </div>
          </div>

          <button
            type="button"
            class="h-7 w-7 flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
            @click="activeConnectorModal = null"
          >
            <div class="i-solar:close-circle-bold text-lg" />
          </button>
        </div>

        <!-- Mode Sub-Tabs -->
        <div class="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            class="border-b-2 px-3 py-1.5 text-xs font-bold transition-colors"
            :class="connectorTab === 'auto'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="connectorTab = 'auto'"
          >
            1-Click Command
          </button>
          <button
            type="button"
            class="border-b-2 px-3 py-1.5 text-xs font-bold transition-colors"
            :class="connectorTab === 'curl'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="connectorTab = 'curl'"
          >
            Direct cURL (Zero Latency)
          </button>
          <button
            type="button"
            class="border-b-2 px-3 py-1.5 text-xs font-bold transition-colors"
            :class="connectorTab === 'json'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="connectorTab = 'json'"
          >
            Config File (JSON)
          </button>
        </div>

        <!-- Tab 1: 1-Click Auto Installer -->
        <div v-if="connectorTab === 'auto'" class="flex flex-col gap-3 text-xs">
          <p class="text-neutral-600 dark:text-neutral-300">
            Run this one-liner in your terminal to automatically configure the assistant hooks and backup previous settings:
          </p>

          <div class="flex items-center gap-2">
            <input
              type="text"
              readonly
              :value="`pnpm assistant install ${activeConnectorModal}`"
              class="flex-1 select-all border border-neutral-200 rounded-xl bg-neutral-950 px-3 py-2 text-xs text-neutral-200 font-mono dark:border-neutral-800"
            >
            <Button
              variant="primary"
              color="primary"
              class="shrink-0 px-3 py-2 text-xs font-bold"
              @click="copyToClipboard(`pnpm assistant install ${activeConnectorModal}`)"
            >
              Copy
            </Button>
          </div>

          <div class="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Target file: <code class="text-neutral-600 font-mono dark:text-neutral-300">{{ activeConnectorModal === 'claude' ? '~/.claude/settings.json' : '.agents/hooks.json' }}</code></span>
            <span class="text-neutral-500">Or: <code class="text-[10px] text-neutral-400 font-mono">npx airi-assistant install {{ activeConnectorModal }}</code></span>
          </div>
        </div>

        <!-- Tab 2: Direct cURL (Zero Latency) -->
        <div v-else-if="connectorTab === 'curl'" class="flex flex-col gap-3 text-xs">
          <p class="text-neutral-600 dark:text-neutral-300">
            Direct HTTP POST via native <code class="text-primary-500 font-mono">curl</code> for sub-millisecond execution with zero node startup delay:
          </p>

          <div class="group relative max-h-48 overflow-y-auto border border-neutral-800 rounded-xl bg-neutral-950 p-3 text-[11px] text-neutral-300 font-mono">
            <pre><code>curl -s -X POST http://127.0.0.1:6121/api/assistant/state \
  -H "Authorization: Bearer {{ authToken }}" \
  -H "Content-Type: application/json" \
  -d '{"source":"{{ activeConnectorModal === 'claude' ? 'claude-code' : 'antigravity' }}","state":"work","headline":"Active"}'</code></pre>
            <button
              type="button"
              class="absolute right-2 top-2 rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 font-medium hover:bg-neutral-700"
              @click="copyToClipboard(`curl -s -X POST http://127.0.0.1:6121/api/assistant/state -H &quot;Authorization: Bearer ${authToken}&quot; -H &quot;Content-Type: application/json&quot; -d '{&quot;source&quot;:&quot;${activeConnectorModal === 'claude' ? 'claude-code' : 'antigravity'}&quot;,&quot;state&quot;:&quot;work&quot;,&quot;headline&quot;:&quot;Active&quot;}'`)"
            >
              Copy
            </button>
          </div>
        </div>

        <!-- Tab 3: Manual JSON -->
        <div v-else class="flex flex-col gap-3 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-neutral-500">
              Merge this block into <code class="text-neutral-700 font-bold font-mono dark:text-neutral-300">{{ activeConnectorModal === 'claude' ? '~/.claude/settings.json' : '.agents/hooks.json' }}</code>:
            </span>
            <Button
              variant="secondary"
              color="neutral"
              class="px-2 py-1 text-xs"
              @click="copyToClipboard(activeConnectorModal === 'claude' ? claudeJsonConfig : antigravityJsonConfig)"
            >
              Copy JSON
            </Button>
          </div>

          <div class="max-h-56 overflow-y-auto border border-neutral-800 rounded-xl bg-neutral-950 p-3 text-[11px] text-neutral-300 font-mono">
            <pre><code>{{ activeConnectorModal === 'claude' ? claudeJsonConfig : antigravityJsonConfig }}</code></pre>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Button
            variant="secondary"
            color="neutral"
            class="px-3 py-1.5 text-xs"
            @click="sendSimulatedAgentEvent(activeConnectorModal === 'claude' ? 'claude-code' : 'antigravity')"
          >
            <div class="i-solar:play-bold mr-1.5 text-xs text-primary-500" />
            <span>Send Test Event</span>
          </Button>

          <Button
            variant="secondary"
            color="neutral"
            class="px-4 py-1.5 text-xs font-bold"
            @click="activeConnectorModal = null"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
