<script setup lang="ts">
import CloudflareAccountHubDialog from '@proj-airi/stage-ui/components/scenarios/dialogs/cloudflare/CloudflareAccountHubDialog.vue'
import CloudflareConnectDialog from '@proj-airi/stage-ui/components/scenarios/dialogs/cloudflare/CloudflareConnectDialog.vue'

import {
  CLOUDFLARE_IMAGE_DEFAULTS,
  CLOUDFLARE_IMAGE_MODELS,
  getCloudflareModelDefaultSteps,
  isCloudflareFixedStepsModel,
} from '@proj-airi/stage-shared'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useCloudflareStore } from '@proj-airi/stage-ui/stores/modules/cloudflare'
import { Alert, Button, FieldInput, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useArtistryStore()
const cloudflareStore = useCloudflareStore()

const {
  cloudflareAccountId,
  cloudflareApiToken,
  cloudflareImageModel,
  cloudflareImageSteps,
  cloudflareImageWidth,
  cloudflareImageHeight,
} = storeToRefs(store)

const {
  isAuthenticated,
  activeAccountId,
  activeAccessToken,
  isConnectOpen,
  isHubOpen,
} = storeToRefs(cloudflareStore)

const modelOptions = [
  ...CLOUDFLARE_IMAGE_MODELS.map(m => ({
    label: m.label,
    value: m.value,
  })),
  { label: 'Custom Model...', value: 'custom' },
]

const isCustomModel = ref(false)

const selectedModel = computed({
  get: () => {
    if (isCustomModel.value)
      return 'custom'
    const found = CLOUDFLARE_IMAGE_MODELS.find(m => m.value === cloudflareImageModel.value)
    if (found)
      return found.value
    if (!cloudflareImageModel.value)
      return CLOUDFLARE_IMAGE_DEFAULTS.model
    return 'custom'
  },
  set: (val: string) => {
    if (val === 'custom') {
      isCustomModel.value = true
      return
    }
    isCustomModel.value = false
    cloudflareImageModel.value = val
    if (isCloudflareFixedStepsModel(val)) {
      cloudflareImageSteps.value = 4
    }
    else {
      cloudflareImageSteps.value = getCloudflareModelDefaultSteps(val)
    }
  },
})

watch(cloudflareImageModel, (val) => {
  if (val && !CLOUDFLARE_IMAGE_MODELS.some(m => m.value === val)) {
    isCustomModel.value = true
  }
}, { immediate: true })

const activeModelMeta = computed(() => {
  return CLOUDFLARE_IMAGE_MODELS.find(m => m.value === cloudflareImageModel.value)
})

const isFixedSteps = computed(() => {
  return isCloudflareFixedStepsModel(cloudflareImageModel.value)
})

const resolutionOptions = [
  { label: 'Auto (Model Default / 1024×1024)', value: 'auto' },
  { label: '1024 × 1024 — Square (1:1)', value: '1024x1024' },
  { label: '1792 × 1024 — Landscape (16:9)', value: '1792x1024' },
  { label: '1024 × 1792 — Portrait (9:16)', value: '1024x1792' },
  { label: '1024 × 768 — Landscape (4:3)', value: '1024x768' },
  { label: '768 × 1024 — Portrait (3:4)', value: '768x1024' },
  { label: '512 × 512 — Fast Preview (1:1)', value: '512x512' },
  { label: 'Custom Dimensions...', value: 'custom' },
]

const isCustomResolution = ref(false)
const widthDraft = ref<string | number>(cloudflareImageWidth.value)
const heightDraft = ref<string | number>(cloudflareImageHeight.value)

const selectedResolution = computed({
  get: () => {
    if (isCustomResolution.value)
      return 'custom'
    if (!cloudflareImageWidth.value && !cloudflareImageHeight.value)
      return 'auto'
    const key = `${cloudflareImageWidth.value}x${cloudflareImageHeight.value}`
    if (['1024x1024', '1792x1024', '1024x1792', '1024x768', '768x1024', '512x512'].includes(key))
      return key
    return 'custom'
  },
  set: (val: string) => {
    if (val === 'custom') {
      isCustomResolution.value = true
      if (!widthDraft.value)
        widthDraft.value = '1024'
      if (!heightDraft.value)
        heightDraft.value = '1024'
      return
    }
    isCustomResolution.value = false
    if (val === 'auto') {
      store.$patch({ cloudflareImageWidth: '', cloudflareImageHeight: '' })
      widthDraft.value = ''
      heightDraft.value = ''
    }
    else {
      const [w, h] = val.split('x')
      if (w && h) {
        store.$patch({ cloudflareImageWidth: w, cloudflareImageHeight: h })
        widthDraft.value = w
        heightDraft.value = h
      }
    }
  },
})

const invalidDimensions = computed(() => {
  if (widthDraft.value === '' && heightDraft.value === '')
    return false
  return [Number(widthDraft.value), Number(heightDraft.value)]
    .some(value => !Number.isSafeInteger(value) || value < 16)
})

const dimensionsChanged = computed(() => {
  return String(widthDraft.value) !== cloudflareImageWidth.value || String(heightDraft.value) !== cloudflareImageHeight.value
})

watch([cloudflareImageWidth, cloudflareImageHeight], ([width, height]) => {
  widthDraft.value = width
  heightDraft.value = height
  const key = `${width}x${height}`
  if (!['', '1024x1024', '1792x1024', '1024x1792', '1024x768', '768x1024', '512x512'].includes(key)) {
    isCustomResolution.value = true
  }
}, { immediate: true })

function saveDimensions() {
  if (invalidDimensions.value)
    return
  store.$patch({
    cloudflareImageWidth: String(widthDraft.value),
    cloudflareImageHeight: String(heightDraft.value),
  })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header banner -->
    <div class="rounded-xl bg-orange-500/8 p-5 dark:bg-orange-500/12">
      <div class="mb-3 flex items-center gap-3">
        <div class="i-simple-icons:cloudflare text-3xl text-orange-500" />
        <div>
          <h2 class="text-xl text-neutral-800 font-semibold dark:text-neutral-100">
            {{ t('settings.pages.providers.provider.cloudflare-image.title', 'Cloudflare Workers AI') }}
          </h2>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('settings.pages.providers.provider.cloudflare-image.description', 'Generate images with free serverless neural models on Cloudflare (FLUX.1 Schnell, FLUX.2 Klein/Dev, Leonardo, SDXL, and DreamShaper).') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Cloudflare Account / OAuth Hub Connection Card -->
    <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div v-if="isAuthenticated" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          <div>
            <div class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
              Connected to Cloudflare Hub
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              Account ID: <span class="font-mono">{{ activeAccountId || 'Configured via OAuth' }}</span>
              (Credentials inherited automatically)
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" @click="isHubOpen = true">
          Manage Account Hub
        </Button>
      </div>

      <div v-else class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="h-3 w-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
          <div>
            <div class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
              Cloudflare Account Not Connected
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              Connect your account with 1-click OAuth to use the 10,000 daily free neurons, or enter an API Token manually below.
            </div>
          </div>
        </div>
        <Button variant="primary" size="sm" @click="isConnectOpen = true">
          Connect Cloudflare
        </Button>
      </div>
    </div>

    <!-- Manual credentials -->
    <div class="flex flex-col gap-4">
      <FieldInput
        v-model="cloudflareAccountId"
        :label="t('settings.pages.providers.provider.cloudflare-image.account-id.label', 'Cloudflare Account ID')"
        :description="t('settings.pages.providers.provider.cloudflare-image.account-id.description', 'Your 32-character hexadecimal Account ID. If blank, uses your connected Cloudflare account.')"
        :placeholder="activeAccountId || 'Leave blank to use connected account'"
      />

      <FieldInput
        v-model="cloudflareApiToken"
        type="password"
        :label="t('settings.pages.providers.provider.cloudflare-image.api-token.label', 'Workers AI API Token')"
        :description="t('settings.pages.providers.provider.cloudflare-image.api-token.description', 'API Token with Workers AI Read/Edit permissions. If blank, uses your connected Cloudflare account token.')"
        :placeholder="activeAccessToken ? '•••••••••••••••• (Inherited from Cloudflare Hub)' : 'Paste Cloudflare API token'"
      />

      <!-- Model selector -->
      <FieldSelect
        v-model="selectedModel"
        :label="t('settings.pages.providers.provider.cloudflare-image.model.label', 'Image Generation Model')"
        :description="activeModelMeta?.description || 'Select a Cloudflare Workers AI model preset or custom model ID.'"
        :options="modelOptions"
      />

      <!-- Model estimate / compute info alert -->
      <div v-if="activeModelMeta?.neuronEstimate" class="rounded-lg bg-neutral-100 px-3.5 py-2.5 text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
        <div class="flex items-center gap-2">
          <div class="i-solar:calculator-minimalistic-bold-duotone text-sm text-orange-500" />
          <span class="font-medium">Free Allowance Usage:</span>
          <span>{{ activeModelMeta.neuronEstimate }}</span>
        </div>
      </div>

      <!-- Custom model ID -->
      <div v-if="selectedModel === 'custom'" class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
        <FieldInput
          v-model="cloudflareImageModel"
          label="Custom Model Identifier"
          description="Enter an exact Cloudflare Workers AI model identifier (e.g. @cf/black-forest-labs/flux-1-schnell)."
          placeholder="@cf/black-forest-labs/flux-1-schnell"
        />
      </div>

      <!-- Inference steps -->
      <div v-if="isFixedSteps" class="border border-blue-500/20 rounded-xl bg-blue-500/5 p-4 dark:bg-blue-500/10">
        <div class="flex items-center gap-2 text-sm text-blue-600 font-medium dark:text-blue-400">
          <div class="i-solar:info-circle-bold-duotone text-base" />
          <span>Fixed 4-step inference</span>
        </div>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          FLUX.2 Klein models use an ultra-fast distilled 4-step process. Step count is fixed by architecture and cannot be adjusted.
        </p>
      </div>

      <FieldInput
        v-else
        v-model="cloudflareImageSteps"
        type="number"
        label="Inference Steps"
        :description="`Number of denoising steps (Recommended: ${getCloudflareModelDefaultSteps(cloudflareImageModel)} for this model). Higher steps increase quality but consume more neuron quota.`"
        :placeholder="String(getCloudflareModelDefaultSteps(cloudflareImageModel))"
      />

      <!-- Resolution & Aspect Ratio -->
      <FieldSelect
        v-model="selectedResolution"
        label="Resolution & Aspect Ratio"
        description="Choose a preset aspect ratio or custom dimensions."
        :options="resolutionOptions"
      />

      <div v-if="selectedResolution === 'custom'" class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/30">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldInput
            v-model="widthDraft"
            type="number"
            label="Default Width (pixels)"
            description="Positive integer (e.g. 1024, 768, 512)"
            placeholder="1024"
          />
          <FieldInput
            v-model="heightDraft"
            type="number"
            label="Default Height (pixels)"
            placeholder="1024"
          />
        </div>
        <Alert
          v-if="invalidDimensions"
          tone="warning"
          title="Invalid dimensions: enter positive integers for width and height."
        />
        <div class="flex justify-end">
          <Button
            variant="primary"
            :disabled="invalidDimensions || !dimensionsChanged"
            @click="saveDimensions"
          >
            Save Dimensions
          </Button>
        </div>
      </div>
    </div>

    <!-- Connect / Hub Dialogs -->
    <CloudflareConnectDialog v-model:open="isConnectOpen" />
    <CloudflareAccountHubDialog v-model:open="isHubOpen" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.cloudflare-image.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
