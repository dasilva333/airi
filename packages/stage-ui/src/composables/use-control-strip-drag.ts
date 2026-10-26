import type { Ref } from 'vue'

import { ref } from 'vue'

export interface ControlStripDragPosition {
  x: number
  y: number
}

interface UseControlStripDragOptions {
  mode: Ref<'desktop' | 'mobile'>
  collapsed: Ref<boolean>
  position: Ref<ControlStripDragPosition>
  isElectron: Ref<boolean> | { value: boolean }
  toggleOrientation: () => void
}

// NOTICE: Electron window drag goes through `control-strip:drag-start` (handled in
// apps/stage-tamagotchi/src/renderer/pages/index.vue), not direct bounds writes for
// mouse. Touch keeps direct set-bounds because there is no native drag gesture.
export function useControlStripDrag(options: UseControlStripDragOptions) {
  const { mode, collapsed, position, isElectron, toggleOrientation } = options

  const isDragging = ref(false)
  let isMouseDown = false
  let startMouseX = 0
  let startMouseY = 0
  let startPosX = 0
  let startPosY = 0
  let dragDistance = 0
  let isTouchEventState = false
  let startTouchScreenX = 0
  let startTouchScreenY = 0
  let startWindowBounds: { x: number, y: number, width: number, height: number } | null = null
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  function cleanupDragListeners() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', onDragging)
      window.removeEventListener('mouseup', onDragEnd)
      window.removeEventListener('touchmove', onDragging)
      window.removeEventListener('touchend', onDragEnd)
    }
  }

  function handlePerpendicularClick() {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
      toggleOrientation()
    }
    else {
      clickTimer = setTimeout(() => {
        clickTimer = null
        collapsed.value = !collapsed.value
      }, 250)
    }
  }

  async function onDragStart(e: MouseEvent | TouchEvent) {
    if (mode.value === 'mobile') {
      collapsed.value = !collapsed.value
      return
    }

    if ('button' in e && e.button !== 0)
      return

    isMouseDown = true
    dragDistance = 0
    isTouchEventState = 'touches' in e

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    startMouseX = clientX
    startMouseY = clientY
    startPosX = position.value.x
    startPosY = position.value.y

    if (isTouchEventState && isElectron.value) {
      const touch = (e as TouchEvent).touches[0]
      startTouchScreenX = touch.screenX
      startTouchScreenY = touch.screenY
      try {
        startWindowBounds = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:get-bounds')
      }
      catch (err) {
        console.error('Failed to get bounds for touch drag:', err)
        startWindowBounds = null
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', onDragging)
      window.addEventListener('mouseup', onDragEnd)
      window.addEventListener('touchmove', onDragging, { passive: false })
      window.addEventListener('touchend', onDragEnd)
    }
  }

  async function onDragging(e: MouseEvent | TouchEvent) {
    if (!isMouseDown)
      return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const diffX = clientX - startMouseX
    const diffY = clientY - startMouseY
    dragDistance = Math.sqrt(diffX * diffX + diffY * diffY)

    if (dragDistance >= 4) {
      isDragging.value = true
    }

    if (isElectron.value) {
      if (isTouchEventState) {
        if (dragDistance >= 4 && startWindowBounds) {
          const touch = (e as TouchEvent).touches[0]
          const deltaX = touch.screenX - startTouchScreenX
          const deltaY = touch.screenY - startTouchScreenY
          try {
            await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:set-bounds', [{
              x: Math.round(startWindowBounds.x + deltaX),
              y: Math.round(startWindowBounds.y + deltaY),
              width: startWindowBounds.width,
              height: startWindowBounds.height,
            }])
          }
          catch (err) {
            console.error('Failed to set bounds on touch drag:', err)
          }
        }
      }
      else {
        if (dragDistance >= 4) {
          cleanupDragListeners()
          isMouseDown = false
          isDragging.value = false
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('control-strip:drag-start'))
          }
        }
      }
    }
    else {
      if (isDragging.value) {
        const deltaX = startMouseX - clientX
        const deltaY = startMouseY - clientY
        position.value.x = Math.max(10, Math.min(window.innerWidth - 72, startPosX + deltaX))
        position.value.y = Math.max(10, Math.min(window.innerHeight - 300, startPosY + deltaY))
      }
    }
  }

  function onDragEnd() {
    const wasDown = isMouseDown
    const wasDragging = isDragging.value
    cleanupDragListeners()
    isMouseDown = false
    isDragging.value = false
    isTouchEventState = false
    startWindowBounds = null

    if (wasDown && !wasDragging) {
      handlePerpendicularClick()
    }
  }

  return {
    isDragging,
    onDragStart,
    onDragging,
    onDragEnd,
    cleanupDragListeners,
    handlePerpendicularClick,
  }
}
