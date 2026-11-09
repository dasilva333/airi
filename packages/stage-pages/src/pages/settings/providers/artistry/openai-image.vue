<script setup lang="ts">
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { Alert, Button, FieldInput, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useArtistryStore()
const { openaiImageApiKey, openaiImageBaseUrl, openaiImageModel, openaiImageWidth, openaiImageHeight } = storeToRefs(store)

const modelOptions = [
  { label: 'GPT Image (Auto / Latest)', value: 'gpt-image' },
  { label: 'GPT Image 2.6 Sunburst', value: 'gpt-image-2.6-sunburst' },
  { label: 'Custom Model...', value: 'custom' },
]

const isCustomModel = ref(false)

const selectedModel = computed({
  get: () => {
    if (isCustomModel.value)
      return 'custom'
    if (openaiImageModel.value === 'gpt-image' || !openaiImageModel.value)
      return 'gpt-image'
    if (openaiImageModel.value === 'gpt-image-2.6-sunburst')
      return 'gpt-image-2.6-sunburst'
    return 'custom'
  },
  set: (val: string) => {
    if (val === 'custom') {
      isCustomModel.value = true
      return
    }
    isCustomModel.value = false
    openaiImageModel.value = val
  },
})

watch(openaiImageModel, (val) => {
  if (val && !['gpt-image', 'gpt-image-2.6-sunburst'].includes(val)) {
    isCustomModel.value = true
  }
}, { immediate: true })

const resolutionOptions = [
  { label: 'Auto (Model Default / 1024×1024)', value: 'auto' },
  { label: '1024 × 1024 — Square (1:1)', value: '1024x1024' },
  { label: '1792 × 1024 — Landscape (16:9 · DALL-E 3)', value: '1792x1024' },
  { label: '1024 × 1792 — Portrait (9:16 · DALL-E 3)', value: '1024x1792' },
  { label: '512 × 512 — Fast Preview (1:1 · DALL-E 2)', value: '512x512' },
  { label: '256 × 256 — Thumbnail (1:1 · DALL-E 2)', value: '256x256' },
  { label: 'Custom Dimensions...', value: 'custom' },
]

const isCustom = ref(false)
const widthDraft = ref<string | number>(openaiImageWidth.value)
const heightDraft = ref<string | number>(openaiImageHeight.value)

const selectedResolution = computed({
  get: () => {
    if (isCustom.value)
      return 'custom'
    if (!openaiImageWidth.value && !openaiImageHeight.value)
      return 'auto'
    const key = `${openaiImageWidth.value}x${openaiImageHeight.value}`
    if (['1024x1024', '1792x1024', '1024x1792', '512x512', '256x256'].includes(key))
      return key
    return 'custom'
  },
  set: (val: string) => {
    if (val === 'custom') {
      isCustom.value = true
      if (!widthDraft.value)
        widthDraft.value = '1024'
      if (!heightDraft.value)
        heightDraft.value = '1024'
      return
    }
    isCustom.value = false
    if (val === 'auto') {
      store.$patch({ openaiImageWidth: '', openaiImageHeight: '' })
      widthDraft.value = ''
      heightDraft.value = ''
    }
    else {
      const [w, h] = val.split('x')
      if (w && h) {
        store.$patch({ openaiImageWidth: w, openaiImageHeight: h })
        widthDraft.value = w
        heightDraft.value = h
      }
    }
  },
})

// Dimension edits stay local until a complete valid pair is explicitly saved.
const invalidDimensions = computed(() => {
  if (widthDraft.value === '' && heightDraft.value === '')
    return false
  return [Number(widthDraft.value), Number(heightDraft.value)]
    .some(value => !Number.isSafeInteger(value) || value <= 0 || value % 16 !== 0)
})
const dimensionsChanged = computed(() => String(widthDraft.value) !== openaiImageWidth.value || String(heightDraft.value) !== openaiImageHeight.value)

// Store resets and remote snapshots refresh only the local form, without writing synchronized state.
watch([openaiImageWidth, openaiImageHeight], ([width, height]) => {
  widthDraft.value = width
  heightDraft.value = height
  const key = `${width}x${height}`
  if (!['', '1024x1024', '1792x1024', '1024x1792', '512x512', '256x256'].includes(key)) {
    isCustom.value = true
  }
}, { immediate: true })

function saveDimensions() {
  if (invalidDimensions.value)
    return
  store.$patch({ openaiImageWidth: String(widthDraft.value), openaiImageHeight: String(heightDraft.value) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="rounded-xl bg-emerald-500/8 p-5 dark:bg-emerald-500/12">
      <div class="mb-3 flex items-center gap-3">
        <div class="i-solar:gallery-bold-duotone text-3xl text-emerald-500" />
        <div>
          <h2 class="text-xl text-neutral-800 font-semibold dark:text-neutral-100">
            {{ t('settings.pages.providers.provider.openai-image.title') }}
          </h2>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('settings.pages.providers.provider.openai-image.description') }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <FieldInput
        v-model="openaiImageApiKey"
        type="password"
        :label="t('settings.pages.providers.provider.openai-image.api-key.label')"
        :description="t('settings.pages.providers.provider.openai-image.api-key.description')"
        :placeholder="t('settings.pages.providers.provider.openai-image.api-key.placeholder')"
      />
      <FieldInput
        v-model="openaiImageBaseUrl"
        :label="t('settings.pages.providers.provider.openai-image.base-url.label')"
        :description="t('settings.pages.providers.provider.openai-image.base-url.description')"
        placeholder="https://api.openai.com/v1/"
      />
      <FieldSelect
        v-model="selectedModel"
        :label="t('settings.pages.providers.provider.openai-image.model.label')"
        description="Select the generation model. 'GPT Image' automatically targets the latest available model."
        :options="modelOptions"
      />

      <div v-if="selectedModel === 'custom'" class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
        <FieldInput
          v-model="openaiImageModel"
          label="Custom Model Identifier"
          description="Enter a custom GPT Image model identifier supported by your endpoint."
          placeholder="gpt-image"
        />
      </div>

      <FieldSelect
        v-model="selectedResolution"
        label="Resolution & Aspect Ratio"
        description="Choose a preset aspect ratio (Square 1:1, Landscape 16:9, Portrait 9:16) or custom dimensions."
        :options="resolutionOptions"
      />

      <div v-if="selectedResolution === 'custom'" class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/30">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldInput
            v-model="widthDraft"
            type="number"
            :label="t('settings.pages.providers.provider.openai-image.dimensions.width')"
            :description="t('settings.pages.providers.provider.openai-image.dimensions.description')"
            :placeholder="t('settings.pages.providers.provider.openai-image.dimensions.placeholder')"
          />
          <FieldInput
            v-model="heightDraft"
            type="number"
            :label="t('settings.pages.providers.provider.openai-image.dimensions.height')"
            :placeholder="t('settings.pages.providers.provider.openai-image.dimensions.placeholder')"
          />
        </div>
        <Alert
          v-if="invalidDimensions"
          tone="warning"
          :title="t('settings.pages.providers.provider.openai-image.dimensions.invalid')"
        />
        <div class="flex justify-end">
          <Button
            variant="primary"
            :disabled="invalidDimensions || !dimensionsChanged"
            @click="saveDimensions"
          >
            {{ t('settings.pages.providers.provider.openai-image.dimensions.save') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.openai-image.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
