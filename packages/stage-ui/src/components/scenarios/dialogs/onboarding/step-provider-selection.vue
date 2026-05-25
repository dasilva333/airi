<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProviderMetadata } from '../../../../stores/providers'
import { RadioCardDetail } from '../../../menu'
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

interface Props {
  availableProviders: ProviderMetadata[]
  selectedProviderId: string
  onSelectProvider: (provider: ProviderMetadata) => void
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}

const props = defineProps<Props>()
const { t } = useI18n()

const deploymentFilter = ref<'all' | 'local' | 'cloud'>('all')
const pricingFilter = ref<'all' | 'free' | 'paid'>('all')

const filteredProviders = computed(() => {
  return props.availableProviders.filter((p) => {
    const matchDeployment = deploymentFilter.value === 'all' || p.deployment === deploymentFilter.value
    const matchPricing = pricingFilter.value === 'all' || p.pricing === pricingFilter.value
    return matchDeployment && matchPricing
  })
})

const selectedProviderIdModel = computed({
  get: () => props.selectedProviderId,
  set: (providerId: string) => {
    const provider = props.availableProviders.find((item) => item.id === providerId)
    if (provider) props.onSelectProvider(provider)
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
  <div h-full flex flex-col gap-4 overflow-hidden>
    <div sticky top-0 z-100 flex flex-shrink-0 items-center gap-2>
      <button outline-none @click="props.onPrevious">
        <div class="i-solar:alt-arrow-left-line-duotone h-5 w-5" />
      </button>
      <h2 class="flex-1 text-center text-xl text-neutral-800 font-semibold md:text-left md:text-2xl dark:text-neutral-100">
        {{ t('settings.dialogs.onboarding.selectProvider') }}
      </h2>
      <div class="h-5 w-5" />
    </div>

    <div flex flex-col gap-3 px-1>
      <!-- Filters -->
      <div flex flex-wrap items-center gap-x-6 gap-y-3>
        <!-- Deployment Filter -->
        <div flex flex-col gap-1.5>
          <span text-xs text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400>Deployment</span>
          <div flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800>
            <button
              v-for="opt in deploymentOptions"
              :key="opt.value"
              rounded-md px-3 py-1 text-xs font-medium transition-all
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

        <!-- Pricing Filter -->
        <div flex flex-col gap-1.5>
          <span text-xs text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400>Pricing</span>
          <div flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800>
            <button
              v-for="opt in pricingOptions"
              :key="opt.value"
              rounded-md px-3 py-1 text-xs font-medium transition-all
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
    </div>

    <div class="flex-1 overflow-y-auto px-1">
      <div v-if="filteredProviders.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RadioCardDetail
          v-for="provider in filteredProviders"
          :id="provider.id"
          :key="provider.id"
          v-model="selectedProviderIdModel"
          name="provider-selection"
          :value="provider.id"
          :title="provider.localizedName || provider.id"
          :description="provider.localizedDescription || ''"
          :pricing="provider.pricing"
          :deployment="provider.deployment"
          :beginner-recommended="provider.beginnerRecommended"
          @click="props.onSelectProvider(provider)"
        />
      </div>
      <div v-else h-40 flex flex-col items-center justify-center gap-2 text-neutral-500>
        <div class="i-solar:shield-warning-line-duotone h-10 w-10 opacity-50" />
        <span text-sm italic>No providers match your current filters.</span>
        <button text-xs underline @click="deploymentFilter = 'all'; pricingFilter = 'all'">
          Clear filters
        </button>
      </div>
    </div>

    <Button
      :label="t('settings.dialogs.onboarding.next')"
      :disabled="!selectedProviderIdModel"
      @click="props.onNext"
    />
  </div>
</template>
