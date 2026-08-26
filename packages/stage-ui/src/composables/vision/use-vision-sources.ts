import type { SerializableDesktopCapturerSource } from '@proj-airi/electron-screen-capture'
import type { SourcesOptions } from 'electron'

import { defineInvokeEventa } from '@moeru/eventa'
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { computed, onBeforeUnmount, ref } from 'vue'

export const screenCaptureGetSources = defineInvokeEventa<SerializableDesktopCapturerSource[], SourcesOptions>('eventa:invoke:electron:screen-capture:get-sources')

export interface VisionCaptureSource {
  id: string
  name: string
  category: 'displays' | 'applications'
  resolution?: string
  icon: string
  appIconURL?: string
  thumbnailURL?: string
}

const FALLBACK_SOURCES: VisionCaptureSource[] = [
  {
    id: 'screen:primary',
    name: 'Primary Display',
    category: 'displays',
    resolution: 'Virtual Screen',
    icon: 'i-solar:screencast-2-line-duotone',
  },
]

function toObjectUrl(buffer: Uint8Array, mimeType: string): string {
  const blob = new Blob([buffer as BlobPart], { type: mimeType })
  return URL.createObjectURL(blob)
}

export function useVisionSources(options?: { autoFetch?: boolean }) {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electron
  const getSourcesInvoke = isElectron ? useElectronEventaInvoke(screenCaptureGetSources) : null

  const sources = ref<VisionCaptureSource[]>([])
  const isRefetching = ref(false)
  const hasFetchedOnce = ref(false)
  const error = ref<string | null>(null)

  const displaySources = computed(() => sources.value.filter(s => s.category === 'displays'))
  const applicationSources = computed(() => sources.value.filter(s => s.category === 'applications'))

  function cleanupUrls(items: VisionCaptureSource[]) {
    for (const item of items) {
      if (item.appIconURL) {
        URL.revokeObjectURL(item.appIconURL)
      }
      if (item.thumbnailURL) {
        URL.revokeObjectURL(item.thumbnailURL)
      }
    }
  }

  async function refetchSources(): Promise<void> {
    isRefetching.value = true
    error.value = null

    try {
      if (!isElectron || !getSourcesInvoke) {
        // Web / non-electron environment: use fallback sources
        cleanupUrls(sources.value)
        sources.value = [...FALLBACK_SOURCES]
        return
      }

      const rawSources = (await getSourcesInvoke({
        types: ['screen', 'window'],
        fetchWindowIcons: true,
      })) as SerializableDesktopCapturerSource[]

      cleanupUrls(sources.value)

      sources.value = (rawSources || []).map((raw) => {
        const isScreen = raw.id.startsWith('screen:')
        return {
          id: raw.id,
          name: raw.name || (isScreen ? 'Display' : 'Window'),
          category: isScreen ? 'displays' : 'applications',
          icon: isScreen ? 'i-solar:screencast-2-line-duotone' : 'i-solar:window-frame-line-duotone',
          appIconURL: raw.appIcon && raw.appIcon.length > 0 ? toObjectUrl(raw.appIcon, 'image/png') : undefined,
          thumbnailURL: raw.thumbnail && raw.thumbnail.length > 0 ? toObjectUrl(raw.thumbnail, 'image/jpeg') : undefined,
        }
      })
    }
    catch (err: any) {
      console.warn('[useVisionSources] Failed to fetch screen capture sources:', err)
      error.value = err?.message || String(err)
      if (sources.value.length === 0) {
        sources.value = [...FALLBACK_SOURCES]
      }
    }
    finally {
      isRefetching.value = false
      hasFetchedOnce.value = true
    }
  }

  if (options?.autoFetch) {
    void refetchSources()
  }

  onBeforeUnmount(() => {
    cleanupUrls(sources.value)
  })

  return {
    sources,
    displaySources,
    applicationSources,
    isRefetching,
    hasFetchedOnce,
    error,
    isElectron,
    refetchSources,
  }
}
