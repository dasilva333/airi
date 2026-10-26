import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useControlStripGeometry } from './use-control-strip-geometry'

function setupGeometry(overrides: Partial<{
  dockedEdge: 'left' | 'right' | 'top' | 'bottom' | null
  collapsed: boolean
  activePopover: string | null
  buttonCount: number
}> = {}) {
  const mode = ref<'desktop' | 'mobile'>('desktop')
  const orientation = ref('vertical')
  const dockedEdge = ref<'left' | 'right' | 'top' | 'bottom' | null>(overrides.dockedEdge ?? null)
  const collapsed = ref(overrides.collapsed ?? false)
  const activePopover = ref<string | null>(overrides.activePopover ?? null)
  const activeButtons = ref(Array.from({ length: overrides.buttonCount ?? 3 }, (_, i) => ({ id: `btn-${i}` })))
  const backgroundTint = ref('')
  const isElectron = ref(false)
  const position = ref({ x: 20, y: 150 })
  return useControlStripGeometry({ mode, orientation, dockedEdge, collapsed, activePopover, activeButtons, backgroundTint, isElectron, position })
}

describe('useControlStripGeometry shell contract', () => {
  it('is not in auto-hide mode without a docked edge', () => {
    const { autoHideMode, isFullyExpanded, stripLength } = setupGeometry({ buttonCount: 3 })
    expect(autoHideMode.value).toBe(false)
    expect(isFullyExpanded.value).toBe(true)
    // 52 + 44 * 3 collapsed-chrome arithmetic from the shell.
    expect(stripLength.value).toBe(52 + 44 * 3)
  })

  it('collapses to the 52px notch when docked and collapsed', () => {
    const { autoHideMode, isFullyExpanded, stripLength } = setupGeometry({ dockedEdge: 'right', collapsed: true })
    expect(autoHideMode.value).toBe(true)
    expect(isFullyExpanded.value).toBe(false)
    expect(stripLength.value).toBe(52)
  })

  it('an open popover forces full expansion in auto-hide mode', () => {
    const { isFullyExpanded } = setupGeometry({ dockedEdge: 'left', collapsed: true, activePopover: 'actor-vfx' })
    expect(isFullyExpanded.value).toBe(true)
  })

  it('mobile placement follows the docked edge', () => {
    const mode = ref<'desktop' | 'mobile'>('mobile')
    const orientation = ref('vertical')
    const dockedEdge = ref<'left' | 'right' | 'top' | 'bottom' | null>('left')
    const collapsed = ref(false)
    const activePopover = ref<string | null>(null)
    const activeButtons = ref([{ id: 'a' }])
    const backgroundTint = ref('')
    const isElectron = ref(false)
    const position = ref({ x: 0, y: 0 })

    const { popoverPlacement, containerStyle } = useControlStripGeometry({ mode, orientation, dockedEdge, collapsed, activePopover, activeButtons, backgroundTint, isElectron, position })
    expect(popoverPlacement.value).toBe('right')
    expect(containerStyle.value).toMatchObject({ left: '0px' })

    dockedEdge.value = 'right'
    expect(popoverPlacement.value).toBe('left')
    expect(containerStyle.value).toMatchObject({ right: '0px' })
  })
})
