import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AboutBuildInfo } from '../../components/scenarios/about/types'

import { useBuildInfo } from '../../composables'

export const useSharedAnalyticsStore = defineStore('analytics-shared', () => {
  const buildInfo = ref<AboutBuildInfo>(useBuildInfo())
  const isInitialized = ref(false)

  const appStartTime = ref<number | null>(null)
  const firstMessageTracked = ref(false)

  function initialize() {
    if (isInitialized.value) return

    appStartTime.value = Date.now()

    isInitialized.value = true
  }

  function markFirstMessageTracked() {
    firstMessageTracked.value = true
  }

  return {
    appStartTime,
    buildInfo,
    firstMessageTracked,
    initialize,
    markFirstMessageTracked,
  }
})
