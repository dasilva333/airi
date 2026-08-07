<script setup lang="ts">
import { FieldSelect } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useProvidersStore } from '../../../stores/providers'

const props = defineProps<{
  providerId: string
  /** Currently active instance id; defaults to primary (`*`). */
  instanceId?: string
}>()

const model = defineModel<string>({ required: false, default: '' })

const { t } = useI18n()
const providersStore = useProvidersStore()

const search = ref('')

const availableModels = computed(() =>
  providersStore.getModelsForProvider(props.providerId) ?? [],
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return availableModels.value
  return availableModels.value.filter(m =>
    m.id.toLowerCase().includes(q)
    || (m.name ?? '').toLowerCase().includes(q),
  )
})

const options = computed(() => filtered.value.map(m => ({ value: m.id, label: m.name || m.id })))

// TODO(phase4-model-browser): render a "Refresh" action that re-calls fetchModelsForProvider
onMounted(() => {
  if ((providersStore.providerRuntimeState[props.providerId]?.models?.length ?? 0) === 0)
    void providersStore.fetchModelsForProvider(props.providerId, { instanceId: props.instanceId })
})

watch(() => props.instanceId, () => {
  void providersStore.fetchModelsForProvider(props.providerId, { instanceId: props.instanceId })
})
</script>

<script lang="ts">
export default { name: 'ProviderModelBrowser' }
</script>

<template>
  <div flex="~ col gap-2">
    <div class="text-sm text-neutral-500 font-medium dark:text-neutral-400">
      {{ t('settings.pages.providers.common.section.modelBrowser.title') }}
    </div>
    <FieldSelect
      v-model="model"
      :options="options"
      :label="t('settings.pages.providers.common.section.modelBrowser.label')"
      :description="t('settings.pages.providers.common.section.modelBrowser.description')"
      :placeholder="t('settings.pages.providers.common.section.modelBrowser.placeholder')"
      layout="vertical"
    />
  </div>
</template>
