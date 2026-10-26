// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

import MotionStudioPopover from './MotionStudioPopover.vue'

import { useSettings } from '../../../../stores/settings'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

vi.mock('@proj-airi/stage-ui-three', () => ({
  useModelStore: () => ({
    triggerMotion: vi.fn(),
  }),
  useCustomVrmAnimationsStore: () => ({
    customAnimations: [],
    addCustomAnimation: vi.fn(),
  }),
}))

vi.mock('../../../../stores/modules/text-to-motion', () => ({
  useTextToMotionStore: () => ({
    generateMotion: vi.fn(),
  }),
}))

vi.mock('../../../../composables/use-control-strip-settings-route', () => ({
  useControlStripSettingsRoute: () => ({
    openSettingsRoute: vi.fn(),
  }),
}))

describe('motionStudioPopover VRM Compatibility Gate', () => {
  let pinia: ReturnType<typeof createPinia>
  let container: HTMLDivElement

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('renders amber warning notice and collapses layout when renderer is Live2D', async () => {
    const settingsStore = useSettings()
    ;(settingsStore as any).stageModelRenderer = 'live2d'

    const app = createApp(MotionStudioPopover)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    // Amber notice must be present
    expect(container.textContent).toContain('Only Compatible with VRM')
    expect(container.textContent).toMatch(/Live2D/i)
    expect(container.textContent).toContain('Switch Avatar in Stage Settings')

    // Standard motion studio controls must be collapsed
    expect(container.textContent).not.toContain('Quick motions')
    expect(container.textContent).not.toContain('Describe a motion')
    expect(container.textContent).not.toContain('Stop motion')

    app.unmount()
  })

  it('renders amber warning notice and collapses layout when renderer is Spine or MMD', async () => {
    const settingsStore = useSettings()
    ;(settingsStore as any).stageModelRenderer = 'spine'

    const app = createApp(MotionStudioPopover)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    expect(container.textContent).toContain('Only Compatible with VRM')
    expect(container.textContent).toMatch(/Spine/i)
    expect(container.textContent).not.toContain('Quick motions')

    app.unmount()
  })

  it('renders full Motion Studio layout when renderer is VRM', async () => {
    const settingsStore = useSettings()
    ;(settingsStore as any).stageModelRenderer = 'vrm'

    const app = createApp(MotionStudioPopover)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    // Warning notice must NOT be present
    expect(container.textContent).not.toContain('Only Compatible with VRM')

    // Studio controls must be present
    expect(container.textContent).toContain('Create')
    expect(container.textContent).toContain('Library')
    expect(container.textContent).toContain('Quick motions')
    expect(container.textContent).toContain('Describe a motion')
    expect(container.textContent).toContain('Stop motion')

    app.unmount()
  })
})
