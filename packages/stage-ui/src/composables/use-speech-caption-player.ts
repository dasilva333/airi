import { useBroadcastChannel } from '@vueuse/core'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { useSpeechStore } from '../stores/modules/speech'
import { useProvidersStore } from '../stores/providers'
import { useSettingsUserProfile } from '../stores/settings/user-profile'

interface CaptionSegment {
  text: string
  color: string
  actorId: string
  isActive: boolean
}

export function useSpeechCaptionPlayer() {
  const userProfileStore = useSettingsUserProfile()
  const speechStore = useSpeechStore()
  const providersStore = useProvidersStore()
  const { post: postCaption } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })

  const playing = ref(false)
  const loading = ref(false)
  const utteredSegments = ref<CaptionSegment[]>([])

  let abortController: AbortController | null = null

  function showCaption(text: string) {
    try {
      postCaption({ type: 'caption-speaker', text: 'User' })
      utteredSegments.value.forEach(s => s.isActive = false)
      utteredSegments.value.push({ text, color: '#818cf8', actorId: 'user', isActive: true })
      postCaption({
        type: 'caption-assistant',
        segments: JSON.parse(JSON.stringify(utteredSegments.value)),
      })
    }
    catch (e) {
      console.warn('Failed to post caption:', e)
    }
  }

  function clearCaption() {
    try {
      utteredSegments.value = []
      postCaption({ type: 'caption-speaker', text: '' })
      postCaption({ type: 'caption-assistant', segments: [] })
    }
    catch (e) {
      console.warn('Failed to clear caption:', e)
    }
  }

  function stop() {
    abortController?.abort()
    abortController = null
    playing.value = false
    loading.value = false
    clearCaption()
  }

  interface PlayCallbacks {
    onLoading?: () => void
    onPlaying?: () => void
    onDone?: () => void
    onError?: (err: Error) => void
  }

  async function play(text: string, voiceId?: string, callbacks?: PlayCallbacks): Promise<void> {
    const id = voiceId ?? userProfileStore.voiceProfileId
    if (!id) {
      toast.error('No voice profile configured. Go to Settings > System > User Profile.')
      return
    }

    stop()
    abortController = new AbortController()
    const signal = abortController.signal
    loading.value = true
    callbacks?.onLoading?.()

    try {
      const provider = await providersStore.getProviderInstance('virtual-audio-studio')
      if (!provider)
        throw new Error('Virtual Audio Studio provider is not active.')
      if (signal.aborted)
        return

      const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)

      const audioItems = await Promise.all(
        sentences.map(async (sentence) => {
          const audioData = await speechStore.speech(provider as any, 'virtual', sentence, id)
          if (signal.aborted)
            throw new DOMException('Aborted', 'AbortError')
          const audioUrl = URL.createObjectURL(new Blob([audioData]))
          return { text: sentence, audio: new Audio(audioUrl) }
        }),
      )

      if (signal.aborted)
        return

      loading.value = false
      playing.value = true
      callbacks?.onPlaying?.()

      for (const item of audioItems) {
        if (signal.aborted)
          break

        showCaption(item.text)
        item.audio.play()

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            item.audio.removeEventListener('ended', onDone)
            item.audio.removeEventListener('pause', onDone)
            item.audio.removeEventListener('error', onDone)
          }
          const onDone = () => {
            cleanup()
            resolve()
          }
          item.audio.addEventListener('ended', onDone)
          item.audio.addEventListener('pause', onDone)
          item.audio.addEventListener('error', onDone)
        })
      }

      if (!signal.aborted) {
        clearCaption()
        callbacks?.onDone?.()
      }
    }
    catch (err) {
      if ((err as DOMException)?.name === 'AbortError')
        return
      console.error('Speech synthesis failed:', err)
      toast.error(err instanceof Error ? err.message : 'Speech synthesis failed.')
      callbacks?.onError?.(err instanceof Error ? err : new Error('Speech synthesis failed.'))
      clearCaption()
    }
    finally {
      loading.value = false
      playing.value = false
      if (abortController?.signal === signal)
        abortController = null
    }
  }

  return {
    play,
    stop,
    showCaption,
    clearCaption,
    playing,
    loading,
  }
}
