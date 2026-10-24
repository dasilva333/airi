import type { ChatProvider } from '@xsai-ext/providers/utils'

import workletUrl from '@proj-airi/stage-ui/workers/vad/process.worklet?worker&url'

import { storeToRefs } from 'pinia'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useVAD } from '../stores/ai/models/vad'
import { useChatOrchestratorStore } from '../stores/chat'
import { appendDraftText } from '../stores/chat/composer-draft-bridge'
import { useChatSessionStore } from '../stores/chat/session-store'
import { useShortTermMemoryStore } from '../stores/memory-short-term'
import { useAiriCardStore } from '../stores/modules/airi-card'
import { useAutonomousArtistryStore } from '../stores/modules/artistry-autonomous'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useHearingSpeechInputPipeline, useHearingStore } from '../stores/modules/hearing'
import { useProvidersStore } from '../stores/providers'
import { useSettingsAudioDevice } from '../stores/settings'
import { useAudioRecorder } from './audio/audio-recorder'

export interface ChatComposerOptions {
  tools?: any[]
  onSendStart?: () => void
  onSendSuccess?: () => void
  onSendError?: (error: unknown) => void
}

export interface ChatComposerAttachment {
  type: 'image' | 'audio'
  data: string
  mimeType: string
  url: string
  /** Raw recording; runtime-only, never persisted. Present on voice-message clips. */
  blob?: Blob
  /** Representative mock waveform bars (0–1), seeded at record time. */
  peaks?: number[]
}

function peaksForAudio(size: number, count = 28) {
  let seed = (size || 1) >>> 0
  const peaks: number[] = []
  for (let i = 0; i < count; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    peaks.push(0.18 + ((seed % 1000) / 1000) * 0.82)
  }
  return peaks
}

export function useChatComposer(options: ChatComposerOptions = {}) {
  const messageInput = ref('')
  const attachments = ref<ChatComposerAttachment[]>([])
  const isComposing = ref(false)
  const isImagineMode = ref(false)
  const trashConfirmOpen = ref(false)

  const providersStore = useProvidersStore()
  const chatOrchestrator = useChatOrchestratorStore()
  const chatSession = useChatSessionStore()
  const airiCardStore = useAiriCardStore()
  const shortTermMemory = useShortTermMemoryStore()
  const consciousnessStore = useConsciousnessStore()
  const settingsAudioDevice = useSettingsAudioDevice()

  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
  const { activeCardId } = storeToRefs(airiCardStore)
  const { messages, activeSessionId } = storeToRefs(chatSession)
  const { ingest, stopCurrentGeneration } = chatOrchestrator
  const { sending, isSpeaking, canStop } = storeToRefs(chatOrchestrator)
  const { stream, enabled } = storeToRefs(settingsAudioDevice)

  // Transcription/Hearing
  const hearingStore = useHearingStore()
  const hearingPipeline = useHearingSpeechInputPipeline()
  const { transcribeForMediaStream, transcribeForRecording, stopStreamingTranscription } = hearingPipeline
  const { supportsStreamInput } = storeToRefs(hearingPipeline)
  const { configured: hearingConfigured, autoSendEnabled, autoSendDelay, voiceInputMode, isTranscribing, tapToTalk, vadThreshold } = storeToRefs(hearingStore)

  // The hearing pipeline has a single transcription slot shared across
  // surfaces (ambient open-mic loop, settings tests, composer captures).
  // Never drop our recording when the slot is busy — wait for it (bounded)
  // and transcribe afterwards. Throws through so callers keep their own
  // error handling; returns undefined only when there is nothing to send.
  async function transcribeRecordingExclusive(recording: Blob): Promise<string | undefined> {
    for (let i = 0; i < 40 && isTranscribing.value; i++) {
      if (i === 0)
        console.warn('[ChatComposer] Transcription slot busy, waiting for our turn')
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    if (isTranscribing.value) {
      console.warn('[ChatComposer] Transcription slot still busy after 10s, dropping utterance')
      return undefined
    }
    const text = await transcribeForRecording(recording)
    return text?.trim() || undefined
  }

  const isListening = ref(false)
  const shouldUseStreamInput = computed(() => supportsStreamInput.value && !!stream.value)

  // Auto-send timers
  let autoSendTimeout: ReturnType<typeof setTimeout> | undefined
  const pendingAutoSendText = ref('')
  let autoSendDispatched = false

  function clearPendingAutoSend() {
    if (autoSendTimeout) {
      clearTimeout(autoSendTimeout)
      autoSendTimeout = undefined
    }
    pendingAutoSendText.value = ''
  }

  async function debouncedAutoSend(text: string) {
    if (!autoSendEnabled.value) {
      clearPendingAutoSend()
      return
    }
    pendingAutoSendText.value = pendingAutoSendText.value ? `${pendingAutoSendText.value} ${text}` : text
    if (autoSendTimeout) {
      clearTimeout(autoSendTimeout)
    }
    autoSendTimeout = setTimeout(async () => {
      if (!autoSendEnabled.value) {
        clearPendingAutoSend()
        return
      }
      const textToSend = pendingAutoSendText.value.trim()
      if (textToSend && autoSendEnabled.value) {
        try {
          const providerConfig = providersStore.getProviderConfig(activeProvider.value)
          autoSendDispatched = true
          await ingest(textToSend, {
            chatProvider: await providersStore.getProviderInstance(activeProvider.value) as ChatProvider,
            model: activeModel.value,
            providerConfig,
            tools: options.tools,
          })
          messageInput.value = ''
          pendingAutoSendText.value = ''
        }
        catch (err) {
          autoSendDispatched = false
          console.error('[ChatComposer] Auto-send error:', err)
        }
      }
      autoSendTimeout = undefined
    }, autoSendDelay.value)
  }

  // VAD speech-end watch: fulfills the tap-to-talk contract (one tap captures
  // one utterance and stops itself) without ever hiding text behind a manual
  // stop. Voice-message is always single-shot; dictation follows tapToTalk
  // (single-shot vs continuous segmenting for non-streaming providers —
  // streaming providers segment on their own, so continuous needs no watch).
  const vadWatchMode = ref<'single-shot' | 'segment' | null>(null)
  const continuousSession = ref(false)
  const hadVadSpeech = ref(false)
  let vadSpeechStartAt = 0
  let suppressNextStop = false
  let vadGeneration = 0
  let vadNoSpeechTimer: ReturnType<typeof setTimeout> | undefined
  let vadMaxTimer: ReturnType<typeof setTimeout> | undefined

  const {
    init: initVAD,
    dispose: disposeVAD,
    start: startVAD,
    stop: stopVAD,
  } = useVAD(workletUrl, {
    threshold: vadThreshold,
    onSpeechStart: () => {
      hadVadSpeech.value = true
      vadSpeechStartAt = Date.now()
      if (vadNoSpeechTimer) {
        clearTimeout(vadNoSpeechTimer)
        vadNoSpeechTimer = undefined
      }
    },
    onSpeechEnd: () => {
      void handleVadSpeechEnd()
    },
  })

  function clearVadTimers() {
    if (vadNoSpeechTimer) {
      clearTimeout(vadNoSpeechTimer)
      vadNoSpeechTimer = undefined
    }
    if (vadMaxTimer) {
      clearTimeout(vadMaxTimer)
      vadMaxTimer = undefined
    }
  }

  function stopVadWatch() {
    vadGeneration += 1
    vadWatchMode.value = null
    clearVadTimers()
    try {
      stopVAD()
    }
    catch {}
  }

  async function stopCaptureForVad() {
    // Mirror a manual stop so the normal hook/send flow runs.
    if (isListening.value)
      await stopListening()
    else if (isRecording.value)
      await stopVoiceRecording()
  }

  async function handleVadSpeechEnd() {
    const mode = vadWatchMode.value
    if (!mode)
      return
    // Ignore sub-second blips; keep waiting for real speech.
    if (vadSpeechStartAt && Date.now() - vadSpeechStartAt < 700) {
      vadSpeechStartAt = 0
      return
    }
    vadSpeechStartAt = 0
    if (mode === 'single-shot') {
      await stopCaptureForVad()
      return
    }
    // Segment mode: close this utterance through the normal hook flow, then
    // open the next segment while the continuous session is still live.
    // NOTE: no generation check here — stopCaptureForVad() intentionally
    // retires the current watch generation via stopVadWatch(); the live
    // session flag is the restart authority (a manual stop clears it first).
    await stopCaptureForVad()
    if (!continuousSession.value)
      return
    await startVoiceRecording()
    if (!continuousSession.value || !isRecording.value)
      return
    await startVadWatch('segment')
  }

  async function startVadWatch(mode: 'single-shot' | 'segment') {
    const generation = ++vadGeneration
    vadWatchMode.value = mode
    hadVadSpeech.value = false
    vadSpeechStartAt = 0
    clearVadTimers()
    try {
      await initVAD()
    }
    catch (err) {
      console.warn('[ChatComposer] VAD unavailable, capture runs without auto-stop:', err)
      vadWatchMode.value = null
      return
    }
    if (vadGeneration !== generation || !vadWatchMode.value || !stream.value)
      return
    try {
      await startVAD(stream.value)
    }
    catch (err) {
      console.warn('[ChatComposer] VAD start failed:', err)
      vadWatchMode.value = null
      return
    }
    // Silence from the start means an empty capture — abort it instead of
    // transcribing quiet (the hearing models hallucinate on silence).
    vadNoSpeechTimer = setTimeout(() => {
      if (vadGeneration !== generation || hadVadSpeech.value)
        return
      console.info('[ChatComposer] No speech detected, stopping empty capture')
      suppressNextStop = true
      toast.info('Stopped listening — no speech detected.')
      void stopCaptureForVad()
    }, 20_000)
    vadMaxTimer = setTimeout(() => {
      if (vadGeneration !== generation)
        return
      if (!hadVadSpeech.value)
        suppressNextStop = true
      void stopCaptureForVad()
    }, 120_000)
  }

  // File/Attachments Helpers
  function addImageAttachmentFromBase64(data: string, mimeType: string) {
    let url = ''
    try {
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: mimeType })
      url = URL.createObjectURL(blob)
    }
    catch {
      url = `data:${mimeType};base64,${data}`
    }

    attachments.value.push({
      type: 'image' as const,
      data,
      mimeType,
      url,
    })
  }

  function handleFilePaste(files: File[]) {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64Data = (e.target?.result as string)?.split(',')[1]
          if (base64Data) {
            addImageAttachmentFromBase64(base64Data, file.type)
          }
        }
        reader.readAsDataURL(file)
      }
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files?.length) {
      handleFilePaste(Array.from(target.files))
    }
    target.value = ''
  }

  function removeAttachment(index: number) {
    const attachment = attachments.value[index]
    if (attachment) {
      URL.revokeObjectURL(attachment.url)
      attachments.value.splice(index, 1)
    }
  }

  // Safety cleanup checks
  function formatLocalDayKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function handleTrashClick(onConfirmDirectly: () => void) {
    const today = formatLocalDayKey(new Date())
    const isTodayCached = activeCardId.value && shortTermMemory.getCharacterBlocks(activeCardId.value).some(b => b.date === today)
    if (!isTodayCached && messages.value.length > 0) {
      trashConfirmOpen.value = true
      return
    }
    onConfirmDirectly()
  }

  async function handleSaveAndClear(onClear: () => void) {
    trashConfirmOpen.value = false
    if (activeCardId.value) {
      try {
        await shortTermMemory.rebuildToday(activeCardId.value)
      }
      catch (err) {
        console.error('[ChatComposer] Failed to cache today before clear:', err)
      }
    }
    onClear()
  }

  function handleClearAnyway(onClear: () => void) {
    trashConfirmOpen.value = false
    onClear()
  }

  // Principal Send Command
  async function handleSend() {
    if (!messageInput.value.trim() && !attachments.value.length || isComposing.value) {
      return
    }

    let textToSend = messageInput.value
    const attachmentsToSend = attachments.value.map(att => ({ ...att }))
    const imageAttachmentsToSend = attachmentsToSend
      .filter(att => att.type === 'image')
      .map(att => ({ type: 'image' as const, data: att.data, mimeType: att.mimeType, url: att.url }))
    const audioAttachmentsToSend = attachmentsToSend.filter(att => att.type === 'audio')

    messageInput.value = ''
    attachments.value = []

    options.onSendStart?.()

    // Voice-message clips transcribe into text at send time — the send
    // pipeline only understands image attachments, so audio never reaches it.
    if (audioAttachmentsToSend.length) {
      try {
        const transcripts: string[] = []
        for (const clip of audioAttachmentsToSend) {
          if (!clip.blob)
            continue
          const text = await transcribeRecordingExclusive(clip.blob)
          if (text)
            transcripts.push(text)
        }
        const combined = [textToSend.trim(), ...transcripts].filter(Boolean).join('\n')
        if (!combined) {
          messageInput.value = textToSend
          attachments.value = attachmentsToSend
          return
        }
        textToSend = combined
      }
      catch (error) {
        messageInput.value = textToSend
        attachments.value = attachmentsToSend
        options.onSendError?.(error)
        return
      }
    }

    if (isImagineMode.value) {
      const artistryStore = useAutonomousArtistryStore()
      void artistryStore.runArtistTask(textToSend, chatSession.messages as any, 'assistant')
      options.onSendSuccess?.()
      return
    }

    if (!activeProvider.value || !activeModel.value) {
      console.error('[useChatComposer] Error sending message: No active AI provider/model configured.')
      messageInput.value = textToSend
      attachments.value = attachmentsToSend
      const error = new Error('No active AI provider/model configured.')
      options.onSendError?.(error)
      return
    }

    try {
      if (!activeSessionId.value) {
        await chatSession.ensureActiveSessionForCharacter()
      }
      if (canStop.value && activeSessionId.value) {
        await stopCurrentGeneration(activeSessionId.value)
      }
      const providerConfig = providersStore.getProviderConfig(activeProvider.value)
      await ingest(textToSend, {
        chatProvider: await providersStore.getProviderInstance(activeProvider.value) as ChatProvider,
        model: activeModel.value,
        providerConfig,
        attachments: imageAttachmentsToSend,
        tools: options.tools,
      }, activeSessionId.value)
      attachmentsToSend.forEach(att => URL.revokeObjectURL(att.url))
      options.onSendSuccess?.()
    }
    catch (error) {
      messageInput.value = textToSend
      attachments.value = attachmentsToSend
      options.onSendError?.(error)
    }
  }

  async function stopGeneration() {
    await stopCurrentGeneration(activeSessionId.value)
  }

  // Listening Loop
  async function startListening() {
    autoSendDispatched = false
    try {
      if (!hearingConfigured.value) {
        const isWebSpeechAvailable = typeof window !== 'undefined'
          && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
        if (isWebSpeechAvailable) {
          providersStore.initializeProvider('browser-web-speech-api')
          hearingStore.activeTranscriptionProvider = 'browser-web-speech-api'
          await nextTick()
        }
        else {
          isListening.value = false
          return
        }
      }
      if (!stream.value) {
        await settingsAudioDevice.askPermission()
        if (!stream.value && enabled.value) {
          settingsAudioDevice.startStream()
        }
      }
      if (!stream.value) {
        isListening.value = false
        return
      }
      if (!shouldUseStreamInput.value) {
        await stopStreamingTranscription(true)
        isListening.value = false
        return
      }
      try {
        await transcribeForMediaStream(stream.value, {
          onSentenceEnd: (delta) => {
            if (delta && delta.trim()) {
              const currentText = messageInput.value.trim()
              messageInput.value = currentText ? `${currentText} ${delta}` : delta
              if (autoSendEnabled.value) {
                debouncedAutoSend(delta)
              }
              else {
                clearPendingAutoSend()
              }
            }
          },
          onSpeechEnd: (text) => {
            if (!text || !text.trim())
              return
            const alreadyDispatched = autoSendDispatched
            autoSendDispatched = false
            clearPendingAutoSend()
            if (alreadyDispatched)
              return
            // With auto-send off the transcript stays in the input for the user to edit and send.
            // Providers without sentence deltas only deliver the final text here.
            if (!autoSendEnabled.value) {
              if (!messageInput.value.includes(text.trim()))
                messageInput.value = appendDraftText(messageInput.value, text)
              return
            }
            void (async () => {
              try {
                const provider = await providersStore.getProviderInstance(activeProvider.value)
                if (!provider || !activeModel.value)
                  return
                await ingest(text, {
                  chatProvider: provider as ChatProvider,
                  model: activeModel.value,
                  tools: options.tools,
                })
                if (messageInput.value.trim() === text.trim()) {
                  messageInput.value = ''
                }
              }
              catch (err) {
                console.error('[ChatComposer] Inscription error:', err)
              }
            })()
          },
        })
        isListening.value = true
      }
      catch (err) {
        isListening.value = false
        throw err
      }
    }
    catch (err) {
      isListening.value = false
    }
  }

  async function stopListening() {
    stopVadWatch()
    if (!isListening.value)
      return
    try {
      clearPendingAutoSend()
      if (autoSendEnabled.value && pendingAutoSendText.value.trim()) {
        const textToSend = pendingAutoSendText.value.trim()
        pendingAutoSendText.value = ''
        try {
          const providerConfig = providersStore.getProviderConfig(activeProvider.value)
          await ingest(textToSend, {
            chatProvider: await providersStore.getProviderInstance(activeProvider.value) as ChatProvider,
            model: activeModel.value,
            providerConfig,
            tools: options.tools,
          })
          messageInput.value = ''
        }
        catch (err) {
          console.error('[ChatComposer] Auto-send error on stop:', err)
        }
      }
      await stopStreamingTranscription(true)
      isListening.value = false
    }
    catch (err) {
      isListening.value = false
    }
  }

  // Voice-message recording loop (tap-to-talk path — the page-level VAD loop
  // owns recording while open-mic `enabled` is on, so this instance only
  // records when the user explicitly taps).
  const isRecording = ref(false)
  const voiceRecorder = useAudioRecorder(stream)

  function addAudioAttachment(recording: Blob) {
    const url = URL.createObjectURL(recording)
    attachments.value.push({
      type: 'audio',
      data: '',
      mimeType: recording.type || 'audio/webm',
      url,
      blob: recording,
      peaks: peaksForAudio(recording.size),
    })
  }

  const stopVoiceHook = voiceRecorder.onStopRecord(async (recording) => {
    // NOTE: isRecording stays true through transcription so the mic button
    // keeps its active/stop affordance until the text actually lands.
    try {
      // Empty auto-abort (no speech ever detected): discard, don't transcribe.
      if (suppressNextStop) {
        suppressNextStop = false
        return
      }
      if (!recording)
        return
      if (voiceInputMode.value === 'dictation') {
        // No streaming provider: the utterance arrives whole — feed it into
        // the input exactly like a live sentence delta, so auto-send semantics
        // match the streaming path (send ON dispatches after the delay,
        // otherwise the text waits in the composer for review).
        try {
          const text = await transcribeRecordingExclusive(recording)
          if (text) {
            const currentText = messageInput.value.trim()
            messageInput.value = currentText ? `${currentText} ${text}` : text
            if (autoSendEnabled.value) {
              debouncedAutoSend(text)
            }
          }
        }
        catch (err) {
          console.error('[ChatComposer] Dictation transcribe error:', err)
          options.onSendError?.(err)
        }
        return
      }
      if (voiceInputMode.value !== 'voice-message')
        return
      // Send ON = transcribe now and send as the message. Providers have no
      // audio-input path yet, so the transcript is what the brain receives;
      // the playable clip is what the user keeps (attached below when manual).
      if (autoSendEnabled.value) {
        try {
          const text = await transcribeRecordingExclusive(recording)
          if (text) {
            messageInput.value = text
            await handleSend()
          }
        }
        catch (err) {
          console.error('[ChatComposer] Voice message auto-send error:', err)
          options.onSendError?.(err)
        }
      }
      else {
        addAudioAttachment(recording)
      }
    }
    finally {
      isRecording.value = false
    }
  })

  async function startVoiceRecording() {
    if (isRecording.value)
      return
    if (!stream.value) {
      await settingsAudioDevice.askPermission()
      if (!stream.value && enabled.value) {
        settingsAudioDevice.startStream()
      }
    }
    if (!stream.value)
      return
    try {
      await voiceRecorder.startRecord()
      isRecording.value = true
    }
    catch {
      isRecording.value = false
    }
  }

  async function stopVoiceRecording() {
    stopVadWatch()
    if (!isRecording.value)
      return
    try {
      await voiceRecorder.stopRecord()
    }
    finally {
      isRecording.value = false
    }
  }

  async function toggleVoiceRecording() {
    if (isRecording.value) {
      await stopVoiceRecording()
      return
    }
    await startVoiceRecording()
    // Voice messages are single utterances in every mode: VAD ends the
    // capture at speech end so no second tap is ever required.
    if (isRecording.value)
      await startVadWatch('single-shot')
  }

  // Dictation entry point (mode-aware): streaming providers transcribe live
  // into the composer; otherwise record-then-transcribe into the input.
  // Either way the composer stays on screen and the mic button is the stop.
  async function startDictation() {
    if (shouldUseStreamInput.value) {
      await startListening()
      return
    }
    await startVoiceRecording()
  }

  async function stopDictation() {
    if (isListening.value)
      await stopListening()
    if (isRecording.value)
      await stopVoiceRecording()
  }

  async function toggleDictation() {
    if (isListening.value || isRecording.value) {
      continuousSession.value = false
      await stopDictation()
      return
    }
    await startDictation()
    if (!isListening.value && !isRecording.value)
      return
    if (tapToTalk.value) {
      // Tap mode: one tap captures one utterance and stops itself.
      await startVadWatch('single-shot')
    }
    else if (!shouldUseStreamInput.value) {
      // Open line, non-streaming: VAD segments utterances automatically
      // until the next tap closes the session. (Streaming providers
      // segment on their own, so no watch is needed.)
      continuousSession.value = true
      await startVadWatch('segment')
    }
  }

  watch(enabled, async (val) => {
    if (val && stream.value) {
      await startListening()
    }
    else if (!val && isListening.value) {
      await stopListening()
    }
  })

  watch(stream, async (val) => {
    if (val && enabled.value && !isListening.value) {
      await startListening()
    }
    else if (!val && isListening.value) {
      await stopListening()
    }
  })

  watch(autoSendEnabled, (val) => {
    if (!val) {
      clearPendingAutoSend()
    }
  })

  onUnmounted(() => {
    if (autoSendTimeout) {
      clearTimeout(autoSendTimeout)
    }
    stopVadWatch()
    try {
      disposeVAD()
    }
    catch {}
    try {
      stopVoiceHook?.()
    }
    catch {}
  })

  const audioAttachments = computed(() => attachments.value.filter(att => att.type === 'audio'))

  return {
    messageInput,
    attachments,
    audioAttachments,
    isComposing,
    isImagineMode,
    isListening,
    isRecording,
    voiceInputMode,
    trashConfirmOpen,
    sending,
    isSpeaking,
    canStop,

    handleFilePaste,
    handleFileSelect,
    removeAttachment,
    handleTrashClick,
    handleSaveAndClear,
    handleClearAnyway,
    handleSend,
    stopGeneration,
    startListening,
    stopListening,
    startVoiceRecording,
    stopVoiceRecording,
    toggleVoiceRecording,
    startDictation,
    stopDictation,
    toggleDictation,
  }
}
