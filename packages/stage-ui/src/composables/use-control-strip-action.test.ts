import { useTheme } from '@proj-airi/ui'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'

import { useHearingStore } from '../stores/modules/hearing'
import { useSettings, useSettingsAudioDevice, useSettingsControlsIsland, useSettingsControlStrip } from '../stores/settings'
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

/**
 * Characterization of the dispatch table, written before `ControlStrip.vue` is
 * decomposed. The popover router will keep delegating non-popover buttons here,
 * so these semantics must survive the split untouched.
 */
describe('useControlStripAction dispatch characterization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const strip = () => useSettingsControlStrip()
  const island = () => useSettingsControlsIsland()
  const settings = () => useSettings()

  const TOGGLES: Array<{ action: string, read: () => boolean, write: (value: boolean) => void }> = [
    { action: 'chat', read: () => strip().chatOpen, write: value => strip().chatOpen = value },
    { action: 'caption', read: () => strip().captionOpen, write: value => strip().captionOpen = value },
    { action: 'stage-mate', read: () => strip().stageMateEnabled, write: value => strip().stageMateEnabled = value },
    { action: 'workspace', read: () => strip().workspaceOpen, write: value => strip().workspaceOpen = value },
    { action: 'always-on-top', read: () => island().alwaysOnTop, write: value => island().alwaysOnTop = value },
    { action: 'viewport-auto-hide', read: () => island().fadeOnHoverEnabled, write: value => island().fadeOnHoverEnabled = value },
    { action: 'caption-sync-position', read: () => settings().captionFollowStagePosition, write: value => settings().captionFollowStagePosition = value },
    { action: 'caption-sync-visibility', read: () => settings().captionFollowStageVisibility, write: value => settings().captionFollowStageVisibility = value },
  ]

  for (const { action, read, write } of TOGGLES) {
    it(`flips "${action}" on every press`, () => {
      write(true)
      const { dispatchAction } = useControlStripAction()

      dispatchAction(action)
      expect(read(), `${action} should turn off`).toBe(false)

      dispatchAction(action)
      expect(read(), `${action} should turn back on`).toBe(true)
    })
  }

  it('flips the actor stage when WebGL is available', () => {
    // `stage` short-circuits with a toast when the startup flag disabled the
    // renderer; that guard must stay in front of the toggle.
    strip().stageDisabled = false
    strip().stageEnabled = true

    const { dispatchAction } = useControlStripAction()
    dispatchAction('stage')
    expect(strip().stageEnabled).toBe(false)
  })

  it('claims and releases microphone ownership alongside the device flag', () => {
    const audioDevice = useSettingsAudioDevice()
    const hearing = useHearingStore()
    audioDevice.enabled = false

    const { dispatchAction } = useControlStripAction()
    dispatchAction('mic')
    expect(audioDevice.enabled).toBe(true)
    expect(hearing.micOwner).toBe('ambient')

    dispatchAction('mic')
    expect(audioDevice.enabled).toBe(false)
    expect(hearing.micOwner).toBeNull()
  })

  it('cycles caption docking none -> bottom -> top -> head -> none', () => {
    settings().captionDocking = 'none'
    const { dispatchAction } = useControlStripAction()

    const seen: Array<string | undefined> = []
    for (let index = 0; index < 4; index++) {
      dispatchAction('caption-docking')
      seen.push(settings().captionDocking)
    }

    expect(seen).toEqual(['bottom', 'top', 'head', 'none'])
  })

  it('cycles caption layout between single and multi', () => {
    settings().captionLayoutMode = 'single'
    const { dispatchAction } = useControlStripAction()

    dispatchAction('caption-layout-mode')
    expect(settings().captionLayoutMode).toBe('multi')

    dispatchAction('caption-layout-mode')
    expect(settings().captionLayoutMode).toBe('single')
  })

  it('keeps stage-view-controls enabled exactly while the drag mode is active', () => {
    // NOTICE: `stageViewControlsEnabled` feeds Electron click-through
    // (`applyTransparencyState`), so a new cycle mode or reorder can silently
    // change window hit-testing. Asserted relationally to stay order-agnostic.
    strip().stageMode = 'tactileMode'
    const { dispatchAction } = useControlStripAction()

    dispatchAction('viewport-cycle-modes')
    expect(settings().stageViewControlsEnabled).toBe(strip().stageMode === 'dragMode')

    dispatchAction('viewport-cycle-modes')
    expect(settings().stageViewControlsEnabled).toBe(strip().stageMode === 'dragMode')
  })

  it('opens the Customizer window for the layout button', () => {
    const listener = vi.fn()
    window.addEventListener('control-strip:open-customizer', listener)
    try {
      useControlStripAction().dispatchAction('layout')
      expect(listener).toHaveBeenCalledTimes(1)
    }
    finally {
      window.removeEventListener('control-strip:open-customizer', listener)
    }
  })

  it('leaves stage-atmosphere to the strip popover', () => {
    // The dispatcher owns this id in its switch only as a documented no-op:
    // ControlStrip opens the atmosphere popover before reaching dispatch.
    const before = [
      settings().captionDocking,
      strip().chatOpen,
      strip().stageEnabled,
      strip().captionOpen,
    ]

    useControlStripAction().dispatchAction('stage-atmosphere')

    expect([
      settings().captionDocking,
      strip().chatOpen,
      strip().stageEnabled,
      strip().captionOpen,
    ]).toEqual(before)
  })

  it('keeps the local action event flowing even when the broadcast is suppressed', () => {
    // `skipBroadcast` only gates the cross-window BroadcastChannel post; the
    // in-window CustomEvent that the desktop page listens on must still fire.
    // (The channel itself is pinned by ControlStrip.contract.test.ts: VueUse
    // treats BroadcastChannel as unsupported under the node test environment.)
    const listener = vi.fn()
    window.addEventListener('control-strip:action', listener)
    try {
      const { dispatchAction } = useControlStripAction()

      dispatchAction('chat')
      dispatchAction('chat', { skipBroadcast: true })

      expect(listener).toHaveBeenCalledTimes(2)
      expect(listener.mock.calls.map(call => (call[0] as CustomEvent).detail)).toEqual([
        { action: 'chat' },
        { action: 'chat' },
      ])
    }
    finally {
      window.removeEventListener('control-strip:action', listener)
    }
  })
})
