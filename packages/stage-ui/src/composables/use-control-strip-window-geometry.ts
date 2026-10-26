/**
 * Window geometry state shared by the stage and chat preset popovers.
 *
 * Before 4b(2) this lived twice — once per popover — including a duplicated
 * `get-monitor-count` IPC invoke and a duplicated `control-strip:apply-size-preset`
 * dispatcher. One owner keeps the event payload identical no matter which
 * popover the user right-clicked.
 *
 * `onPresetApplied` fires only when a *size preset* is chosen; the alignment
 * grid deliberately does not close the popover (users often pick a size, then
 * nudge the alignment).
 */
import { computed, onMounted, ref, watch } from 'vue'

export interface UseControlStripWindowGeometryOptions {
  /** Called after a size preset is applied, so the popover can close itself. */
  onPresetApplied?: () => void
}

export interface SizePresetPayload {
  target: 'actor' | 'chat'
  preset?: string
  monitorIndex?: number
  alignment?: string
}

export function useControlStripWindowGeometry(options: UseControlStripWindowGeometryOptions = {}) {
  const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

  const activeMonitor = ref(1)
  const selectedAlignment = ref('center')
  // Only pass alignment to apply-size-preset after the user explicitly chose one —
  // otherwise every size-preset click silently re-centers the window (selectedAlignment
  // defaults to 'center'), which made oversized windows snap to the screen middle.
  const alignmentChosen = ref(false)
  watch(selectedAlignment, () => alignmentChosen.value = true)
  const presetAlignment = computed(() => alignmentChosen.value ? selectedAlignment.value : undefined)
  const monitorCount = ref(1)

  onMounted(async () => {
    if (isElectron.value && (window as any).electron?.ipcRenderer) {
      try {
        monitorCount.value = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:windows:get-monitor-count')
      }
      catch (err) {
        console.warn('Failed to get monitor count:', err)
      }
    }
  })

  function applySizePreset(target: 'actor' | 'chat', preset?: string, alignment?: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-strip:apply-size-preset', {
        detail: {
          target,
          preset,
          monitorIndex: monitorCount.value > 1 ? activeMonitor.value : undefined,
          alignment,
        },
      }))
    }
    if (preset) {
      options.onPresetApplied?.()
    }
  }

  function selectMonitor(target: 'actor' | 'chat', monitor: number) {
    activeMonitor.value = monitor
    applySizePreset(target, undefined, selectedAlignment.value)
  }

  /** Pick a 9-way alignment, then re-apply the window at that anchor. */
  function applyAlignment(target: 'actor' | 'chat', alignment: string) {
    applySizePreset(target, undefined, alignment)
    selectedAlignment.value = alignment
  }

  return {
    monitorCount,
    activeMonitor,
    selectedAlignment,
    presetAlignment,
    applySizePreset,
    selectMonitor,
    applyAlignment,
  }
}
