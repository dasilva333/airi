import type { ComputedRef, Ref } from 'vue'

import { computed, ref } from 'vue'

interface UseControlStripGeometryOptions {
  mode: Ref<'desktop' | 'mobile'>
  orientation: Ref<string>
  dockedEdge: Ref<'left' | 'right' | 'top' | 'bottom' | null>
  collapsed: Ref<boolean>
  activePopover: Ref<string | null>
  activeButtons: Ref<Array<{ id: string }>>
  backgroundTint: Ref<string>
  isElectron: Ref<boolean> | ComputedRef<boolean> | { value: boolean }
  position: Ref<{ x: number, y: number }>
}

const HOVER_COLLAPSE_DELAY_MS = 400

// Verbatim extraction of the shell geometry block from ControlStrip.vue:
// autoHideMode / isFullyExpanded / hover expand timers / tab classes /
// popoverPlacement / stripLength / containerStyle. No behavior change intended;
// the strip keeps owning activePopover (window-bounds contract in
// apps/stage-tamagotchi/src/renderer/pages/index.vue depends on it).
export function useControlStripGeometry(options: UseControlStripGeometryOptions) {
  const { mode, orientation, dockedEdge, collapsed, activePopover, activeButtons, backgroundTint, isElectron, position } = options

  const autoHideMode = computed(() => dockedEdge.value !== null)

  const hoverExpanded = ref(false)
  const hoverTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  const isFullyExpanded = computed(() => {
    if (autoHideMode.value) {
      return !collapsed.value || hoverExpanded.value || activePopover.value !== null
    }
    return !collapsed.value
  })

  function onContainerMouseEnter() {
    if (autoHideMode.value && collapsed.value) {
      if (hoverTimer.value) {
        clearTimeout(hoverTimer.value)
        hoverTimer.value = null
      }
      hoverExpanded.value = true
    }
  }

  function onContainerMouseLeave() {
    if (autoHideMode.value && collapsed.value) {
      if (hoverTimer.value)
        clearTimeout(hoverTimer.value)
      hoverTimer.value = setTimeout(() => {
        hoverExpanded.value = false
      }, HOVER_COLLAPSE_DELAY_MS)
    }
  }

  function handleContainerClick() {
    if (autoHideMode.value && !isFullyExpanded.value) {
      collapsed.value = false
    }
  }

  const autoHideTabClasses = computed(() => {
    if (!autoHideMode.value || isFullyExpanded.value) {
      return ''
    }
    const edge = dockedEdge.value
    const base = 'transition-transform duration-300 ease-out'

    if (edge === 'left') {
      return `${base} rounded-r-full rounded-l-none border-l-0 -translate-x-[calc(100%-14px)]`
    }
    if (edge === 'right') {
      return `${base} rounded-l-full rounded-r-none border-r-0 translate-x-[calc(100%-14px)]`
    }
    if (edge === 'top') {
      return `${base} rounded-b-full rounded-t-none border-t-0 -translate-y-[calc(100%-14px)]`
    }
    if (edge === 'bottom') {
      return `${base} rounded-t-full rounded-b-none border-b-0 translate-y-[calc(100%-14px)]`
    }
    return ''
  })

  const popoverPlacement = computed(() => {
    if (mode.value === 'mobile') {
      return dockedEdge.value === 'left' ? 'right' : 'left'
    }
    if (typeof window === 'undefined')
      return 'bottom'

    const screenX = window.screenX || 0
    const screenY = window.screenY || 0
    const screenWidth = window.screen?.width || window.innerWidth
    const screenHeight = window.screen?.height || window.innerHeight

    if (orientation.value === 'vertical') {
      return screenX < screenWidth / 2 ? 'right' : 'left'
    }
    else {
      return screenY < screenHeight / 2 ? 'bottom' : 'top'
    }
  })

  const stripLength = computed(() => {
    if (!isFullyExpanded.value) {
      return 52
    }
    const N = activeButtons.value.length
    return N === 0 ? 52 : 52 + 44 * N
  })

  const containerStyle = computed(() => {
    if (mode.value === 'mobile') {
      const styles: Record<string, string> = {
        top: '50%',
        transform: 'translateY(-50%)',
      }
      if (dockedEdge.value === 'left') {
        styles.left = '0px'
      }
      else {
        styles.right = '0px'
      }
      return styles
    }
    if (isElectron.value) {
      const styles: Record<string, string> = {
        backgroundColor: backgroundTint.value || '',
        opacity: '0.85',
      }
      if (activePopover.value) {
        if (orientation.value === 'vertical') {
          const windowHeight = Math.max(500, stripLength.value)
          styles.top = `${(windowHeight - stripLength.value) / 2}px`
          if (popoverPlacement.value === 'right') {
            styles.left = '0px'
          }
          else {
            styles.left = '276px'
          }
        }
        else {
          const windowWidth = Math.max(500, stripLength.value)
          styles.left = `${(windowWidth - stripLength.value) / 2}px`
          if (popoverPlacement.value === 'bottom') {
            styles.top = '0px'
          }
          else {
            styles.top = '452px'
          }
        }
      }
      else {
        styles.left = '0px'
        styles.top = '0px'
      }
      return styles
    }
    else {
      return {
        top: `${position.value.y}px`,
        right: `${position.value.x}px`,
        backgroundColor: backgroundTint.value || '',
        opacity: '0.85',
      }
    }
  })

  return {
    autoHideMode,
    isFullyExpanded,
    hoverExpanded,
    onContainerMouseEnter,
    onContainerMouseLeave,
    handleContainerClick,
    autoHideTabClasses,
    popoverPlacement,
    stripLength,
    containerStyle,
  }
}
