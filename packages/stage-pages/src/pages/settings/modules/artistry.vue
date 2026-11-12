<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  CLOUDFLARE_IMAGE_DEFAULTS,
  CLOUDFLARE_IMAGE_MODELS,
  formatCorsProxyUrl,
  getCloudflareModelDefaultSteps,
  isCloudflareFixedStepsModel,
  isCloudflareMultipartModel,
  isCloudflareOmitDimensionsModel,
  POLLINATIONS_DEFAULT_MODELS,
  REPLICATE_IMAGEGEN_PRESETS,
} from '@proj-airi/stage-shared'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useCloudflareStore } from '@proj-airi/stage-ui/stores/modules/cloudflare'
import { Select } from '@proj-airi/ui/components/form'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { artistryGenerateHeadless } from '../../../../../../apps/stage-tamagotchi/src/shared/eventa'

const router = useRouter()
const artistryStore = useArtistryStore()
const cloudflareStore = useCloudflareStore()
const backgroundStore = useBackgroundStore()
const airiCardStore = useAiriCardStore()

const {
  activeProvider,
  pollinationsApiKey,
  pollinationsModel,
  pollinationsWidth,
  pollinationsHeight,
  pollinationsCachedModels,
  nanobananaModel,
  replicateDefaultModel,
  replicateAspectRatio,
  comfyuiActiveWorkflow,
  comfyuiSavedWorkflows,
  openaiImageModel,
  openaiImageApiKey,
  openaiImageBaseUrl,
  openaiImageWidth,
  openaiImageHeight,
  cloudflareImageModel,
  cloudflareImageSteps,
  cloudflareImageWidth,
  cloudflareImageHeight,
} = storeToRefs(artistryStore)

const generateInvoke = useElectronEventaInvoke(artistryGenerateHeadless)

// --- Provider Options ---
const providers = [
  {
    id: 'pollinations',
    name: 'Pollinations AI',
    badge: '100% Free / Zero-Config',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: 'Instant cloud image generation without API keys or accounts.',
    icon: 'i-solar:magic-stick-3-bold-duotone',
    configRoute: '/settings/providers/artistry/pollinations',
  },
  {
    id: 'comfyui',
    name: 'ComfyUI (Local)',
    badge: 'Local Node',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    description: 'Execute local workflows via WSL or dedicated ComfyUI server.',
    icon: 'i-solar:monitor-camera-bold-duotone',
    configRoute: '/settings/providers/artistry/comfyui',
  },
  {
    id: 'nanobanana',
    name: 'Nano Banana',
    badge: 'Google AI Studio',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    description: 'Native Google Gemini image preview models.',
    icon: 'i-solar:gallery-round-bold-duotone',
    configRoute: '/settings/providers/artistry/nanobanana',
  },
  {
    id: 'replicate',
    name: 'Replicate.ai',
    badge: 'Cloud API',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    description: 'Cloud inference API with high-resolution LoRAs and Flux.',
    icon: 'i-solar:cloud-upload-bold-duotone',
    configRoute: '/settings/providers/artistry/replicate',
  },
  {
    id: 'openai-image',
    name: 'OpenAI GPT Image',
    badge: 'OpenAI API',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: 'Generate and edit images with native OpenAI Images API.',
    icon: 'i-solar:gallery-bold-duotone',
    configRoute: '/settings/providers/artistry/openai-image',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    badge: '10,000 Free Daily Neurons',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    description: 'Free serverless FLUX, Leonardo, SDXL, and DreamShaper models.',
    icon: 'i-simple-icons:cloudflare',
    configRoute: '/settings/providers/artistry/cloudflare',
  },
  {
    id: 'none',
    name: 'None (Disabled)',
    badge: 'Disabled',
    badgeColor: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20',
    description: 'Bypass and disable image generation globally.',
    icon: 'i-solar:forbidden-circle-bold-duotone',
    configRoute: '/settings/modules/artistry',
  },
]

// --- Pollinations Model List ---
const isLoadingPollinationsModels = ref(false)

const pollinationsModelOptions = computed(() => {
  const list = pollinationsCachedModels.value.length > 0
    ? pollinationsCachedModels.value
    : POLLINATIONS_DEFAULT_MODELS
  return list.map(m => ({
    label: m.id === ''
      ? 'Free Router (Pollinations Auto)'
      : (m.price ? `${m.name} (${m.price})` : m.name),
    value: m.id,
  }))
})

async function refreshPollinationsCatalog() {
  isLoadingPollinationsModels.value = true
  try {
    await artistryStore.fetchPollinationsModels(true)
  }
  finally {
    isLoadingPollinationsModels.value = false
  }
}

// --- Nano Banana Models ---
const nanobananaModelOptions = [
  { label: 'Nano Banana 2 (Gemini 3.1 Flash Image)', value: 'gemini-3.1-flash-image-preview' },
  { label: 'Nano Banana Pro (Gemini 3 Pro Image)', value: 'gemini-3-pro-image-preview' },
  { label: 'Nano Banana (Gemini 2.5 Flash Image)', value: 'gemini-2.5-flash-image' },
]

// --- OpenAI Image Models ---
const openaiImageModelOptions = computed(() => {
  const base = [
    { label: 'GPT Image (Auto / Latest)', value: 'gpt-image' },
    { label: 'GPT Image 2.6 Sunburst', value: 'gpt-image-2.6-sunburst' },
  ]
  if (openaiImageModel.value && !base.some(m => m.value === openaiImageModel.value)) {
    base.push({ label: `${openaiImageModel.value} (Custom)`, value: openaiImageModel.value })
  }
  return base
})

const openaiResolutionOptions = computed(() => {
  const base = [
    { label: 'Auto (Model Default / 1024×1024)', value: 'auto' },
    { label: '1024 × 1024 (Square 1:1)', value: '1024x1024' },
    { label: '1792 × 1024 (Landscape 16:9 · DALL-E 3)', value: '1792x1024' },
    { label: '1024 × 1792 (Portrait 9:16 · DALL-E 3)', value: '1024x1792' },
    { label: '512 × 512 (Fast Preview 1:1)', value: '512x512' },
  ]
  if (openaiImageWidth.value && openaiImageHeight.value) {
    const key = `${openaiImageWidth.value}x${openaiImageHeight.value}`
    if (!base.some(o => o.value === key)) {
      base.push({ label: `${openaiImageWidth.value} × ${openaiImageHeight.value} (Custom)`, value: key })
    }
  }
  return base
})

const openaiResolutionPreset = computed({
  get: () => {
    if (!openaiImageWidth.value && !openaiImageHeight.value)
      return 'auto'
    const key = `${openaiImageWidth.value}x${openaiImageHeight.value}`
    return key
  },
  set: (val: string) => {
    if (val === 'auto') {
      openaiImageWidth.value = ''
      openaiImageHeight.value = ''
    }
    else {
      const [w, h] = val.split('x')
      if (w && h) {
        openaiImageWidth.value = w
        openaiImageHeight.value = h
      }
    }
  },
})

// --- Cloudflare Workers AI Options ---
const cloudflareModelOptions = computed(() => {
  return CLOUDFLARE_IMAGE_MODELS.map(m => ({
    label: m.label,
    value: m.value,
  }))
})

const cloudflareResolutionOptions = computed(() => {
  const base = [
    { label: 'Auto (Model Default / 1024×1024)', value: 'auto' },
    { label: '1024 × 1024 (Square 1:1)', value: '1024x1024' },
    { label: '1792 × 1024 (Landscape 16:9)', value: '1792x1024' },
    { label: '1024 × 1792 (Portrait 9:16)', value: '1024x1792' },
    { label: '1024 × 768 (Landscape 4:3)', value: '1024x768' },
    { label: '768 × 1024 (Portrait 3:4)', value: '768x1024' },
    { label: '512 × 512 (Fast Preview 1:1)', value: '512x512' },
  ]
  if (cloudflareImageWidth.value && cloudflareImageHeight.value) {
    const key = `${cloudflareImageWidth.value}x${cloudflareImageHeight.value}`
    if (!base.some(o => o.value === key)) {
      base.push({ label: `${cloudflareImageWidth.value} × ${cloudflareImageHeight.value} (Custom)`, value: key })
    }
  }
  return base
})

const cloudflareResolutionPreset = computed({
  get: () => {
    if (!cloudflareImageWidth.value && !cloudflareImageHeight.value)
      return 'auto'
    return `${cloudflareImageWidth.value}x${cloudflareImageHeight.value}`
  },
  set: (val: string) => {
    if (val === 'auto') {
      cloudflareImageWidth.value = ''
      cloudflareImageHeight.value = ''
    }
    else {
      const [w, h] = val.split('x')
      if (w && h) {
        cloudflareImageWidth.value = w
        cloudflareImageHeight.value = h
      }
    }
  },
})

// --- Replicate Models ---
const replicateModelOptions = computed(() => {
  return REPLICATE_IMAGEGEN_PRESETS.map(p => ({
    label: `${p.label} (${p.cost})`,
    value: p.id,
  }))
})

// --- ComfyUI Workflows ---
const comfyuiWorkflowOptions = computed(() => {
  if (!comfyuiSavedWorkflows.value || comfyuiSavedWorkflows.value.length === 0) {
    return [
      { label: 'No workflows uploaded (Configure in Settings)', value: '' },
    ]
  }
  return comfyuiSavedWorkflows.value.map(wf => ({
    label: `${wf.name} (${Object.values(wf.exposedFields || {}).reduce((n, arr) => n + (arr?.length || 0), 0)} exposed fields)`,
    value: wf.id,
  }))
})

// --- Resolution Options ---
const resolutionOptions = [
  { label: '1024 × 1024 (Square 1:1)', value: '1024x1024' },
  { label: '1280 × 720 (Landscape 16:9)', value: '1280x720' },
  { label: '720 × 1280 (Portrait 9:16)', value: '720x1280' },
  { label: '512 × 512 (Fast Preview 1:1)', value: '512x512' },
]

const currentResolution = computed({
  get: () => `${pollinationsWidth.value}x${pollinationsHeight.value}`,
  set: (val: string) => {
    const [w, h] = val.split('x').map(Number)
    if (w && h) {
      pollinationsWidth.value = w
      pollinationsHeight.value = h
    }
  },
})

// --- Playground State ---
interface GeneratedPreviewItem {
  id: string
  url: string
  base64?: string
  prompt: string
  provider: string
  model: string
  dimensions: string
  duration: string
  timestamp: number
}

const presetPromptTemplates = [
  {
    label: '🌸 Anime Teahouse',
    prompt: 'A serene traditional anime teahouse in spring surrounded by blooming sakura blossoms, soft sunlight filtering through paper shoji screens, vibrant watercolor aesthetic, high detail',
  },
  {
    label: '🌃 Cyberpunk Shinjuku',
    prompt: 'A vibrant rain-slicked cyberpunk alley in Neo Tokyo at night, glowing holographic signs, neon reflections in puddles, atmospheric fog, cinematic lighting, 8k resolution',
  },
  {
    label: '🍃 Ghibli Meadow',
    prompt: 'A sun-drenched rolling green meadow with colorful wildflowers under puffy cumulus clouds, hand-painted anime background style, Studio Ghibli inspired, warm peaceful breeze',
  },
  {
    label: '☕ Cozy Rainy Cafe',
    prompt: 'A warm and cozy coffee shop interior seen from inside looking out at rain drops on the window, steaming mug of latte art, vintage wooden furniture, soft ambient bokeh',
  },
  {
    label: '🌌 Cosmic Aurora',
    prompt: 'A breathtaking starry night sky filled with a glowing purple and turquoise aurora borealis over a quiet frozen lake, reflective ice, celestial dreamscape',
  },
  {
    label: '🎋 Bamboo Sanctuary',
    prompt: 'A tranquil Japanese bamboo grove with morning mist rising between emerald stalks, stone lantern path, golden sunbeams, meditative atmosphere',
  },
]

const testPrompt = ref('A serene traditional anime teahouse in spring surrounded by blooming sakura blossoms, soft sunlight, vibrant watercolor aesthetic')
const isGenerating = ref(false)
const generationElapsedSeconds = ref(0)
const generationStatusLabel = ref('Synthesizing...')
const generationError = ref('')
const notificationMessage = ref('')

const recentGenerations = ref<GeneratedPreviewItem[]>([])
const activePreviewIndex = ref(0)

const currentPreviewItem = computed<GeneratedPreviewItem | null>(() => {
  if (recentGenerations.value.length === 0)
    return null
  return recentGenerations.value[activePreviewIndex.value] || recentGenerations.value[0]
})

function applyPresetPrompt(promptText: string) {
  testPrompt.value = promptText
}

async function fetchDirectPollinations(prompt: string, model: string, width: number, height: number) {
  const modelParam = model ? `&model=${encodeURIComponent(model)}` : ''
  const seed = Math.floor(Math.random() * 1000000)
  const rawUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}${modelParam}&nologo=true`
  const url = formatCorsProxyUrl(rawUrl)

  const headers: Record<string, string> = {}
  if (pollinationsApiKey.value) {
    headers.Authorization = `Bearer ${pollinationsApiKey.value}`
  }

  const response = await fetch(url, { headers })
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)

  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  const imageUrl = `data:image/jpeg;base64,${base64}`
  return { imageUrl, base64 }
}

async function fetchDirectOpenAIImage(prompt: string, model: string, width?: number, height?: number) {
  const apiKey = openaiImageApiKey.value?.trim()
  if (!apiKey) {
    throw new Error('OpenAI Image API key is not configured. Please enter your API key in Settings > Providers > OpenAI Image.')
  }

  const rawBaseUrl = (openaiImageBaseUrl.value || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  const endpoint = new URL('images/generations', `${rawBaseUrl}/`)
  const url = formatCorsProxyUrl(endpoint.toString())

  const size = (width && height) ? `${width}x${height}` : undefined

  const payload: Record<string, any> = {
    model: model || openaiImageModel.value || 'gpt-image',
    prompt,
    n: 1,
    output_format: 'png',
  }
  if (size) {
    payload.size = size
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errorData = await response.json()
      if (errorData?.error?.message) {
        const code = errorData.error.code || errorData.error.type || 'error'
        const msg = String(errorData.error.message).trim().replace(/\.+$/, '')
        errorDetail = ` (${code}): ${msg}`
      }
    }
    catch {
      // Body was not JSON; fallback to status text
    }
    throw new Error(`OpenAI Images API returned HTTP ${response.status}${errorDetail || `: ${response.statusText}`}.`)
  }

  const data = await response.json()
  const firstItem = data.data?.[0]
  if (!firstItem) {
    throw new Error('OpenAI Images API returned an empty data list.')
  }

  let imageUrl = ''
  let base64 = ''

  if (firstItem.b64_json) {
    base64 = firstItem.b64_json
    imageUrl = base64.startsWith('data:image/')
      ? base64
      : `data:image/png;base64,${base64}`
  }
  else if (firstItem.url) {
    imageUrl = firstItem.url
  }
  else {
    throw new Error('OpenAI Images API returned neither b64_json nor an image URL.')
  }

  return { imageUrl, base64 }
}

async function fetchDirectCloudflareImage(prompt: string, model: string, width?: number, height?: number, steps?: number) {
  const credentials = artistryStore.getEffectiveCloudflareCredentials()
  const accountId = credentials.accountId
  let apiToken = credentials.apiToken

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID or API token is not configured. Please connect your account or enter credentials in Settings > Providers > Cloudflare Workers AI.')
  }

  const targetModel = model || cloudflareImageModel.value || CLOUDFLARE_IMAGE_DEFAULTS.model
  const rawUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${targetModel.replace(/^\/+/, '')}`
  const url = formatCorsProxyUrl(rawUrl)

  const isMultipart = isCloudflareMultipartModel(targetModel)
  const isFixedSteps = isCloudflareFixedStepsModel(targetModel)
  const resolvedSteps = isFixedSteps ? 4 : (steps || cloudflareImageSteps.value || getCloudflareModelDefaultSteps(targetModel))

  const makeRequest = async (token: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }

    let body: string | FormData
    if (isMultipart) {
      const form = new FormData()
      form.append('prompt', prompt)
      if (width)
        form.append('width', String(width))
      if (height)
        form.append('height', String(height))
      if (!isFixedSteps && resolvedSteps) {
        form.append('steps', String(resolvedSteps))
      }
      body = form
    }
    else {
      headers['Content-Type'] = 'application/json'
      headers.Accept = 'application/json'
      const payload: Record<string, any> = { prompt }
      if (!isCloudflareOmitDimensionsModel(targetModel)) {
        if (width)
          payload.width = width
        if (height)
          payload.height = height
      }
      if (resolvedSteps) {
        payload.steps = resolvedSteps
        if (targetModel.includes('stable-diffusion') || targetModel.includes('sdxl')) {
          payload.num_steps = resolvedSteps
        }
      }
      body = JSON.stringify(payload)
    }

    return fetch(url, {
      method: 'POST',
      headers,
      body,
    })
  }

  let response = await makeRequest(apiToken)

  // Transparent OAuth token refresh on 401
  if (response.status === 401 && cloudflareStore.cfOAuthTokens?.refreshToken) {
    try {
      await cloudflareStore.refreshOAuthTokens()
      if (cloudflareStore.activeAccessToken) {
        apiToken = cloudflareStore.activeAccessToken
        response = await makeRequest(apiToken)
      }
    }
    catch {
      // If refresh fails, fall through to reporting original response error
    }
  }

  if (!response.ok) {
    let errorDetail = ''
    try {
      const errorData = await response.json()
      if (errorData?.errors?.length) {
        errorDetail = errorData.errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join('; ')
      }
      else if (errorData?.messages?.length) {
        errorDetail = errorData.messages.join('; ')
      }
    }
    catch {
      try {
        const text = await response.text()
        if (text)
          errorDetail = text.slice(0, 300)
      }
      catch {
        // Fallback to HTTP status text
      }
    }
    throw new Error(`Cloudflare Workers AI returned HTTP ${response.status}${errorDetail ? `: ${errorDetail}` : ` (${response.statusText})`}.`)
  }

  const contentType = response.headers.get('content-type') || ''
  let imageUrl = ''
  let base64 = ''

  if (contentType.includes('application/json')) {
    const json = await response.json()
    if (!json.success && json.errors?.length) {
      throw new Error(`Cloudflare Workers AI error: ${json.errors.map((e: any) => e.message || e.code).join('; ')}`)
    }
    const b64 = json.result?.image
    if (!b64) {
      throw new Error('Cloudflare Workers AI response did not contain an image.')
    }
    base64 = b64.replace(/^data:image\/[^;]+;base64,/, '')
    imageUrl = b64.startsWith('data:image/') ? b64 : `data:image/png;base64,${b64}`
  }
  else {
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    base64 = btoa(binary)
    const mime = contentType.includes('image/jpeg') ? 'image/jpeg' : 'image/png'
    imageUrl = `data:${mime};base64,${base64}`
  }

  return { imageUrl, base64 }
}

// --- Live Generation Runner ---
async function generatePreviewImage() {
  if (activeProvider.value === 'none') {
    generationError.value = 'Image generation is currently set to None (Disabled). Please select an active provider.'
    return
  }

  if (!testPrompt.value.trim()) {
    generationError.value = 'Please enter a prompt describing the image to generate.'
    return
  }

  isGenerating.value = true
  generationError.value = ''
  notificationMessage.value = ''
  generationElapsedSeconds.value = 0
  generationStatusLabel.value = 'Initiating image synthesis...'

  const timer = setInterval(() => {
    generationElapsedSeconds.value = Number((generationElapsedSeconds.value + 0.1).toFixed(1))
  }, 100)

  const startTime = Date.now()

  try {
    let resultImageUrl = ''
    let resultBase64 = ''

    const providerId = activeProvider.value
    let modelId = ''
    let width = 1024
    let height = 1024

    if (providerId === 'pollinations') {
      modelId = pollinationsModel.value
      width = pollinationsWidth.value
      height = pollinationsHeight.value
    }
    else if (providerId === 'nanobanana') {
      modelId = nanobananaModel.value
    }
    else if (providerId === 'replicate') {
      modelId = replicateDefaultModel.value
    }
    else if (providerId === 'comfyui') {
      modelId = comfyuiActiveWorkflow.value
    }
    else if (providerId === 'openai-image') {
      modelId = openaiImageModel.value || 'gpt-image'
      width = Number(openaiImageWidth.value) || 1024
      height = Number(openaiImageHeight.value) || 1024
    }
    else if (providerId === 'cloudflare') {
      modelId = cloudflareImageModel.value || CLOUDFLARE_IMAGE_DEFAULTS.model
      width = Number(cloudflareImageWidth.value) || 1024
      height = Number(cloudflareImageHeight.value) || 1024
    }

    generationStatusLabel.value = `Dispatching to ${providerId.toUpperCase()}...`

    // Direct Renderer Fetch for Web & DevTools Network Observability (OpenAI Image & Cloudflare Workers AI)
    if (providerId === 'openai-image') {
      const directRes = await fetchDirectOpenAIImage(testPrompt.value, modelId, width, height)
      resultImageUrl = directRes.imageUrl
      resultBase64 = directRes.base64
    }
    else if (providerId === 'cloudflare') {
      const directRes = await fetchDirectCloudflareImage(testPrompt.value, modelId, width, height, cloudflareImageSteps.value)
      resultImageUrl = directRes.imageUrl
      resultBase64 = directRes.base64
    }
    // Electron Eventa Dispatch with Renderer Fallback
    else if (generateInvoke) {
      try {
        const optionsPayload = JSON.parse(JSON.stringify({
          width,
          height,
          aspect_ratio: replicateAspectRatio.value,
        }))
        const globalsPayload = JSON.parse(JSON.stringify(artistryStore.artistryGlobals || {}))

        const res = await generateInvoke({
          prompt: testPrompt.value,
          model: modelId,
          provider: providerId,
          options: optionsPayload,
          globals: globalsPayload,
        })

        if (res?.error) {
          if (providerId === 'pollinations') {
            console.warn('[Artistry Studio] Main process threw error, falling back to direct Pollinations fetch:', res.error)
            const fallbackRes = await fetchDirectPollinations(testPrompt.value, modelId, width, height)
            resultImageUrl = fallbackRes.imageUrl
            resultBase64 = fallbackRes.base64
          }
          else {
            throw new Error(res.error)
          }
        }
        else if (res?.base64) {
          resultBase64 = res.base64
          resultImageUrl = res.base64.startsWith('data:image/')
            ? res.base64
            : `data:image/jpeg;base64,${res.base64}`
        }
        else if (res?.imageUrl) {
          resultImageUrl = res.imageUrl
        }
      }
      catch (ipcErr: any) {
        if (providerId === 'pollinations') {
          console.warn('[Artistry Studio] IPC error, falling back to direct Pollinations fetch:', ipcErr)
          const fallbackRes = await fetchDirectPollinations(testPrompt.value, modelId, width, height)
          resultImageUrl = fallbackRes.imageUrl
          resultBase64 = fallbackRes.base64
        }
        else {
          throw ipcErr
        }
      }
    }
    else if (providerId === 'pollinations') {
      const fallbackRes = await fetchDirectPollinations(testPrompt.value, modelId, width, height)
      resultImageUrl = fallbackRes.imageUrl
      resultBase64 = fallbackRes.base64
    }
    else {
      throw new Error(`Direct browser testing for '${providerId}' is not supported. Please run inside the AIRI Electron app.`)
    }

    if (!resultImageUrl)
      throw new Error('No image output was returned from the generator.')

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    const newItem: GeneratedPreviewItem = {
      id: `preview-${Date.now()}`,
      url: resultImageUrl,
      base64: resultBase64,
      prompt: testPrompt.value,
      provider: providerId,
      model: modelId || 'Auto / Default',
      dimensions: `${width}×${height}`,
      duration,
      timestamp: Date.now(),
    }

    // Keep up to 6 items in memory
    recentGenerations.value = [newItem, ...recentGenerations.value.slice(0, 5)]
    activePreviewIndex.value = 0
  }
  catch (err: any) {
    console.error('[Artistry Studio] Generation error:', err)
    generationError.value = err?.message || String(err) || 'Generation failed'
  }
  finally {
    clearInterval(timer)
    isGenerating.value = false
  }
}

// --- Action: Set as Stage Background ---
async function setAsStageBackground(item: GeneratedPreviewItem) {
  try {
    notificationMessage.value = 'Applying background to active stage...'
    const response = await fetch(item.url)
    const blob = await response.blob()

    const title = `Preview ${new Date().toLocaleTimeString()} - ${item.provider}`
    const bgId = await backgroundStore.addBackground('scene', blob, title, item.prompt, null)

    // Assign to active card
    const activeCard = airiCardStore.activeCard
    if (activeCard) {
      if (!activeCard.extensions)
        activeCard.extensions = {} as any
      if (!(activeCard.extensions as any).airi)
        (activeCard.extensions as any).airi = {}
      if (!(activeCard.extensions as any).airi.modules)
        (activeCard.extensions as any).airi.modules = {}
      ;(activeCard.extensions as any).airi.modules.activeBackgroundId = bgId
    }

    notificationMessage.value = '✨ Successfully set as active stage background!'
    setTimeout(() => {
      notificationMessage.value = ''
    }, 4000)
  }
  catch (err: any) {
    console.error('[Artistry Studio] Failed to apply background:', err)
    generationError.value = `Failed to apply background: ${err?.message || String(err)}`
  }
}

// --- Action: Save to Backgrounds Library ---
async function saveToLibrary(item: GeneratedPreviewItem) {
  try {
    const response = await fetch(item.url)
    const blob = await response.blob()
    const title = `Artistry ${new Date().toLocaleTimeString()} (${item.provider})`
    await backgroundStore.addBackground('scene', blob, title, item.prompt, null)

    notificationMessage.value = '💾 Saved to Stage Backgrounds library!'
    setTimeout(() => {
      notificationMessage.value = ''
    }, 3000)
  }
  catch (err: any) {
    console.error('[Artistry Studio] Failed to save image:', err)
    generationError.value = `Failed to save image: ${err?.message || String(err)}`
  }
}

// --- Action: Download Image ---
function downloadImage(item: GeneratedPreviewItem) {
  const link = document.createElement('a')
  link.href = item.url
  link.download = `airi-artistry-${item.provider}-${Date.now()}.jpg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  if (pollinationsCachedModels.value.length === 0) {
    artistryStore.fetchPollinationsModels()
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
          Artistry & Image Studio
        </h2>
        <p class="text-xs text-neutral-400 dark:text-neutral-500">
          Configure active generation backends, test custom prompts in the live studio, and apply generated artwork directly to the avatar stage.
        </p>
      </div>

      <div
        v-if="notificationMessage"
        class="flex animate-fade-in items-center gap-2 border border-emerald-500/30 rounded-xl bg-emerald-500/10 px-3.5 py-1.5 text-xs text-emerald-600 font-medium dark:text-emerald-300"
      >
        <div class="i-solar:check-circle-bold text-base" />
        <span>{{ notificationMessage }}</span>
      </div>
    </div>

    <!-- Two-Column Studio Layout -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- ================= LEFT COLUMN: Provider Switchboard ================= -->
      <div class="flex flex-col gap-4 lg:col-span-4">
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-200">
              <div class="i-solar:palette-bold-duotone text-primary-500" />
              Active Backend
            </h3>
            <span class="text-[11px] text-neutral-400">Global Engine</span>
          </div>

          <!-- Provider Cards List -->
          <div class="flex flex-col gap-2">
            <div
              v-for="p in providers"
              :key="p.id"
              :class="[
                'relative cursor-pointer rounded-xl border p-3.5 transition-all text-left',
                activeProvider === p.id
                  ? 'border-primary-500 bg-primary-500/5 dark:border-primary-500/80 dark:bg-primary-500/10 shadow-sm'
                  : 'border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/20 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="activeProvider = p.id"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <div :class="[p.icon, 'text-xl shrink-0', activeProvider === p.id ? 'text-primary-500' : 'text-neutral-400']" />
                  <div>
                    <div class="text-xs text-neutral-800 font-bold dark:text-neutral-100">
                      {{ p.name }}
                    </div>
                    <span :class="['mt-0.5 inline-block rounded px-1.5 py-0.2 text-[9px] font-medium border', p.badgeColor]">
                      {{ p.badge }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="activeProvider === p.id"
                  class="i-solar:check-circle-bold shrink-0 text-base text-primary-500"
                />
              </div>
              <p class="mt-2 text-[11px] text-neutral-500 leading-tight dark:text-neutral-400">
                {{ p.description }}
              </p>
            </div>
          </div>

          <!-- Provider Inline Quick Config -->
          <!-- Pollinations -->
          <div v-if="activeProvider === 'pollinations'" class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800">
            <div class="w-full flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                  Pollinations Model
                </label>
                <button
                  type="button"
                  class="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  :disabled="isLoadingPollinationsModels"
                  @click="refreshPollinationsCatalog"
                >
                  <div class="i-solar:refresh-bold-duotone text-xs" :class="{ 'animate-spin': isLoadingPollinationsModels }" />
                  <span>Refresh</span>
                </button>
              </div>

              <Select
                v-model="pollinationsModel"
                :options="pollinationsModelOptions"
                placeholder="Free Router (Pollinations Auto)"
                class="w-full text-xs"
              />
            </div>

            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Resolution
              </label>
              <Select
                v-model="currentResolution"
                :options="resolutionOptions"
                class="w-full text-xs"
              />
            </div>
          </div>

          <!-- Nano Banana -->
          <div v-else-if="activeProvider === 'nanobanana'" class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800">
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Gemini Model
              </label>
              <Select
                v-model="nanobananaModel"
                :options="nanobananaModelOptions"
                class="w-full text-xs"
              />
            </div>
          </div>

          <!-- Replicate -->
          <div v-else-if="activeProvider === 'replicate'" class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800">
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Replicate Model
              </label>
              <Select
                v-model="replicateDefaultModel"
                :options="replicateModelOptions"
                class="w-full text-xs"
              />
            </div>
          </div>

          <!-- ComfyUI -->
          <div v-else-if="activeProvider === 'comfyui'" class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800">
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Active Workflow Template
              </label>
              <Select
                v-model="comfyuiActiveWorkflow"
                :options="comfyuiWorkflowOptions"
                placeholder="Select a workflow..."
                class="w-full text-xs"
              />
            </div>
          </div>

          <!-- OpenAI GPT Image -->
          <div v-else-if="activeProvider === 'openai-image'" class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800">
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                OpenAI Image Model
              </label>
              <Select
                v-model="openaiImageModel"
                :options="openaiImageModelOptions"
                class="w-full text-xs"
              />
            </div>
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Resolution & Aspect Ratio
              </label>
              <Select
                v-model="openaiResolutionPreset"
                :options="openaiResolutionOptions"
                class="w-full text-xs"
              />
            </div>
            <div v-if="!openaiImageApiKey" class="rounded-lg bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
              API key not configured. Click "Provider Settings & Keys" below to configure credentials.
            </div>
          </div>

          <!-- Cloudflare Workers AI -->
          <div v-else-if="activeProvider === 'cloudflare'" class="border-t border-neutral-100 pt-3 space-y-3 dark:border-neutral-800">
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Workers AI Model
              </label>
              <Select
                v-model="cloudflareImageModel"
                :options="cloudflareModelOptions"
                class="w-full text-xs"
              />
            </div>
            <div class="w-full flex flex-col gap-1.5">
              <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Resolution & Aspect Ratio
              </label>
              <Select
                v-model="cloudflareResolutionPreset"
                :options="cloudflareResolutionOptions"
                class="w-full text-xs"
              />
            </div>
            <div v-if="!artistryStore.getEffectiveCloudflareCredentials().accountId || !artistryStore.getEffectiveCloudflareCredentials().apiToken" class="rounded-lg bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
              Cloudflare credentials not configured. Click "Provider Settings & Keys" below to connect your account or enter an API token.
            </div>
          </div>

          <!-- Deep Provider Settings Link -->
          <div v-if="activeProvider !== 'none'" class="border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <button
              type="button"
              class="w-full flex items-center justify-between rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-700 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
              @click="router.push(`/settings/providers/artistry/${activeProvider}`)"
            >
              <span>Provider Settings & Keys</span>
              <div class="i-solar:arrow-right-bold-duotone text-sm" />
            </button>
          </div>
        </div>
      </div>

      <!-- ================= RIGHT COLUMN: Interactive Studio & Live Canvas ================= -->
      <div class="flex flex-col gap-5 lg:col-span-8">
        <!-- Inspiration Prompt Presets -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="mb-2 flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-bold dark:text-neutral-400">
              <div class="i-solar:magic-stick-bold-duotone text-amber-500" />
              Preset Inspiration Prompts
            </span>
            <span class="text-[10px] text-neutral-400">Click to load into composer</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in presetPromptTemplates"
              :key="preset.label"
              type="button"
              class="border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700 font-medium transition-all dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-800/60 hover:bg-primary-50/50 dark:text-neutral-300 dark:hover:border-primary-500 dark:hover:bg-primary-950/20"
              @click="applyPresetPrompt(preset.prompt)"
            >
              {{ preset.label }}
            </button>
          </div>

          <!-- Prompt Textarea -->
          <div class="mt-4 flex flex-col gap-2">
            <label class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
              Prompt Composer
            </label>
            <textarea
              v-model="testPrompt"
              rows="3"
              placeholder="Describe the scene, style, lighting, and mood..."
              class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/80 p-3 text-xs text-neutral-800 leading-relaxed outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800/40 dark:text-neutral-200 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <!-- Generation Trigger Bar -->
          <div class="mt-3 flex items-center justify-between gap-3">
            <div class="text-[11px] text-neutral-400">
              Target: <span class="text-neutral-600 font-semibold dark:text-neutral-300">{{ activeProvider.toUpperCase() }}</span>
            </div>

            <button
              type="button"
              :disabled="isGenerating || activeProvider === 'none'"
              class="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-xs text-white font-bold shadow-sm transition-all active:scale-98 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
              @click="generatePreviewImage"
            >
              <div
                :class="[
                  isGenerating ? 'i-solar:refresh-bold-duotone animate-spin' : 'i-solar:pallete-2-bold-duotone',
                  'text-base',
                ]"
              />
              <span>{{ isGenerating ? `Generating (${generationElapsedSeconds}s)...` : 'Generate Preview Image' }}</span>
            </button>
          </div>

          <!-- Error Alert Container -->
          <div
            v-if="generationError"
            class="mt-3 flex items-center gap-2 border border-red-500/20 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
          >
            <div class="i-solar:danger-triangle-bold shrink-0 text-base" />
            <span>{{ generationError }}</span>
          </div>
        </div>

        <!-- ================= Live Canvas Display Viewport ================= -->
        <div class="flex flex-col border border-neutral-200 rounded-2xl bg-white p-5 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="flex items-center justify-between">
            <h4 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-200">
              <div class="i-solar:gallery-round-bold-duotone text-primary-500" />
              Live Studio Canvas
            </h4>

            <div v-if="currentPreviewItem" class="flex items-center gap-2 text-[10px] text-neutral-400">
              <span class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">{{ currentPreviewItem.dimensions }}</span>
              <span class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">{{ currentPreviewItem.duration }}</span>
              <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-primary-500 font-mono dark:bg-neutral-800">{{ currentPreviewItem.provider }}</span>
            </div>
          </div>

          <!-- Main Viewport Canvas -->
          <div class="relative min-h-[320px] w-full flex items-center justify-center overflow-hidden border border-neutral-200/80 rounded-xl bg-neutral-100/60 dark:border-neutral-800/80 dark:bg-neutral-950/40">
            <!-- Loading Overlay -->
            <div
              v-if="isGenerating"
              class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm dark:bg-neutral-900/80"
            >
              <div class="i-solar:refresh-bold-duotone animate-spin text-4xl text-primary-500" />
              <div class="text-xs text-neutral-700 font-bold dark:text-neutral-200">
                {{ generationStatusLabel }}
              </div>
              <div class="text-[11px] text-neutral-400 font-mono">
                Elapsed: {{ generationElapsedSeconds }}s
              </div>
            </div>

            <!-- Image Render Surface -->
            <img
              v-if="currentPreviewItem"
              :src="currentPreviewItem.url"
              :alt="currentPreviewItem.prompt"
              class="max-h-[500px] w-full object-contain transition-all"
            >

            <!-- Empty State -->
            <div
              v-else-if="!isGenerating"
              class="flex flex-col items-center justify-center p-8 text-center"
            >
              <div class="i-solar:gallery-wide-bold-duotone text-5xl text-neutral-300 dark:text-neutral-700" />
              <p class="mt-2 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                No preview generated yet
              </p>
              <p class="mt-0.5 max-w-sm text-[11px] text-neutral-400 dark:text-neutral-500">
                Choose a preset inspiration prompt or type in your own description, then click <strong>Generate Preview Image</strong>.
              </p>
            </div>
          </div>

          <!-- Image Action Toolbar -->
          <div v-if="currentPreviewItem" class="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div class="max-w-[50%] truncate text-[11px] text-neutral-500 dark:text-neutral-400" :title="currentPreviewItem.prompt">
              "{{ currentPreviewItem.prompt }}"
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-xl bg-primary-500/10 px-3 py-1.5 text-xs text-primary-600 font-bold transition-all dark:bg-primary-500/20 hover:bg-primary-500 dark:text-primary-300 hover:text-white dark:hover:text-white"
                @click="setAsStageBackground(currentPreviewItem)"
              >
                <div class="i-solar:wallpaper-bold-duotone text-sm" />
                <span>Set as Stage Background</span>
              </button>

              <button
                type="button"
                class="flex items-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-1.5 text-xs text-neutral-700 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                @click="saveToLibrary(currentPreviewItem)"
              >
                <div class="i-solar:diskette-bold-duotone text-sm" />
                <span>Save to Library</span>
              </button>

              <button
                type="button"
                class="rounded-xl bg-neutral-100 p-2 text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                title="Download Image"
                @click="downloadImage(currentPreviewItem)"
              >
                <div class="i-solar:download-minimalistic-bold-duotone text-base" />
              </button>
            </div>
          </div>
        </div>

        <!-- ================= Session History Strip (Last 6 in memory) ================= -->
        <div v-if="recentGenerations.length > 0" class="border border-neutral-200 rounded-2xl bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="mb-2.5 flex items-center justify-between">
            <span class="text-xs text-neutral-600 font-bold dark:text-neutral-300">
              Session History ({{ recentGenerations.length }} / 6 in memory)
            </span>
            <span class="text-[10px] text-neutral-400">Click thumbnail to inspect</span>
          </div>

          <div class="flex flex-row gap-3 overflow-x-auto pb-1" style="scrollbar-width: thin;">
            <div
              v-for="(item, idx) in recentGenerations"
              :key="item.id"
              :class="[
                'relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all',
                activePreviewIndex === idx
                  ? 'border-primary-500 ring-2 ring-primary-500/30 scale-102'
                  : 'border-neutral-200 opacity-70 hover:opacity-100 dark:border-neutral-700',
              ]"
              @click="activePreviewIndex = idx"
            >
              <img :src="item.url" :alt="item.prompt" class="h-full w-full object-cover">
              <span class="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[9px] text-white font-mono">
                {{ item.provider }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.artistry.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
