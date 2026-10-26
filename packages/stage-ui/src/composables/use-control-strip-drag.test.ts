import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useControlStripDrag } from './use-control-strip-drag'

describe('useControlStripDrag shell protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('toggles collapse instead of dragging on mobile', () => {
    const mode = ref<'desktop' | 'mobile'>('mobile')
    const collapsed = ref(false)
    const position = ref({ x: 20, y: 150 })
    const isElectron = ref(false)
    const toggleOrientation = vi.fn()

    const { onDragStart, isDragging } = useControlStripDrag({ mode, collapsed, position, isElectron, toggleOrientation })
    void onDragStart({} as MouseEvent)

    expect(collapsed.value).toBe(true)
    expect(isDragging.value).toBe(false)
    expect(toggleOrientation).not.toHaveBeenCalled()
  })

  it('fires control-strip:drag-start once the pointer travels on Electron', async () => {
    const seen: Event[] = []
    const onDragStartEvent = (e: Event) => seen.push(e)
    window.addEventListener('control-strip:drag-start', onDragStartEvent)
    try {
      const mode = ref<'desktop' | 'mobile'>('desktop')
      const collapsed = ref(false)
      const position = ref({ x: 20, y: 150 })
      const isElectron = ref(true)
      const toggleOrientation = vi.fn()

      const { onDragStart, onDragging, onDragEnd } = useControlStripDrag({ mode, collapsed, position, isElectron, toggleOrientation })
      await onDragStart({ button: 0, clientX: 100, clientY: 100 } as MouseEvent)
      await onDragging({ clientX: 120, clientY: 100 } as MouseEvent)
      onDragEnd()

      expect(seen).toHaveLength(1)
    }
    finally {
      window.removeEventListener('control-strip:drag-start', onDragStartEvent)
    }
  })

  it('single-click collapses, double-click toggles orientation (web)', () => {
    vi.useFakeTimers()
    try {
      const mode = ref<'desktop' | 'mobile'>('desktop')
      const collapsed = ref(false)
      const position = ref({ x: 20, y: 150 })
      const isElectron = ref(false)
      const toggleOrientation = vi.fn()

      const { onDragStart, onDragEnd } = useControlStripDrag({ mode, collapsed, position, isElectron, toggleOrientation })

      // First click: starts the single-click timer.
      void onDragStart({ button: 0, clientX: 100, clientY: 100 } as MouseEvent)
      onDragEnd()
      // Second click before the timer fires: perpendicular toggle.
      void onDragStart({ button: 0, clientX: 100, clientY: 100 } as MouseEvent)
      onDragEnd()

      expect(toggleOrientation).toHaveBeenCalledTimes(1)
      expect(collapsed.value).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('ignores non-primary mouse buttons', async () => {
    const mode = ref<'desktop' | 'mobile'>('desktop')
    const collapsed = ref(false)
    const position = ref({ x: 20, y: 150 })
    const isElectron = ref(false)
    const toggleOrientation = vi.fn()

    const { onDragStart, isDragging } = useControlStripDrag({ mode, collapsed, position, isElectron, toggleOrientation })
    await onDragStart({ button: 2, clientX: 100, clientY: 100 } as MouseEvent)

    expect(isDragging.value).toBe(false)
  })
})
