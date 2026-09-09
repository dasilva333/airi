<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { artistryGenerateHeadless, formatCorsProxyUrl } from '@proj-airi/stage-shared'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  prompt: string
  provider: string
  model?: string
  apiKey?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const isGenerating = ref(false)
const generationStatus = ref('Initiating synthesis...')
const generationError = ref('')
const generationLatency = ref('')
const generatedImageUrl = ref('')

const generateInvoke = (window as any)?.electron ? useElectronEventaInvoke(artistryGenerateHeadless) : null

async function fetchDirectPollinations(promptText: string, modelId?: string) {
  const modelParam = modelId ? `&model=${encodeURIComponent(modelId)}` : ''
  const seed = Math.floor(Math.random() * 1000000)
  const rawUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=1024&height=1024&seed=${seed}${modelParam}&nologo=true`
  const targetUrl = formatCorsProxyUrl(rawUrl)

  const headers: Record<string, string> = {}
  if (props.apiKey) {
    headers.Authorization = `Bearer ${props.apiKey}`
  }

  const response = await fetch(targetUrl, { headers })
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)

  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return `data:image/jpeg;base64,${base64}`
}

async function runGeneration() {
  if (!props.prompt.trim()) {
    generationError.value = 'Please enter a visual style prompt first.'
    return
  }

  isGenerating.value = true
  generationError.value = ''
  generationStatus.value = `Dispatching to ${props.provider.toUpperCase()}...`
  const startTime = Date.now()

  try {
    let resultUrl = ''

    if (generateInvoke) {
      generationStatus.value = `Synthesizing via ${props.provider.toUpperCase()}...`
      try {
        const res = await Promise.race([
          generateInvoke({
            prompt: props.prompt,
            model: props.model,
            provider: props.provider,
            options: { width: 1024, height: 1024 },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout waiting for Electron generation response')), 35000),
          ),
        ])
        if (res?.error) {
          if (props.provider === 'pollinations') {
            console.warn('[ArtPreviewModal] Main process error, falling back to CORS proxy:', res.error)
            resultUrl = await fetchDirectPollinations(props.prompt, props.model)
          }
          else {
            throw new Error(res.error)
          }
        }
        else if (res?.base64) {
          resultUrl = res.base64.startsWith('data:image/')
            ? res.base64
            : `data:image/jpeg;base64,${res.base64}`
        }
        else if (res?.imageUrl) {
          resultUrl = res.imageUrl
        }
      }
      catch (ipcErr: any) {
        if (props.provider === 'pollinations') {
          console.warn('[ArtPreviewModal] IPC throw or timeout, falling back to CORS proxy:', ipcErr)
          resultUrl = await fetchDirectPollinations(props.prompt, props.model)
        }
        else {
          throw ipcErr
        }
      }
    }
    else if (props.provider === 'pollinations') {
      generationStatus.value = 'Synthesizing with Pollinations AI...'
      resultUrl = await fetchDirectPollinations(props.prompt, props.model)
    }
    else {
      throw new Error(`Direct browser testing for '${props.provider}' is not supported. Please run inside the AIRI Electron app.`)
    }

    if (!resultUrl)
      throw new Error('No image was returned from generator.')

    generatedImageUrl.value = resultUrl
    generationLatency.value = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
  }
  catch (err: any) {
    console.error('[ArtPreviewModal] Generation failed:', err)
    generationError.value = err?.message || 'Image generation failed. Please check your provider settings.'
  }
  finally {
    isGenerating.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    if (!generatedImageUrl.value || generationError.value) {
      void runGeneration()
    }
  }
})

function handleClose() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogPortal>
      <DialogOverlay :class="['fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fadeIn']" />
      <DialogContent :class="['fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl bg-[#0e1726] border border-primary-500/40 p-5 text-white shadow-2xl space-y-3.5']">
        <!-- Header -->
        <div :class="['flex items-center justify-between border-b border-white/10 pb-2.5']">
          <div :class="['flex items-center gap-2']">
            <span :class="['w-2.5 h-2.5 rounded-full bg-emerald-400', isGenerating ? 'animate-ping' : '']" />
            <DialogTitle :class="['text-xs font-bold text-white uppercase tracking-wider']">
              Visual Style Preview
            </DialogTitle>
          </div>
          <button
            type="button"
            :class="['p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs']"
            @click="handleClose"
          >
            ✕
          </button>
        </div>

        <!-- Image Display / Spinner Box -->
        <div :class="['relative w-full aspect-square rounded-xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center shadow-inner']">
          <div v-if="isGenerating" :class="['flex flex-col items-center justify-center gap-2 text-center p-4']">
            <div :class="['w-8 h-8 border-3 border-primary-400 border-t-transparent rounded-full animate-spin']" />
            <span :class="['text-xs text-primary-300 font-medium']">{{ generationStatus }}</span>
            <span :class="['text-[10px] text-neutral-500']">Rendering character style sample...</span>
          </div>

          <div v-else-if="generationError" :class="['flex flex-col items-center justify-center gap-2 text-center p-4 text-rose-400 text-xs']">
            <div :class="['i-solar:danger-triangle-bold text-2xl text-rose-500']" />
            <p :class="['text-[11px] leading-relaxed']">
              {{ generationError }}
            </p>
            <button
              type="button"
              :class="['mt-2 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] hover:bg-rose-500/30 cursor-pointer']"
              @click="runGeneration"
            >
              Try Again
            </button>
          </div>

          <img
            v-else-if="generatedImageUrl"
            :src="generatedImageUrl"
            alt="Character Style Preview"
            :class="['w-full h-full object-cover transition-opacity duration-300']"
          >
        </div>

        <!-- Metadata & Prompt Echo -->
        <div :class="['space-y-1.5 text-xs']">
          <div :class="['flex items-center justify-between text-[11px]']">
            <span :class="['text-neutral-400']">Provider: <strong :class="['text-primary-300 font-medium capitalize']">{{ provider }}</strong></span>
            <span v-if="generationLatency" :class="['text-emerald-400 font-mono text-[10px]']">{{ generationLatency }}</span>
          </div>
          <p :class="['text-[10px] text-neutral-300 font-mono line-clamp-2 bg-black/40 p-2 rounded-lg border border-white/5 leading-relaxed']">
            {{ prompt }}
          </p>
        </div>

        <!-- Footer Actions -->
        <div :class="['flex gap-2 pt-2 border-t border-white/10']">
          <button
            type="button"
            :disabled="isGenerating"
            :class="['flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer disabled:opacity-50']"
            @click="runGeneration"
          >
            🔄 Re-roll
          </button>
          <button
            type="button"
            :class="['flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
            @click="handleClose"
          >
            Done / Close
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
