import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useControlStripButtons } from './use-control-strip-buttons'

describe('useControlStripButtons visibility and dot contract', () => {
  it('prunes desktop-only buttons on mobile but keeps them on desktop', () => {
    const buttons = ref([
      { id: 'theme-mode', label: 'Theme', icon: 'i-solar:sun-linear', enabled: true },
      { id: 'actor-characters', label: 'Char', icon: 'i-solar:user-linear', enabled: true },
      { id: 'stage-mate', label: 'Mate', icon: 'i-solar:ghost-linear', enabled: true },
    ])
    const desktop = useControlStripButtons({
      mode: ref<'desktop' | 'mobile'>('desktop'),
      buttons,
      isSandboxAllowed: ref(true),
      powerState: ref('off'),
    })
    expect(desktop.activeButtons.value.map(b => b.id)).toContain('stage-mate')

    const mobile = useControlStripButtons({
      mode: ref<'desktop' | 'mobile'>('mobile'),
      buttons,
      isSandboxAllowed: ref(true),
      powerState: ref('off'),
    })
    // stage-mate is desktopOnly in the catalog; theme-mode is not.
    expect(desktop.activeButtons.value.length).toBeGreaterThan(mobile.activeButtons.value.length)
    expect(mobile.activeButtons.value.map(b => b.id)).toContain('theme-mode')
  })

  it('gates the workspace button on sandbox allowlist', () => {
    const buttons = ref([{ id: 'workspace', label: 'Work', icon: 'i-solar:code-linear', enabled: true }])
    const allowed = useControlStripButtons({
      mode: ref<'desktop' | 'mobile'>('desktop'),
      buttons,
      isSandboxAllowed: ref(true),
      powerState: ref('off'),
    })
    expect(allowed.activeButtons.value).toHaveLength(1)

    const denied = useControlStripButtons({
      mode: ref<'desktop' | 'mobile'>('desktop'),
      buttons,
      isSandboxAllowed: ref(false),
      powerState: ref('off'),
    })
    expect(denied.activeButtons.value).toHaveLength(0)
  })

  it('preserves label and icon through the filter for the presentation feed', () => {
    const buttons = ref([
      { id: 'chat', label: 'Chat', icon: 'i-solar:chat-linear', enabled: true },
      { id: 'mic', label: 'Mic', icon: 'i-solar:mic-linear', enabled: false },
    ])
    const { activeButtons } = useControlStripButtons({
      mode: ref<'desktop' | 'mobile'>('desktop'),
      buttons,
      isSandboxAllowed: ref(true),
      powerState: ref('off'),
    })
    expect(activeButtons.value).toEqual([
      { id: 'chat', label: 'Chat', icon: 'i-solar:chat-linear', enabled: true },
    ])
  })

  it('maps every power state to a distinct dot class', () => {
    const states = ['busy', 'active', 'connecting', 'ambient', 'off']
    const dots = states.map((state) => {
      const { geminiDotClasses } = useControlStripButtons({
        mode: ref<'desktop' | 'mobile'>('desktop'),
        buttons: ref([]),
        isSandboxAllowed: ref(true),
        powerState: ref(state),
      })
      return geminiDotClasses.value
    })
    expect(new Set(dots).size).toBe(states.length)
  })
})
