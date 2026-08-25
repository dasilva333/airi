<script setup lang="ts">
import { FieldSelect } from '@proj-airi/ui'
import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../stores/providers'

const props = defineProps<{
  providerId: string
  /** Currently active instance id; defaults to primary (`*`). */
  instanceId?: string
}>()

const model = defineModel<string>({ required: false, default: '' })

const { t } = useI18n()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const airiCardStore = useAiriCardStore()

const search = ref('')
const isSaved = ref(false)

const isLoading = computed(() => providersStore.isLoadingModels[props.providerId] || false)
const modelLoadError = computed(() => providersStore.modelLoadError[props.providerId] || null)

const availableModels = computed(() => {
  const models = providersStore.getModelsForProvider(props.providerId) ?? []
  return [...models].sort((a, b) => {
    const nameA = (a.name || a.id.split('/').pop() || a.id).toLowerCase()
    const nameB = (b.name || b.id.split('/').pop() || b.id).toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

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

// Favorites local storage sync
const favorites = useLocalStorage<Array<{ id: string, name: string, provider: string, model: string }>>('airi:chat-model-favorites', [])

function handleSaveAndActivate() {
  if (!model.value)
    return

  const targetInstanceId = props.instanceId || '*'
  const providerKey = targetInstanceId !== '*' ? `${props.providerId}:${targetInstanceId}` : props.providerId
  const providerMetadata = providersStore.getProviderMetadata(props.providerId)
  const baseName = providerMetadata?.name || providerMetadata?.localizedName || props.providerId
  const modelShortName = model.value.split('/').pop() || model.value

  // 1. Update runtime consciousness store
  consciousnessStore.activeProvider = providerKey
  consciousnessStore.activeModel = model.value

  // 2. Save into Favorites list if not present
  const existingIndex = favorites.value.findIndex(f => f.provider === providerKey && f.model === model.value)
  const favoriteName = `${baseName} (${modelShortName})`

  if (existingIndex >= 0) {
    favorites.value[existingIndex].name = favoriteName
  }
  else {
    favorites.value.push({
      id: String(Date.now()),
      name: favoriteName,
      provider: providerKey,
      model: model.value,
    })
  }

  // 3. Silently apply to active character card
  if (airiCardStore.activeCard) {
    airiCardStore.updateCard(airiCardStore.activeCardId, {
      extensions: {
        ...airiCardStore.activeCard.extensions,
        airi: {
          ...airiCardStore.activeCard.extensions?.airi,
          modules: {
            ...airiCardStore.activeCard.extensions?.airi?.modules,
            consciousness: {
              provider: providerKey,
              model: model.value,
            },
          },
        },
      },
    } as any)
  }

  isSaved.value = true
  setTimeout(() => {
    isSaved.value = false
  }, 2500)
}

function handleFetchModels() {
  void providersStore.fetchModelsForProvider(props.providerId, { instanceId: props.instanceId })
}

onMounted(() => {
  const targetInstanceId = props.instanceId || '*'
  const providerKey = targetInstanceId !== '*' ? `${props.providerId}:${targetInstanceId}` : props.providerId
  if (!model.value && (consciousnessStore.activeProvider === providerKey || consciousnessStore.activeProvider === props.providerId)) {
    model.value = consciousnessStore.activeModel
  }

  if ((providersStore.providerRuntimeState[props.providerId]?.models?.length ?? 0) === 0)
    handleFetchModels()
})

watch(() => props.instanceId, () => {
  handleFetchModels()
})

watch(
  () => {
    const cfg = providersStore.getProviderConfig(props.providerId)
    return `${cfg?.apiKey || ''}::${cfg?.baseUrl || ''}`
  },
  (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
      handleFetchModels()
    }
  },
)
</script>

<script lang="ts">
export default { name: 'ProviderModelBrowser' }
</script>

<template>
  <div flex="~ col gap-3" class="border border-neutral-200/80 rounded-2xl bg-white/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
    <div class="flex items-center justify-between">
      <div class="text-xs text-neutral-400 font-bold tracking-wider uppercase">
        {{ t('settings.pages.providers.common.section.modelBrowser.title') }}
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="isLoading"
          class="h-7 inline-flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 text-[11px] text-neutral-600 font-medium transition dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 disabled:opacity-50 dark:hover:bg-neutral-700"
          title="Refresh model list from provider"
          @click="handleFetchModels"
        >
          <div :class="isLoading ? 'i-svg-spinners:ring-resize text-primary-500' : 'i-solar:refresh-line-duotone'" class="text-xs" />
          <span>{{ isLoading ? 'Loading...' : 'Refresh' }}</span>
        </button>

        <button
          v-if="model"
          type="button"
          class="h-7 inline-flex items-center gap-1.5 rounded-lg bg-primary-500/10 px-2.5 text-[11px] text-primary-600 font-semibold transition-all active:scale-95 dark:bg-primary-500/20 hover:bg-primary-500/20 dark:text-primary-300"
          @click="handleSaveAndActivate"
        >
          <div :class="isSaved ? 'i-solar:check-circle-bold-duotone text-emerald-500' : 'i-solar:star-bold-duotone text-primary-500'" class="text-xs" />
          <span>{{ isSaved ? 'Saved & Applied to Character!' : 'Save & Set Active' }}</span>
        </button>
      </div>
    </div>

    <!-- Error Alert Banner -->
    <div v-if="modelLoadError" class="flex items-center gap-2 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
      <div class="i-solar:danger-triangle-bold shrink-0 text-sm" />
      <span>{{ modelLoadError }}</span>
    </div>

    <FieldSelect
      v-model="model"
      :options="options"
      :label="t('settings.pages.providers.common.section.modelBrowser.label')"
      :description="t('settings.pages.providers.common.section.modelBrowser.description')"
      :placeholder="isLoading ? 'Fetching live models...' : (options.length > 0 ? t('settings.pages.providers.common.section.modelBrowser.placeholder') : 'No models loaded. Check API Key or click Refresh.')"
      layout="vertical"
    />
  </div>
</template>
