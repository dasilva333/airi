// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref } from 'vue'

import VoiceInputHoverCard from './VoiceInputHoverCard.vue'

const mockAudioInputs = ref<any[]>([])
const mockSelectedAudioInput = ref('')
const mockSelectedAudioInputLabel = ref('Unknown Device')
const mockPermissionStatus = ref<'granted' | 'denied' | 'prompt'>('prompt')
const mockIsPermissionGranted = ref(false)
const mockIsPermissionDenied = ref(false)
const mockAskPermission = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@proj-airi/electron-vueuse', () => ({
  useElectronEventaInvoke: () => vi.fn(),
}))

vi.mock('../../../stores/settings', () => ({
  useSettingsAudioDevice: () => ({
    audioInputs: mockAudioInputs,
    selectedAudioInput: mockSelectedAudioInput,
    selectedAudioInputLabel: mockSelectedAudioInputLabel,
    permissionStatus: mockPermissionStatus,
    isPermissionGranted: mockIsPermissionGranted,
    isPermissionDenied: mockIsPermissionDenied,
    stream: ref(null),
    askPermission: mockAskPermission,
  }),
}))

vi.mock('../../../composables/audio/audio-analyzer', () => ({
  useAudioAnalyzer: () => ({
    volumeLevel: ref(0),
    startAnalyzer: vi.fn(),
  }),
}))

describe('voiceInputHoverCard microphone status', () => {
  let pinia: ReturnType<typeof createPinia>
  let container: HTMLDivElement

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    container = document.createElement('div')
    document.body.appendChild(container)

    mockAudioInputs.value = [{ deviceId: '', label: '' }]
    mockSelectedAudioInput.value = ''
    mockSelectedAudioInputLabel.value = 'Unknown Device'
    mockPermissionStatus.value = 'prompt'
    mockIsPermissionGranted.value = false
    mockIsPermissionDenied.value = false
    mockAskPermission.mockClear()
  })

  it('renders BLOCKED badge and "Microphone access blocked" when permission is denied', async () => {
    mockPermissionStatus.value = 'denied'
    mockIsPermissionDenied.value = true

    const app = createApp(VoiceInputHoverCard)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    expect(container.textContent).toContain('Blocked')
    expect(container.textContent).not.toContain('Ready')
    expect(container.textContent).toContain('Microphone access blocked')

    app.unmount()
  })

  it('renders READY badge and device label when permission is granted', async () => {
    mockPermissionStatus.value = 'granted'
    mockIsPermissionGranted.value = true
    mockSelectedAudioInputLabel.value = 'MacBook Pro Microphone'
    mockAudioInputs.value = [{ deviceId: 'default', label: 'MacBook Pro Microphone' }]

    const app = createApp(VoiceInputHoverCard)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    expect(container.textContent).toContain('Ready')
    expect(container.textContent).toContain('MacBook Pro Microphone')

    app.unmount()
  })

  it('renders NO MIC when no input devices are detected', async () => {
    mockAudioInputs.value = []

    const app = createApp(VoiceInputHoverCard)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    expect(container.textContent).toContain('No mic')
    expect(container.textContent).not.toContain('Ready')

    app.unmount()
  })

  it('renders NEED ACCESS badge when permission has not been requested yet', async () => {
    mockPermissionStatus.value = 'prompt'
    mockAudioInputs.value = [{ deviceId: '', label: '' }]

    const app = createApp(VoiceInputHoverCard)
    app.use(pinia)
    app.mount(container)
    await nextTick()

    expect(container.textContent).toContain('Need access')
    expect(container.textContent).not.toContain('Ready')

    app.unmount()
  })
})
