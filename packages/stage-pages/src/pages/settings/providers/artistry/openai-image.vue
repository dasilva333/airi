<script setup lang="ts">
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { Alert, Button, FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useArtistryStore()
const { openaiImageApiKey, openaiImageBaseUrl, openaiImageModel, openaiImageWidth, openaiImageHeight } = storeToRefs(store)

// Dimension edits stay local until a complete valid pair is explicitly saved.
const widthDraft = ref<string | number>(openaiImageWidth.value)
const heightDraft = ref<string | number>(openaiImageHeight.value)
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
})

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
      <FieldInput
        v-model="openaiImageModel"
        :label="t('settings.pages.providers.provider.openai-image.model.label')"
        :description="t('settings.pages.providers.provider.openai-image.model.description')"
        placeholder="gpt-image-2.6-sunburst"
      />
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
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.openai-image.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
