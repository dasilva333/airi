<script setup lang="ts">
import { Alert } from '@proj-airi/stage-ui/components'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores/modules/system-one'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

const providersStore = useProvidersStore()
const systemOneStore = useSystemOneStore()

const { persistedSystem1ProvidersMetadata, configuredProviders } = storeToRefs(providersStore)
const {
  activeProvider,
  activeModel,
  availableModels,
  lastLatencyMs,
  systemOneDecisionsCount,
  systemOneCloudTokens,
  systemOneLocalTokens,
} = storeToRefs(systemOneStore)

// Active Tab: 'triage' | 'rerank' | 'affect'
const activeTab = ref<'triage' | 'rerank' | 'affect'>('triage')

// Ping state
const isPinging = ref(false)
const pingResult = ref<string | null>(null)

// Tab 1: Triage State
const triageQuery = ref('When was the last time we walked in Central Park together?')
const triageResult = ref<any>(null)
const isRunningTriage = ref(false)

// Tab 2: Rerank State
const rerankQuery = ref('What did we have for dinner last Tuesday?')
const rerankCandidates = ref([
  { id: '1', text: 'On Tuesday night, we cooked homemade chicken parmesan with spaghetti and drank Chianti.' },
  { id: '2', text: 'Last Wednesday we went to the Italian restaurant downtown and ordered pizza.' },
  { id: '3', text: 'You mentioned that you bought fresh mozzarella and chicken cutlets at the grocery store.' },
])
const rerankResult = ref<any>(null)
const isRunningRerank = ref(false)

// Tab 3: Affect State
const affectHistory = ref('Companion: Did you finish that report you said you were working on?\nUser: Well, to be completely honest...')
const affectTarget = ref('I actually lied earlier, I was just playing video games all afternoon.')
const affectResult = ref<any>(null)
const isRunningAffect = ref(false)

// Ensure valid model when provider changes
watch(activeProvider, (newProv) => {
  if (newProv === 'openrouter-ai') {
    activeModel.value = 'typesafe/jev-1.13'
  }
  else if (newProv === 'typesafe-ai') {
    activeModel.value = 'jev-latest'
  }
  else if (newProv === 'opencode-go') {
    activeModel.value = 'jev-1.13-free'
  }
  else if (newProv === 'laya-local') {
    const configuredModel = providersStore.getProviderConfig('laya-local')?.model as string | undefined
    if (activeModel.value !== 'tozp/laya-onnx' && activeModel.value !== 'tozp/laya-onnx-fp16') {
      activeModel.value = configuredModel || 'tozp/laya-onnx'
    }
  }
})

async function runPing() {
  isPinging.value = true
  pingResult.value = null
  try {
    const t0 = performance.now()
    await systemOneStore.execute('ping test', {
      ping: {
        type: 'choice',
        instructions: 'Respond to connectivity ping check.',
        criteria: { ok: 'Connection established successfully' },
      },
    })
    const dt = Math.round(performance.now() - t0)
    pingResult.value = `Connected successfully (${dt}ms round-trip)`
  }
  catch (err: any) {
    pingResult.value = `Error: ${err?.message || String(err)}`
  }
  finally {
    isPinging.value = false
  }
}

async function handleRunTriage() {
  if (!triageQuery.value.trim())
    return
  isRunningTriage.value = true
  triageResult.value = null
  try {
    triageResult.value = await systemOneStore.runTriage(triageQuery.value)
  }
  catch (err: any) {
    triageResult.value = { error: err?.message || String(err) }
  }
  finally {
    isRunningTriage.value = false
  }
}

async function handleRunRerank() {
  if (!rerankQuery.value.trim() || rerankCandidates.value.length === 0)
    return
  isRunningRerank.value = true
  rerankResult.value = null
  try {
    rerankResult.value = await systemOneStore.runRerank(rerankQuery.value, rerankCandidates.value)
  }
  catch (err: any) {
    rerankResult.value = { error: err?.message || String(err) }
  }
  finally {
    isRunningRerank.value = false
  }
}

async function handleRunAffect() {
  if (!affectTarget.value.trim())
    return
  isRunningAffect.value = true
  affectResult.value = null
  try {
    const historyTurns = affectHistory.value
      .split('\n')
      .filter(l => l.trim().length > 0)
      .map((l) => {
        const parts = l.split(':')
        if (parts.length > 1) {
          return { role: parts[0].trim(), text: parts.slice(1).join(':').trim() }
        }
        return { role: 'user', text: l.trim() }
      })
    affectResult.value = await systemOneStore.runAffect(historyTurns, affectTarget.value)
  }
  catch (err: any) {
    affectResult.value = { error: err?.message || String(err) }
  }
  finally {
    isRunningAffect.value = false
  }
}

function setTriageExample(type: 'literal' | 'temporal' | 'multihop' | 'detective') {
  if (type === 'literal') {
    triageQuery.value = 'Where did I buy that green ceramic coffee mug?'
  }
  else if (type === 'temporal') {
    triageQuery.value = 'When was the last time we walked in Central Park together?'
  }
  else if (type === 'multihop') {
    triageQuery.value = 'Can you list all the indie coffee shops we have talked about visiting?'
  }
  else if (type === 'detective') {
    triageQuery.value = 'Given what I mentioned about the heavy rain yesterday, is our basement likely flooded?'
  }
}

function setAffectExample(type: 'apology' | 'roast' | 'lie' | 'neutral') {
  if (type === 'apology') {
    affectHistory.value = 'Companion: You seemed frustrated earlier when I asked about the project.\nUser: I was stressed out and snapped at you.'
    affectTarget.value = 'I am really sorry for being short with you earlier, that wasn\'t fair to you at all.'
  }
  else if (type === 'roast') {
    affectHistory.value = 'User: Look at you sitting there like a potato.\nCompanion: I am an advanced AI companion!'
    affectTarget.value = 'Haha you are so helpless, bet you can\'t even roast me back!'
  }
  else if (type === 'lie') {
    affectHistory.value = 'Companion: Did you finish that report you said you were working on?\nUser: Well, to be completely honest...'
    affectTarget.value = 'I actually lied earlier, I was just playing video games all afternoon.'
  }
  else if (type === 'neutral') {
    affectHistory.value = 'User: It looks like it might rain today.'
    affectTarget.value = 'Yeah the weather report said 60% chance of showers by late afternoon.'
  }
}

const isCurrentProviderConfigured = computed(() => {
  if (activeProvider.value === 'laya-local')
    return true
  return !!configuredProviders.value[activeProvider.value]
})
</script>

<template>
  <div :class="['bg-neutral-50 dark:bg-neutral-900/40', 'rounded-xl p-4 sm:p-6', 'flex flex-col gap-6']">
    <!-- Header Banner -->
    <div :class="['flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4', 'border border-primary-500/20 bg-primary-500/5 rounded-xl p-4']">
      <div :class="['flex items-center gap-3.5']">
        <div :class="['i-solar:cpu-bolt-bold-duotone', 'text-3xl text-primary-500 shrink-0']" />
        <div :class="['flex flex-col']">
          <div :class="['flex items-center gap-2']">
            <h1 :class="['text-lg font-bold text-neutral-800 dark:text-neutral-100']">
              System 1 Coprocessor
            </h1>
            <span
              v-if="isCurrentProviderConfigured"
              :class="['px-2 py-0.5 text-xs font-semibold rounded-full', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30']"
            >
              READY
            </span>
            <span
              v-else
              :class="['px-2 py-0.5 text-xs font-semibold rounded-full', 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30']"
            >
              CREDENTIAL REQUIRED
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Ultra-fast cognitive coprocessor for zero-shot question triage, batched candidate reranking, and affective heuristics in &lt; 200ms.
          </p>
        </div>
      </div>

      <div :class="['flex items-center gap-2 self-stretch sm:self-auto justify-end']">
        <button
          type="button"
          :disabled="isPinging || !isCurrentProviderConfigured"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5',
            'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200',
            (isPinging || !isCurrentProviderConfigured) ? 'opacity-50 cursor-not-allowed' : '',
          ]"
          @click="runPing"
        >
          <div v-if="isPinging" :class="['i-solar:restart-bold animate-spin text-sm']" />
          <div v-else :class="['i-solar:radar-bold text-sm']" />
          <span>{{ isPinging ? 'Pinging...' : 'Test Connection' }}</span>
        </button>
      </div>
    </div>

    <!-- Ping Result Feedback -->
    <div v-if="pingResult" :class="['text-xs px-3 py-2 rounded-lg border', pingResult.startsWith('Error') ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400']">
      {{ pingResult }}
    </div>

    <!-- Live Telemetry & Performance Stats Strip -->
    <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-3']">
      <!-- Latency Card -->
      <div :class="['p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 flex flex-col justify-between gap-1']">
        <div :class="['flex items-center justify-between text-[11px] text-neutral-400 font-medium']">
          <span>Latency</span>
          <div :class="['i-solar:stopwatch-play-bold-duotone text-sm text-primary-500']" />
        </div>
        <div :class="['flex items-baseline gap-1.5 mt-1']">
          <span
            :class="[
              'text-lg font-bold font-mono',
              lastLatencyMs == null
                ? 'text-neutral-400'
                : lastLatencyMs < 250
                  ? 'text-emerald-500'
                  : lastLatencyMs < 600
                    ? 'text-amber-500'
                    : 'text-red-500',
            ]"
          >
            {{ lastLatencyMs != null ? `${lastLatencyMs}ms` : '—' }}
          </span>
          <span
            v-if="lastLatencyMs != null"
            :class="[
              'text-[10px] px-1.5 py-0.2 rounded-full font-semibold',
              lastLatencyMs < 250
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : lastLatencyMs < 600
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400',
            ]"
          >
            {{ lastLatencyMs < 250 ? 'FAST' : lastLatencyMs < 600 ? 'GOOD' : 'SLOW' }}
          </span>
        </div>
        <span :class="['text-[10px] text-neutral-400']">Latest round-trip</span>
      </div>

      <!-- Decisions Counter Card -->
      <div :class="['p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 flex flex-col justify-between gap-1']">
        <div :class="['flex items-center justify-between text-[11px] text-neutral-400 font-medium']">
          <span>Decisions</span>
          <div :class="['i-solar:check-read-bold-duotone text-sm text-sky-500']" />
        </div>
        <div :class="['text-lg font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1']">
          {{ systemOneDecisionsCount.toLocaleString() }}
        </div>
        <span :class="['text-[10px] text-neutral-400']">Total evaluated</span>
      </div>

      <!-- Cloud Tokens Card -->
      <div :class="['p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 flex flex-col justify-between gap-1']">
        <div :class="['flex items-center justify-between text-[11px] text-neutral-400 font-medium']">
          <span>Cloud Tokens</span>
          <div :class="['i-solar:cloud-bold-duotone text-sm text-indigo-500']" />
        </div>
        <div :class="['text-lg font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1']">
          {{ systemOneCloudTokens.toLocaleString() }}
        </div>
        <span :class="['text-[10px] text-neutral-400']">Processed in cloud</span>
      </div>

      <!-- Local Tokens / Reset Card -->
      <div :class="['p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 flex flex-col justify-between gap-1']">
        <div :class="['flex items-center justify-between text-[11px] text-neutral-400 font-medium']">
          <span>Local Tokens</span>
          <button
            type="button"
            title="Reset telemetry counters"
            :class="['text-neutral-400 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer']"
            @click="systemOneStore.resetUsageStats()"
          >
            <div :class="['i-solar:restart-bold text-xs']" />
          </button>
        </div>
        <div :class="['text-lg font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1']">
          {{ systemOneLocalTokens.toLocaleString() }}
        </div>
        <span :class="['text-[10px] text-neutral-400']">Processed on-device</span>
      </div>
    </div>

    <!-- Provider Configuration Card -->
    <div :class="['flex flex-col gap-4 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900/60']">
      <div>
        <h2 :class="['text-sm font-bold text-neutral-800 dark:text-neutral-200']">
          System 1 Provider & Model
        </h2>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          Select the backend coprocessor. OpenRouter Decisions and OpenCode Go route fast requests to TypeSafe Jev.
        </p>
      </div>

      <!-- Provider Radio Cards -->
      <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3']">
        <div
          v-for="provider in persistedSystem1ProvidersMetadata"
          :key="provider.id"
          :class="[
            'cursor-pointer rounded-xl p-3 border transition-all flex flex-col justify-between gap-2',
            activeProvider === provider.id
              ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500'
              : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40',
          ]"
          @click="activeProvider = provider.id"
        >
          <div :class="['flex items-start justify-between']">
            <div :class="['flex items-center gap-2']">
              <div :class="[provider.icon || 'i-solar:cpu-bold-duotone', 'text-xl text-primary-500']" />
              <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
                {{ provider.name }}
              </span>
            </div>
            <div v-if="activeProvider === provider.id" :class="['i-solar:check-circle-bold text-primary-500 text-sm']" />
          </div>
          <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug line-clamp-2']">
            {{ provider.description }}
          </p>
          <div :class="['flex items-center justify-between text-[10px] text-neutral-400 mt-1']">
            <span>{{ provider.deployment === 'local' ? '100% Offline' : 'Cloud REST API' }}</span>
            <span v-if="configuredProviders[provider.id]" :class="['text-emerald-500 font-medium']">Configured</span>
            <span v-else-if="provider.id !== 'laya-local'" :class="['text-amber-500 font-medium']">Needs Key</span>
          </div>
        </div>
      </div>

      <!-- Missing Key Notice -->
      <Alert
        v-if="!isCurrentProviderConfigured"
        type="warning"
      >
        <template #title>
          {{ activeProvider }} requires configuration
        </template>
        <template #content>
          <div :class="['flex items-center justify-between gap-2']">
            <span :class="['text-xs']">
              Provide your API key in the Providers page to enable System 1 live requests.
            </span>
            <RouterLink
              :to="`/settings/providers/system1/${activeProvider}`"
              :class="['text-xs font-semibold text-primary-600 dark:text-primary-400 underline shrink-0']"
            >
              Configure Key
            </RouterLink>
          </div>
        </template>
      </Alert>

      <!-- Model Selection -->
      <div v-if="availableModels.length > 0" :class="['flex flex-col gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/60']">
        <label :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">
          Decision Model (Strictly Restricted to Jev Classifiers)
        </label>
        <div :class="['flex flex-wrap gap-2']">
          <button
            v-for="model in availableModels"
            :key="model.id"
            type="button"
            :class="[
              'px-3 py-1.5 text-xs rounded-lg border transition-all text-left flex flex-col',
              activeModel === model.id
                ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-300 font-semibold'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
            ]"
            @click="activeModel = model.id"
          >
            <span>{{ model.name }}</span>
            <span :class="['text-[10px] opacity-75 font-mono']">{{ model.id }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Interactive 3-Tab Playground -->
    <div :class="['flex flex-col gap-4 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900/60']">
      <!-- Tab Navigation -->
      <div :class="['flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2']">
        <button
          type="button"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2',
            activeTab === 'triage'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
          ]"
          @click="activeTab = 'triage'"
        >
          <div :class="['i-solar:compass-bold text-sm']" />
          <span>Tab 1: Query Triage</span>
        </button>

        <button
          type="button"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2',
            activeTab === 'rerank'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
          ]"
          @click="activeTab = 'rerank'"
        >
          <div :class="['i-solar:sort-vertical-bold text-sm']" />
          <span>Tab 2: Batched Rerank</span>
        </button>

        <button
          type="button"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2',
            activeTab === 'affect'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
          ]"
          @click="activeTab = 'affect'"
        >
          <div :class="['i-solar:heart-angle-bold text-sm']" />
          <span>Tab 3: Affect & Sentiment</span>
        </button>
      </div>

      <!-- TAB 1: TRIAGE -->
      <div v-if="activeTab === 'triage'" :class="['flex flex-col gap-4']">
        <div :class="['flex flex-col gap-1']">
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
            Zero-shot classifies conversational queries into LoCoMo cognitive categories (Multi-Hop, Temporal, Detective, Literal) + temporal subtype + session scope in a single pass.
          </p>
          <div :class="['flex flex-wrap items-center gap-1.5 pt-1']">
            <span :class="['text-[11px] font-medium text-neutral-400']">Preset queries:</span>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setTriageExample('literal')"
            >
              Literal
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setTriageExample('temporal')"
            >
              Temporal
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setTriageExample('multihop')"
            >
              Multi-Hop
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setTriageExample('detective')"
            >
              Detective
            </button>
          </div>
        </div>

        <div :class="['flex gap-2']">
          <input
            v-model="triageQuery"
            type="text"
            placeholder="Enter conversational question..."
            :class="['flex-1 px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500']"
            @keydown.enter="handleRunTriage"
          >
          <button
            type="button"
            :disabled="isRunningTriage || !isCurrentProviderConfigured"
            :class="[
              'px-4 py-2 text-xs font-semibold rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors flex items-center gap-1.5 shrink-0',
              (isRunningTriage || !isCurrentProviderConfigured) ? 'opacity-50 cursor-not-allowed' : '',
            ]"
            @click="handleRunTriage"
          >
            <div v-if="isRunningTriage" :class="['i-solar:restart-bold animate-spin text-sm']" />
            <div v-else :class="['i-solar:play-bold text-sm']" />
            <span>Run Triage</span>
          </button>
        </div>

        <!-- Triage Results Output -->
        <div v-if="triageResult" :class="['flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50']">
          <div v-if="triageResult.error" :class="['text-xs text-red-500 font-mono']">
            {{ triageResult.error }}
          </div>
          <div v-else :class="['flex flex-col gap-3']">
            <div :class="['flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2']">
              <div :class="['flex items-center gap-2']">
                <span :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300']">Result Category:</span>
                <span
                  :class="[
                    'px-2.5 py-1 text-xs font-bold rounded-lg border',
                    triageResult.category === 1 ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' : '',
                    triageResult.category === 2 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : '',
                    triageResult.category === 3 ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : '',
                    triageResult.category === 4 ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' : '',
                  ]"
                >
                  Category {{ triageResult.category }} · {{ triageResult.choice }}
                </span>
              </div>
              <span :class="['text-[11px] font-mono text-neutral-400']">{{ triageResult.latencyMs }}ms</span>
            </div>

            <div :class="['grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs']">
              <div :class="['p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800']">
                <span :class="['text-[10px] text-neutral-400 uppercase font-semibold']">Temporal Subtype</span>
                <p :class="['font-medium text-neutral-700 dark:text-neutral-300 mt-0.5']">
                  {{ triageResult.temporalSubtype }}
                </p>
              </div>
              <div :class="['p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800']">
                <span :class="['text-[10px] text-neutral-400 uppercase font-semibold']">Search Scope</span>
                <p :class="['font-medium text-neutral-700 dark:text-neutral-300 mt-0.5']">
                  {{ triageResult.searchScope }}
                </p>
              </div>
              <div :class="['p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 col-span-2 sm:col-span-1']">
                <span :class="['text-[10px] text-neutral-400 uppercase font-semibold']">Confidence</span>
                <p :class="['font-medium text-neutral-700 dark:text-neutral-300 mt-0.5']">
                  {{ Math.round(triageResult.confidence * 100) }}%
                </p>
              </div>
            </div>

            <div v-if="Object.keys(triageResult.probabilities).length > 0" :class="['flex flex-col gap-1 pt-1']">
              <span :class="['text-[10px] font-semibold text-neutral-400 uppercase']">Probabilities Distribution</span>
              <div :class="['flex flex-col gap-1']">
                <div
                  v-for="(prob, opt) in triageResult.probabilities"
                  :key="opt"
                  :class="['flex items-center justify-between text-[11px] font-mono text-neutral-500']"
                >
                  <span>{{ opt }}</span>
                  <span>{{ (Number(prob) * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: RERANK -->
      <div v-if="activeTab === 'rerank'" :class="['flex flex-col gap-4']">
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          Batch-scores multiple candidate memories concurrently in a SINGLE forward pass on a 4-point rubric (0..3), breaking ties with original semantic rankings.
        </p>

        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">Query to Answer:</label>
          <input
            v-model="rerankQuery"
            type="text"
            :class="['px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500']"
          >
        </div>

        <div :class="['flex flex-col gap-2']">
          <div :class="['flex items-center justify-between']">
            <label :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">Candidate Pool (Batched):</label>
            <button
              type="button"
              :class="['text-[11px] text-primary-500 hover:underline font-medium']"
              @click="rerankCandidates.push({ id: String(rerankCandidates.length + 1), text: '' })"
            >
              + Add Candidate
            </button>
          </div>
          <div
            v-for="(cand, idx) in rerankCandidates"
            :key="cand.id"
            :class="['flex items-start gap-2']"
          >
            <span :class="['text-[10px] font-mono text-neutral-400 pt-2 w-4 text-right']">{{ idx + 1 }}</span>
            <textarea
              v-model="cand.text"
              rows="2"
              placeholder="Candidate text snippet..."
              :class="['flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500']"
            />
            <button
              v-if="rerankCandidates.length > 1"
              type="button"
              :class="['p-2 text-neutral-400 hover:text-red-500 text-sm']"
              @click="rerankCandidates.splice(idx, 1)"
            >
              <div :class="['i-solar:trash-bin-trash-bold']" />
            </button>
          </div>
        </div>

        <button
          type="button"
          :disabled="isRunningRerank || !isCurrentProviderConfigured"
          :class="[
            'px-4 py-2 text-xs font-semibold rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors flex items-center justify-center gap-1.5',
            (isRunningRerank || !isCurrentProviderConfigured) ? 'opacity-50 cursor-not-allowed' : '',
          ]"
          @click="handleRunRerank"
        >
          <div v-if="isRunningRerank" :class="['i-solar:restart-bold animate-spin text-sm']" />
          <div v-else :class="['i-solar:play-bold text-sm']" />
          <span>Execute Batched Rerank</span>
        </button>

        <!-- Rerank Results Output -->
        <div v-if="rerankResult" :class="['flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50']">
          <div v-if="rerankResult.error" :class="['text-xs text-red-500 font-mono']">
            {{ rerankResult.error }}
          </div>
          <div v-else :class="['flex flex-col gap-2']">
            <div :class="['flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2']">
              <span :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300']">Ranked Results (Top Down):</span>
              <span :class="['text-[11px] font-mono text-neutral-400']">{{ rerankResult.latencyMs }}ms</span>
            </div>

            <div
              v-for="(item, rIdx) in rerankResult.rankedCandidates"
              :key="item.id"
              :class="['p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5']"
            >
              <div :class="['flex items-center justify-between']">
                <span :class="['text-xs font-bold text-primary-500']">#{{ Number(rIdx) + 1 }} · Final Score: {{ (item.finalScore * 100).toFixed(1) }}%</span>
                <span
                  :class="[
                    'px-2 py-0.5 text-[10px] font-bold rounded',
                    item.jevScore >= 2.5 ? 'bg-emerald-500/10 text-emerald-600' : '',
                    item.jevScore >= 1.5 && item.jevScore < 2.5 ? 'bg-blue-500/10 text-blue-600' : '',
                    item.jevScore >= 0.5 && item.jevScore < 1.5 ? 'bg-amber-500/10 text-amber-600' : '',
                    item.jevScore < 0.5 ? 'bg-neutral-500/10 text-neutral-500' : '',
                  ]"
                >
                  Jev Score: {{ item.jevScore }}/3.0
                </span>
              </div>
              <p :class="['text-xs text-neutral-600 dark:text-neutral-300 italic']">
                "{{ item.text }}"
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: AFFECT -->
      <div v-if="activeTab === 'affect'" :class="['flex flex-col gap-4']">
        <div :class="['flex flex-col gap-1']">
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
            Calculates instant emotional updates (Suspicion Delta, Attachment Delta, Playful Counter-Roast) for ACT token priming without waiting for full generation.
          </p>
          <div :class="['flex flex-wrap items-center gap-1.5 pt-1']">
            <span :class="['text-[11px] font-medium text-neutral-400']">Preset scenarios:</span>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setAffectExample('apology')"
            >
              Sincere Apology
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setAffectExample('roast')"
            >
              Playful Roast
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setAffectExample('lie')"
            >
              Confessed Lie
            </button>
            <button
              type="button"
              :class="['px-2 py-0.5 text-[11px] rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300']"
              @click="setAffectExample('neutral')"
            >
              Normal Chat
            </button>
          </div>
        </div>

        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">Dialogue History (Context):</label>
          <textarea
            v-model="affectHistory"
            rows="2"
            :class="['px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono']"
          />
        </div>

        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">Target User Utterance:</label>
          <input
            v-model="affectTarget"
            type="text"
            :class="['px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500']"
            @keydown.enter="handleRunAffect"
          >
        </div>

        <button
          type="button"
          :disabled="isRunningAffect || !isCurrentProviderConfigured"
          :class="[
            'px-4 py-2 text-xs font-semibold rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors flex items-center justify-center gap-1.5',
            (isRunningAffect || !isCurrentProviderConfigured) ? 'opacity-50 cursor-not-allowed' : '',
          ]"
          @click="handleRunAffect"
        >
          <div v-if="isRunningAffect" :class="['i-solar:restart-bold animate-spin text-sm']" />
          <div v-else :class="['i-solar:play-bold text-sm']" />
          <span>Analyze Emotional Deltas</span>
        </button>

        <!-- Affect Results Output -->
        <div v-if="affectResult" :class="['flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50']">
          <div v-if="affectResult.error" :class="['text-xs text-red-500 font-mono']">
            {{ affectResult.error }}
          </div>
          <div v-else :class="['flex flex-col gap-3']">
            <div :class="['flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2']">
              <span :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300']">Real-Time Affective Primes:</span>
              <span :class="['text-[11px] font-mono text-neutral-400']">{{ affectResult.latencyMs }}ms</span>
            </div>

            <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-3']">
              <!-- Suspicion Delta Card -->
              <div :class="['p-3 rounded-xl border bg-white dark:bg-neutral-900 flex flex-col gap-1', affectResult.suspicionDelta > 0 ? 'border-red-500/40 bg-red-500/5' : affectResult.suspicionDelta < 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-neutral-200 dark:border-neutral-800']">
                <span :class="['text-[10px] text-neutral-400 uppercase font-semibold']">Suspicion Meter</span>
                <div :class="['flex items-center gap-2 mt-1']">
                  <span
                    :class="[
                      'text-lg font-black',
                      affectResult.suspicionDelta > 0 ? 'text-red-500' : affectResult.suspicionDelta < 0 ? 'text-emerald-500' : 'text-neutral-500',
                    ]"
                  >
                    {{ affectResult.suspicionDelta > 0 ? '+1' : affectResult.suspicionDelta < 0 ? '-1' : '0' }}
                  </span>
                  <span :class="['text-xs font-medium text-neutral-600 dark:text-neutral-300']">
                    {{ affectResult.suspicionChoice }}
                  </span>
                </div>
              </div>

              <!-- Attachment Delta Card -->
              <div :class="['p-3 rounded-xl border bg-white dark:bg-neutral-900 flex flex-col gap-1', affectResult.attachmentDelta > 0 ? 'border-pink-500/40 bg-pink-500/5' : 'border-neutral-200 dark:border-neutral-800']">
                <span :class="['text-[10px] text-neutral-400 uppercase font-semibold']">Attachment Delta</span>
                <div :class="['flex items-center gap-2 mt-1']">
                  <span
                    :class="[
                      'text-lg font-black',
                      affectResult.attachmentDelta > 0 ? 'text-pink-500' : 'text-neutral-500',
                    ]"
                  >
                    {{ affectResult.attachmentDelta > 0 ? '+1' : '0' }}
                  </span>
                  <span :class="['text-xs font-medium text-neutral-600 dark:text-neutral-300']">
                    {{ affectResult.attachmentChoice }}
                  </span>
                </div>
              </div>

              <!-- Counter Roast Card -->
              <div :class="['p-3 rounded-xl border bg-white dark:bg-neutral-900 flex flex-col gap-1', affectResult.gremlinPrideAction === 'counter_roast' ? 'border-amber-500/40 bg-amber-500/5' : 'border-neutral-200 dark:border-neutral-800']">
                <span :class="['text-[10px] text-neutral-400 uppercase font-semibold']">Counter-Roast Action</span>
                <div :class="['flex items-center gap-2 mt-1']">
                  <span
                    :class="[
                      'text-sm font-bold',
                      affectResult.gremlinPrideAction === 'counter_roast' ? 'text-amber-500' : 'text-neutral-500',
                    ]"
                  >
                    {{ affectResult.gremlinPrideAction }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.system-one.title
  subtitleKey: settings.title
  settingsEntry: true
  order: 7.5
  stageTransition:
    name: slide
</route>
