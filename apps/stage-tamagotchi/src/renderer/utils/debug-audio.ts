import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings'

// NOTICE: These helpers live at module scope (not inside App.vue setup) so that
// assigning them to `window` for DevTools debugging never retains the App setup
// scope. Store instances resolve lazily on each call. Dev-only (see App.vue).

export interface AudioDebugSnapshot {
  window: string
  hearing: Record<string, unknown>
  audio: Record<string, unknown>
  consciousness: Record<string, unknown>
  chatboxDraft: string | null
}

export function snapshotAudioStateFromWindow(): AudioDebugSnapshot {
  const hearingStore = useHearingStore()
  const audioDeviceStore = useSettingsAudioDevice()
  const consciousnessStore = useConsciousnessStore()
  const snapshot: AudioDebugSnapshot = {
    window: typeof location !== 'undefined' ? location.href : 'unknown',
    hearing: {
      provider: hearingStore.activeTranscriptionProvider,
      model: hearingStore.activeTranscriptionModel,
      detectionMode: hearingStore.hearingDetectionMode,
      tapToTalk: hearingStore.tapToTalk,
      voiceInputMode: hearingStore.voiceInputMode,
      autoSend: hearingStore.autoSendEnabled,
      autoSendDelay: hearingStore.autoSendDelay,
      vadThreshold: hearingStore.vadThreshold,
      isTranscribing: hearingStore.isTranscribing,
      configured: hearingStore.configured,
    },
    audio: {
      enabled: audioDeviceStore.enabled,
      micOwner: hearingStore.micOwner,
      streamActive: !!audioDeviceStore.stream,
      streamId: audioDeviceStore.stream?.id,
      selectedInput: audioDeviceStore.selectedAudioInput,
      selectedInputLabel: audioDeviceStore.selectedAudioInputLabel,
    },
    consciousness: {
      provider: consciousnessStore.activeProvider,
      model: consciousnessStore.activeModel,
      configured: consciousnessStore.configured,
    },
    chatboxDraft: typeof localStorage !== 'undefined' ? localStorage.getItem('airi-chatbox-draft') : null,
  }
  console.info('[AudioDebug] snapshot', snapshot)
  return snapshot
}

export function stopAmbientAudioFromWindow(): { enabled: boolean, streamActive: boolean } {
  // Flipping the persisted flag stops the MediaStream via the store watcher,
  // which tears down the page-level VAD loop through the voice input binding.
  // The flag syncs to other windows through storage events.
  const audioDeviceStore = useSettingsAudioDevice()
  audioDeviceStore.enabled = false
  const result = { enabled: audioDeviceStore.enabled as boolean, streamActive: !!audioDeviceStore.stream }
  console.info('[AudioDebug] ambient audio stop requested', result)
  return result
}
