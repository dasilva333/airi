<script setup lang="ts">
import { HackerPanel, LHackerPanel, ModelSettings } from '@proj-airi/stage-ui/components/scenarios/settings/model-settings'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Vibrant } from 'node-vibrant/browser'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const cardStore = useAiriCardStore()
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
    if (action && refVal) {
      const tabMap: Record<string, 'library' | 'explore' | 'cloud'> = {
        explore: 'explore',
        cloud: 'cloud',
        browse: 'library',
      }
      const targetTab = tabMap[action as string] || 'explore'
      refVal.openModelSelector(targetTab)
      router.replace({ query: {} })
    }
  },
  { immediate: true },
)

onMounted(() => {
  cardStore.isModelSyncPrevented = true
})

onBeforeUnmount(async () => {
  cardStore.isModelSyncPrevented = false
  // Restore character's original model state on exit
  await cardStore.syncCardState(cardStore.activeCard, true)
})
</script>

<template>
  <div flex class="relative h-full flex-col-reverse md:flex-row">
    <ModelSettings
      ref="modelSettingsRef"
      settings-class="w-100% md:w-40% lg:w-40% xl:w-25% 2xl:w-30% h-fit sm:max-h-80dvh overflow-y-scroll relative"
      live-2d-scene-class="absolute max-h-[calc(100dvh-100px-56px)] w-full h-full"
      vrm-scene-class="absolute max-h-[calc(100dvh-100px-56px)] w-full h-full"
      :palette="palette" @extract-colors-from-model="extractColorsFromModel"
    />
    <HackerPanel />
    <LHackerPanel />
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
