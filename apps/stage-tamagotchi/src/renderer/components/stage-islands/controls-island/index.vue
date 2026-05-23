<script setup lang="ts">
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { useLive2d } from '@proj-airi/stage-ui/stores/live2d'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings, useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings'
import { useColorMode } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import ControlButtonTooltip from './control-button-tooltip.vue'
import ControlButton from './control-button.vue'
import ControlsIslandFadeOnHover from './controls-island-fade-on-hover.vue'
import ControlsIslandHearingConfig from './controls-island-hearing-config.vue'
import GeminiControls from './gemini-controls.vue'
import IndicatorMicVolume from './indicator-mic-volume.vue'

import {
  electronCaptionSyncDocking,
  electronCaptionToggleVisibility,
  electronOpenChat,
  electronOpenSettings,
  electronStartDraggingWindow,
  electronWindowHide,
} from '../../../../shared/eventa'

defineProps<{
  isLocked?: boolean
}>()

const emit = defineEmits<{
  (e: 'take-photo'): void
}>()
const viewControlsActiveMode = defineModel<'x' | 'y' | 'z' | 'scale'>('viewControlsActiveMode', { default: 'scale' })
const { t } = useI18n()

const providersStore = useProvidersStore()
const settingsAudioDeviceStore = useSettingsAudioDevice()
const settingsStore = useSettings()
const modelStore = useModelStore()
const cardStore = useAiriCardStore()
const live2dStore = useLive2d()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const context = useElectronEventaContext()
const { enabled } = storeToRefs(settingsAudioDeviceStore)
const { alwaysOnTop, controlsIslandIconSize, stageModelRenderer } = storeToRefs(settingsStore)
const { activeCard, activeCardId } = storeToRefs(cardStore)
const liveSessionStore = useLiveSessionStore()
const colorMode = useColorMode()

function toggleTheme() {
  colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
}
const visionStore = useVisionStore()
const { powerState } = storeToRefs(liveSessionStore)
const { status: visionStatus } = storeToRefs(visionStore)
const { interactionMode, detectedWardrobe, activeExpressions } = storeToRefs(modelStore)
const vrmIdleAnimation = toRef(modelStore as any, 'vrmIdleAnimation')

const hasGeminiKey = computed(() => {
  const creds = providersStore.getProviderConfig('google-generative-ai')
  return !!(typeof creds?.apiKey === 'string' && creds.apiKey.trim())
})

// Watch for profile changes to provide feedback
const lastCardId = ref(activeCardId.value)
watch(activeCard, (card) => {
  if (card && activeCardId.value !== lastCardId.value) {
    lastCardId.value = activeCardId.value
    toast.info(`You selected AIRI Card: ${card.name}`, { id: 'transcription-feedback' })
  }
})
const openSettings = useElectronEventaInvoke(electronOpenSettings)
const openChat = useElectronEventaInvoke(electronOpenChat)
const isLinux = ref(false)
const hideWindow = useElectronEventaInvoke(electronWindowHide)

const toggleCaptionVisibility = useElectronEventaInvoke(electronCaptionToggleVisibility)
const syncCaptionDocking = useElectronEventaInvoke(electronCaptionSyncDocking)

const expanded = ref(false)
const geminiExpanded = ref(false)
const islandRef = ref<HTMLElement>()

// === Sub-menu state ===
const view = ref<'main' | 'emotions' | 'wardrobe' | 'profiles' | 'captions' | 'view-window' | 'wardrobe-discovery' | 'placement'>('main')

// Auto-expand to wardrobe-discovery when a tactile hit detects sibling outfits
watch(() => detectedWardrobe.value.siblings, (siblings) => {
  if (siblings.length > 0) {
    expanded.value = true
    view.value = 'wardrobe-discovery'
  }
})

// Swap outfit by toggling VRM expression weights
function swapOutfit(sibling: { display: string, raw: string }) {
  // Deactivate all siblings for this slot (including current active)
  const allSiblings = [...detectedWardrobe.value.siblings]
  if (detectedWardrobe.value.active) {
    allSiblings.push(detectedWardrobe.value.active)
  }

  // 1. Create a shallow copy of activeExpressions to ensure reference change triggers Vue watchers
  const nextExpressions = { ...activeExpressions.value }

  for (const s of allSiblings) {
    if (s.raw)
      nextExpressions[s.raw] = 0
  }

  // 2. Activate the target
  nextExpressions[sibling.raw] = 1

  // 3. Apply the updated object
  activeExpressions.value = nextExpressions

  // 4. Update the detection state so the UI reflects the swap (clicked item becomes active)
  const newSiblings = allSiblings.filter(s => s.raw !== sibling.raw)
  detectedWardrobe.value = {
    active: sibling,
    siblings: newSiblings,
    texIndex: detectedWardrobe.value.texIndex,
  }

  // [WIRED] Ensure expressions are registered in modelStore so they are applied on next update
  const rawNames = [sibling.raw, ...newSiblings.map(s => s.raw)]
  rawNames.forEach((raw) => {
    if (raw && !modelStore.availableExpressions.includes(raw)) {
      modelStore.availableExpressions.push(raw)
    }
  })
}

// Expose whether hearing dialog is open so parent can disable click-through
const hearingDialogOpen = ref(false)
const geminiRef = ref<HTMLElement>()
const geminiPanelRef = ref<HTMLElement>()

defineExpose({
  hearingDialogOpen,
  rootElement: islandRef,
  geminiRootElement: geminiRef,
  geminiPanelElement: geminiPanelRef,
})

watch(expanded, (isExp) => {
  if (isExp) {
    geminiExpanded.value = false
  }
  else {
    view.value = 'main' // Reset sub-menu when collapsing
    settingsStore.stageViewControlsEnabled = false // Disable view controls overlay when collapsing
  }
})

function toggleAlwaysOnTop() {
  alwaysOnTop.value = !alwaysOnTop.value
  expanded.value = false
}

function toggleInteractionMode() {
  interactionMode.value = interactionMode.value === 'orbit' ? 'tactile' : 'orbit'
  toast.success(`Switched to ${interactionMode.value === 'orbit' ? 'Orbit (Camera)' : 'Tactile (Poke)'} Mode`, { id: 'interaction-mode' })
}

function handleOpenSettings() {
  expanded.value = false
  return openSettings({})
}

function handleOpenChat() {
  expanded.value = false
  return openChat()
}

function handleViewGallery() {
  if (activeCardId.value) {
    openSettings({ route: `/settings/airi-card?cardId=${activeCardId.value}&tab=gallery` })
    expanded.value = false
  }
}

function handleManageProfiles() {
  openSettings({ route: '/settings/airi-card' })
  expanded.value = false
}

// === Capture Handles (Future) ===

// Grouped classes for icon / border / padding and combined style class
const adjustStyleClasses = computed(() => {
  let isLarge: boolean

  // Determine size based on setting
  switch (controlsIslandIconSize.value) {
    case 'large':
      isLarge = true
      break
    case 'small':
      isLarge = false
      break
    case 'auto':
    default:
      // Fixed to large for better visibility in the new layout,
      // can be changed to windowHeight based check if absolutely needed.
      isLarge = true
      break
  }

  const icon = isLarge ? 'size-5' : 'size-3'
  const border = isLarge ? 'border-2' : 'border-0'
  const padding = isLarge ? 'p-2' : 'p-0.5'
  return { icon, border, padding, button: `${border} ${padding}` }
})

const geminiColorClasses = computed(() => {
  if (powerState.value === 'busy')
    return 'text-purple-500 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-pulse shadow-purple-500/50'
  if (powerState.value === 'active')
    return 'text-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
  if (powerState.value === 'connecting')
    return 'text-sky-400 animate-pulse'
  if (powerState.value === 'ambient')
    return 'text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] transition-all duration-1000 animate-pulse'

  return 'text-neutral-600 dark:neutral-400 opacity-50'
})

const geminiIconClasses = computed(() => {
  if (visionStatus.value === 'capturing')
    return 'text-green-500 scale-110 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'
  return ''
})

function handleGeminiToggle() {
  if (!hasGeminiKey.value) {
    toast.error('Provide your API key in Settings > Providers > Google Gemini to take advantage of these exciting new features')
    return
  }
  geminiExpanded.value = !geminiExpanded.value
  if (geminiExpanded.value) {
    expanded.value = false
  }
}

/**
 * This is a know issue (or expected behavior maybe) to Electron.
 * We don't use this approach on Linux because it's not working.
 *
 * See `apps/stage-tamagotchi/src/main/windows/main/index.ts` for handler definition
 */
const startDraggingWindowInvoke = useElectronEventaInvoke(electronStartDraggingWindow, context.value)
function startDraggingWindow() {
  if (!isLinux.value) {
    startDraggingWindowInvoke()
  }
}

async function refreshWindow() {
  expanded.value = false
  // Use store-level applyCardState with force=true to reload model without full page refresh
  if (activeCard.value) {
    await cardStore.activateCard(activeCardId.value, true)
  }
  else {
    window.location.reload()
  }
}

// === Emotions ===
const ACT_EMOTIONS = [
  { key: 'happy', emoji: '😊' },
  { key: 'sad', emoji: '😢' },
  { key: 'angry', emoji: '😠' },
  { key: 'surprised', emoji: '😲' },
  { key: 'neutral', emoji: '😐' },
  { key: 'think', emoji: '🤔' },
  { key: 'cool', emoji: '😎' },
] as const

function triggerEmotion(emotion: string) {
  if (typeof (window as any).testEmotion === 'function') {
    ;(window as any).testEmotion(emotion)
    toast.info(`Triggered ${emotion} expression`, { id: 'transcription-feedback' })
  }
}

function triggerRandomEmotion() {
  const random = ACT_EMOTIONS[Math.floor(Math.random() * ACT_EMOTIONS.length)]
  triggerEmotion(random.key)
}

// === Favorite (Superseded by Wardrobe) ===
// const hasFavorite = computed(() => !!favoriteExpression.value)
const currentIdleAnimationLabel = computed(() => {
  if (stageModelRenderer.value === 'mmd') {
    const mmdStore = useMmd()
    return mmdStore.currentMotion || 'None'
  }
  return customVrmAnimationsStore.animationLabelByKey[vrmIdleAnimation.value] ?? vrmIdleAnimation.value
})
// const isFavoriteActive = computed(() => {
//   if (!favoriteExpression.value)
//     return false
//   return (activeExpressions.value[favoriteExpression.value] || 0) > 0
// })
//
// function toggleFavorite() {
//   if (!favoriteExpression.value)
//     return
//   expanded.value = false
//   const name = favoriteExpression.value
//   const current = activeExpressions.value[name] || 0
//   const next = current > 0 ? 0 : 1
//   activeExpressions.value = { ...activeExpressions.value, [name]: next }
// }

function cycleAnimation() {
  if (stageModelRenderer.value === 'mmd') {
    const mmdStore = useMmd()
    const allKeys = mmdStore.availableMotions
    if (allKeys.length === 0) {
      toast.error('No MMD motions available', { id: 'animation-cycle' })
      return
    }
    const currentKey = mmdStore.currentMotion
    const currentIndex = allKeys.indexOf(currentKey)
    const nextIndex = (currentIndex + 1) % allKeys.length
    const nextAnimation = allKeys[nextIndex]

    mmdStore.currentMotion = nextAnimation
    toast.info(`Cycling MMD: ${nextAnimation}`, { id: 'animation-cycle' })
    return
  }

  const cardIdleAnimations = activeCard.value?.extensions?.airi?.acting?.idleAnimations || []
  const allKeys = customVrmAnimationsStore.animationKeys
  const hasCardSubset = cardIdleAnimations.length > 0

  // Tier 1: Character owns a fixed idle (size 1)
  if (cardIdleAnimations.length === 1) {
    // Treat as manual cycler: Move the character's choice to the NEXT global animation
    const currentKey = cardIdleAnimations[0]
    const currentIndex = allKeys.indexOf(currentKey)
    const nextIndex = (currentIndex + 1) % allKeys.length
    const nextAnimation = allKeys[nextIndex]

    if (activeCard.value?.extensions?.airi?.acting) {
      activeCard.value.extensions.airi.acting.idleAnimations = [nextAnimation]
      // No need to set vrmIdleAnimation manually, Stage.vue computed will handle it
    }
    toast.info(`Character Fixed: ${customVrmAnimationsStore.animationLabelByKey[nextAnimation] || nextAnimation}`, { id: 'animation-cycle' })
    return
  }

  // Tier 2: Random cycling or global fallback
  const keys = hasCardSubset ? cardIdleAnimations.filter(k => allKeys.includes(k)) : allKeys
  const finalKeys = keys.length > 0 ? keys : allKeys

  const currentKey = vrmIdleAnimation.value
  const currentIndex = finalKeys.indexOf(currentKey)
  const nextIndex = (currentIndex + 1) % finalKeys.length
  const nextAnimation = finalKeys[nextIndex]

  vrmIdleAnimation.value = nextAnimation
  toast.info(`Cycling: ${customVrmAnimationsStore.animationLabelByKey[nextAnimation] || nextAnimation}`, { id: 'animation-cycle' })
}

// === Wardrobe ===
const wardrobeFilter = ref<'all' | 'base' | 'overlay'>('all')
const wardrobeItems = computed(() => {
  const outfits = activeCard.value?.extensions?.airi?.outfits || []
  return outfits.filter(item => wardrobeFilter.value === 'all' || item.type === wardrobeFilter.value)
})

function isOutfitActive(outfitId: string) {
  const outfit = activeCard.value?.extensions?.airi?.outfits?.find(o => o.id === outfitId)
  if (!outfit)
    return false
  return Object.entries(outfit.expressions).every(([name, weight]) => {
    return Math.abs((activeExpressions.value[name] || 0) - weight) < 0.05
  })
}

function triggerWardrobeItem(id: string) {
  console.log(`[WIRED] CUSTOM OUTFIT CLICKED: ${id}`)
  cardStore.applyOutfit(id)
}
</script>

<template>
  <div ref="islandRef" fixed bottom-2 right-2 z-100 select-none>
    <div flex flex-col items-end gap-1>
      <!-- iOS Style Drawer Panel -->
      <Transition
        enter-active-class="transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)"
        leave-active-class="transition-all duration-400 cubic-bezier(0.32, 0.72, 0, 1)"
        enter-from-class="opacity-0 translate-y-8 scale-90 blur-sm"
        leave-to-class="opacity-0 translate-y-8 scale-90 blur-sm"
      >
        <div v-if="expanded" border="1 neutral-200 dark:neutral-800" mb-2 flex flex-col gap-1 rounded-2xl p-2 backdrop-blur-xl :class="['bg-neutral-100/80 shadow-2xl shadow-black/20 dark:bg-neutral-900/80']">
          <!-- Main View -->
          <Transition
            enter-active-class="transition-all duration-300 cubic-bezier(0.32, 0.72, 0, 1)"
            leave-active-class="transition-all duration-200 cubic-bezier(0.32, 0.72, 0, 1)"
            enter-from-class="opacity-0 scale-95"
            leave-to-class="opacity-0 scale-95"
            mode="out-in"
          >
            <div v-if="view === 'main'" key="main" grid grid-cols-3 gap-2>
              <!-- Row 1: Communication -->
              <ControlButtonTooltip disable-hoverable-content>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'profiles'">
                  <div i-solar:users-group-rounded-outline :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400" />
                </ControlButton>
                <template #tooltip>
                  {{ t('tamagotchi.stage.controls-island.switch-profile') }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip disable-hoverable-content>
                <ControlButton :button-style="adjustStyleClasses.button" @click="handleOpenChat">
                  <div i-solar:chat-line-line-duotone :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400" />
                </ControlButton>
                <template #tooltip>
                  {{ t('tamagotchi.stage.controls-island.open-chat') }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlsIslandHearingConfig v-model:show="hearingDialogOpen">
                  <div class="relative">
                    <ControlButton :button-style="adjustStyleClasses.button">
                      <Transition name="fade" mode="out-in">
                        <IndicatorMicVolume v-if="enabled" :class="adjustStyleClasses.icon" />
                        <div v-else i-ph:microphone-slash :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400" />
                      </Transition>
                    </ControlButton>
                  </div>
                </ControlsIslandHearingConfig>
                <template #tooltip>
                  {{ t('tamagotchi.stage.controls-island.open-hearing-controls') }}
                </template>
              </ControlButtonTooltip>

              <!-- Row 2: Persona & Performance -->
              <ControlButtonTooltip>
                <ControlButton
                  :button-style="[
                    adjustStyleClasses.button,
                    stageModelRenderer === 'live2d' ? 'opacity-30 cursor-not-allowed filter-grayscale' : '',
                  ].join(' ')"
                  :disabled="stageModelRenderer === 'live2d'"
                  @click="cycleAnimation"
                >
                  <div i-solar:running-2-linear :class="adjustStyleClasses.icon" text="amber-500" />
                </ControlButton>
                <template #tooltip>
                  <template v-if="stageModelRenderer === 'live2d'">
                    Not Supported (Live2D)
                  </template>
                  <template v-else>
                    {{ t('tamagotchi.stage.controls-island.cycle-animation') }}: {{ currentIdleAnimationLabel }}
                  </template>
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'emotions'">
                  <div i-solar:mask-happly-outline :class="adjustStyleClasses.icon" text="amber-500" />
                </ControlButton>
                <template #tooltip>
                  Emotions
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="view = 'wardrobe'"
                >
                  <div
                    :class="[
                      adjustStyleClasses.icon,
                      'text-amber-500',
                      'i-solar:t-shirt-outline',
                    ]"
                  />
                </ControlButton>
                <template #tooltip>
                  Wardrobe & Outfits
                </template>
              </ControlButtonTooltip>

              <!-- Row 3: System & Utility -->
              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="handleOpenSettings">
                  <div i-solar:settings-minimalistic-outline :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                </ControlButton>
                <template #tooltip>
                  {{ t('tamagotchi.stage.controls-island.open-settings') }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="refreshWindow">
                  <div i-solar:refresh-linear :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                </ControlButton>
                <template #tooltip>
                  {{ t('tamagotchi.stage.controls-island.refresh') }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'captions'">
                  <Transition name="fade" mode="out-in">
                    <div v-if="settingsStore.showCaptions" i-ph:closed-captioning-duotone :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                    <div v-else i-ph:closed-captioning-duotone :class="adjustStyleClasses.icon" text="neutral-600 dark:neutral-400 opacity-50" />
                  </Transition>
                </ControlButton>
                <template #tooltip>
                  {{ settingsStore.showCaptions ? 'Hide Captions' : 'Show Captions' }}
                </template>
              </ControlButtonTooltip>

              <!-- Row 4: Window/Stage Management (Consolidated) -->
              <ControlButtonTooltip key="view-window-toggle">
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="view = 'view-window'"
                >
                  <div
                    i-solar:window-frame-linear
                    :class="[
                      adjustStyleClasses.icon,
                      interactionMode === 'tactile' ? 'text-sky-500 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]' : 'text-neutral-600 dark:text-neutral-300',
                    ]"
                  />
                </ControlButton>
                <template #tooltip>
                  View & Window Settings
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'placement'; settingsStore.stageViewControlsEnabled = true">
                  <div i-solar:tuning-outline :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                </ControlButton>
                <template #tooltip>
                  Placement & Scale
                </template>
              </ControlButtonTooltip>

              <div key="spacer-2" class="flex items-center justify-center opacity-20">
                <div i-solar:add-circle-linear :class="adjustStyleClasses.icon" />
              </div>
            </div>

            <!-- Emotions Sub-menu -->
            <div v-else-if="view === 'emotions'" key="emotions" grid grid-cols-3 gap-2>
              <ControlButtonTooltip v-for="emotion in ACT_EMOTIONS" :key="emotion.key">
                <ControlButton :button-style="adjustStyleClasses.button" @click="triggerEmotion(emotion.key)">
                  <div :class="[adjustStyleClasses.icon, 'flex items-center justify-center text-base leading-none text-amber-500']">
                    {{ emotion.emoji }}
                  </div>
                </ControlButton>
                <template #tooltip>
                  {{ emotion.key }}
                </template>
              </ControlButtonTooltip>

              <!-- Random -->
              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="triggerRandomEmotion">
                  <div i-solar:shuffle-linear :class="adjustStyleClasses.icon" text="amber-500" />
                </ControlButton>
                <template #tooltip>
                  Random Emotion
                </template>
              </ControlButtonTooltip>

              <!-- Back -->
              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'">
                  <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="amber-500" />
                </ControlButton>
                <template #tooltip>
                  Back
                </template>
              </ControlButtonTooltip>
            </div>

            <!-- Wardrobe Sub-menu -->
            <div v-else-if="view === 'wardrobe'" key="wardrobe" flex flex-col gap-2>
              <!-- 3x3 Grid (Scrollbox) -->
              <div class="scrollbar-hide max-h-[144px] overflow-y-auto">
                <div grid grid-cols-3 gap-2 pb-1>
                  <ControlButtonTooltip v-for="item in wardrobeItems" :key="item.id">
                    <ControlButton
                      :button-style="adjustStyleClasses.button"
                      :class="[
                        isOutfitActive(item.id)
                          ? item.type === 'base'
                            ? 'bg-amber-500/30 border-amber-400'
                            : 'ring-2 ring-sky-400/60 border-sky-400'
                          : '',
                      ]"
                      @click="triggerWardrobeItem(item.id)"
                    >
                      <div
                        :class="[
                          adjustStyleClasses.icon,
                          item.type === 'base' ? 'text-amber-500' : 'text-sky-400',
                          item.icon,
                        ]"
                      />
                    </ControlButton>
                    <template #tooltip>
                      {{ item.name }}
                    </template>
                  </ControlButtonTooltip>

                  <!-- Empty State -->
                  <div
                    v-if="wardrobeItems.length === 0"
                    class="col-span-3 flex flex-col items-center justify-center py-4 text-center opacity-40"
                  >
                    <div i-solar:pajamas-outline class="size-8" />
                    <span class="mt-1 text-[10px]">No outfits found</span>
                  </div>
                </div>
              </div>

              <!-- Fixed Utility Row -->
              <div grid grid-cols-3 gap-2 border-t border-neutral-200 border-solid pt-2 dark:border-neutral-800>
                <ControlButtonTooltip>
                  <ControlButton
                    :button-style="adjustStyleClasses.button"
                    :class="wardrobeFilter === 'base' ? 'bg-amber-500/20' : ''"
                    @click="wardrobeFilter = wardrobeFilter === 'base' ? 'all' : 'base'"
                  >
                    <div i-solar:t-shirt-bold-duotone :class="adjustStyleClasses.icon" text="amber-500" />
                  </ControlButton>
                  <template #tooltip>
                    Filter: Outfits (Base)
                  </template>
                </ControlButtonTooltip>

                <ControlButtonTooltip>
                  <ControlButton
                    :button-style="adjustStyleClasses.button"
                    :class="wardrobeFilter === 'overlay' ? 'bg-sky-500/20' : ''"
                    @click="wardrobeFilter = wardrobeFilter === 'overlay' ? 'all' : 'overlay'"
                  >
                    <div i-solar:magic-stick-3-bold-duotone :class="adjustStyleClasses.icon" text="sky-400" />
                  </ControlButton>
                  <template #tooltip>
                    Filter: Accessories (Overlay)
                  </template>
                </ControlButtonTooltip>

                <ControlButtonTooltip>
                  <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'; wardrobeFilter = 'all'">
                    <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="neutral-500" />
                  </ControlButton>
                  <template #tooltip>
                    Back
                  </template>
                </ControlButtonTooltip>
              </div>
            </div>

            <!-- Wardrobe Discovery Sub-menu -->
            <div v-else-if="view === 'wardrobe-discovery'" key="wardrobe-discovery" w-48 flex flex-col gap-2>
              <div flex flex-col gap-1>
                <div flex items-center gap-2 px-1 pb-1>
                  <div i-solar:stars-minimalistic-bold-duotone class="animate-pulse text-sm text-amber-500" />
                  <span class="text-[10px] text-neutral-500 font-black tracking-widest uppercase">{{ detectedWardrobe.active?.display || 'Wardrobe Discovery' }}</span>
                </div>
                <div class="scrollbar-hide max-h-[200px] overflow-y-auto">
                  <div flex flex-col gap-1.5 pb-1>
                    <button
                      v-for="sibling in detectedWardrobe.siblings"
                      :key="sibling.raw"
                      :class="['group relative w-full cursor-pointer rounded-xl bg-white/5 px-3 py-2 text-left backdrop-blur-md transition-all duration-300']"
                      @click="swapOutfit(sibling)"
                    >
                      <div flex items-center justify-between gap-2>
                        <div flex items-center gap-2>
                          <div i-solar:tag-bold-duotone class="size-3 text-sky-400 opacity-50 transition-colors" />
                          <span class="text-[11px] text-neutral-300 font-bold transition-colors group-hover:text-white">{{ sibling.display }}</span>
                        </div>
                        <div i-solar:arrow-right-linear class="size-3 text-transparent transition-all group-hover:text-white" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
              <div grid grid-cols-3 gap-2 border-t border-neutral-700 border-solid pt-2>
                <div />
                <div />
                <ControlButtonTooltip>
                  <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'">
                    <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="neutral-500" />
                  </ControlButton>
                  <template #tooltip>
                    Back
                  </template>
                </ControlButtonTooltip>
              </div>
            </div>

            <!-- Profiles Sub-menu -->
            <div v-else-if="view === 'profiles'" key="profiles" w-40 flex flex-col gap-2>
              <!-- Profile List (Scrollbox) -->
              <div class="scrollbar-hide max-h-[144px] overflow-y-auto">
                <div flex flex-col gap-1 pb-1>
                  <button
                    v-for="[id, card] in cardStore.cards"
                    :key="id"
                    class="w-full cursor-pointer border-2 rounded-xl border-solid px-2 py-1 text-left text-xs backdrop-blur-md transition-all duration-300 transition-ease-out"
                    :class="[
                      id === activeCardId
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-600 dark:text-sky-300'
                        : 'bg-neutral-50/80 dark:bg-neutral-800/70 border-neutral-200/60 dark:border-neutral-800/10 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
                    ]"
                    @click="cardStore.activateCard(id)"
                  >
                    <div flex items-center gap-2>
                      <div w-4 flex items-center justify-center>
                        <div v-if="id === activeCardId" i-solar:check-circle-bold class="size-3" />
                      </div>
                      <span truncate>{{ card.name }}</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Fixed Utility Row -->
              <div grid grid-cols-3 gap-2 border-t border-neutral-200 border-solid pt-2 dark:border-neutral-800>
                <ControlButtonTooltip>
                  <ControlButton
                    :button-style="adjustStyleClasses.button"
                    @click="handleViewGallery"
                  >
                    <div i-solar:gallery-linear :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400" />
                  </ControlButton>
                  <template #tooltip>
                    View Gallery
                  </template>
                </ControlButtonTooltip>

                <ControlButtonTooltip>
                  <ControlButton
                    :button-style="adjustStyleClasses.button"
                    @click="handleManageProfiles"
                  >
                    <div i-solar:settings-outline :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                  </ControlButton>
                  <template #tooltip>
                    Manage Profiles
                  </template>
                </ControlButtonTooltip>

                <ControlButtonTooltip>
                  <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'">
                    <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="neutral-500" />
                  </ControlButton>
                  <template #tooltip>
                    Back
                  </template>
                </ControlButtonTooltip>
              </div>
            </div>

            <div v-else-if="view === 'captions'" key="captions" grid grid-cols-3 gap-2>
              <!-- Row 1: Visuals -->
              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="toggleCaptionVisibility()"
                >
                  <div
                    i-ph:power-bold
                    :class="[
                      adjustStyleClasses.icon,
                      settingsStore.showCaptions ? 'text-green-500 opacity-100' : 'text-neutral-500 opacity-40',
                    ]"
                  />
                </ControlButton>
                <template #tooltip>
                  {{ settingsStore.showCaptions ? 'Power: ON' : 'Power: OFF' }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="settingsStore.captionFontSize = (settingsStore.captionFontSize >= 150 ? 80 : settingsStore.captionFontSize + (settingsStore.captionFontSize === 125 ? 25 : 20))"
                >
                  <div i-ph:text-t-bold :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                </ControlButton>
                <template #tooltip>
                  Font Size: {{ settingsStore.captionFontSize }}%
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="settingsStore.captionOpacity = (settingsStore.captionOpacity === 80 ? 0 : (settingsStore.captionOpacity === 0 ? 20 : (settingsStore.captionOpacity === 20 ? 50 : 80)))"
                >
                  <div i-solar:layers-minimalistic-outline :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                </ControlButton>
                <template #tooltip>
                  Background: {{ settingsStore.captionOpacity }}%
                </template>
              </ControlButtonTooltip>

              <!-- Row 2: Layout & Behavior -->
              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="() => {
                    const next = (settingsStore.captionDocking === 'top' ? 'bottom' : 'top')
                    settingsStore.captionDocking = next
                    syncCaptionDocking(next)
                  }"
                >
                  <div
                    :class="[
                      adjustStyleClasses.icon,
                      settingsStore.captionDocking === 'top' ? 'i-solar:align-top-line-duotone' : 'i-solar:align-bottom-line-duotone',
                    ]"
                    text="purple-600 dark:purple-400"
                  />
                </ControlButton>
                <template #tooltip>
                  Dock: {{ settingsStore.captionDocking === 'top' ? 'Top' : 'Bottom' }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="settingsStore.captionFollowStage = !settingsStore.captionFollowStage"
                >
                  <div
                    i-solar:magnet-bold-duotone
                    :class="[
                      adjustStyleClasses.icon,
                      settingsStore.captionFollowStage ? 'text-purple-600 dark:text-purple-400 opacity-100' : 'text-neutral-500 opacity-40',
                    ]"
                  />
                </ControlButton>
                <template #tooltip>
                  {{ settingsStore.captionFollowStage ? 'Following Stage' : 'Follow Position' }}
                </template>
              </ControlButtonTooltip>

              <!-- Row 3: Advanced & Reset -->
              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="settingsStore.triggerCaptionReset"
                >
                  <div i-solar:restart-square-outline :class="adjustStyleClasses.icon" text="neutral-600 dark:text-neutral-300" />
                </ControlButton>
                <template #tooltip>
                  Reset Position
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="settingsStore.captionLayoutMode = (settingsStore.captionLayoutMode === 'single' ? 'multi' : 'single')"
                >
                  <div
                    i-solar:widget-2-outline
                    :class="[
                      adjustStyleClasses.icon,
                      settingsStore.captionLayoutMode === 'multi' ? 'text-amber-500 opacity-100' : 'text-neutral-500 opacity-40',
                    ]"
                  />
                </ControlButton>
                <template #tooltip>
                  Mode: {{ settingsStore.captionLayoutMode === 'single' ? 'Single Turn' : 'Multi-Turn' }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'">
                  <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="neutral-500" />
                </ControlButton>
                <template #tooltip>
                  Back
                </template>
              </ControlButtonTooltip>
            </div>

            <!-- View & Window Sub-menu -->
            <div v-else-if="view === 'view-window'" key="view-window" grid grid-cols-3 gap-2>
              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="toggleAlwaysOnTop()">
                  <div v-if="alwaysOnTop" i-solar:pin-bold :class="adjustStyleClasses.icon" text="neutral-600 dark:text-neutral-300 shadow-xl" />
                  <div v-else i-solar:pin-linear :class="adjustStyleClasses.icon" text="neutral-600 dark:neutral-400 opacity-50" />
                </ControlButton>
                <template #tooltip>
                  {{ alwaysOnTop ? t('tamagotchi.stage.controls-island.unpin-from-top') : t('tamagotchi.stage.controls-island.pin-on-top') }}
                </template>
              </ControlButtonTooltip>

              <ControlsIslandFadeOnHover
                :icon-class="adjustStyleClasses.icon"
                :button-style="adjustStyleClasses.button"
                @click="expanded = false"
              />

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="toggleInteractionMode">
                  <Transition name="fade" mode="out-in">
                    <div v-if="interactionMode === 'orbit'" key="orbit" i-solar:camera-rotate-linear :class="adjustStyleClasses.icon" text="purple-600 dark:purple-400" />
                    <div v-else key="tactile" i-ph:hand-pointing-duotone :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400" />
                  </Transition>
                </ControlButton>
                <template #tooltip>
                  {{ interactionMode === 'orbit' ? 'Tactile Mode (Poke)' : 'Orbit Mode (Camera)' }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="toggleTheme()">
                  <div v-if="colorMode === 'dark'" i-solar:sun-linear :class="adjustStyleClasses.icon" text="amber-500" />
                  <div v-else i-solar:moon-linear :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400" />
                </ControlButton>
                <template #tooltip>
                  {{ colorMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" hover:bg-red-500 hover:text-white @click="hideWindow(); expanded = false">
                  <div i-solar:close-circle-outline :class="adjustStyleClasses.icon" />
                </ControlButton>
                <template #tooltip>
                  {{ t('tamagotchi.stage.controls-island.hide') }}
                </template>
              </ControlButtonTooltip>

              <div class="opacity-10" />

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'">
                  <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="neutral-500" />
                </ControlButton>
                <template #tooltip>
                  Back
                </template>
              </ControlButtonTooltip>
            </div>

            <!-- Placement Sub-menu -->
            <div v-else-if="view === 'placement'" key="placement" grid grid-cols-3 gap-2>
              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" :toggled="viewControlsActiveMode === 'x'" @click="viewControlsActiveMode = 'x'">
                  <div class="font-bold font-mono" :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400">
                    X
                  </div>
                </ControlButton>
                <template #tooltip>
                  Horizontal Offset
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" :toggled="viewControlsActiveMode === 'y'" @click="viewControlsActiveMode = 'y'">
                  <div class="font-bold font-mono" :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400">
                    Y
                  </div>
                </ControlButton>
                <template #tooltip>
                  Vertical Offset
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" :toggled="viewControlsActiveMode === 'scale'" @click="viewControlsActiveMode = 'scale'">
                  <div class="font-bold font-mono" :class="adjustStyleClasses.icon" text="amber-500">
                    S
                  </div>
                </ControlButton>
                <template #tooltip>
                  Scale / Zoom
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip v-if="stageModelRenderer === 'vrm'">
                <ControlButton :button-style="adjustStyleClasses.button" :toggled="viewControlsActiveMode === 'z'" @click="viewControlsActiveMode = 'z'">
                  <div class="font-bold font-mono" :class="adjustStyleClasses.icon" text="sky-600 dark:sky-400">
                    Z
                  </div>
                </ControlButton>
                <template #tooltip>
                  Depth Offset
                </template>
              </ControlButtonTooltip>

              <div v-else class="opacity-10" />

              <ControlButtonTooltip>
                <ControlButton
                  :button-style="adjustStyleClasses.button"
                  @click="() => {
                    if (stageModelRenderer === 'live2d') {
                      live2dStore.resetState()
                    }
                    else {
                      modelStore.modelOffset = { x: 0, y: 0, z: 0 }
                      modelStore.cameraDistance = modelStore.modelSize.z * 10
                    }
                  }"
                >
                  <div i-solar:restart-square-outline :class="adjustStyleClasses.icon" text="neutral-600 dark:text-neutral-300" />
                </ControlButton>
                <template #tooltip>
                  Reset Placement
                </template>
              </ControlButtonTooltip>

              <ControlButtonTooltip>
                <ControlButton :button-style="adjustStyleClasses.button" @click="view = 'main'; settingsStore.stageViewControlsEnabled = false">
                  <div i-solar:arrow-left-outline :class="adjustStyleClasses.icon" text="neutral-500" />
                </ControlButton>
                <template #tooltip>
                  Back
                </template>
              </ControlButtonTooltip>
            </div>
          </Transition>
        </div>
      </Transition>

      <!-- Main Controls (Dual Column Layout) -->
      <div flex items-end>
        <!-- Main Logic Column (Chevron + Handlebar) -->
        <div flex flex-col gap-1>
          <ControlButtonTooltip side="left">
            <ControlButton :button-style="adjustStyleClasses.button" @click="expanded = !expanded">
              <div
                :class="[adjustStyleClasses.icon, expanded ? 'rotate-180' : 'rotate-0']"
                i-solar:alt-arrow-up-line-duotone scale-110 transition-all duration-300
                text="neutral-600 dark:neutral-400"
              />
            </ControlButton>
            <template #tooltip>
              {{ expanded ? t('tamagotchi.stage.controls-island.collapse') : t('tamagotchi.stage.controls-island.expand') }}
            </template>
          </ControlButtonTooltip>

          <ControlButtonTooltip side="left">
            <ControlButton
              :button-style="adjustStyleClasses.button"
              cursor-move
              @mousedown="startDraggingWindow()"
            >
              <div
                i-ph:arrows-out-cardinal
                :class="[
                  adjustStyleClasses.icon,
                  useHearingStore().isTranscribing ? 'text-red-500 animate-pulse' : 'text-neutral-800 dark:text-neutral-300',
                ]"
              />
            </ControlButton>
            <template #tooltip>
              {{ useHearingStore().isTranscribing ? 'STT Processing...' : t('tamagotchi.stage.controls-island.drag-to-move-window') }}
            </template>
          </ControlButtonTooltip>
        </div>
      </div>
    </div>
  </div>

  <!-- Left Side Gemini Anchor -->
  <div ref="geminiRef" fixed bottom-2 left-2 z-100 select-none>
    <div flex flex-col gap-1>
      <Transition
        enter-active-class="transition-all duration-300 cubic-bezier(0.32, 0.72, 0, 1)"
        leave-active-class="transition-all duration-200 cubic-bezier(0.32, 0.72, 0, 1)"
        enter-from-class="opacity-0 translate-x-4 scale-95"
        leave-to-class="opacity-0 translate-x-4 scale-95"
      >
        <div v-if="geminiExpanded" ref="geminiPanelRef" absolute bottom-0 left-full z-50 ml-2>
          <GeminiControls @close="geminiExpanded = false" />
        </div>
      </Transition>

      <ControlButtonTooltip side="right">
        <ControlButton
          :button-style="[adjustStyleClasses.button, geminiColorClasses].join(' ')"
          @click="handleGeminiToggle"
        >
          <div
            i-ph:sparkle
            :class="[
              adjustStyleClasses.icon,
              geminiIconClasses,
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.open-gemini-controls') }}
        </template>
      </ControlButtonTooltip>
    </div>
  </div>
</template>
