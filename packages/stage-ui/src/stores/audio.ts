import { debug } from '@proj-airi/stage-shared'
import { useDevicesList, usePermission, useUserMedia } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import { enableIOSPlayback } from '../utils/ios-audio-unmute'

function calculateVolumeWithLinearNormalize(analyser: AnalyserNode) {
  const dataBuffer = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(dataBuffer)

  const volumeVector: Array<number> = []
  for (let i = 0; i < 700; i += 80)
    volumeVector.push(dataBuffer[i])

  const volumeSum = dataBuffer
    // The volume changes flatten-ly, while the volume is often low, therefore we need to amplify it.
    // Applying a power function to amplify the volume is helpful, for example:
    // v ** 1.2 will amplify the volume by 1.2 times
    .map(v => v ** 1.2)
    // Scale up the volume values to make them more distinguishable
    .map(v => v * 1.2)
    .reduce((acc, cur) => acc + cur, 0)

  return (volumeSum / dataBuffer.length / 100)
}

function calculateVolumeWithMinMaxNormalize(analyser: AnalyserNode) {
  const dataBuffer = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(dataBuffer)

  const volumeVector: Array<number> = []
  for (let i = 0; i < 700; i += 80)
    volumeVector.push(dataBuffer[i])

  // The volume changes flatten-ly, while the volume is often low, therefore we need to amplify it.
  // We can apply a power function to amplify the volume, for example
  // v ** 1.2 will amplify the volume by 1.2 times
  const amplifiedVolumeVector = dataBuffer.map(v => v ** 1.5)

  // Normalize the amplified values using Min-Max scaling
  const min = Math.min(...amplifiedVolumeVector)
  const max = Math.max(...amplifiedVolumeVector)
  const range = max - min

  let normalizedVolumeVector
  if (range === 0) {
    // If range is zero, all values are the same, so normalization is not needed
    normalizedVolumeVector = amplifiedVolumeVector.map(() => 0) // or any default value
  }
  else {
    normalizedVolumeVector = amplifiedVolumeVector.map(v => (v - min) / range)
  }

  // Aggregate the volume values
  const volumeSum = normalizedVolumeVector.reduce((acc, cur) => acc + cur, 0)

  // Average the volume values
  return volumeSum / dataBuffer.length
}

function calculateVolume(analyser: AnalyserNode, mode: 'linear' | 'minmax' = 'linear') {
  switch (mode) {
    case 'linear':
      return calculateVolumeWithLinearNormalize(analyser)
    case 'minmax':
      return calculateVolumeWithMinMaxNormalize(analyser)
  }
}

export const useAudioContext = defineStore('audio-context', () => {
  const audioContext = shallowRef<AudioContext>(new AudioContext())

  async function setSinkId(sinkId: string) {
    if (!audioContext.value)
      return
    if ('setSinkId' in audioContext.value && typeof (audioContext.value as any).setSinkId === 'function') {
      try {
        await (audioContext.value as any).setSinkId(sinkId || '')
      }
      catch (error) {
        console.warn('[AudioContext] Failed to set sinkId:', error)
      }
    }
  }

  // Restore saved output sink if present in localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const savedSink = localStorage.getItem('settings/audio/output')
      if (savedSink) {
        const parsed = JSON.parse(savedSink)
        if (typeof parsed === 'string' && parsed) {
          void setSinkId(parsed)
        }
      }
    }
    catch {
      // Ignore JSON parse errors or localStorage access errors
    }
  }

  // iOS silent mode workaround: must run from a user gesture.
  // Register a one-time listener so the first interaction unlocks playback.
  function unlockOnInteraction() {
    enableIOSPlayback()
    document.removeEventListener('touchend', unlockOnInteraction, true)
    document.removeEventListener('click', unlockOnInteraction, true)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('touchend', unlockOnInteraction, { capture: true, once: true })
    document.addEventListener('click', unlockOnInteraction, { capture: true, once: true })
  }

  return {
    audioContext,
    calculateVolume,
    setSinkId,
  }
})

export function useAudioDevice(requestPermission: boolean = false) {
  const devices = useDevicesList({ constraints: { audio: true }, requestPermissions: requestPermission })
  const audioInputs = computed(() => devices.audioInputs.value)
  const audioOutputs = computed(() => devices.audioOutputs.value)

  const micPermission = usePermission('microphone')
  const permissionDenied = ref(false)

  // NOTICE: Track permission dynamically; when the user unblocks the mic in site settings,
  // the 'change' event fires on PermissionStatus and clears permissionDenied.
  watch(micPermission, (status) => {
    if (status === 'granted')
      permissionDenied.value = false
    else if (status === 'denied')
      permissionDenied.value = true
  })

  // Permission tri-state: 'granted' | 'denied' | 'prompt'
  // Browsers strip device labels when media permissions are withheld; non-empty labels indicate granted access.
  const permissionStatus = computed<'granted' | 'denied' | 'prompt'>(() => {
    if (micPermission.value === 'denied' || permissionDenied.value)
      return 'denied'
    if (micPermission.value === 'granted' || devices.permissionGranted?.value)
      return 'granted'
    if (audioInputs.value.some(d => Boolean(d.label)))
      return 'granted'
    return 'prompt'
  })

  const isPermissionGranted = computed(() => permissionStatus.value === 'granted')
  const isPermissionDenied = computed(() => permissionStatus.value === 'denied')

  const selectedAudioInput = ref<string>('')
  const selectedAudioOutput = ref<string>('')

  function findBestDevice(inputs: MediaDeviceInfo[]) {
    if (inputs.length === 0)
      return ''

    // 1. Look for "Microphone Array" that is NOT "Communications" (User's specific preference)
    const arrayMic = inputs.find(d => d.label.toLowerCase().includes('microphone array') && !d.label.toLowerCase().includes('communications'))
    if (arrayMic)
      return arrayMic.deviceId

    // 2. Fallback to any "Microphone Array"
    const anyArrayMic = inputs.find(d => d.label.toLowerCase().includes('microphone array'))
    if (anyArrayMic)
      return anyArrayMic.deviceId

    // 3. Look for "default"
    const defaultMic = inputs.find(d => d.deviceId === 'default')
    if (defaultMic)
      return defaultMic.deviceId

    // 4. Fallback to first available
    return inputs[0].deviceId
  }

  const selectedAudioInputLabel = computed(() => {
    const device = audioInputs.value.find(d => d.deviceId === selectedAudioInput.value)
    return device?.label || 'Unknown Device'
  })

  const selectedAudioOutputLabel = computed(() => {
    if (!selectedAudioOutput.value)
      return 'Default Output Device'
    const device = audioOutputs.value.find(d => d.deviceId === selectedAudioOutput.value)
    return device?.label || selectedAudioOutput.value || 'Default Output Device'
  })

  const deviceConstraints = computed<MediaStreamConstraints>(() => ({
    audio: {
      deviceId: selectedAudioInput.value ? { exact: selectedAudioInput.value } : undefined,
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
  }))

  const { stream, stop: stopStream, start: startStream } = useUserMedia({
    constraints: deviceConstraints,
    enabled: false,
    autoSwitch: true,
  })

  watch(audioInputs, (newInputs) => {
    const isCommunications = selectedAudioInputLabel.value.toLowerCase().includes('communications')
    const needsBest = !selectedAudioInput.value || selectedAudioInput.value === 'default' || isCommunications

    if (needsBest && newInputs.length > 0) {
      const best = findBestDevice(newInputs)
      if (best && best !== selectedAudioInput.value) {
        debug('[Audio Store] Switching away from Communications/Default device to:', best)
        selectedAudioInput.value = best
      }
    }
  }, { immediate: true })

  async function askPermission() {
    try {
      const granted = await devices.ensurePermissions()
      await nextTick()
      if (granted) {
        permissionDenied.value = false
        if (audioInputs.value.length > 0 && !selectedAudioInput.value) {
          selectedAudioInput.value = findBestDevice(audioInputs.value)
        }
        return true
      }
      else {
        permissionDenied.value = true
        return false
      }
    }
    catch (error) {
      permissionDenied.value = true
      console.error('Error ensuring permissions:', error)
      throw error // Re-throw so callers can handle the error
    }
  }

  return {
    audioInputs,
    audioOutputs,
    selectedAudioInput,
    selectedAudioInputLabel,
    selectedAudioOutput,
    selectedAudioOutputLabel,
    stream,
    deviceConstraints,
    permissionStatus,
    isPermissionGranted,
    isPermissionDenied,

    askPermission,
    startStream,
    stopStream,
  }
}

export const useSpeakingStore = defineStore('character-speaking', () => {
  const nowSpeakingAvatarBorderOpacityMin = 30
  const nowSpeakingAvatarBorderOpacityMax = 100
  const mouthOpenSize = ref(0)
  const nowSpeaking = ref(false)

  const nowSpeakingAvatarBorderOpacity = computed<number>(() => {
    if (!nowSpeaking.value)
      return nowSpeakingAvatarBorderOpacityMin

    return ((nowSpeakingAvatarBorderOpacityMin
      + (nowSpeakingAvatarBorderOpacityMax - nowSpeakingAvatarBorderOpacityMin) * mouthOpenSize.value) / 100)
  })

  return {
    mouthOpenSize,
    nowSpeaking,
    nowSpeakingAvatarBorderOpacity,
  }
})

// Phase 0D: this module manages raw WebAudio allocations (AudioContext, PCM
// nodes, mic streams) that cannot be hot-swapped. Force a clean window reload
// rather than strand native audio handles across re-evaluations. Covers all
// stores in this module. No-op in production.
if (import.meta.hot) {
  import.meta.hot.invalidate('AudioContext HMR hard reload')
}
