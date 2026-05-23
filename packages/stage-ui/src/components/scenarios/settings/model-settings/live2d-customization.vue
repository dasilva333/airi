<script setup lang="ts">
import { useLive2d } from '@proj-airi/stage-ui-live2d/stores'
import { Checkbox, FieldRange } from '@proj-airi/ui'
import { useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'
import { Container } from '../../../data-pane'

const live2dStore = useLive2d()
const airiCardStore = useAiriCardStore()
const settingsStore = useSettings()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const {
  availableExpressions,
  parameterMetadata,
  modelParameters,
  expressionData,
  activeExpressions,
  emotionMappings,
} = storeToRefs(live2dStore)

const saveLive2dState = useDebounceFn(() => {
  if (!activeCard.value)
    return

  // Only auto-save customization state if this model is actually applied to the active character card.
  // This prevents auto-save triggers from corrupting/polluting the active card before "Apply" is clicked,
  // and avoids cross-process local storage sync race conditions that revert the selected preview model.
  if (settingsStore.stageModelSelected !== airiCardStore.getCardDisplayModelId(activeCardId.value))
    return

  const extensions = JSON.parse(JSON.stringify(activeCard.value.extensions))
  if (!extensions.airi)
    extensions.airi = { modules: {} }
  if (!extensions.airi.modules)
    extensions.airi.modules = {}

  extensions.airi.modules.live2d = {
    ...extensions.airi.modules.live2d,
    activeExpressions: { ...activeExpressions.value },
    modelParameters: { ...modelParameters.value },
    emotionMappings: { ...emotionMappings.value },
  }

  airiCardStore.updateCard(activeCardId.value, { extensions })
}, 1000)

watch([activeExpressions, modelParameters, emotionMappings], () => {
  saveLive2dState()
}, { deep: true })

// === Categorize parameters ===
const toggles = computed(() =>
  parameterMetadata.value.filter(p =>
    p.groupName?.toLowerCase().includes('toggle')
    || p.name.toLowerCase().includes('off on')
    || p.id.toLowerCase().includes('onoff'),
  ),
)

const sliders = computed(() =>
  parameterMetadata.value.filter(p =>
    p.groupName?.toLowerCase().includes('slider')
    || (p.groupName && !toggles.value.some(t => t.id === p.id) && !isStandardParam(p.id)),
  ),
)

const otherParams = computed(() =>
  parameterMetadata.value.filter(p =>
    !toggles.value.some(t => t.id === p.id)
    && !sliders.value.some(s => s.id === p.id)
    && !isStandardParam(p.id),
  ),
)

function isStandardParam(id: string) {
  const standardIds = [
    'ParamAngleX',
    'ParamAngleY',
    'ParamAngleZ',
    'ParamEyeLOpen',
    'ParamEyeROpen',
    'ParamEyeSmile',
    'ParamBrowLX',
    'ParamBrowRX',
    'ParamBrowLY',
    'ParamBrowRY',
    'ParamBrowLAngle',
    'ParamBrowRAngle',
    'ParamBrowLForm',
    'ParamBrowRForm',
    'ParamMouthOpenY',
    'ParamMouthForm',
    'ParamCheek',
    'ParamBodyAngleX',
    'ParamBodyAngleY',
    'ParamBodyAngleZ',
    'ParamBreath',
  ]
  return standardIds.includes(id)
}

// === Layer 1: Toggle Expression ===
function isActive(fileName: string): boolean {
  return (activeExpressions.value[fileName] || 0) > 0
}

function toggleExpression(fileName: string) {
  if (isActive(fileName)) {
    unapplyExpression(fileName)
    activeExpressions.value = { ...activeExpressions.value, [fileName]: 0 }
  }
  else {
    applyExpression(fileName)
    activeExpressions.value = { ...activeExpressions.value, [fileName]: 1 }
  }
}

function applyExpression(fileName: string) {
  const expData = expressionData.value.find((e: any) => e.fileName === fileName)?.data
  if (expData?.Parameters) {
    for (const param of expData.Parameters) {
      const id = param.Id || param.id
      const value = param.Value ?? param.value
      if (id !== undefined && value !== undefined) {
        modelParameters.value[id] = value
      }
    }
  }
}

function unapplyExpression(fileName: string) {
  const expData = expressionData.value.find((e: any) => e.fileName === fileName)?.data
  if (expData?.Parameters) {
    for (const param of expData.Parameters) {
      const id = param.Id || param.id
      if (id !== undefined) {
        modelParameters.value[id] = 0
      }
    }
  }
}

function resetAll() {
  for (const fileName of Object.keys(activeExpressions.value)) {
    unapplyExpression(fileName)
  }
  for (const param of toggles.value) {
    modelParameters.value[param.id] = 0
  }
  activeExpressions.value = {}
}

const ACT_EMOTIONS = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'think', 'cool'] as const
const ACT_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  surprised: '😲',
  neutral: '😐',
  think: '🤔',
  cool: '😎',
}

const mappingTarget = ref<string | null>(null)
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(fileName: string) {
  longPressTimer = setTimeout(() => {
    mappingTarget.value = fileName
    longPressTimer = null
  }, 500)
}

function onPointerUp(fileName: string) {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
    toggleExpression(fileName)
  }
}

function onPointerLeave() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function assignMapping(actEmotion: string) {
  if (!mappingTarget.value)
    return
  emotionMappings.value = { ...emotionMappings.value, [mappingTarget.value]: actEmotion }
  mappingTarget.value = null
}

function clearMapping() {
  if (!mappingTarget.value)
    return
  const updated = { ...emotionMappings.value }
  delete updated[mappingTarget.value]
  emotionMappings.value = updated
  mappingTarget.value = null
}

function closeModal() {
  mappingTarget.value = null
}

function getMappedEmotion(fileName: string): string | undefined {
  return emotionMappings.value[fileName]
}

function getToggleValue(id: string) {
  return modelParameters.value[id] > 0.5
}
function setToggleValue(id: string, value: boolean) {
  modelParameters.value[id] = value ? 1 : 0
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header with Reset -->
    <div class="flex items-center justify-between px-2 pt-1">
      <span class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ availableExpressions.length }} expressions · hold to map
      </span>
      <button
        class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
        @click="resetAll"
      >
        Reset All
      </button>
    </div>

    <!-- Expressions Grid -->
    <div v-if="availableExpressions.length > 0" class="flex flex-wrap gap-1 p-2">
      <button
        v-for="exp in availableExpressions"
        :key="exp.fileName"
        :class="[
          'relative rounded-md px-2 py-1 text-xs transition-all duration-150',
          'border border-solid select-none',
          isActive(exp.fileName)
            ? 'bg-primary-500/20 border-primary-400 text-primary-600 dark:text-primary-300 font-medium'
            : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700',
        ]"
        @pointerdown.prevent="onPointerDown(exp.fileName)"
        @pointerup="onPointerUp(exp.fileName)"
        @pointerleave="onPointerLeave"
      >
        {{ exp.name }}
        <span
          v-if="getMappedEmotion(exp.fileName)"
          class="ml-0.5 text-[10px] opacity-70"
        >{{ ACT_EMOJI[getMappedEmotion(exp.fileName)!] || '🔗' }}</span>
      </button>
    </div>

    <!-- Additional Parameters -->
    <Container
      v-if="toggles.length > 0 || sliders.length > 0 || otherParams.length > 0"
      title="Advanced Parameters"
      icon="i-solar:tuning-bold-duotone"
      :expand="false"
      class="mt-2"
    >
      <div class="p-4 space-y-6">
        <!-- Toggles -->
        <div v-if="toggles.length > 0" class="space-y-3">
          <h3 class="text-xs font-bold tracking-wider uppercase opacity-40">
            Toggles
          </h3>
          <div class="grid grid-cols-1 gap-3">
            <div v-for="param in toggles" :key="param.id" class="flex items-center justify-between">
              <span class="text-sm text-neutral-600 font-medium dark:text-neutral-400">{{ param.name }}</span>
              <Checkbox
                :model-value="getToggleValue(param.id)"
                @update:model-value="(val) => setToggleValue(param.id, val)"
              />
            </div>
          </div>
        </div>

        <!-- Sliders -->
        <div v-if="sliders.length > 0" class="space-y-3">
          <h3 class="text-xs font-bold tracking-wider uppercase opacity-40">
            Custom Sliders
          </h3>
          <div class="space-y-4">
            <FieldRange
              v-for="param in sliders"
              :key="param.id"
              v-model="modelParameters[param.id]"
              as="div"
              :label="param.name"
              :min="-1"
              :max="1"
              :step="0.01"
            />
          </div>
        </div>

        <!-- Others -->
        <div v-if="otherParams.length > 0" class="space-y-3">
          <h3 class="text-xs text-amber-500/80 font-bold tracking-wider uppercase opacity-60">
            Other Settings
          </h3>
          <div class="space-y-4">
            <FieldRange
              v-for="param in otherParams"
              :key="param.id"
              v-model="modelParameters[param.id]"
              as="div"
              :label="param.name"
              :min="-1"
              :max="1"
              :step="0.01"
            />
          </div>
        </div>
      </div>
    </Container>

    <!-- ACT Mapping Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="mappingTarget"
          class="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <div class="w-72 border border-neutral-200 rounded-xl border-solid bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
            <div class="mb-3 text-center">
              <div class="text-sm text-neutral-700 font-medium dark:text-neutral-200">
                Map Live2D Expression
              </div>
              <div class="mt-1 rounded-md bg-neutral-100 px-3 py-1 text-xs text-primary-500 font-mono dark:bg-neutral-800">
                {{ availableExpressions.find(e => e.fileName === mappingTarget)?.name || mappingTarget }}
              </div>
              <div class="mt-1 text-[11px] text-neutral-400">
                to an ACT emotion slot
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="emotion in ACT_EMOTIONS"
                :key="emotion"
                :class="[
                  'rounded-lg px-3 py-2 text-sm transition-all duration-150',
                  'border border-solid',
                  getMappedEmotion(mappingTarget!) === emotion
                    ? 'bg-primary-500/20 border-primary-400 text-primary-600 dark:text-primary-300 font-medium'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700',
                ]"
                @click="assignMapping(emotion)"
              >
                {{ ACT_EMOJI[emotion] }} {{ emotion }}
              </button>
            </div>

            <div class="mt-3 flex gap-2">
              <button
                class="flex-1 border border-red-300 rounded-lg border-solid bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors dark:border-red-800 dark:bg-red-900/30 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
                @click="clearMapping"
              >
                Clear Mapping
              </button>
              <button
                class="flex-1 border border-neutral-200 rounded-lg border-solid bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                @click="closeModal"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
