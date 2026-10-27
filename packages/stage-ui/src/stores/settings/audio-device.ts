import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { onMounted, watch } from 'vue'

import { useAudioContext, useAudioDevice } from '../audio'

export const useSettingsAudioDevice = defineStore('settings-audio-devices', () => {
  const {
    audioInputs,
    audioOutputs,
    deviceConstraints,
    selectedAudioInput: selectedAudioInputNonPersist,
    selectedAudioInputLabel,
    selectedAudioOutput: selectedAudioOutputNonPersist,
    selectedAudioOutputLabel,
    permissionStatus,
    isPermissionGranted,
    isPermissionDenied,
    startStream,
    stopStream,
    stream,
    askPermission,
  } = useAudioDevice()

  const audioContextStore = useAudioContext()

  const selectedAudioInputPersist = useLocalStorageManualReset<string>('settings/audio/input', selectedAudioInputNonPersist.value)
  const selectedAudioInputEnabledPersist = useLocalStorageManualReset<boolean>('settings/audio/input/enabled', false)

  const selectedAudioOutputPersist = useLocalStorageManualReset<string>('settings/audio/output', selectedAudioOutputNonPersist.value)

  let stopPendingAudioInput = false

  async function handleStartStream() {
    stopPendingAudioInput = false
    await startStream()
    if (stopPendingAudioInput) {
      stopStream()
    }
  }

  function handleStopStream() {
    stopPendingAudioInput = true
    stopStream()
  }

  watch(selectedAudioInputPersist, (newValue) => {
    selectedAudioInputNonPersist.value = newValue
  })

  watch(selectedAudioInputEnabledPersist, (val) => {
    if (val) {
      void handleStartStream()
    }
    else {
      handleStopStream()
    }
  })

  async function applyOutputSink(sinkId: string) {
    await audioContextStore.setSinkId(sinkId)
  }

  watch(selectedAudioOutputPersist, (newValue) => {
    selectedAudioOutputNonPersist.value = newValue
    void applyOutputSink(newValue)
  }, { immediate: true })

  watch(() => audioContextStore.audioContext, () => {
    void applyOutputSink(selectedAudioOutputPersist.value)
  })

  onMounted(() => {
    const hasSelectedInput = selectedAudioInputPersist.value
      && audioInputs.value.some(device => device.deviceId === selectedAudioInputPersist.value)

    if (hasSelectedInput) {
      selectedAudioInputNonPersist.value = selectedAudioInputPersist.value
    }

    if (selectedAudioInputEnabledPersist.value) {
      void handleStartStream()
    }
    if (selectedAudioInputNonPersist.value && !selectedAudioInputEnabledPersist.value) {
      selectedAudioInputPersist.value = selectedAudioInputNonPersist.value
    }

    if (selectedAudioOutputNonPersist.value && !selectedAudioOutputPersist.value) {
      selectedAudioOutputPersist.value = selectedAudioOutputNonPersist.value
    }
    void applyOutputSink(selectedAudioOutputPersist.value)
  })

  function resetState() {
    selectedAudioInputPersist.value = ''
    selectedAudioInputNonPersist.value = ''
    selectedAudioInputEnabledPersist.value = false
    handleStopStream()

    selectedAudioOutputPersist.value = ''
    selectedAudioOutputNonPersist.value = ''
    void applyOutputSink('')
  }

  return {
    audioInputs,
    audioOutputs,
    deviceConstraints,
    selectedAudioInput: selectedAudioInputPersist,
    selectedAudioInputLabel,
    selectedAudioOutput: selectedAudioOutputPersist,
    selectedAudioOutputLabel,
    enabled: selectedAudioInputEnabledPersist,
    permissionStatus,
    isPermissionGranted,
    isPermissionDenied,

    stream,

    askPermission,
    startStream: handleStartStream,
    stopStream: handleStopStream,
    applyOutputSink,
    resetState,
  }
})
