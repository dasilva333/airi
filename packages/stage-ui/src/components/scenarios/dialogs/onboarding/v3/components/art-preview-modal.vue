<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  artistryGenerateHeadless,
  CLOUDFLARE_IMAGE_DEFAULTS,
  formatCorsProxyUrl,
  isCloudflareFixedStepsModel,
  isCloudflareMultipartModel,
  isCloudflareOmitDimensionsModel,
} from '@proj-airi/stage-shared'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useCloudflareStore } from '@proj-airi/stage-ui/stores/modules/cloudflare'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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

const { t } = useI18n()

const isGenerating = ref(false)
const generationStatus = ref(t('onboarding.steps.artistry.preview.status.initiating'))
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

async function fetchDirectCloudflare(promptText: string, modelId?: string) {
  const artistryStore = useArtistryStore()
  const cloudflareStore = useCloudflareStore()
  const creds = artistryStore.getEffectiveCloudflareCredentials()
  const accountId = creds.accountId || cloudflareStore.activeAccountId
  let apiToken = props.apiKey || creds.apiToken || cloudflareStore.activeAccessToken

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID or API token is missing. Please connect your Cloudflare account or enter an API token.')
  }

  const targetModel = modelId || CLOUDFLARE_IMAGE_DEFAULTS.model
  const rawUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${targetModel.replace(/^\/+/, '')}`
  const targetUrl = formatCorsProxyUrl(rawUrl)

  const isMultipart = isCloudflareMultipartModel(targetModel)
  const isFixedSteps = isCloudflareFixedStepsModel(targetModel)

  const makeReq = async (token: string) => {
    let body: string | FormData
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (isMultipart) {
      const form = new FormData()
      form.append('prompt', promptText)
      form.append('width', '1024')
      form.append('height', '1024')
      body = form
    }
    else {
      headers['Content-Type'] = 'application/json'
      headers.Accept = 'application/json'
      const payload: Record<string, any> = { prompt: promptText }
      if (!isCloudflareOmitDimensionsModel(targetModel)) {
        payload.width = 1024
        payload.height = 1024
      }
      if (!isFixedSteps) {
        payload.steps = 4
      }
      body = JSON.stringify(payload)
    }
    return fetch(targetUrl, { method: 'POST', headers, body })
  }

  let response = await makeReq(apiToken)
  if (response.status === 401 && cloudflareStore.cfOAuthTokens?.refreshToken) {
    try {
      await cloudflareStore.refreshOAuthTokens()
      if (cloudflareStore.activeAccessToken) {
        apiToken = cloudflareStore.activeAccessToken
        response = await makeReq(apiToken)
      }
    }
    catch {}
  }

  if (!response.ok) {
    let errDetail = ''
    try {
      const errData = await response.json()
      if (errData?.errors?.length)
        errDetail = errData.errors.map((e: any) => e.message || e.code).join('; ')
    }
    catch {}
    throw new Error(`Cloudflare Workers AI returned HTTP ${response.status}${errDetail ? `: ${errDetail}` : ''}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await response.json()
    const b64 = json.result?.image
    if (!b64)
      throw new Error('Cloudflare response did not contain an image.')
    return b64.startsWith('data:image/') ? b64 : `data:image/png;base64,${b64}`
  }
  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return `data:image/png;base64,${base64}`
}

async function fetchDirectOpenAI(promptText: string, modelId?: string) {
  const artistryStore = useArtistryStore()
  const apiKey = props.apiKey || artistryStore.openaiImageApiKey
  if (!apiKey) {
    throw new Error('OpenAI Image API key is required. Please enter an API key.')
  }
  const rawBaseUrl = (artistryStore.openaiImageBaseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  const endpoint = new URL('images/generations', `${rawBaseUrl}/`)
  const targetUrl = formatCorsProxyUrl(endpoint.toString())

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId || 'gpt-image',
      prompt: promptText,
      n: 1,
      output_format: 'png',
      size: '1024x1024',
    }),
  })
  if (!response.ok) {
    let errDetail = ''
    try {
      const errData = await response.json()
      if (errData?.error?.message)
        errDetail = `: ${errData.error.message}`
    }
    catch {}
    throw new Error(`OpenAI Images API returned HTTP ${response.status}${errDetail}`)
  }
  const data = await response.json()
  const item = data.data?.[0]
  if (item?.b64_json)
    return item.b64_json.startsWith('data:image/') ? item.b64_json : `data:image/png;base64,${item.b64_json}`
  if (item?.url)
    return item.url
  throw new Error('No image returned from OpenAI.')
}

async function runGeneration() {
  if (!props.prompt.trim()) {
    generationError.value = t('onboarding.steps.artistry.preview.messages.pleaseEnterAVisualStylePromptFirst')
    return
  }

  isGenerating.value = true
  generationError.value = ''
  generationStatus.value = t('onboarding.steps.artistry.preview.messages.dispatchingToValue', { value0: props.provider.toUpperCase() })
  const startTime = Date.now()

  try {
    let resultUrl = ''

    if (props.provider === 'pollinations') {
      generationStatus.value = t('onboarding.steps.artistry.preview.messages.synthesizingWithPollinationsAi')
      resultUrl = await fetchDirectPollinations(props.prompt, props.model)
    }
    else if (props.provider === 'cloudflare') {
      generationStatus.value = 'Synthesizing with Cloudflare Workers AI...'
      resultUrl = await fetchDirectCloudflare(props.prompt, props.model)
    }
    else if (props.provider === 'openai-image') {
      generationStatus.value = 'Synthesizing with OpenAI Images API...'
      resultUrl = await fetchDirectOpenAI(props.prompt, props.model)
    }
    else if (generateInvoke) {
      generationStatus.value = t('onboarding.steps.artistry.preview.messages.synthesizingViaValue', { value0: props.provider.toUpperCase() })
      try {
        const artistryStore = useArtistryStore()
        const globalsPayload = JSON.parse(JSON.stringify(artistryStore.artistryGlobals || {}))
        const res = await Promise.race([
          generateInvoke({
            prompt: props.prompt,
            model: props.model,
            provider: props.provider,
            options: { width: 1024, height: 1024 },
            globals: globalsPayload,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(t('onboarding.steps.artistry.preview.errors.timeout'))), 35000),
          ),
        ])
        if (res?.error) {
          throw new Error(res.error)
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
        throw ipcErr
      }
    }
    else {
      throw new Error(t('onboarding.steps.artistry.preview.errors.desktopRequired', { provider: props.provider }))
    }

    if (!resultUrl)
      throw new Error(t('onboarding.steps.artistry.preview.errors.emptyResult'))

    generatedImageUrl.value = resultUrl
    generationLatency.value = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
  }
  catch (err: any) {
    console.error('[ArtPreviewModal] Generation failed:', err)
    generationError.value = err?.message || t('onboarding.steps.artistry.preview.errors.failed')
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
    <DialogPortal to="#onboarding-v3-root">
      <DialogOverlay :class="['fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fadeIn']" />
      <DialogContent :class="['fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl bg-[#0e1726] border border-primary-500/40 p-5 text-white shadow-2xl space-y-3.5']">
        <!-- Header -->
        <div :class="['flex items-center justify-between border-b border-white/10 pb-2.5']">
          <div :class="['flex items-center gap-2']">
            <span :class="['w-2.5 h-2.5 rounded-full bg-emerald-400', isGenerating ? 'animate-ping' : '']" />
            <DialogTitle :class="['text-xs font-bold text-white uppercase tracking-wider']">
              {{ t('onboarding.steps.artistry.preview.visualStylePreview') }}
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
            <span :class="['text-[10px] text-neutral-500']">{{ t('onboarding.steps.artistry.preview.renderingCharacterStyleSample') }}</span>
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
              {{ t('onboarding.steps.artistry.preview.tryAgain') }}
            </button>
          </div>

          <img
            v-else-if="generatedImageUrl"
            :src="generatedImageUrl"
            :alt="t('onboarding.steps.artistry.preview.characterStylePreview')"
            :class="['w-full h-full object-cover transition-opacity duration-300']"
          >
        </div>

        <!-- Metadata & Prompt Echo -->
        <div :class="['space-y-1.5 text-xs']">
          <div :class="['flex items-center justify-between text-[11px]']">
            <span :class="['text-neutral-400']">{{ t('onboarding.steps.artistry.preview.provider') }} <strong :class="['text-primary-300 font-medium capitalize']">{{ provider }}</strong></span>
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
            {{ t('onboarding.steps.artistry.preview.reRoll') }}
          </button>
          <button
            type="button"
            :class="['flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
            @click="handleClose"
          >
            {{ t('onboarding.steps.artistry.preview.doneClose') }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
