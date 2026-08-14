import type { ChatProvider } from '@xsai-ext/providers/utils'

import { storeToRefs } from 'pinia'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import { useChatOrchestratorStore } from '../stores/chat'
import { useChatSessionStore } from '../stores/chat/session-store'
import { useShortTermMemoryStore } from '../stores/memory-short-term'
import { useAiriCardStore } from '../stores/modules/airi-card'
import { useAutonomousArtistryStore } from '../stores/modules/artistry-autonomous'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useHearingSpeechInputPipeline, useHearingStore } from '../stores/modules/hearing'
import { useProvidersStore } from '../stores/providers'
import { useSettingsAudioDevice } from '../stores/settings'

export interface ChatComposerOptions {
  tools?: any[]
  onSendStart?: () => void
  onSendSuccess?: () => void
  onSendError?: (error: unknown) => void
}

export function useChatComposer(options: ChatComposerOptions = {}) {
  const messageInput = ref('')
  const attachments = ref<{ type: 'image', data: string, mimeType: string, url: string }[]>([])
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
  const { ingest } = chatOrchestrator
  const { stream, enabled } = storeToRefs(settingsAudioDevice)

  // Transcription/Hearing
  const hearingStore = useHearingStore()
  const hearingPipeline = useHearingSpeechInputPipeline()
  const { transcribeForMediaStream, stopStreamingTranscription } = hearingPipeline
  const { supportsStreamInput } = storeToRefs(hearingPipeline)
  const { configured: hearingConfigured, autoSendEnabled, autoSendDelay } = storeToRefs(hearingStore)

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

    const textToSend = messageInput.value
    const attachmentsToSend = attachments.value.map(att => ({ ...att }))

    messageInput.value = ''
    attachments.value = []

    options.onSendStart?.()

    if (isImagineMode.value) {
      const artistryStore = useAutonomousArtistryStore()
      void artistryStore.runArtistTask(textToSend, chatSession.messages as any, 'assistant')
      options.onSendSuccess?.()
      return
    }

    try {
      const providerConfig = providersStore.getProviderConfig(activeProvider.value)
      await ingest(textToSend, {
        chatProvider: await providersStore.getProviderInstance(activeProvider.value) as ChatProvider,
        model: activeModel.value,
        providerConfig,
        attachments: attachmentsToSend,
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
            void (async () => {
              try {
                const provider = await providersStore.getProviderInstance(activeProvider.value)
                if (!provider || !activeModel.value)
                  return
                await ingest(text, {
                  chatProvider: provider as ChatProvider,
                  model: activeModel.value,
                  skipAssistant: !autoSendEnabled.value,
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
  })

  return {
    messageInput,
    attachments,
    isComposing,
    isImagineMode,
    isListening,
    trashConfirmOpen,

    handleFilePaste,
    handleFileSelect,
    removeAttachment,
    handleTrashClick,
    handleSaveAndClear,
    handleClearAnyway,
    handleSend,
    startListening,
    stopListening,
  }
}
