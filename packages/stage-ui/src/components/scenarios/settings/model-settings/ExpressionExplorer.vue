<script setup lang="ts">
import type { ExpressionCategory } from '../../../../libs/character/expression-noise-gate'
import type { ModelCapabilityItem } from '../../../../stores/display-models'

import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import ModelCustomizerSkeleton from './components/ModelCustomizerSkeleton.vue'

import { classifyExpression } from '../../../../libs/character/expression-noise-gate'
import { DisplayModelFormat, useDisplayModelsStore } from '../../../../stores/display-models'
import { useSettingsControlStrip } from '../../../../stores/settings/control-strip'

export type ExpressionExplorerMode = 'trigger' | 'manage'

interface UnifiedExpression {
  key: string
  displayName: string
  isActive: boolean
  usable: boolean
  category?: string
  expressionCategory?: ExpressionCategory
}

const props = withDefaults(defineProps<{
  /** Display model id whose expression capabilities to browse. */
  modelId?: string
  /**
   * 'trigger' (popover): tap previews, edit affordances hidden.
   * 'manage' (ModelCustomizer): rename + usable toggles enabled.
   */
  mode?: ExpressionExplorerMode
  showInsertActions?: boolean
}>(), {
  modelId: '',
  mode: 'trigger',
  showInsertActions: false,
})

const emit = defineEmits<{
  (e: 'insert-token', token: string): void
  (e: 'update:visible-emotions', payload: { usable: string[], total: number }): void
}>()

const displayModelsStore = useDisplayModelsStore()
const controlStripStore = useSettingsControlStrip()
const live2dStore = useLive2d()
const mmdStore = useMmd()
const spineStore = useSpine()
const modelStore = useModelStore() // VRM

const { stageMateEnabled } = storeToRefs(controlStripStore)
const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

// Resolve Model Format
const currentModel = computed(() => {
  return displayModelsStore.displayModels.find(m => m.id === props.modelId)
})

const modelType = computed<'live2d' | 'vrm' | 'mmd' | 'spine' | 'unknown'>(() => {
  if (!currentModel.value)
    return 'unknown'
  const fmt = currentModel.value.format
  if (fmt === DisplayModelFormat.Live2dZip || fmt === DisplayModelFormat.Live2dDirectory)
    return 'live2d'
  if (fmt === DisplayModelFormat.VRM)
    return 'vrm'
  if (fmt === DisplayModelFormat.PMXZip || fmt === DisplayModelFormat.PMXDirectory || fmt === DisplayModelFormat.PMD)
    return 'mmd'
  if (fmt === DisplayModelFormat.SpineZip)
    return 'spine'
  return 'unknown'
})

// Local capability state (mirrors the persisted display-model metadata)
const expressionCapabilities = ref<ModelCapabilityItem[]>([])
const capabilitiesLoading = ref(false)

watch(() => props.modelId, async (newId) => {
  if (!newId) {
    expressionCapabilities.value = []
    return
  }
  if (displayModelsStore.displayModels.length === 0) {
    await displayModelsStore.loadDisplayModelsFromIndexedDB()
  }
  capabilitiesLoading.value = true
  try {
    const caps = await displayModelsStore.getOrLoadModelCapabilities(newId)
    expressionCapabilities.value = JSON.parse(JSON.stringify(caps.expressionCapabilities || []))
    syncEmotionMappings()
  }
  catch (e) {
    console.error(`[ExpressionExplorer] Failed to load capabilities for ${newId}:`, e)
    expressionCapabilities.value = []
  }
  finally {
    capabilitiesLoading.value = false
  }
}, { immediate: true })

// Sync labels to the store for stage window cross-process triggers
function syncEmotionMappings() {
  const emotionMap: Record<string, string> = {}
  for (const e of expressionCapabilities.value) {
    emotionMap[e.rawKey] = e.label
  }
  live2dStore.emotionMappings = emotionMap
}

async function saveMetadata() {
  if (!props.modelId)
    return
  await displayModelsStore.updateDisplayModelCapabilities(props.modelId, {
    expressionCapabilities: expressionCapabilities.value,
  })
  syncEmotionMappings()
}

// Expression list driven by getOrLoadModelCapabilities (not live renderer
// stores). isActive still reads from the renderer for on-stage feedback, but
// the list itself is sourced from the model file — works whether or not the
// model is currently on stage.
const rawExpressions = computed<UnifiedExpression[]>(() => {
  const mType = modelType.value
  if (mType === 'unknown' || capabilitiesLoading.value)
    return []

  return expressionCapabilities.value.map((item) => {
    let isActive = false
    if (mType === 'live2d') {
      isActive = !!live2dStore.activeExpressions[item.rawKey]
    }
    else if (mType === 'mmd') {
      isActive = mmdStore.previewExpression === item.rawKey
    }
    else if (mType === 'spine') {
      const match = item.rawKey.match(/^(.+?)\s*\[(.+?)\]$/)
      if (match) {
        isActive = spineStore.currentVariant === match[1].trim() && spineStore.currentSkin === match[2].trim()
      }
      else {
        isActive = spineStore.currentVariant === item.rawKey
      }
    }

    return {
      key: item.rawKey,
      displayName: item.label,
      isActive,
      usable: item.usable,
      category: item.rawKey === item.rawKey.toUpperCase() ? 'preset' : 'custom',
      expressionCategory: classifyExpression(item.label || item.rawKey),
    }
  })
})

// Filter states
const usableFilter = ref<'usable' | 'all'>('usable')
const filterRenamedOnly = ref(false)

const usableExpressionsCount = computed(() => rawExpressions.value.filter(e => e.usable).length)
const allExpressionsCount = computed(() => rawExpressions.value.length)

const expressionsToRender = computed(() => {
  let list = rawExpressions.value

  if (usableFilter.value === 'usable') {
    list = list.filter(e => e.usable)
  }

  // Renamed Filter
  if (filterRenamedOnly.value) {
    list = list.filter(e => e.displayName !== e.key)
  }

  return list
})

watch(() => ({
  usable: rawExpressions.value.filter(e => e.usable).map(e => e.displayName),
  total: rawExpressions.value.length,
}), (payload) => {
  emit('update:visible-emotions', payload)
}, { immediate: true })

// Rename Label persisting
const editingKey = ref<string | null>(null)
const editingValue = ref('')

function startEditing(key: string, currentDisplayName: string) {
  editingKey.value = key
  editingValue.value = currentDisplayName
}

async function saveEdits(key: string) {
  if (editingKey.value === null)
    return

  const newValue = editingValue.value.trim()
  const item = expressionCapabilities.value.find(e => e.rawKey === key)
  if (item) {
    item.label = newValue || item.rawKey
  }

  await saveMetadata()
  editingKey.value = null
  editingValue.value = ''
  toast.success('Label updated.')
}

async function toggleUsable(key: string) {
  const item = expressionCapabilities.value.find(e => e.rawKey === key)
  if (item) {
    item.usable = !item.usable
    await saveMetadata()
  }
}

// Trigger Click-to-Effectuate on Stage
function triggerExpressionEffect(key: string) {
  if (modelType.value === 'live2d') {
    live2dStore.triggerEmotion(key, 1.0)
  }
  else if (modelType.value === 'vrm') {
    modelStore.triggerEmotion(key, 1.0)
    if (stageMateEnabled.value && isElectron.value) {
      import('@proj-airi/electron-vueuse').then(({ useElectronEventaInvoke }) => {
        import('@proj-airi/stage-shared').then(({ electronStageMateTriggerExpression }) => {
          const triggerExpr = useElectronEventaInvoke(electronStageMateTriggerExpression)
          triggerExpr({ name: key, weight: 1.0, durationMs: 2500 })
        })
      }).catch(() => {})
    }
  }
  else if (modelType.value === 'mmd') {
    mmdStore.previewExpression = key
    setTimeout(() => {
      if (mmdStore.previewExpression === key)
        mmdStore.previewExpression = null
    }, 2000)
  }
  else if (modelType.value === 'spine') {
    const match = key.match(/^(.+?)\s*\[(.+?)\]$/)
    if (match) {
      const variant = match[1].trim()
      const skin = match[2].trim()
      spineStore.selectVariantAndSkin(variant, skin)
    }
    else {
      spineStore.selectVariantAndSkin(key, 'default')
    }
  }
  if (props.mode === 'manage') {
    toast.info(`Triggered expression: ${key}`)
  }
}
</script>

<template>
  <div class="min-h-0 w-full flex flex-1 flex-col overflow-hidden">
    <!-- Empty (no model in context) -->
    <div
      v-if="!modelId"
      class="flex flex-col items-center justify-center py-6 text-center opacity-40"
    >
      <span class="text-xs">No model selected</span>
    </div>

    <template v-else>
      <!-- Shimmer skeleton while capabilities resolve -->
      <ModelCustomizerSkeleton v-if="capabilitiesLoading" :show-tabs="false" class="my-1" />

      <!-- Filter Controls -->
      <div v-if="!capabilitiesLoading" class="flex shrink-0 flex-col items-stretch gap-1.5 py-2">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
          Filters
        </span>
        <div class="flex items-center gap-1">
          <!-- Usable Only (Default) -->
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] transition-colors"
            :class="usableFilter === 'usable'
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
            title="Showing usable capabilities only"
            @click="usableFilter = 'usable'"
          >
            <div class="inline-flex items-center gap-1">
              <div :class="usableFilter === 'usable' ? 'i-solar:check-circle-bold-duotone' : 'i-solar:circle-linear'" />
              <span>Usable ({{ usableExpressionsCount }})</span>
            </div>
          </button>
          <!-- Show All -->
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] transition-colors"
            :class="usableFilter === 'all'
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
            title="Show all capabilities (including disabled/noise)"
            @click="usableFilter = 'all'"
          >
            <div class="inline-flex items-center gap-1">
              <span>All ({{ allExpressionsCount }})</span>
            </div>
          </button>
          <!-- Renamed Only -->
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] transition-colors"
            :class="filterRenamedOnly
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
            @click="filterRenamedOnly = !filterRenamedOnly"
          >
            {{ filterRenamedOnly ? 'Renamed Only' : 'Filter Renamed' }}
          </button>
        </div>
      </div>

      <!-- Scrollable List Area -->
      <div v-if="!capabilitiesLoading" class="min-h-0 flex-1 overflow-y-auto pb-4">
        <div v-if="expressionsToRender.length === 0" class="py-8 text-center text-xs text-neutral-400">
          No expressions match filters
        </div>
        <div v-else class="min-w-0 w-full overflow-hidden border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div
            v-for="exp in expressionsToRender"
            :key="exp.key"
            :class="[
              'flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors min-w-0 w-full overflow-hidden',
              exp.isActive ? 'bg-primary-50/30 dark:bg-primary-900/15' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
            ]"
          >
            <!-- Left: Active dot + name + key -->
            <div class="min-w-0 flex flex-1 cursor-pointer items-center gap-2" @click="triggerExpressionEffect(exp.key)">
              <div
                :class="['h-2 w-2 rounded-full shrink-0 transition-colors', exp.isActive ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600']"
              />
              <div class="min-w-0 flex-1">
                <template v-if="editingKey === exp.key">
                  <input
                    v-model="editingValue"
                    type="text"
                    class="w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                    @click.stop
                    @keydown.enter="saveEdits(exp.key)"
                    @keydown.esc="editingKey = null"
                  >
                </template>
                <template v-else>
                  <div class="min-w-0 flex flex-1 items-center gap-1 text-sm text-neutral-900 font-medium dark:text-neutral-100">
                    <span class="min-w-0 flex-1 truncate">{{ exp.displayName }}</span>
                  </div>
                </template>
                <span class="block truncate text-[10px] text-neutral-400">{{ exp.key }}</span>
              </div>
            </div>

            <!-- Right: Actions -->
            <div class="ml-2 flex shrink-0 items-center gap-0.5">
              <!-- Append to Sandbox -->
              <button
                v-if="props.showInsertActions"
                class="cursor-pointer rounded p-1 text-neutral-400 hover:bg-primary-500/10 dark:text-neutral-500 hover:text-primary-500"
                title="Insert into Sandbox"
                @click.stop="emit('insert-token', `<|ACT:emotion=\x22${exp.displayName}\x22|>`)"
              >
                <div class="i-solar:document-add-bold-duotone text-sm" />
              </button>
              <!-- Rename (manage mode only) -->
              <button
                v-if="props.mode === 'manage'"
                class="cursor-pointer rounded p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:bg-neutral-700"
                title="Rename"
                @click.stop="startEditing(exp.key, exp.displayName)"
              >
                <div class="i-solar:pen-bold-duotone text-sm" />
              </button>
              <!-- Usable Toggle (manage mode only) -->
              <button
                v-if="props.mode === 'manage'"
                class="cursor-pointer rounded p-1 transition-colors"
                :class="exp.usable
                  ? 'text-primary-500 hover:text-primary-600 bg-primary-500/10'
                  : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700'"
                :title="exp.usable ? 'Usable (Click to disable)' : 'Disabled (Click to enable)'"
                @click.stop="toggleUsable(exp.key)"
              >
                <div :class="exp.usable ? 'i-solar:check-circle-bold-duotone' : 'i-solar:close-circle-line-duotone'" class="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
