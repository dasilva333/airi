<script setup lang="ts">
import type { Pose } from '@proj-airi/model-driver-magic-live2d'
import type { DisplayModel } from '@proj-airi/stage-ui/stores/display-models'

import { neutralPose } from '@proj-airi/model-driver-magic-live2d'
import {
  defaultLive2DBreathControlOptions,
  useLive2DMotionControl,
} from '@proj-airi/stage-ui-live2d/stores'
import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import { Live2DCanvas, Live2DModel } from '@proj-airi/stage-ui/components/scenes'
import {
  defaultLive2DMotionMagicDataset,
  live2dMotionMagicProfiles,
  useLive2DMotionMagic,
} from '@proj-airi/stage-ui/features/motions/live2d'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// NOTICE: The DSL intimacy write-back inside Model.vue is keyed by `modelId`. We force a
// `__playground__/`-prefixed id so persisted intimacy lands under a sandbox key and never
// clobbers the real per-character `settings/live2d/dsl-intimacy` entries. See plan §4.
const PLAYGROUND_ID_PREFIX = '__playground__/'

// The instance type for Live2DModel includes the DSL introspection surface exposed in Model.vue.
interface DslPendingChoice { text: string, nextMtn?: string }
interface DslState {
  active: boolean
  varFloats: Record<string, number>
  pendingChoices: { text?: string, choices: DslPendingChoice[] } | null
  intimacyRaw: number
  intimacyDisplay: number
}

type Live2DModelExposed = InstanceType<typeof Live2DModel> & {
  dispatchDsl: (group: string) => unknown
  selectDslChoice: (index: number) => unknown
  getDslState: () => DslState
  setMotion: (motionName: string, index?: number) => Promise<void>
  listMotionGroups: () => { motionName: string, motionIndex: number, fileName: string }[]
}

const displayModelsStore = useDisplayModelsStore()
const live2dModelRef = ref<Live2DModelExposed>()

const selectedModelId = ref<string>('')
const modelSelectorOpen = ref(false)
const modelState = ref<'pending' | 'loading' | 'mounted'>('pending')
const loadError = ref<string>('')

const dslState = ref<DslState | null>(null)
const motionGroups = ref<{ motionName: string, motionIndex: number, fileName: string }[]>([])
const dispatchGroup = ref('Tapbody')

const selectedModel = computed<DisplayModel | undefined>(() => {
  return displayModelsStore.displayModels.find(m => m.id === selectedModelId.value)
})

const selectedModelSrc = ref<string | undefined>()
const selectedModelFile = ref<File | undefined>()

const playgroundModelId = computed(() => `${PLAYGROUND_ID_PREFIX}${selectedModel.value?.id || 'model'}`)

const followCursor = ref(false)
const mouseFocusAt = ref({ x: 400, y: 300 })

function handleCanvasPointerMove(event: PointerEvent) {
  if (!followCursor.value)
    return
  const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
  if (rect) {
    mouseFocusAt.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }
}

const varFloatEntries = computed(() => Object.entries(dslState.value?.varFloats ?? {}).sort(([a], [b]) => a.localeCompare(b)))
const pendingChoices = computed(() => dslState.value?.pendingChoices ?? null)

// The DSL VM is non-reactive inside Model.vue; poll on a short cadence to keep the
// VarFloats heap / pending choices inspector live without invasive reactive bridging.
useIntervalFn(() => {
  if (modelState.value === 'mounted' && live2dModelRef.value)
    dslState.value = live2dModelRef.value.getDslState()
}, 200)

async function handleModelPick(model: DisplayModel | undefined) {
  loadError.value = ''
  if (!model) {
    selectedModelId.value = ''
    selectedModelSrc.value = undefined
    selectedModelFile.value = undefined
    modelState.value = 'pending'
    return
  }

  selectedModelId.value = model.id
  modelState.value = 'loading'

  try {
    const fullModel = await displayModelsStore.getDisplayModel(model.id) as any
    if (fullModel?.file) {
      selectedModelFile.value = fullModel.file
      selectedModelSrc.value = fullModel.url || fullModel.file.name
    }
    else if (fullModel?.url) {
      selectedModelFile.value = undefined
      selectedModelSrc.value = fullModel.url
    }
    else {
      selectedModelFile.value = undefined
      selectedModelSrc.value = (model as any).url || model.name
    }
  }
  catch (err: any) {
    loadError.value = err?.message || 'Failed to load model from store'
    modelState.value = 'pending'
  }
}

function handleModelLoaded() {
  modelState.value = 'mounted'
  motionGroups.value = live2dModelRef.value?.listMotionGroups() ?? []
  dslState.value = live2dModelRef.value?.getDslState() ?? null
}

function handleModelError(error: Error) {
  modelState.value = 'pending'
  loadError.value = error.message
}

function dispatch() {
  live2dModelRef.value?.dispatchDsl(dispatchGroup.value.trim())
  dslState.value = live2dModelRef.value?.getDslState() ?? null
}

function choose(index: number) {
  live2dModelRef.value?.selectDslChoice(index)
  dslState.value = live2dModelRef.value?.getDslState() ?? null
}

function playMotion(group: string, index: number) {
  void live2dModelRef.value?.setMotion(group, index)
}

// --- Top-Level Segmented Control ---
const activeTab = ref<'dsl' | 'motion'>('dsl')

// --- Ambient Motion (MAGIC AR-HMM / VAR) ---
const ownerId = 'devtools-live2d-ambient-motion'
const motionControl = useLive2DMotionControl()

const ambientMotionEnabled = ref(false)
const selectedProfileId = ref<'idle-calm' | 'speaking-excited'>('idle-calm')
const motionMethod = ref<'ar-hmm' | 'var'>('ar-hmm')

const profileOptions = [
  { value: 'idle-calm', label: 'Calm Resting' },
  { value: 'speaking-excited', label: 'Lively / Speaking' },
]

const methodOptions = [
  { value: 'ar-hmm', label: 'AR-HMM (Markov)' },
  { value: 'var', label: 'VAR (Linear)' },
]

const dynamics = ref({ follow: 1, inertia: 0.6 })
const lastPublishedPose = ref<Pose>({ ...neutralPose })

const currentDataset = computed(() => {
  return live2dMotionMagicProfiles[selectedProfileId.value]?.dataset ?? defaultLive2DMotionMagicDataset
})

const motion = useLive2DMotionMagic({
  dataset: currentDataset,
  publishPose: (pose: Pose) => {
    lastPublishedPose.value = pose
    if (ambientMotionEnabled.value) {
      motionControl.setPose(ownerId, pose, dynamics.value)
    }
  },
  releasePose: () => {
    motionControl.release(ownerId)
  },
})

// Synchronize motion.method with motionMethod
watch(motionMethod, (newMethod) => {
  motion.method.value = newMethod
})

async function toggleAmbientMotion() {
  if (ambientMotionEnabled.value) {
    ambientMotionEnabled.value = false
    motion.stop()
    motionControl.release(ownerId)
    motionControl.releaseBreath(ownerId)
  }
  else {
    ambientMotionEnabled.value = true
    if (!motion.model.value) {
      await motion.initialize(currentDataset.value)
    }
    motion.start()
    motionControl.setBreath(ownerId, defaultLive2DBreathControlOptions)
  }
}

async function handleFit() {
  await motion.initialize(currentDataset.value)
  if (ambientMotionEnabled.value) {
    motion.start()
  }
}

function handleNewSeed() {
  motion.randomizeSeed()
}

watch(selectedProfileId, async () => {
  if (ambientMotionEnabled.value) {
    await motion.initialize(currentDataset.value)
    motion.start()
  }
})

watch(motionMethod, async () => {
  if (ambientMotionEnabled.value) {
    await motion.initialize(currentDataset.value)
    motion.start()
  }
})

onBeforeUnmount(() => {
  motion.stop()
  motionControl.release(ownerId)
  motionControl.releaseBreath(ownerId)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-neutral-950 text-neutral-100">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
      <h1 class="text-sm font-semibold tracking-wide">
        Live2D DSL Playground
      </h1>
      <span class="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
        sandboxed · model id <code class="font-mono">{{ playgroundModelId }}</code>
      </span>
      <span class="ml-auto text-xs text-neutral-400">
        Intimacy writes are isolated from live settings
      </span>
    </header>

    <div class="grid grid-cols-1 min-h-0 flex-1 lg:grid-cols-[1fr_360px]">
      <!-- Canvas / Model viewport -->
      <section
        class="relative min-h-0 border-neutral-800 lg:border-r"
        @pointermove="handleCanvasPointerMove"
      >
        <div class="absolute inset-0">
          <Live2DCanvas
            v-if="selectedModelSrc"
            v-slot="{ app }"
            :width="800"
            :height="600"
            class="h-full w-full"
          >
            <Live2DModel
              ref="live2dModelRef"
              :model-src="selectedModelSrc"
              :model-file="selectedModelFile"
              :model-id="playgroundModelId"
              :app="app"
              :width="800"
              :height="600"
              :disable-focus-at="!followCursor"
              :focus-at="mouseFocusAt"
              @model-loaded="handleModelLoaded"
              @error="handleModelError"
            />
          </Live2DCanvas>

          <!-- Empty state / Model picker trigger -->
          <div
            v-if="!selectedModelSrc"
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center"
          >
            <div class="i-solar:gallery-send-bold-duotone text-5xl text-neutral-600" />
            <div>
              <p class="text-sm text-neutral-300 font-medium">
                No model selected
              </p>
              <p class="mt-1 text-xs text-neutral-500">
                Pick a Live2D model from your collection to test DSL motions &amp; intimacy
              </p>
            </div>
            <button
              class="flex items-center gap-2 border border-neutral-700 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold hover:border-primary-500 hover:bg-neutral-800"
              @click="modelSelectorOpen = true"
            >
              <div class="i-solar:gallery-send-bold-duotone text-sm text-primary-400" />
              <span>Select Model from Collection</span>
            </button>
          </div>

          <div
            v-if="modelState === 'loading'"
            class="absolute inset-0 flex items-center justify-center bg-neutral-950/60"
          >
            <div class="i-svg-spinners:ring-resize text-3xl text-neutral-400" />
          </div>
        </div>

        <div v-if="selectedModelSrc" class="absolute bottom-3 left-3 flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 border border-neutral-700 rounded-lg bg-neutral-900/90 px-3 py-1.5 text-xs text-neutral-200 backdrop-blur hover:bg-neutral-800"
            @click="modelSelectorOpen = true"
          >
            <div class="i-solar:gallery-send-bold-duotone text-xs text-primary-400" />
            <span>Change Model ({{ selectedModel?.name }})</span>
          </button>
          <button
            :class="[
              'flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs backdrop-blur transition-colors',
              followCursor
                ? 'border-primary-500/50 bg-primary-500/15 text-primary-300 hover:bg-primary-500/25'
                : 'border-neutral-700 bg-neutral-900/90 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200',
            ]"
            @click="followCursor = !followCursor"
          >
            <div :class="followCursor ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold'" class="text-xs" />
            <span>Follow Cursor: {{ followCursor ? 'On' : 'Off' }}</span>
          </button>
        </div>
      </section>

      <!-- Inspector -->
      <aside class="min-h-0 flex flex-col overflow-y-auto divide-y divide-neutral-800">
        <!-- Top Segmented Mode Selector -->
        <div class="p-3">
          <div class="flex border border-neutral-800 rounded-lg bg-neutral-900 p-1">
            <button
              :class="[
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors',
                activeTab === 'dsl' ? 'bg-neutral-800 text-neutral-100 shadow-sm' : 'text-neutral-400 hover:text-neutral-200',
              ]"
              @click="activeTab = 'dsl'"
            >
              <div class="i-solar:document-text-bold text-sm" />
              <span>DSL &amp; State</span>
            </button>
            <button
              :class="[
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors',
                activeTab === 'motion' ? 'bg-neutral-800 text-cyan-300 shadow-sm' : 'text-neutral-400 hover:text-neutral-200',
              ]"
              @click="activeTab = 'motion'"
            >
              <div class="i-solar:waterdrops-bold text-sm text-cyan-400" />
              <span>Ambient Motion</span>
            </button>
          </div>
        </div>

        <!-- Tab 1: DSL & State -->
        <div v-if="activeTab === 'dsl'" class="p-4 space-y-5">
          <p v-if="loadError" class="rounded bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {{ loadError }}
          </p>

          <!-- Intimacy -->
          <section>
            <h2 class="mb-2 text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              Intimacy (playground-scoped)
            </h2>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-semibold">{{ dslState?.intimacyDisplay ?? 0 }}</span>
              <span class="text-xs text-neutral-500">/ 100</span>
              <span class="ml-auto text-xs text-neutral-500 font-mono">raw {{ dslState?.intimacyRaw ?? 0 }}</span>
            </div>
          </section>

          <!-- Pending choices -->
          <section v-if="pendingChoices">
            <h2 class="mb-2 text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              Choices
            </h2>
            <p v-if="pendingChoices.text" class="mb-2 text-sm text-neutral-300">
              {{ pendingChoices.text }}
            </p>
            <div class="flex flex-col gap-2">
              <button
                v-for="(choice, index) in pendingChoices.choices"
                :key="index"
                class="border border-neutral-700 rounded bg-neutral-900 px-3 py-2 text-left text-sm hover:border-primary-500 hover:bg-neutral-800"
                @click="choose(index)"
              >
                {{ choice.text }}
              </button>
            </div>
          </section>

          <!-- Dispatch -->
          <section>
            <h2 class="mb-2 text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              Dispatch group
            </h2>
            <div class="flex gap-2">
              <input
                v-model="dispatchGroup"
                placeholder="Tapbody · 送礼#99:香水 …"
                class="min-w-0 flex-1 border border-neutral-700 rounded bg-neutral-900 px-2 py-1.5 text-xs font-mono outline-none focus:border-primary-500"
                @keyup.enter="dispatch"
              >
              <button
                class="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium hover:bg-primary-500 disabled:opacity-40"
                :disabled="modelState !== 'mounted'"
                @click="dispatch"
              >
                Dispatch
              </button>
            </div>
            <p class="mt-1 text-xs text-neutral-500">
              DSL active: <span :class="dslState?.active ? 'text-emerald-400' : 'text-neutral-500'">{{ dslState?.active ? 'yes' : 'no DSL payload' }}</span>
            </p>
          </section>

          <!-- VarFloats heap -->
          <section>
            <h2 class="mb-2 text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              VarFloats heap
            </h2>
            <div v-if="varFloatEntries.length" class="overflow-hidden border border-neutral-800 rounded">
              <table class="w-full text-xs">
                <tbody>
                  <tr
                    v-for="[name, value] in varFloatEntries"
                    :key="name"
                    class="border-b border-neutral-800 last:border-0 odd:bg-neutral-900/60"
                  >
                    <td class="px-2 py-1 text-neutral-300 font-mono">
                      {{ name }}
                    </td>
                    <td class="px-2 py-1 text-right text-neutral-100 font-mono">
                      {{ value }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-xs text-neutral-600">
              Heap empty — dispatch an entry with VarFloats to populate it.
            </p>
          </section>

          <!-- Renderable motions -->
          <section v-if="motionGroups.length">
            <h2 class="mb-2 text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              Motion groups
            </h2>
            <div class="flex flex-col gap-1">
              <button
                v-for="m in motionGroups"
                :key="`${m.motionName}:${m.motionIndex}`"
                class="rounded px-2 py-1 text-left text-xs text-neutral-300 font-mono hover:bg-neutral-800"
                @click="playMotion(m.motionName, m.motionIndex)"
              >
                {{ m.motionName }}[{{ m.motionIndex }}] <span class="text-neutral-600">{{ m.fileName }}</span>
              </button>
            </div>
          </section>
        </div>

        <!-- Tab 2: Ambient Motion Studio -->
        <div v-else-if="activeTab === 'motion'" class="p-4 space-y-5">
          <!-- Master Control & Status Banner -->
          <section class="border border-neutral-800 rounded-xl bg-neutral-900/70 p-3 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xs text-neutral-200 font-semibold tracking-wide uppercase">
                  Ambient Motion (MAGIC)
                </h2>
                <p class="mt-0.5 text-[11px] text-neutral-400">
                  Autoregressive parameter-space idle sway
                </p>
              </div>
              <button
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border',
                  ambientMotionEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700',
                ]"
                @click="toggleAmbientMotion"
              >
                <div :class="ambientMotionEnabled ? 'i-solar:stop-bold text-xs' : 'i-solar:play-bold text-xs'" />
                <span>{{ ambientMotionEnabled ? 'Active' : 'Disabled' }}</span>
              </button>
            </div>

            <!-- Yield / Status Badge -->
            <div class="flex items-center gap-2 pt-1">
              <span class="text-[11px] text-neutral-500">State:</span>
              <span
                v-if="dslState?.active"
                class="inline-flex items-center gap-1 border border-amber-500/30 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300 font-medium"
              >
                <div class="i-solar:pause-circle-bold text-xs" />
                Yielding to DSL Interaction
              </span>
              <span
                v-else-if="ambientMotionEnabled && motion.playing.value"
                class="inline-flex items-center gap-1 border border-emerald-500/30 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300 font-medium"
              >
                <div class="i-solar:waterdrops-bold animate-pulse text-xs" />
                Ambient Presence Active
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded bg-neutral-800/80 px-2 py-0.5 text-[11px] text-neutral-400 font-medium"
              >
                Inactive
              </span>
            </div>
          </section>

          <!-- Profile & Method Selection -->
          <section class="space-y-3">
            <div>
              <label class="mb-1.5 block text-xs text-neutral-400 font-semibold tracking-wide uppercase">
                Motion Profile
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="profile in profileOptions"
                  :key="profile.value"
                  :class="[
                    'px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-colors',
                    selectedProfileId === profile.value
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700',
                  ]"
                  @click="selectedProfileId = (profile.value as any)"
                >
                  {{ profile.label }}
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1.5 block text-xs text-neutral-400 font-semibold tracking-wide uppercase">
                Model Engine
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="method in methodOptions"
                  :key="method.value"
                  :class="[
                    'px-2.5 py-1.5 rounded-lg border text-xs font-medium text-center transition-colors',
                    motionMethod === method.value
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700',
                  ]"
                  @click="motionMethod = (method.value as any)"
                >
                  {{ method.label }}
                </button>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 pt-1">
              <button
                class="flex flex-1 items-center justify-center gap-1.5 border border-neutral-700 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                :disabled="motion.status.value === 'initializing'"
                @click="handleFit"
              >
                <div v-if="motion.status.value === 'initializing'" class="i-svg-spinners:ring-resize text-xs" />
                <div v-else class="i-solar:chart-square-bold text-xs text-cyan-400" />
                <span>{{ motion.model.value ? 'Re-fit Model' : 'Fit Model' }}</span>
              </button>
              <button
                class="flex items-center justify-center gap-1.5 border border-neutral-700 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                @click="handleNewSeed"
              >
                <div class="i-solar:shuffle-bold text-xs text-amber-400" />
                <span>New Seed</span>
              </button>
            </div>
          </section>

          <!-- Dynamics & Spring Tuning -->
          <section class="border border-neutral-800 rounded-xl bg-neutral-900/50 p-3 space-y-3">
            <h2 class="text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              Dynamics &amp; Tuning
            </h2>

            <!-- Noise Scale Slider -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-neutral-400">Micro-Movement Noise</span>
                <span class="text-cyan-300 font-mono">
                  {{ motionMethod === 'ar-hmm' ? motion.arHmmSettings.noiseScale.toFixed(2) : motion.varSettings.noiseScale.toFixed(2) }}x
                </span>
              </div>
              <input
                v-if="motionMethod === 'ar-hmm'"
                v-model.number="motion.arHmmSettings.noiseScale"
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                class="w-full accent-cyan-500"
              >
              <input
                v-else
                v-model.number="motion.varSettings.noiseScale"
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                class="w-full accent-cyan-500"
              >
            </div>

            <!-- Follow / Stiffness -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-neutral-400">Spring Follow (Stiffness)</span>
                <span class="text-cyan-300 font-mono">{{ dynamics.follow.toFixed(2) }}</span>
              </div>
              <input
                v-model.number="dynamics.follow"
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                class="w-full accent-cyan-500"
              >
            </div>

            <!-- Inertia / Momentum -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-neutral-400">Momentum (Inertia)</span>
                <span class="text-cyan-300 font-mono">{{ dynamics.inertia.toFixed(2) }}</span>
              </div>
              <input
                v-model.number="dynamics.inertia"
                type="range"
                min="0.0"
                max="0.95"
                step="0.05"
                class="w-full accent-cyan-500"
              >
            </div>

            <!-- AR-HMM States (if ar-hmm) -->
            <div v-if="motionMethod === 'ar-hmm'" class="pt-1 space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-neutral-400">Markov Regimes (States)</span>
                <span class="text-cyan-300 font-mono">{{ motion.arHmmSettings.stateCount }} states</span>
              </div>
              <input
                v-model.number="motion.arHmmSettings.stateCount"
                type="range"
                min="2"
                max="8"
                step="1"
                class="w-full accent-cyan-500"
              >
            </div>

            <!-- Order -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-neutral-400">Model Order (Lag Frames)</span>
                <span class="text-cyan-300 font-mono">
                  {{ motionMethod === 'ar-hmm' ? motion.arHmmSettings.order : motion.varSettings.order }} frames
                </span>
              </div>
              <input
                v-if="motionMethod === 'ar-hmm'"
                v-model.number="motion.arHmmSettings.order"
                type="range"
                min="4"
                max="18"
                step="1"
                class="w-full accent-cyan-500"
              >
              <input
                v-else
                v-model.number="motion.varSettings.order"
                type="range"
                min="4"
                max="36"
                step="1"
                class="w-full accent-cyan-500"
              >
            </div>
          </section>

          <!-- Real-Time Telemetry & Parameter HUD -->
          <section class="space-y-3">
            <h2 class="text-xs text-neutral-400 font-semibold tracking-wide uppercase">
              Live Diagnostics
            </h2>

            <!-- Markov Regime State Pills -->
            <div v-if="motionMethod === 'ar-hmm'" class="border border-neutral-800 rounded-lg bg-neutral-900 p-2.5 space-y-1.5">
              <div class="flex justify-between text-[11px] text-neutral-400">
                <span>Active Markov Regime</span>
                <span class="text-neutral-300 font-mono">
                  State {{ motion.currentState.value !== undefined ? motion.currentState.value + 1 : '—' }}
                </span>
              </div>
              <div class="flex gap-1.5">
                <div
                  v-for="s in motion.arHmmSettings.stateCount"
                  :key="s"
                  :class="[
                    'flex-1 py-1 rounded text-center text-[10px] font-mono font-bold transition-all',
                    motion.currentState.value === s - 1
                      ? 'bg-cyan-500 text-neutral-950 shadow-sm shadow-cyan-500/50 scale-105'
                      : 'bg-neutral-800 text-neutral-500',
                  ]"
                >
                  S{{ s }}
                </div>
              </div>
            </div>

            <!-- Real-Time Live Angles Readout -->
            <div class="overflow-hidden border border-neutral-800 rounded-lg bg-neutral-900/60">
              <table class="w-full text-xs">
                <tbody>
                  <tr class="border-b border-neutral-800/80">
                    <td class="px-2.5 py-1 text-neutral-400">
                      Head Angles (Yaw / Pitch / Roll)
                    </td>
                    <td class="px-2.5 py-1 text-right text-neutral-200 font-mono">
                      {{ (lastPublishedPose.headX * 30).toFixed(1) }}° / {{ (lastPublishedPose.headY * 30).toFixed(1) }}° / {{ (lastPublishedPose.headZ * 30).toFixed(1) }}°
                    </td>
                  </tr>
                  <tr class="border-b border-neutral-800/80">
                    <td class="px-2.5 py-1 text-neutral-400">
                      Body Angles (Yaw / Roll)
                    </td>
                    <td class="px-2.5 py-1 text-right text-neutral-200 font-mono">
                      {{ (lastPublishedPose.bodyX * 10).toFixed(1) }}° / {{ (lastPublishedPose.bodyZ * 10).toFixed(1) }}°
                    </td>
                  </tr>
                  <tr class="border-b border-neutral-800/80">
                    <td class="px-2.5 py-1 text-neutral-400">
                      Eye Gaze (Ball X / Y)
                    </td>
                    <td class="px-2.5 py-1 text-right text-neutral-200 font-mono">
                      {{ lastPublishedPose.eyeX.toFixed(2) }} / {{ lastPublishedPose.eyeY.toFixed(2) }}
                    </td>
                  </tr>
                  <tr class="border-b border-neutral-800/80">
                    <td class="px-2.5 py-1 text-neutral-400">
                      Generated Duration
                    </td>
                    <td class="px-2.5 py-1 text-right text-neutral-200 font-mono">
                      {{ motion.generatedDurationSeconds.value.toFixed(1) }}s ({{ motion.generatedFrameCount.value }} frames)
                    </td>
                  </tr>
                  <tr>
                    <td class="px-2.5 py-1 text-neutral-400">
                      Fit Duration / Seed
                    </td>
                    <td class="px-2.5 py-1 text-right text-neutral-200 font-mono">
                      {{ motion.fitDurationMs.value.toFixed(0) }}ms / #{{ motion.seed.value }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p v-if="motion.error.value" class="rounded bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {{ motion.error.value }}
            </p>
          </section>
        </div>
      </aside>
    </div>

    <!-- Model Selector Dialog Component -->
    <ModelSelectorDialog
      v-model:show="modelSelectorOpen"
      :selected-model="selectedModel"
      @pick="handleModelPick"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  title: Live2D DSL Playground
  subtitleKey: tamagotchi.settings.devtools.title
</route>
