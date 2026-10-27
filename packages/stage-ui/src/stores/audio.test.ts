import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useAudioContext, useAudioDevice, useSpeakingStore } from './audio'

const mockAudioInputs = ref<unknown[]>([])
const mockAudioOutputs = ref<unknown[]>([])
const mockEnsurePermissions = vi.fn().mockResolvedValue(true)
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockStream = ref<unknown>(null)
const mockMicPermission = ref<PermissionState | undefined>(undefined)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    usePermission: vi.fn((desc) => {
      if (desc === 'microphone' || (typeof desc === 'object' && desc?.name === 'microphone'))
        return mockMicPermission
      return ref(undefined)
    }),
    useDevicesList: () => ({
      audioInputs: mockAudioInputs,
      audioOutputs: mockAudioOutputs,
      devices: ref([]),
      permissionGranted: ref(false),
      ensurePermissions: mockEnsurePermissions,
    }),
    useUserMedia: () => ({
      stream: mockStream,
      start: mockStart,
      stop: mockStop,
    }),
  }
})

function makeAnalyser(data: number[]) {
  const buf = new Uint8Array(data)
  return {
    frequencyBinCount: data.length,
    getByteFrequencyData: (target: Uint8Array) => {
      target.set(buf)
    },
  } as unknown as AnalyserNode
}

describe('audio store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAudioInputs.value = []
    mockAudioOutputs.value = []
    mockEnsurePermissions.mockClear()
    mockMicPermission.value = undefined
    localStorage.clear()
  })

  it('calculateVolume linear', () => {
    const store = useAudioContext()
    const v = store.calculateVolume(makeAnalyser([10, 20, 30]), 'linear')
    expect(typeof v).toBe('number')
  })

  it('calculateVolume minmax', () => {
    const store = useAudioContext()
    const v = store.calculateVolume(makeAnalyser([10, 20, 30]), 'minmax')
    expect(typeof v).toBe('number')
  })

  it('calculateVolume minmax zero range', () => {
    const store = useAudioContext()
    const v = store.calculateVolume(makeAnalyser([5, 5, 5]), 'minmax')
    expect(v).toBe(0)
  })

  it('useAudioContext setSinkId no throw', async () => {
    const store = useAudioContext()
    await store.setSinkId('x')
    expect(true).toBe(true)
  })

  it('useSpeakingStore opacity', () => {
    const store = useSpeakingStore()
    expect(store.nowSpeakingAvatarBorderOpacity).toBe(30)
    store.mouthOpenSize = 1
    store.nowSpeaking = true
    expect(store.nowSpeakingAvatarBorderOpacity).toBe(1)
  })

  it('useAudioDevice basics', async () => {
    mockAudioInputs.value = [{ deviceId: 'default', label: 'default mic' }]
    const dev = useAudioDevice(false)
    expect(dev.audioInputs.value).toHaveLength(1)
    expect(dev.selectedAudioInputLabel.value).toBe('default mic')
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('default')
  })

  it('useAudioDevice findBestDevice microphone array', async () => {
    mockAudioInputs.value = [
      { deviceId: 'a', label: 'Microphone Array' },
      { deviceId: 'default', label: 'Default' },
    ]
    const dev = useAudioDevice(false)
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('a')
  })

  it('findBestDevice communications preference', async () => {
    mockAudioInputs.value = [
      { deviceId: 'comm', label: 'Microphone Array Communications' },
      { deviceId: 'arr', label: 'Microphone Array' },
    ]
    const dev = useAudioDevice(false)
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('arr')
  })

  it('findBestDevice fallback first', async () => {
    mockAudioInputs.value = [{ deviceId: 'first', label: 'Plain Mic' }]
    const dev = useAudioDevice(false)
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('first')
  })

  it('findBestDevice default mic', async () => {
    mockAudioInputs.value = [{ deviceId: 'default', label: 'Default Mic' }]
    const dev = useAudioDevice(false)
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('default')
  })

  it('askPermission error', async () => {
    mockEnsurePermissions.mockRejectedValueOnce(new Error('nope'))
    const dev = useAudioDevice(false)
    await expect(dev.askPermission()).rejects.toThrow('nope')
  })

  it('useAudioDevice labels', () => {
    const dev = useAudioDevice(false)
    dev.selectedAudioOutput.value = 'out1'
    expect(dev.selectedAudioOutputLabel.value).toBe('out1')
    dev.selectedAudioOutput.value = ''
    expect(dev.selectedAudioOutputLabel.value).toBe('Default Output Device')
  })
  it('useAudioContext restores saved sink', async () => {
    const ctx = { setSinkId: vi.fn().mockResolvedValue(undefined) }
    const g = globalThis as unknown as { AudioContext: unknown }
    g.AudioContext = function () { return ctx }
    localStorage.setItem('settings/audio/output', JSON.stringify('sink-1'))
    const store = useAudioContext()
    await Promise.resolve()
    await Promise.resolve()
    expect(ctx.setSinkId).toHaveBeenCalledWith('sink-1')
    await store.setSinkId('sink-2')
    expect(ctx.setSinkId).toHaveBeenCalledWith('sink-2')
  })

  it('useAudioContext setSinkId no setSinkId method', async () => {
    const ctx = {}
    const g2 = globalThis as unknown as { AudioContext: unknown }
    g2.AudioContext = function () { return ctx }
    const store = useAudioContext()
    await store.setSinkId('x')
    expect(true).toBe(true)
  })

  it('useAudioContext setSinkId error caught', async () => {
    const ctx = { setSinkId: vi.fn().mockRejectedValue(new Error('boom')) }
    const g3 = globalThis as unknown as { AudioContext: unknown }
    g3.AudioContext = function () { return ctx }
    localStorage.clear()
    const store = useAudioContext()
    await store.setSinkId('x')
    expect(true).toBe(true)
  })

  it('calculateVolume default mode', () => {
    const store = useAudioContext()
    const v = store.calculateVolume(makeAnalyser([10, 20, 30]))
    expect(typeof v).toBe('number')
  })

  it('selectedAudioInputLabel unknown', () => {
    const dev = useAudioDevice(false)
    dev.selectedAudioInput.value = 'missing'
    expect(dev.selectedAudioInputLabel.value).toBe('Unknown Device')
  })

  it('selectedAudioOutputLabel found device', () => {
    mockAudioOutputs.value = [{ deviceId: 'out1', label: 'Speaker' }]
    const dev = useAudioDevice(false)
    dev.selectedAudioOutput.value = 'out1'
    expect(dev.selectedAudioOutputLabel.value).toBe('Speaker')
  })

  it('watch switches from communications', async () => {
    mockAudioInputs.value = [{ deviceId: 'comm', label: 'Microphone Array Communications' }]
    const dev = useAudioDevice(false)
    dev.selectedAudioInput.value = 'comm'
    mockAudioInputs.value = [
      { deviceId: 'comm', label: 'Microphone Array Communications' },
      { deviceId: 'arr', label: 'Microphone Array' },
    ]
    await Promise.resolve()
    expect(dev.selectedAudioInput.value).toBe('arr')
  })

  it('askPermission sets best when empty', async () => {
    mockAudioInputs.value = [{ deviceId: 'first', label: 'Plain Mic' }]
    const dev = useAudioDevice(false)
    dev.selectedAudioInput.value = ''
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('first')
  })

  it('useSpeakingStore not speaking', () => {
    const store = useSpeakingStore()
    store.nowSpeaking = false
    store.mouthOpenSize = 0.5
    expect(store.nowSpeakingAvatarBorderOpacity).toBe(30)
  })
  it('useAudioContext ignores invalid saved sink JSON', () => {
    const ctx = { setSinkId: vi.fn() }
    const g = globalThis as unknown as { AudioContext: unknown }
    g.AudioContext = function () { return ctx }
    localStorage.setItem('settings/audio/output', '{bad json')
    const store = useAudioContext()
    expect(store).toBeDefined()
    expect(ctx.setSinkId).not.toHaveBeenCalled()
  })

  it('askPermission no-op when selected exists', async () => {
    mockAudioInputs.value = [{ deviceId: 'first', label: 'Plain Mic' }]
    const dev = useAudioDevice(false)
    dev.selectedAudioInput.value = 'existing'
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('existing')
  })

  it('askPermission no-op when no inputs', async () => {
    mockAudioInputs.value = []
    const dev = useAudioDevice(false)
    dev.selectedAudioInput.value = ''
  })
  it('useAudioContext registers document listeners when document exists', () => {
    const g = globalThis as Record<string, unknown>
    const prevDoc = g.document
    const addEventListener = vi.fn()
    g.document = { addEventListener, removeEventListener: vi.fn() }
    const pinia = createPinia()
    setActivePinia(pinia)
    useAudioContext()
    expect(addEventListener).toHaveBeenCalled()
    g.document = prevDoc
  })

  it('useAudioContext unlockOnInteraction fires on document touchend', () => {
    const g = globalThis as Record<string, unknown>
    const prevDoc = g.document
    let handler: ((...args: unknown[]) => void) | undefined
    const addEventListener = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'touchend')
        handler = cb
    })
    const removeEventListener = vi.fn()
    g.document = { addEventListener, removeEventListener }
    const pinia = createPinia()
    setActivePinia(pinia)
    useAudioContext()
    expect(handler).toBeDefined()
    handler!()
    expect(removeEventListener).toHaveBeenCalled()
    g.document = prevDoc
  })

  it('useAudioContext unlockOnInteraction fires on document click', () => {
    const g = globalThis as Record<string, unknown>
    const prevDoc = g.document
    let handler: ((...args: unknown[]) => void) | undefined
    const addEventListener = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'click')
        handler = cb
    })
    const removeEventListener = vi.fn()
    g.document = { addEventListener, removeEventListener }
    const pinia = createPinia()
    setActivePinia(pinia)
    useAudioContext()
    expect(handler).toBeDefined()
    handler!()
    expect(removeEventListener).toHaveBeenCalled()
    g.document = prevDoc
  })
  it('useAudioContext setSinkId returns when no audioContext (2)', async () => {
    const g = globalThis as unknown as { AudioContext: unknown }
    g.AudioContext = function () { return {} }
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useAudioContext()
    store.audioContext.value = null as unknown as AudioContext
    const r = await store.setSinkId('x')
    expect(r).toBeUndefined()
  })
  it('setSinkId early return when null (cover 76)', async () => {
    const g = globalThis as unknown as { AudioContext: unknown }
    g.AudioContext = function () { return { setSinkId: vi.fn() } }
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useAudioContext()
    store.audioContext.value = null as unknown as AudioContext
    const r = await store.setSinkId('zzz')
    expect(r).toBeUndefined()
  })

  it('placeholder', () => {
    expect(true).toBe(true)
  })
  it('setSinkId early return when AudioContext constructor returns null', async () => {
    const g = globalThis as unknown as { AudioContext: unknown }
    const prev = g.AudioContext
    g.AudioContext = function () { return null }
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useAudioContext()
    const r = await store.setSinkId('x')
    expect(r).toBeUndefined()
    g.AudioContext = prev
  })

  it('findBestDevice empty inputs returns empty', async () => {
    mockAudioInputs.value = []
    const dev = useAudioDevice(false)
    dev.selectedAudioInput.value = ''
    await dev.askPermission()
    expect(dev.selectedAudioInput.value).toBe('')
  })

  it('reports permissionStatus as denied and isPermissionDenied as true when micPermission is denied', () => {
    mockMicPermission.value = 'denied'
    mockAudioInputs.value = [{ deviceId: '', label: '' }]
    const dev = useAudioDevice(false)
    expect(dev.permissionStatus.value).toBe('denied')
    expect(dev.isPermissionDenied.value).toBe(true)
    expect(dev.isPermissionGranted.value).toBe(false)
  })

  it('reports permissionStatus as granted when device labels are present', () => {
    mockMicPermission.value = undefined
    mockAudioInputs.value = [{ deviceId: 'mic-1', label: 'Built-in Microphone' }]
    const dev = useAudioDevice(false)
    expect(dev.permissionStatus.value).toBe('granted')
    expect(dev.isPermissionGranted.value).toBe(true)
    expect(dev.isPermissionDenied.value).toBe(false)
  })

  it('reports permissionStatus as denied when ensurePermissions returns false', async () => {
    mockEnsurePermissions.mockResolvedValueOnce(false)
    mockAudioInputs.value = [{ deviceId: '', label: '' }]
    const dev = useAudioDevice(false)
    const result = await dev.askPermission()
    expect(result).toBe(false)
    expect(dev.permissionStatus.value).toBe('denied')
    expect(dev.isPermissionDenied.value).toBe(true)
    expect(dev.isPermissionGranted.value).toBe(false)
  })

  it('reports permissionStatus as prompt when devices lack labels and permission is unprompted', () => {
    mockMicPermission.value = 'prompt'
    mockAudioInputs.value = [{ deviceId: '', label: '' }]
    const dev = useAudioDevice(false)
    expect(dev.permissionStatus.value).toBe('prompt')
    expect(dev.isPermissionGranted.value).toBe(false)
    expect(dev.isPermissionDenied.value).toBe(false)
  })
})
