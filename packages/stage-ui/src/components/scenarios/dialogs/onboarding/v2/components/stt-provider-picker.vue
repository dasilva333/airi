<script setup lang="ts">
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { computed, ref } from 'vue'

import { RadioCardDetail } from '../../../../../menu'

// V2 onboarding — reusable provider grid + filter primitive, lifted from
// step-provider-selection.vue but driven by an injected provider list so it can
// be pointed at the transcription catalog instead of chat providers.
const props = defineProps<{
  providers: ProviderMetadata[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void
  (e: 'select', provider: ProviderMetadata): void
}>()

const deploymentFilter = ref<'all' | 'local' | 'cloud'>('all')
const pricingFilter = ref<'all' | 'free' | 'paid'>('all')

const filteredProviders = computed(() => {
  return props.providers.filter((p) => {
    const matchDeployment = deploymentFilter.value === 'all' || p.deployment === deploymentFilter.value
    const matchPricing = pricingFilter.value === 'all' || p.pricing === pricingFilter.value
    return matchDeployment && matchPricing
  })
})

const selectedIdModel = computed({
  get: () => props.modelValue,
  set: (id: string) => {
    const provider = props.providers.find(item => item.id === id)
    emit('update:modelValue', id)
    if (provider)
      emit('select', provider)
  },
})

const deploymentOptions = [
  { label: 'All', value: 'all' },
  { label: 'Cloud', value: 'cloud' },
  { label: 'Local', value: 'local' },
] as const

const pricingOptions = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' },
] as const
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Deployment / Pricing filters -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">Deployment</span>
        <div class="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            v-for="opt in deploymentOptions"
            :key="opt.value"
            class="rounded-md px-3 py-1 text-xs font-medium transition-all"
            :class="[
              deploymentFilter === opt.value
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
            ]"
            @click="deploymentFilter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">Pricing</span>
        <div class="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            v-for="opt in pricingOptions"
            :key="opt.value"
            class="rounded-md px-3 py-1 text-xs font-medium transition-all"
            :class="[
              pricingFilter === opt.value
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
            ]"
            @click="pricingFilter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Provider grid -->
    <div v-if="filteredProviders.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <RadioCardDetail
        v-for="provider in filteredProviders"
        :id="provider.id"
        :key="provider.id"
        v-model="selectedIdModel"
        name="onboarding-v2-stt-provider"
        :value="provider.id"
        :title="provider.localizedName || provider.name || provider.id"
        :description="provider.localizedDescription || provider.description || ''"
        :pricing="provider.pricing"
        :deployment="provider.deployment"
        :beginner-recommended="provider.beginnerRecommended"
      />
    </div>
    <div v-else class="h-28 flex flex-col items-center justify-center gap-2 text-neutral-500">
      <div class="i-solar:shield-warning-line-duotone h-8 w-8 opacity-50" />
      <span class="text-sm italic">No providers match your current filters.</span>
      <button class="text-xs underline" @click="deploymentFilter = 'all'; pricingFilter = 'all'">
        Clear filters
      </button>
    </div>
  </div>
</template>
