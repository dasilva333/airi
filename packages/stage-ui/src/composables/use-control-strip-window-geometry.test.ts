import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useControlStripWindowGeometry } from './use-control-strip-window-geometry'

function collectPresets() {
  const seen: Array<CustomEvent> = []
  const onPreset = (e: Event) => seen.push(e as CustomEvent)
  window.addEventListener('control-strip:apply-size-preset', onPreset)
  return {
    seen,
    release: () => window.removeEventListener('control-strip:apply-size-preset', onPreset),
  }
}

describe('useControlStripWindowGeometry preset contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('withholds alignment until the user explicitly chooses one', async () => {
    const { presetAlignment, selectedAlignment } = useControlStripWindowGeometry()
    expect(presetAlignment.value).toBeUndefined()

    selectedAlignment.value = 'top-left'
    await nextTick()
    expect(presetAlignment.value).toBe('top-left')
  })

  it('dispatches apply-size-preset without monitorIndex on a single monitor and closes via callback', () => {
    const onPresetApplied = vi.fn()
    const { seen, release } = collectPresets()
    try {
      const { applySizePreset } = useControlStripWindowGeometry({ onPresetApplied })
      applySizePreset('actor', 'large', undefined)

      expect(seen).toHaveLength(1)
      expect(seen[0].detail).toEqual({
        target: 'actor',
        preset: 'large',
        monitorIndex: undefined,
        alignment: undefined,
      })
      expect(onPresetApplied).toHaveBeenCalledTimes(1)
    }
    finally {
      release()
    }
  })

  it('selectMonitor pins the monitor and re-applies without closing', () => {
    const onPresetApplied = vi.fn()
    const { seen, release } = collectPresets()
    try {
      const { selectMonitor, activeMonitor, monitorCount } = useControlStripWindowGeometry({ onPresetApplied })
      monitorCount.value = 2
      selectMonitor('chat', 2)

      expect(activeMonitor.value).toBe(2)
      expect(seen).toHaveLength(1)
      expect(seen[0].detail).toMatchObject({ target: 'chat', monitorIndex: 2 })
      expect(onPresetApplied).not.toHaveBeenCalled()
    }
    finally {
      release()
    }
  })

  it('applyAlignment dispatches the anchor and arms the chosen-alignment guard', async () => {
    const { seen, release } = collectPresets()
    try {
      const { applyAlignment, presetAlignment } = useControlStripWindowGeometry()
      applyAlignment('actor', 'bottom-right')

      expect(seen).toHaveLength(1)
      expect(seen[0].detail).toMatchObject({ target: 'actor', alignment: 'bottom-right' })
      await nextTick()
      expect(presetAlignment.value).toBe('bottom-right')
    }
    finally {
      release()
    }
  })
})
