import localforage from 'localforage'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { animations } from '../assets/vrm/animations'

const STORAGE_PREFIX = 'custom-vrma-animation-'
const CUSTOM_VRMA_KEY_PREFIX = 'custom-vrma:'

interface StoredCustomVrmAnimation {
  file: File
  importedAt: number
  name: string
  originalFileName: string
}

export interface CustomVrmAnimation {
  key: string
  name: string
  originalFileName: string
  importedAt: number
  url: string
}

function fileNameToLabel(fileName: string) {
  return fileName.replace(/\.vrma$/i, '')
}

export const useCustomVrmAnimationsStore = defineStore('custom-vrm-animations', () => {
  const customAnimations = ref<Record<string, CustomVrmAnimation>>({})
  const deletedAnimations = useLocalStorageManualReset<string[]>('settings/vrma/deleted-animations', () => [])
  const customAnimationsLoading = ref(false)
  const customAnimationsLoaded = ref(false)
  const objectUrls = new Map<string, string>()
  let loadPromise: Promise<void> | undefined

  const { data: customVrmaSyncSignal, post: broadcastCustomVrmaSync } = useBroadcastChannel({ name: 'airi:custom-vrma-sync' })

  watch(customVrmaSyncSignal, (val) => {
    if (val) {
      console.log('[CustomVRMA] Received custom VRMA sync signal, reloading from IndexedDB...')
      customAnimationsLoaded.value = false
      void loadCustomAnimations()
    }
  })

  function getStorageKey(id: string) {
    return `${STORAGE_PREFIX}${id}`
  }

  function getAnimationKey(id: string) {
    return `${CUSTOM_VRMA_KEY_PREFIX}${id}`
  }

  function revokeObjectUrl(key: string) {
    const existingUrl = objectUrls.get(key)
    if (!existingUrl)
      return

    URL.revokeObjectURL(existingUrl)
    objectUrls.delete(key)
  }

  function createAnimationRecord(id: string, stored: StoredCustomVrmAnimation): CustomVrmAnimation {
    const key = getAnimationKey(id)
    revokeObjectUrl(key)

    const url = URL.createObjectURL(stored.file)
    objectUrls.set(key, url)

    return {
      key,
      name: stored.name,
      originalFileName: stored.originalFileName,
      importedAt: stored.importedAt,
      url,
    }
  }

  async function loadCustomAnimations() {
    if (customAnimationsLoaded.value)
      return

    if (loadPromise)
      return loadPromise

    loadPromise = (async () => {
      customAnimationsLoading.value = true
      const nextAnimations: Record<string, CustomVrmAnimation> = {}

      try {
        const keys = await localforage.keys()
        const animKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX))
        for (const storageKey of animKeys) {
          const stored = await localforage.getItem<StoredCustomVrmAnimation>(storageKey)
          if (stored) {
            const id = storageKey.slice(STORAGE_PREFIX.length)
            const animation = createAnimationRecord(id, stored)
            nextAnimations[animation.key] = animation
          }
        }

        customAnimations.value = nextAnimations
        customAnimationsLoaded.value = true
      }
      catch (error) {
        console.error('[CustomVRMA] Failed to load custom VRMA animations', error)
      }
      finally {
        customAnimationsLoading.value = false
      }
    })()

    await loadPromise
    loadPromise = undefined
  }

  async function addCustomAnimation(file: File) {
    await loadCustomAnimations()

    const name = fileNameToLabel(file.name)
    const existingEntry = Object.entries(customAnimations.value).find(([_, anim]) => anim.originalFileName === file.name || anim.name === name)
    const id = existingEntry ? existingEntry[0].replace(CUSTOM_VRMA_KEY_PREFIX, '') : (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

    const stored: StoredCustomVrmAnimation = {
      file,
      importedAt: Date.now(),
      name,
      originalFileName: file.name,
    }

    await localforage.setItem(getStorageKey(id), stored)

    const animation = createAnimationRecord(id, stored)
    customAnimations.value = {
      ...customAnimations.value,
      [animation.key]: animation,
    }

    deletedAnimations.value = deletedAnimations.value.filter(d => d !== id)

    broadcastCustomVrmaSync(Date.now())

    return animation.key
  }

  async function removeCustomAnimation(id: string) {
    const key = getAnimationKey(id)
    revokeObjectUrl(key)
    const nextAnimations = { ...customAnimations.value }
    delete nextAnimations[key]
    customAnimations.value = nextAnimations

    await localforage.removeItem(getStorageKey(id))

    if (!deletedAnimations.value.includes(id)) {
      deletedAnimations.value = [...deletedAnimations.value, id]
    }

    broadcastCustomVrmaSync(Date.now())
  }

  function resolveAnimationUrl(key: string | null | undefined) {
    if (!key)
      return animations.idleLoop

    if (key in customAnimations.value)
      return customAnimations.value[key].url

    const customKey = key.startsWith(CUSTOM_VRMA_KEY_PREFIX) ? key : `${CUSTOM_VRMA_KEY_PREFIX}${key}`
    if (customKey in customAnimations.value)
      return customAnimations.value[customKey].url

    if (key in animations)
      return animations[key as keyof typeof animations]

    return animations.idleLoop
  }

  const animationOptions = computed(() => {
    const builtinOptions = Object.keys(animations).map(key => ({ label: key, value: key }))
    const customOptions = Object.values(customAnimations.value)
      .sort((a, b) => b.importedAt - a.importedAt)
      .map(animation => ({ label: animation.name, value: animation.key }))

    return [...builtinOptions, ...customOptions]
  })

  const animationKeys = computed(() => animationOptions.value.map(option => option.value))
  const animationLabelByKey = computed<Record<string, string>>(() =>
    Object.fromEntries(animationOptions.value.map(option => [option.value, option.label])),
  )

  void loadCustomAnimations()

  return {
    customAnimations,
    customAnimationsLoading,
    customAnimationsLoaded,
    animationOptions,
    animationKeys,
    animationLabelByKey,
    loadCustomAnimations,
    addCustomAnimation,
    removeCustomAnimation,
    resolveAnimationUrl,
    deletedAnimations,
  }
})
