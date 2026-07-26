<script setup lang="ts">
import type { DisplayModel } from '../../../../stores/display-models'

import { Button } from '@proj-airi/ui'
import { useMediaQuery, useResizeObserver, useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger, VisuallyHidden } from 'reka-ui'
import { DrawerContent, DrawerHandle, DrawerOverlay, DrawerPortal, DrawerRoot, DrawerTrigger } from 'vaul-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAiriCardStore } from '../../../../stores/modules'

const props = defineProps<{
  selectedModel?: DisplayModel
  modelId?: string
}>()

const emits = defineEmits<{
  (e: 'assigned', targetKey: string): void
}>()

const showDialog = defineModel('show', { type: Boolean, default: false, required: false })
const isDesktop = useMediaQuery('(min-width: 768px)')
const screenSafeArea = useScreenSafeArea()

useResizeObserver(document.documentElement, () => screenSafeArea.update())
onMounted(() => screenSafeArea.update())

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { updateCard } = airiCardStore

const showAllConcepts = ref(false)
const selectedTargetKey = ref<string>('')

interface ConceptOption {
  key: string
  label: string
  description?: string
  currentModelId?: string
  isAssigned: boolean
  isRootFallback?: boolean
}

const visualAssets = computed(() => {
  return activeCard.value?.extensions?.airi?.visual_assets || {}
})

// Concepts with explicit manifestation modelId
const assignedConcepts = computed<ConceptOption[]>(() => {
  const assets = visualAssets.value
  const result: ConceptOption[] = []

  for (const [key, asset] of Object.entries(assets)) {
    if (asset?.manifestation?.modelId) {
      result.push({
        key,
        label: key,
        description: asset.description || asset.prompt,
        currentModelId: asset.manifestation.modelId,
        isAssigned: true,
      })
    }
  }
  return result
})

const isMultiModelSetup = computed(() => assignedConcepts.value.length > 0)

// Concepts without explicit manifestation modelId
const unassignedConcepts = computed<ConceptOption[]>(() => {
  const assets = visualAssets.value
  const result: ConceptOption[] = []

  for (const [key, asset] of Object.entries(assets)) {
    if (!asset?.manifestation?.modelId) {
      result.push({
        key,
        label: key,
        description: asset.description || asset.prompt,
        currentModelId: undefined,
        isAssigned: false,
      })
    }
  }
  return result
})

const availableOptions = computed<ConceptOption[]>(() => {
  if (!isMultiModelSetup.value) {
    // Single-model setup: root displayModelId is the only option
    return [
      {
        key: '__ROOT_DISPLAY_MODEL__',
        label: activeCard.value?.name || 'Primary Character Default',
        description: 'Set as the main 3D model for this card',
        currentModelId: activeCard.value?.extensions?.airi?.modules?.displayModelId,
        isAssigned: true,
        isRootFallback: true,
      },
    ]
  }

  // Multi-model setup: list assigned concepts, and unassigned concepts if toggle is enabled
  if (showAllConcepts.value) {
    return [...assignedConcepts.value, ...unassignedConcepts.value]
  }
  return assignedConcepts.value
})

watch(showDialog, (isOpen) => {
  if (isOpen && availableOptions.value.length > 0) {
    selectedTargetKey.value = availableOptions.value[0].key
  }
})

watch(availableOptions, (newOptions) => {
  if (newOptions.length > 0 && !newOptions.some(opt => opt.key === selectedTargetKey.value)) {
    selectedTargetKey.value = newOptions[0].key
  }
})

async function handleConfirmAssignment() {
  if (!activeCardId.value || !activeCard.value || !selectedTargetKey.value)
    return

  const targetModelId = props.selectedModel?.id || props.modelId || ''
  if (!targetModelId) {
    toast.error('No model selected to assign.')
    return
  }

  const cardId = activeCardId.value
  const card = activeCard.value

  if (selectedTargetKey.value === '__ROOT_DISPLAY_MODEL__') {
    const updatedAiriExtension = {
      ...card.extensions.airi,
      modules: {
        ...card.extensions.airi.modules,
        displayModelId: targetModelId,
      },
    }
    await updateCard(cardId, {
      extensions: {
        ...card.extensions,
        airi: updatedAiriExtension,
      },
    })
    toast.success(`Assigned model to ${card.name || 'character'}`)
  }
  else {
    const conceptKey = selectedTargetKey.value
    const currentAsset = card.extensions.airi.visual_assets?.[conceptKey] || { description: '' }

    const updatedVisualAssets = {
      ...card.extensions.airi.visual_assets,
      [conceptKey]: {
        ...currentAsset,
        manifestation: {
          ...currentAsset.manifestation,
          modelId: targetModelId,
        },
      },
    }

    const currentModule = (card.extensions.airi.modules as Record<string, any>)?.[conceptKey] || {}
    const updatedModules = {
      ...card.extensions.airi.modules,
      [conceptKey]: {
        ...currentModule,
        manifestation: {
          ...(currentModule as any)?.manifestation,
          modelId: targetModelId,
        },
      },
    }

    await updateCard(cardId, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions.airi,
          modules: updatedModules,
          visual_assets: updatedVisualAssets,
        },
      },
    })
    toast.success(`Assigned model to concept '${conceptKey}'`)
  }

  // Also sync to character-bindings in localStorage for AnimaDex/Guided wizard
  try {
    const raw = localStorage.getItem('settings/airi-card/character-bindings')
    const map = raw ? JSON.parse(raw) : {}
    const triggerKey = card.name?.toLowerCase().trim()
    if (triggerKey) {
      map[triggerKey] = {
        ...map[triggerKey],
        trigger: triggerKey,
        displayModelId: targetModelId,
      }
      localStorage.setItem('settings/airi-card/character-bindings', JSON.stringify(map))
    }
  }
  catch (e) {
    console.error('Failed to sync character-bindings on model assignment:', e)
  }

  emits('assigned', selectedTargetKey.value)
  showDialog.value = false
}
</script>

<template>
  <DialogRoot v-if="isDesktop" :open="showDialog" @update:open="value => showDialog = value">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogPortal v-if="showDialog">
      <DialogOverlay :class="['fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn']" />
      <DialogContent :class="['fixed left-1/2 top-1/2 z-[9999] max-h-[90dvh] max-w-lg w-[92dvw] transform overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none backdrop-blur-md -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:bg-neutral-900']">
        <VisuallyHidden>
          <DialogTitle>Assign Model to Character</DialogTitle>
        </VisuallyHidden>

        <div :class="['flex flex-col gap-4']">
          <!-- Header -->
          <div :class="['flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800']">
            <div :class="['flex items-center gap-2']">
              <div :class="['i-solar:user-bold-duotone text-xl text-primary-500']" />
              <h3 :class="['text-lg font-semibold text-neutral-900 dark:text-neutral-100']">
                Assign Model to Character
              </h3>
            </div>
            <button
              :class="['rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300']"
              @click="showDialog = false"
            >
              <div :class="['i-solar:close-square-bold-duotone text-xl']" />
            </button>
          </div>

          <!-- Model info banner -->
          <div :class="['flex items-center gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50']">
            <div :class="['h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500']">
              <div :class="['i-solar:box-minimalistic-bold-duotone text-xl']" />
            </div>
            <div :class="['min-w-0 flex-1']">
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                Selected Model
              </p>
              <p :class="['truncate text-sm font-medium text-neutral-900 dark:text-neutral-100']">
                {{ props.selectedModel?.name || props.modelId || 'Selected Model' }}
              </p>
            </div>
          </div>

          <!-- Multi-model director notice & toggle -->
          <div v-if="isMultiModelSetup" :class="['flex flex-col gap-2']">
            <div :class="['rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2']">
              <div :class="['i-solar:info-circle-bold-duotone text-base flex-shrink-0 mt-0.5']" />
              <span>Multi-concept card detected. Root model fallback is managed by the Director between turns. Assign directly to a concept slot below.</span>
            </div>

            <div v-if="unassignedConcepts.length > 0" :class="['flex items-center justify-between pt-1']">
              <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                Show unassigned concepts ({{ unassignedConcepts.length }})
              </span>
              <button
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  showAllConcepts ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
                ]"
                @click="showAllConcepts = !showAllConcepts"
              >
                <span
                  :class="[
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    showAllConcepts ? 'translate-x-4' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
          </div>

          <!-- Target Candidates List -->
          <div :class="['flex flex-col gap-2 max-h-60 overflow-y-auto pr-1']">
            <label
              v-for="opt in availableOptions"
              :key="opt.key"
              :class="[
                'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition',
                selectedTargetKey === opt.key
                  ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
              ]"
              @click="selectedTargetKey = opt.key"
            >
              <div :class="['flex items-center gap-3 min-w-0 flex-1']">
                <input
                  type="radio"
                  name="model-target"
                  :value="opt.key"
                  :checked="selectedTargetKey === opt.key"
                  :class="['text-primary-500 focus:ring-primary-500']"
                  @change="selectedTargetKey = opt.key"
                >
                <div :class="['min-w-0 flex-1']">
                  <div :class="['flex items-center gap-2']">
                    <span :class="['font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate']">
                      {{ opt.label }}
                    </span>
                    <span
                      v-if="opt.isRootFallback"
                      :class="['rounded px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300']"
                    >
                      Default
                    </span>
                    <span
                      v-else-if="!opt.isAssigned"
                      :class="['rounded px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400']"
                    >
                      Unassigned
                    </span>
                  </div>
                  <p v-if="opt.description" :class="['text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5']">
                    {{ opt.description }}
                  </p>
                </div>
              </div>
            </label>

            <div v-if="availableOptions.length === 0" :class="['py-6 text-center text-sm text-neutral-500']">
              No concepts available for model assignment. Toggle "Show unassigned concepts" to reveal available slots.
            </div>
          </div>

          <!-- Actions -->
          <div :class="['flex items-center justify-end gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800']">
            <Button variant="secondary" @click="showDialog = false">
              Cancel
            </Button>
            <Button
              variant="primary"
              :disabled="!selectedTargetKey || !activeCardId"
              @click="handleConfirmAssignment"
            >
              Assign Model
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <DrawerRoot v-else :open="showDialog" should-scale-background @update:open="value => showDialog = value">
    <DrawerTrigger as-child>
      <slot />
    </DrawerTrigger>
    <DrawerPortal v-if="showDialog">
      <DrawerOverlay :class="['fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm']" />
      <DrawerContent
        :class="['fixed bottom-0 left-0 right-0 z-[10000] mt-20 max-h-[85%] flex flex-col rounded-t-2xl bg-white p-4 outline-none backdrop-blur-md dark:bg-neutral-900']"
        :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 24)}px` }"
      >
        <DrawerHandle />
        <div :class="['flex flex-col gap-4 pt-2']">
          <div :class="['flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800']">
            <h3 :class="['text-lg font-semibold text-neutral-900 dark:text-neutral-100']">
              Assign Model to Character
            </h3>
          </div>

          <!-- Model info banner -->
          <div :class="['flex items-center gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50']">
            <div :class="['min-w-0 flex-1']">
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                Selected Model
              </p>
              <p :class="['truncate text-sm font-medium text-neutral-900 dark:text-neutral-100']">
                {{ props.selectedModel?.name || props.modelId || 'Selected Model' }}
              </p>
            </div>
          </div>

          <!-- Multi-model director notice & toggle -->
          <div v-if="isMultiModelSetup" :class="['flex flex-col gap-2']">
            <div :class="['rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400']">
              Multi-concept card detected. Root model is managed by Director. Select a concept slot below.
            </div>
            <div v-if="unassignedConcepts.length > 0" :class="['flex items-center justify-between']">
              <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                Show unassigned concepts ({{ unassignedConcepts.length }})
              </span>
              <button
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                  showAllConcepts ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
                ]"
                @click="showAllConcepts = !showAllConcepts"
              >
                <span
                  :class="[
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                    showAllConcepts ? 'translate-x-4' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
          </div>

          <!-- Target Candidates List -->
          <div :class="['flex flex-col gap-2 max-h-52 overflow-y-auto pr-1']">
            <label
              v-for="opt in availableOptions"
              :key="opt.key"
              :class="[
                'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition',
                selectedTargetKey === opt.key
                  ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
              ]"
              @click="selectedTargetKey = opt.key"
            >
              <div :class="['flex items-center gap-3 min-w-0 flex-1']">
                <input
                  type="radio"
                  name="model-target-mobile"
                  :value="opt.key"
                  :checked="selectedTargetKey === opt.key"
                  @change="selectedTargetKey = opt.key"
                >
                <span :class="['font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate']">
                  {{ opt.label }}
                </span>
              </div>
            </label>
          </div>

          <div :class="['flex items-center justify-end gap-2 pt-2']">
            <Button variant="secondary" @click="showDialog = false">
              Cancel
            </Button>
            <Button
              variant="primary"
              :disabled="!selectedTargetKey || !activeCardId"
              @click="handleConfirmAssignment"
            >
              Assign Model
            </Button>
          </div>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
