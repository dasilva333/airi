<script setup lang="ts">
import { ModelSettings } from '@proj-airi/stage-ui/components/scenarios/settings/model-settings'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { Vibrant } from 'node-vibrant/browser'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const cardStore = useAiriCardStore()
const settingsStore = useSettings()
const modelSettingsRef = ref<InstanceType<typeof ModelSettings>>()
const route = useRoute()
const router = useRouter()

const palette = ref<string[]>([])

async function extractColorsFromModel() {
  if (!modelSettingsRef.value)
    return

  const frame = await modelSettingsRef.value.captureFrame()
  if (!frame) {
    console.error('No frame captured')
    return
  }

  const frameUrl = URL.createObjectURL(frame)
  try {
    const vibrant = new Vibrant(frameUrl)

    const paletteFromVibrant = await vibrant.getPalette()
    palette.value = Object.values(paletteFromVibrant).map(color => color?.hex).filter(it => typeof it === 'string')
  }
  finally {
    URL.revokeObjectURL(frameUrl)
  }
}

watch(
  [() => route.query.action, modelSettingsRef],
  ([action, refVal]) => {
    if (action === 'explore') {
      router.replace('/settings/models/explore')
      return
    }

    if (action && refVal) {
      const tabMap: Record<string, 'library' | 'cloud'> = {
        cloud: 'cloud',
        browse: 'library',
      }
      const targetTab = tabMap[action as string] || 'library'
      refVal.openModelSelector(targetTab)
      router.replace({ query: {} })
    }
  },
  { immediate: true },
)

onMounted(async () => {
  // Ensure the stage model is loaded for this window before preventing card sync.
  // Secondary windows (like Settings) do not initialize stage models at boot.
  if (!settingsStore.stageModelRenderer || !settingsStore.stageModelSelectedDisplayModel || !settingsStore.stageModelSelectedUrl) {
    if (!settingsStore.stageModelSelected) {
      const cardModelId = cardStore.activeCard?.extensions?.airi?.active_state?.displayModelId
        ?? cardStore.activeCard?.extensions?.airi?.modules?.displayModelId
      if (cardModelId) {
        settingsStore.stageModelSelected = cardModelId
      }
    }
    await settingsStore.updateStageModel('models page mounted')
  }
  cardStore.isModelSyncPrevented = true
})

onBeforeUnmount(async () => {
  cardStore.isModelSyncPrevented = false
  // Restore character's original model state on exit
  await cardStore.syncCardState(cardStore.activeCard, true)
})
</script>

<template>
  <div class="relative h-[calc(100dvh-100px-56px)] w-full overflow-hidden">
    <ModelSettings
      ref="modelSettingsRef"
      :palette="palette"
      @extract-colors-from-model="extractColorsFromModel"
    />
  </div>

  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, y: 15 }"
    :enter="{ scale: 1, opacity: 1, y: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:people-nearby-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.models.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.models.description
  icon: i-solar:people-nearby-bold-duotone
  settingsEntry: true
  order: 4
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
