import { useTheme } from '@proj-airi/ui'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'

import { useControlStripAction } from './use-control-strip-action'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('useControlStripAction theme handling', () => {
  const { themeMode } = useTheme()

  beforeEach(() => {
    setActivePinia(createPinia())
    themeMode.value = 'auto'
    vi.clearAllMocks()
  })

  it('cycles theme through light -> dark -> auto -> light and displays toast notification on theme-mode action', () => {
    themeMode.value = 'light'
    const { dispatchAction } = useControlStripAction()

    dispatchAction('theme-mode')
    expect(themeMode.value).toBe('dark')
    expect(toast.info).toHaveBeenCalledWith('Theme: Dark')

    dispatchAction('theme-mode')
    expect(themeMode.value).toBe('auto')
    expect(toast.info).toHaveBeenCalledWith('Theme: System')

    dispatchAction('theme-mode')
    expect(themeMode.value).toBe('light')
    expect(toast.info).toHaveBeenCalledWith('Theme: Light')
  })

  it('cycles theme on caption-theme-mode without showing theme toast', () => {
    themeMode.value = 'light'
    const { dispatchAction } = useControlStripAction()

    dispatchAction('caption-theme-mode')
    expect(themeMode.value).toBe('dark')
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('dispatches window control-strip:action event when an action is executed', () => {
    const { dispatchAction } = useControlStripAction()
    const eventSpy = vi.fn()
    window.addEventListener('control-strip:action', eventSpy)

    try {
      dispatchAction('theme-mode')
      expect(eventSpy).toHaveBeenCalled()
      const eventDetail = eventSpy.mock.calls[0][0].detail
      expect(eventDetail).toEqual({ action: 'theme-mode' })
    }
    finally {
      window.removeEventListener('control-strip:action', eventSpy)
    }
  })
})
