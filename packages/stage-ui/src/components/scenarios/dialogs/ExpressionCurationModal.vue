<script setup lang="ts">
import type { CuratedExpressionItem, ExpressionInputItem } from '../../../composables/use-expression-curation'

import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import {

  useExpressionCuration,
} from '../../../composables/use-expression-curation'
import { useAiriCardStore } from '../../../stores/modules/airi-card'

interface UnifiedExpressionProp {
  key: string
  displayName: string
  isActive: boolean
  actMapping?: string
  isFavorite: boolean
  isVisible: boolean
  expressionCategory?: string
}

interface Props {
  modelValue: boolean
  modelId: string
  modelFormat: string
  visibleExpressions: UnifiedExpressionProp[]
  allExpressions: UnifiedExpressionProp[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'applied'): void
}>()

const airiCardStore = useAiriCardStore()
const {
  isCurating,
  isGeneratingPrompt,
  curationError,
  curateExpressions,
  generateActingPrompt,
  previewOnStage,
  applyCuration,
} = useExpressionCuration()

// State Management
const currentStep = ref<1 | 2 | 3>(1)
const selectedScope = ref<'visible' | 'unhidden' | 'all'>('visible')
const curatedItems = ref<CuratedExpressionItem[]>([])
const customActingPrompt = ref<string>('')
const autoHideSkipped = ref<boolean>(true)
const updateCardPrompt = ref<boolean>(true)
const isSaving = ref<boolean>(false)

// Resolve Candidate items based on scope
const candidateItems = computed<ExpressionInputItem[]>(() => {
  let sourceList: UnifiedExpressionProp[] = []
  if (selectedScope.value === 'visible') {
    sourceList = props.visibleExpressions
  }
  else if (selectedScope.value === 'unhidden') {
    sourceList = props.allExpressions.filter(e => e.isVisible)
  }
  else {
    sourceList = props.allExpressions
  }

  return sourceList.map(e => ({
    key: e.key,
    currentLabel: e.displayName,
    isCustomRenamed: e.displayName !== e.key,
    isFavorite: e.isFavorite,
    category: e.expressionCategory,
  }))
})

const customRenamedCount = computed(() => {
  return candidateItems.value.filter(i => i.isCustomRenamed).length
})

const activeCharacter = computed(() => {
  return airiCardStore.activeCard
})

const activeCuratedItems = computed(() => {
  return curatedItems.value.filter(i => !i.shouldSkip)
})

// Reset on modal open
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    currentStep.value = 1
    selectedScope.value = 'visible'
    curatedItems.value = []
    customActingPrompt.value = ''
    autoHideSkipped.value = true
    updateCardPrompt.value = true
  }
})

async function handleStartCuration() {
  const result = await curateExpressions(
    props.modelId,
    props.modelFormat,
    candidateItems.value,
    {
      characterName: activeCharacter.value?.name,
      personality: activeCharacter.value?.personality,
      description: activeCharacter.value?.description,
    },
  )

  if (result && Array.isArray(result.items)) {
    curatedItems.value = JSON.parse(JSON.stringify(result.items))
    currentStep.value = 2
  }
}

function handlePreview(rawKey: string) {
  previewOnStage(props.modelFormat, rawKey)
}

function toggleSkip(index: number) {
  if (curatedItems.value[index]) {
    curatedItems.value[index].shouldSkip = !curatedItems.value[index].shouldSkip
  }
}

async function triggerGeneratePrompt() {
  const generated = await generateActingPrompt(
    {
      name: activeCharacter.value?.name,
      personality: activeCharacter.value?.personality,
      description: activeCharacter.value?.description,
      scenario: activeCharacter.value?.scenario,
    },
    activeCuratedItems.value,
  )
  customActingPrompt.value = generated
}

async function goToStep3() {
  currentStep.value = 3
  await triggerGeneratePrompt()
}

async function handleApply() {
  isSaving.value = true
  try {
    const success = await applyCuration(
      props.modelId,
      curatedItems.value,
      {
        autoHideSkipped: autoHideSkipped.value,
        updateCardPrompt: updateCardPrompt.value,
        suggestedPrompt: customActingPrompt.value,
      },
    )

    if (success) {
      emit('applied')
      emit('update:modelValue', false)
    }
  }
  finally {
    isSaving.value = false
  }
}

function closeModal() {
  emit('update:modelValue', false)
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 max-h-[88vh] max-w-2xl w-[92vw] flex flex-col border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 dark:border-neutral-800 dark:bg-neutral-900 focus:outline-none"
      >
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
          <div class="flex items-center gap-2.5">
            <div class="h-8 w-8 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
              <div class="i-solar:magic-stick-3-bold-duotone text-lg" />
            </div>
            <div>
              <DialogTitle class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                AI Expression Curator & Acting Directives
              </DialogTitle>
              <p class="text-xs text-neutral-400">
                Translate foreign morphs, generate ACT tokens, and calibrate character acting.
              </p>
            </div>
          </div>

          <!-- Close Button -->
          <button
            class="cursor-pointer rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:text-neutral-500 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            @click="closeModal"
          >
            <div class="i-solar:close-circle-bold text-lg" />
          </button>
        </div>

        <!-- Progress Steps Indicator -->
        <div class="flex shrink-0 border-b border-neutral-100 bg-neutral-50/50 px-6 py-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/30">
          <div class="flex items-center gap-2 text-xs font-medium">
            <div
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                currentStep === 1
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : currentStep > 1 ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-400',
              ]"
            >
              <span class="h-4 w-4 flex items-center justify-center rounded-full text-[10px]" :class="currentStep > 1 ? 'bg-primary-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700'">1</span>
              <span>Scope & Persona</span>
            </div>
            <div class="i-solar:alt-arrow-right-linear text-neutral-400" />
            <div
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                currentStep === 2
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : currentStep > 2 ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-400',
              ]"
            >
              <span class="h-4 w-4 flex items-center justify-center rounded-full text-[10px]" :class="currentStep > 2 ? 'bg-primary-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700'">2</span>
              <span>Review & Preview</span>
            </div>
            <div class="i-solar:alt-arrow-right-linear text-neutral-400" />
            <div
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                currentStep === 3
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-neutral-400',
              ]"
            >
              <span class="h-4 w-4 flex items-center justify-center rounded-full text-[10px]" :class="currentStep === 3 ? 'bg-primary-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700'">3</span>
              <span>Apply & Save</span>
            </div>
          </div>
        </div>

        <!-- Body Area -->
        <div class="min-h-0 flex-1 overflow-y-auto p-6">
          <!-- STEP 1: Scope & Persona -->
          <div v-if="currentStep === 1" class="space-y-5">
            <div>
              <label class="block text-xs text-neutral-700 font-bold dark:text-neutral-300">
                1. Select Expression Scope
              </label>
              <p class="mt-0.5 text-xs text-neutral-400">
                Choose which expressions to send to the AI director for curation.
              </p>

              <div class="grid grid-cols-1 mt-3 gap-2.5 sm:grid-cols-3">
                <div
                  :class="[
                    'p-3.5 rounded-xl border cursor-pointer transition-all',
                    selectedScope === 'visible'
                      ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500 dark:bg-primary-500/10'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40',
                  ]"
                  @click="selectedScope = 'visible'"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">Active Visible</span>
                    <span class="rounded bg-primary-100 px-1.5 py-0.2 text-[10px] text-primary-700 font-bold dark:bg-primary-900/60 dark:text-primary-300">Recommended</span>
                  </div>
                  <div class="mt-2 text-xl text-primary-600 font-bold dark:text-primary-400">
                    {{ props.visibleExpressions.length }}
                  </div>
                  <p class="mt-1 text-[11px] text-neutral-400 leading-tight">
                    Respects your active noise filter and manual hidden flags.
                  </p>
                </div>

                <div
                  :class="[
                    'p-3.5 rounded-xl border cursor-pointer transition-all',
                    selectedScope === 'unhidden'
                      ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500 dark:bg-primary-500/10'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40',
                  ]"
                  @click="selectedScope = 'unhidden'"
                >
                  <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">All Unhidden</span>
                  <div class="mt-2 text-xl text-neutral-800 font-bold dark:text-neutral-200">
                    {{ props.allExpressions.filter(e => e.isVisible).length }}
                  </div>
                  <p class="mt-1 text-[11px] text-neutral-400 leading-tight">
                    All non-hidden morphs including procedural tracking noise.
                  </p>
                </div>

                <div
                  :class="[
                    'p-3.5 rounded-xl border cursor-pointer transition-all',
                    selectedScope === 'all'
                      ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500 dark:bg-primary-500/10'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40',
                  ]"
                  @click="selectedScope = 'all'"
                >
                  <span class="text-xs text-neutral-900 font-bold dark:text-neutral-100">Full Raw Model</span>
                  <div class="mt-2 text-xl text-neutral-800 font-bold dark:text-neutral-200">
                    {{ props.allExpressions.length }}
                  </div>
                  <p class="mt-1 text-[11px] text-neutral-400 leading-tight">
                    Complete raw blendshape dump from the avatar file.
                  </p>
                </div>
              </div>
            </div>

            <!-- Character Persona Card -->
            <div class="border border-neutral-200 rounded-xl bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
              <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
                <div class="i-solar:user-bold-duotone text-primary-500" />
                <span>Active Persona: {{ activeCharacter?.name || 'Companion' }}</span>
              </div>
              <p v-if="activeCharacter?.personality" class="line-clamp-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {{ activeCharacter.personality }}
              </p>
              <div v-if="customRenamedCount > 0" class="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <div class="i-solar:check-circle-bold" />
                <span>{{ customRenamedCount }} custom renamed expressions will be preserved and prioritized.</span>
              </div>
            </div>

            <!-- Error Banner -->
            <div v-if="curationError" class="border border-red-200 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              <div class="flex items-center gap-1.5 font-semibold">
                <div class="i-solar:danger-triangle-bold" />
                <span>Curation Error</span>
              </div>
              <p class="mt-1">
                {{ curationError }}
              </p>
            </div>
          </div>

          <!-- STEP 2: Review & Preview -->
          <div v-else-if="currentStep === 2" class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs text-neutral-900 font-bold dark:text-neutral-100">
                  Review & Preview Curated Expressions
                </h3>
                <p class="text-[11px] text-neutral-400">
                  Edit display names, action tokens, or test on the live avatar before applying.
                </p>
              </div>
              <span class="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] text-primary-700 font-bold dark:bg-primary-900 dark:text-primary-300">
                {{ activeCuratedItems.length }} of {{ curatedItems.length }} active
              </span>
            </div>

            <div class="max-h-[48vh] overflow-y-auto border border-neutral-200 rounded-xl bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <table class="w-full text-left text-xs">
                <thead class="sticky top-0 border-b border-neutral-200 bg-neutral-50 text-[10px] text-neutral-400 font-bold uppercase dark:border-neutral-800 dark:bg-neutral-800/90">
                  <tr>
                    <th class="px-3 py-2">
                      Raw Morph
                    </th>
                    <th class="px-3 py-2">
                      Display Label
                    </th>
                    <th class="px-3 py-2">
                      ACT Action Token
                    </th>
                    <th class="px-2 py-2 text-center">
                      Category
                    </th>
                    <th class="px-2 py-2 text-center">
                      Test
                    </th>
                    <th class="px-2 py-2 text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                  <tr
                    v-for="(item, idx) in curatedItems"
                    :key="item.rawKey"
                    :class="[
                      'transition-colors',
                      item.shouldSkip
                        ? 'opacity-40 bg-neutral-50 dark:bg-neutral-800/30'
                        : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40',
                    ]"
                  >
                    <td class="px-3 py-2 text-[11px] text-neutral-500 font-mono dark:text-neutral-400">
                      <div class="max-w-[120px] truncate" :title="item.rawKey">
                        {{ item.rawKey }}
                      </div>
                      <span v-if="item.shouldSkip && item.skipReason" class="block text-[9px] text-amber-600 font-sans dark:text-amber-400">
                        {{ item.skipReason }}
                      </span>
                    </td>
                    <td class="px-3 py-2">
                      <input
                        v-model="item.label"
                        :disabled="item.shouldSkip"
                        class="w-full border border-neutral-200 rounded px-2 py-1 text-xs dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100 focus:outline-none"
                      >
                    </td>
                    <td class="px-3 py-2 font-mono">
                      <input
                        v-model="item.actToken"
                        :disabled="item.shouldSkip"
                        class="w-full border border-neutral-200 rounded px-2 py-1 text-xs text-primary-600 dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-primary-400 focus:outline-none"
                      >
                    </td>
                    <td class="px-2 py-2 text-center">
                      <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 capitalize dark:bg-neutral-800 dark:text-neutral-300">
                        {{ item.category || 'other' }}
                      </span>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <button
                        class="cursor-pointer rounded p-1 text-neutral-400 hover:bg-primary-500/10 dark:text-neutral-500 hover:text-primary-500"
                        title="Preview on Stage"
                        @click="handlePreview(item.rawKey)"
                      >
                        <div class="i-solar:eye-bold text-sm" />
                      </button>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <button
                        :class="[
                          'px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer',
                          item.shouldSkip
                            ? 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
                        ]"
                        :title="item.shouldSkip ? 'Click to Include' : 'Click to Skip / Hide'"
                        @click="toggleSkip(idx)"
                      >
                        {{ item.shouldSkip ? 'Skipped' : 'Active' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- STEP 3: Apply & Save -->
          <div v-else-if="currentStep === 3" class="space-y-4">
            <!-- Loading State for Step 3 Prompt Generation -->
            <div v-if="isGeneratingPrompt" class="py-12 text-center">
              <div class="i-solar:magic-stick-3-bold-duotone inline-block animate-bounce text-3xl text-primary-500" />
              <div class="mt-3 text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                Drafting In-Character Acting Directives with AI…
              </div>
              <p class="mt-1 text-[11px] text-neutral-400">
                Synthesizing guidelines for all {{ activeCuratedItems.length }} curated ACT tokens tailored to {{ activeCharacter?.name || 'your character' }}.
              </p>
            </div>

            <!-- Loaded State -->
            <template v-else>
              <div>
                <h3 class="text-xs text-neutral-900 font-bold dark:text-neutral-100">
                  Acting Directives & System Prompt
                </h3>
                <p class="text-[11px] text-neutral-400">
                  The AI synthesized instructions teaching {{ activeCharacter?.name || 'the character' }} how to inject the curated ACT tokens in dialogue.
                </p>
              </div>

              <!-- Options Checkboxes -->
              <div class="border border-neutral-200 rounded-xl bg-neutral-50/60 p-4 space-y-2.5 dark:border-neutral-800 dark:bg-neutral-800/40">
                <label class="flex cursor-pointer items-center gap-2 text-xs text-neutral-800 dark:text-neutral-200">
                  <input v-model="autoHideSkipped" type="checkbox" class="h-4 w-4 rounded accent-primary-500">
                  <span>Auto-hide skipped / tracking noise morphs in Model Customizer</span>
                </label>

                <label class="flex cursor-pointer items-center gap-2 text-xs text-neutral-800 dark:text-neutral-200">
                  <input v-model="updateCardPrompt" type="checkbox" class="h-4 w-4 rounded accent-primary-500">
                  <span>Update active character card's ACT acting instructions (<code class="text-[11px] text-primary-500">acting.modelExpressionPrompt</code>)</span>
                </label>
              </div>

              <!-- Acting Prompt Editor -->
              <div>
                <div class="flex items-center justify-between">
                  <label class="block text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                    Generated Acting Instruction Block:
                  </label>
                  <button
                    class="flex cursor-pointer items-center gap-1 text-[11px] text-primary-600 font-medium dark:text-primary-400 hover:underline"
                    @click="triggerGeneratePrompt"
                  >
                    <div class="i-solar:refresh-bold text-xs" />
                    <span>Regenerate Directives</span>
                  </button>
                </div>
                <textarea
                  v-model="customActingPrompt"
                  rows="6"
                  class="mt-1.5 w-full border border-neutral-200 rounded-xl bg-white p-3 text-xs text-neutral-800 leading-relaxed font-mono dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800/80 dark:text-neutral-200 focus:outline-none"
                />
              </div>
            </template>
          </div>
        </div>

        <!-- Footer / Navigation -->
        <div class="dark:bg-neutral-850 flex shrink-0 items-center justify-between border-t border-neutral-100 bg-neutral-50/80 px-6 py-3.5 dark:border-neutral-800">
          <button
            v-if="currentStep > 1"
            :disabled="isGeneratingPrompt"
            class="cursor-pointer border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-700 font-medium dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 disabled:opacity-50 dark:hover:bg-neutral-700"
            @click="currentStep = (currentStep - 1) as any"
          >
            ← Back
          </button>
          <div v-else />

          <div class="flex items-center gap-2">
            <button
              class="cursor-pointer rounded-lg px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              @click="closeModal"
            >
              Cancel
            </button>

            <!-- Step 1 Next -->
            <button
              v-if="currentStep === 1"
              :disabled="isCurating || candidateItems.length === 0"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs text-white font-semibold shadow-sm transition-all hover:bg-primary-600 disabled:opacity-50"
              @click="handleStartCuration"
            >
              <div v-if="isCurating" class="i-solar:spinner-bold animate-spin text-sm" />
              <div v-else class="i-solar:magic-stick-3-bold-duotone text-sm" />
              <span>{{ isCurating ? 'Curating Expressions…' : '✨ Start AI Curation' }}</span>
            </button>

            <!-- Step 2 Next (Triggers 2nd LLM Pass) -->
            <button
              v-else-if="currentStep === 2"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs text-white font-semibold shadow-sm transition-all hover:bg-primary-600"
              @click="goToStep3"
            >
              <span>Next: Review Acting Directives →</span>
            </button>

            <!-- Step 3 Apply -->
            <button
              v-else-if="currentStep === 3"
              :disabled="isSaving || isGeneratingPrompt"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs text-white font-semibold shadow-sm transition-all hover:bg-primary-600 disabled:opacity-50"
              @click="handleApply"
            >
              <div v-if="isSaving" class="i-solar:spinner-bold animate-spin text-sm" />
              <div v-else class="i-solar:diskette-bold text-sm" />
              <span>{{ isSaving ? 'Saving…' : '💾 Apply to Model & Card' }}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
