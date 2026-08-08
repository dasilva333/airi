<script setup lang="ts">
import type { DisplayModel } from '@proj-airi/stage-ui/stores/display-models'

import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import { Live2DCanvas, Live2DModel } from '@proj-airi/stage-ui/components/scenes'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'

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
      selectedModelSrc.value = model.url
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
      <section class="relative min-h-0 border-neutral-800 lg:border-r">
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
        </div>
      </section>

      <!-- Inspector -->
      <aside class="min-h-0 overflow-y-auto p-4 space-y-5">
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
