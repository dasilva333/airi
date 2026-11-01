<script setup lang="ts">
import type { ConsciousnessConfig } from './useConsciousnessConfig'

import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

import ProviderPickerGrid from '../dialogs/onboarding/v3/components/provider-picker-grid.vue'

import { BrainModelPicker } from '../chat'

const props = defineProps<{
  config: ConsciousnessConfig
}>()

const { t } = useI18n()
const { config } = props
</script>

<template>
  <div :class="['flex flex-col gap-4 min-w-0']">
    <!-- Saved brains compact row -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 8 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="100"
      :class="[
        'rounded-[20px] border p-4 sm:p-5 flex flex-col gap-3',
        'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
      ]"
    >
      <div :class="['flex items-center gap-3']">
        <span :class="['text-sm font-semibold text-neutral-700 dark:text-neutral-200 whitespace-nowrap flex-shrink-0']">
          {{ t('onboarding.steps.consciousness.savedBrains') }}
        </span>
        <div :class="['flex-1 min-w-0']">
          <BrainModelPicker
            v-model:provider="config.selectedProviderId.value"
            v-model:model="config.selectedModelId.value"
            variant="button"
            :title="t('onboarding.steps.consciousness.selectConsciousnessLlm')"
            side="bottom"
            class="w-full"
          />
          <p v-if="!(config.configuredChatProvidersMetadata.value.length > 0 || config.selectedProviderId.value)" :class="['mt-1 text-[11px] text-neutral-400']">
            {{ t('onboarding.steps.consciousness.noSavedBrains') }}
          </p>
        </div>
      </div>

      <!-- Route selector: three mutually exclusive segments -->
      <div class="flex items-center gap-1 rounded-xl bg-neutral-200/50 p-1 backdrop-blur-md dark:bg-neutral-800/50">
        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
            config.activeTab.value === 'free'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="config.activeTab.value = 'free'"
        >
          <div class="i-solar:cloud-bold-duotone h-4 w-4" />
          <span>{{ t('onboarding.steps.consciousness.freeCloudAi') }}</span>
          <span class="rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[9px] text-amber-600 font-bold hidden sm:inline-block dark:text-amber-400">{{ t('onboarding.steps.consciousness.noSetup') }}</span>
        </button>

        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
            config.activeTab.value === 'local'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="config.activeTab.value = 'local'"
        >
          <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4" />
          <span>{{ t('onboarding.steps.consciousness.localOnDevice') }}</span>
          <span class="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] text-emerald-600 font-bold hidden sm:inline-block dark:text-emerald-400">{{ t('onboarding.steps.consciousness.offline') }}</span>
        </button>

        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
            config.activeTab.value === 'custom'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="config.activeTab.value = 'custom'"
        >
          <div class="i-solar:key-minimalistic-square-bold-duotone h-4 w-4" />
          <span>{{ t('onboarding.steps.consciousness.customApiKey') }}</span>
        </button>
      </div>
    </div>

    <!-- Route content -->
    <div :class="['flex flex-col gap-4 min-w-0']">
      <!-- FREE CLOUD ROUTE -->
      <div v-if="config.activeTab.value === 'free'" class="min-w-0 flex flex-col gap-4">
        <!-- Cloudflare Workers AI -->
        <div class="flex flex-col gap-3 border border-neutral-200/60 rounded-[20px] bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex items-center gap-2">
              <div class="i-simple-icons:cloudflare h-4.5 w-4.5 flex-shrink-0 text-[#F38020]" />
              <span class="truncate text-xs text-neutral-700 font-bold tracking-wider uppercase dark:text-neutral-300">Cloudflare Workers AI</span>
            </div>
            <div class="flex flex-shrink-0 items-center gap-1.5">
              <span v-if="config.isCloudflareConnected.value" class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {{ t('onboarding.steps.consciousness.connected') }}
              </span>
              <span v-else class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
                {{ t('onboarding.steps.consciousness.zeroTrustOauth') }}
              </span>
            </div>
          </div>

          <template v-if="config.isCloudflareConnected.value">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="preset in config.cloudflarePresets"
                :key="preset.id"
                type="button"
                :class="[
                  'relative flex items-start gap-3 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer min-h-[44px]',
                  config.selectedProviderId.value === 'cloudflare-workers-ai' && config.selectedModelId.value === preset.id
                    ? 'border-primary-500 bg-primary-500/5 shadow-md shadow-primary-500/10 dark:border-primary-400'
                    : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/80 dark:bg-neutral-900/50 hover:border-primary-500/40',
                ]"
                @click="config.selectCloudflareModel(preset.id)"
              >
                <div
                  :class="[
                    'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    config.selectedProviderId.value === 'cloudflare-workers-ai' && config.selectedModelId.value === preset.id
                      ? 'bg-primary-500/15 text-primary-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500',
                  ]"
                >
                  <div class="i-solar:bolt-bold-duotone h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
                    <span class="flex-shrink-0 rounded bg-primary-500/10 px-1.5 py-0.2 text-[9px] text-primary-600 font-bold dark:text-primary-400">
                      {{ preset.badgeKey ? t(preset.badgeKey) : (preset.badge || '') }}
                    </span>
                  </div>
                  <p class="line-clamp-1 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ preset.descriptionKey ? t(preset.descriptionKey) : (preset.description || '') }}
                  </p>
                </div>
              </button>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1 text-[11px] text-neutral-400">
              <span class="min-w-0 truncate"><i18n-t scope="global" keypath="onboarding.steps.consciousness.connectedAccountSummary" tag="span"><template #account><span class="text-neutral-600 font-mono dark:text-neutral-300">{{ config.cloudflareStore.activeAccountId }}</span></template></i18n-t></span>
              <button
                type="button"
                class="flex-shrink-0 cursor-pointer text-primary-500 hover:underline"
                @click="config.isConnectModalOpen.value = true"
              >
                {{ t('onboarding.steps.consciousness.switchAccount') }}
              </button>
            </div>
          </template>

          <template v-else>
            <div class="flex flex-col gap-3 border border-amber-500/20 rounded-xl bg-amber-500/5 p-3.5">
              <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
                {{ t('onboarding.steps.consciousness.connectYourCloudflareAccountToUnlockHighSpeedLlama3370bDeepseekR1') }}
              </p>
              <div class="flex items-center gap-2">
                <Button
                  variant="primary"
                  class="h-[44px] flex cursor-pointer items-center gap-1.5 px-4 text-sm font-medium"
                  @click="config.isConnectModalOpen.value = true"
                >
                  <div class="i-simple-icons:cloudflare text-sm" />
                  <span>{{ t('onboarding.steps.consciousness.connectCloudflareAccount') }}</span>
                </Button>
              </div>
            </div>
          </template>
        </div>

        <!-- LanLan Free (StepFun) -->
        <div class="flex flex-col gap-3 border border-neutral-200/60 rounded-[20px] bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex items-center gap-2">
              <div class="i-solar:cloud-bold h-4.5 w-4.5 flex-shrink-0 text-cyan-500" />
              <span class="truncate text-xs text-neutral-700 font-bold tracking-wider uppercase dark:text-neutral-300">LanLan Free (StepFun)</span>
            </div>
            <span class="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
              100% Free · No Sign-in
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="preset in config.lanlanFreePresets"
              :key="preset.id"
              type="button"
              :class="[
                'relative flex flex-col gap-1 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer min-h-[44px]',
                config.selectedProviderId.value === 'lanlan-free' && config.selectedModelId.value === preset.id
                  ? 'border-primary-500 bg-primary-500/5 shadow-md shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/80 dark:bg-neutral-900/50 hover:border-primary-500/40',
              ]"
              @click="config.selectLanlanFreeModel(preset.id)"
            >
              <div class="flex items-center justify-between gap-1">
                <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
                <span class="flex-shrink-0 rounded bg-cyan-500/10 px-1.5 py-0.2 text-[9px] text-cyan-600 font-bold dark:text-cyan-400">
                  {{ preset.badge }}
                </span>
              </div>
              <p class="line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ preset.description }}
              </p>
            </button>
          </div>
        </div>

        <!-- Kilo Gateway -->
        <div class="flex flex-col gap-3 border border-neutral-200/60 rounded-[20px] bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex items-center gap-2">
              <div class="i-solar:code-bold h-4.5 w-4.5 flex-shrink-0 text-emerald-500" />
              <span class="truncate text-xs text-neutral-700 font-bold tracking-wider uppercase dark:text-neutral-300">Kilo Free Gateway</span>
            </div>
            <span class="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
              Free AI Gateway · Keyless
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              v-for="preset in config.kiloPresets"
              :key="preset.id"
              type="button"
              :class="[
                'relative flex flex-col gap-1 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer min-h-[44px]',
                config.selectedProviderId.value === 'kilo' && config.selectedModelId.value === preset.id
                  ? 'border-primary-500 bg-primary-500/5 shadow-md shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/80 dark:bg-neutral-900/50 hover:border-primary-500/40',
              ]"
              @click="config.selectKiloModel(preset.id)"
            >
              <div class="flex items-center justify-between gap-1">
                <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
                <span v-if="preset.badge" class="flex-shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] text-emerald-600 font-bold dark:text-emerald-400">
                  {{ preset.badge }}
                </span>
              </div>
              <p class="line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ preset.description }}
              </p>
            </button>
          </div>
        </div>

        <!-- Pollinations AI -->
        <div class="flex flex-col gap-3 border border-neutral-200/60 rounded-[20px] bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40 sm:p-5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex items-center gap-2">
              <div class="i-solar:magic-stick-3-bold-duotone h-4.5 w-4.5 flex-shrink-0 text-purple-500" />
              <span class="truncate text-xs text-neutral-700 font-bold tracking-wider uppercase dark:text-neutral-300">Pollinations AI</span>
            </div>
            <span class="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
              {{ t('onboarding.steps.consciousness.100FreeNoSignIn') }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              v-for="preset in config.pollinationsPresets"
              :key="preset.id"
              type="button"
              :class="[
                'relative flex flex-col gap-1 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer min-h-[44px]',
                config.selectedProviderId.value === 'pollinations' && config.selectedModelId.value === preset.id
                  ? 'border-primary-500 bg-primary-500/5 shadow-md shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/80 dark:bg-neutral-900/50 hover:border-primary-500/40',
              ]"
              @click="config.selectPollinationsModel(preset.id)"
            >
              <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
              <p class="line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ preset.descriptionKey ? t(preset.descriptionKey) : (preset.description || '') }}
              </p>
            </button>
          </div>

          <p :class="['flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500']">
            <span :class="['i-solar:info-circle-linear text-sm flex-shrink-0']" />
            <span>{{ t('onboarding.steps.consciousness.moreModelsInSettings') }}</span>
          </p>
        </div>
      </div>

      <!-- LOCAL ON-DEVICE ROUTE -->
      <div v-if="config.activeTab.value === 'local'" class="min-w-0 flex flex-col gap-4">
        <!-- Apple Core AI Local Engine (iOS Native) -->
        <div
          v-if="config.isIOSNative.value"
          :class="['p-4 sm:p-5 rounded-[20px]', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']"
        >
          <div class="flex items-center gap-2">
            <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4 text-primary-500" />
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">{{ t('onboarding.steps.consciousness.appleCoreAiNeuralEngine') }}</span>
            <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">{{ t('onboarding.steps.consciousness.aneAccelerated100Offline') }}</span>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button
              type="button"
              :class="[
                'relative flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300 cursor-pointer min-h-[44px]',
                config.selectedProviderId.value === 'apple-core-ai'
                  ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
              ]"
              @click="config.selectCoreAiModel"
            >
              <div
                class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl"
                :class="[config.selectedProviderId.value === 'apple-core-ai' ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
              >
                <div class="i-solar:cpu-bolt-bold-duotone h-6 w-6" :class="config.selectedProviderId.value === 'apple-core-ai' ? 'text-primary-500' : 'text-neutral-500'" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ t('onboarding.steps.consciousness.gemma4E2bItSpeculativeCoreml') }}</span>
                  <span class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
                    {{ t('onboarding.steps.consciousness.recommendedOnDevice') }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('onboarding.steps.consciousness.highSpeedNeuralDialogueOnAppleNeuralEngine45TokS100OfflinePrivate') }}
                </p>
              </div>
              <span class="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                {{ t('onboarding.steps.consciousness.14GbRam') }}
              </span>
            </button>
          </div>

          <!-- Core AI In-Context Download & Action Controls -->
          <div v-if="config.selectedProviderId.value === 'apple-core-ai'" class="flex flex-col gap-2.5 border border-neutral-200/60 rounded-xl bg-white/40 p-3.5 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1 flex-col">
                <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ t('onboarding.steps.consciousness.selectedGemma4E2bItSpeculativeCoreml') }}
                </span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {{ config.coreAiState.value === 'ready' ? t('onboarding.steps.consciousness.modelIsCompiledAndReadyToThinkOnAppleNeuralEngine') : (config.coreAiState.value === 'downloading' ? t('onboarding.steps.consciousness.downloadingCoremlWeightBundleAndCompilingOnDevice') : t('onboarding.steps.consciousness.clickToDownloadAndCompileModelOnAppleNeuralEngine')) }}
                </span>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-shrink-0 items-center gap-2">
                <Button
                  v-if="config.coreAiState.value === 'idle'"
                  variant="primary"
                  class="h-[44px] flex cursor-pointer items-center gap-1.5 px-3.5 text-sm font-medium"
                  @click="config.startCoreAiDownload"
                >
                  <div class="i-solar:cloud-download-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.downloadCompile') }}</span>
                </Button>

                <div
                  v-else-if="config.coreAiState.value === 'ready'"
                  class="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 font-bold dark:text-emerald-400"
                >
                  <div class="i-solar:check-circle-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.activeReady') }}</span>
                </div>

                <Button
                  v-else-if="config.coreAiState.value === 'error'"
                  variant="primary"
                  class="h-[44px] flex cursor-pointer items-center gap-1.5 px-3.5 text-sm font-medium"
                  @click="config.startCoreAiDownload"
                >
                  <div class="i-solar:restart-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.retryDownload') }}</span>
                </Button>
              </div>
            </div>

            <!-- Download progress bar -->
            <div v-if="config.coreAiState.value === 'downloading'" class="flex flex-col gap-1.5 pt-1">
              <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span class="truncate">{{ config.coreAiStatusText.value }}</span>
                <span class="font-bold font-mono">{{ Math.floor(config.coreAiProgress.value) }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${config.coreAiProgress.value}%` }" />
              </div>
            </div>

            <!-- Error message -->
            <div v-if="config.coreAiState.value === 'error' && config.coreAiErrorMessage.value" class="break-all text-[11px] text-red-600/80 dark:text-red-400/80">
              {{ config.coreAiErrorMessage.value }}
            </div>

            <!-- Warmup notice -->
            <div class="flex items-start gap-2.5 border border-amber-500/20 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              <div class="i-solar:hourglass-line-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <div class="min-w-0 flex-1 space-y-0.5">
                <span class="font-bold">{{ t('onboarding.steps.consciousness.firstLaunchOnDeviceWarmupNotice') }}</span>
                <p class="text-[11px] text-amber-800/90 leading-relaxed dark:text-amber-300/90">
                  <i18n-t scope="global" keypath="onboarding.steps.consciousness.firstLaunchNotice" tag="span">
                    <template #emphasis>
                      <strong>{{ t('onboarding.steps.consciousness.6090Seconds') }}</strong>
                    </template>
                  </i18n-t>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- WebGPU warning when local engine unavailable (Desktop/Web only) -->
        <div
          v-if="config.isWebLlmPlatform.value && !config.webgpuSupported.value"
          class="flex flex-shrink-0 items-start gap-2 border border-amber-300/60 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <div class="i-solar:danger-triangle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{{ t('onboarding.steps.consciousness.webgpuIsnTAvailableInThisBrowserPickAFreeOrCloudProviderBelowEG') }}</span>
        </div>

        <!-- WebGPU FP32 Universal notice when shader-f16 is missing (Desktop/Web only) -->
        <div
          v-else-if="config.isWebLlmPlatform.value && config.webgpuSupported.value && !config.fp16Supported.value"
          class="flex flex-shrink-0 items-start gap-2 border border-blue-400/40 rounded-xl bg-blue-50/80 p-3 text-xs text-blue-900 dark:border-blue-700/60 dark:bg-blue-900/20 dark:text-blue-200"
        >
          <div class="i-solar:info-circle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <i18n-t scope="global" keypath="onboarding.steps.consciousness.legacyGpuNotice" tag="span">
            <template #code>
              <code>shader-f16</code>
            </template>
          </i18n-t>
        </div>

        <!-- WebLLM Local Engine (Desktop / Web only) -->
        <div
          v-if="config.isWebLlmPlatform.value"
          :class="['p-4 sm:p-5 rounded-[20px]', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3', !config.webgpuSupported.value ? 'opacity-60' : '']"
        >
          <div class="flex items-center gap-2">
            <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4 text-primary-500" />
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">{{ t('onboarding.steps.consciousness.localWebllmWebgpuEngine') }}</span>
            <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">{{ t('onboarding.steps.consciousness.offlineLocal') }}</span>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button
              v-for="model in config.availableWebLlmModels.value"
              :key="model.id"
              type="button"
              :disabled="!config.webgpuSupported.value"
              :class="[
                'relative flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300 cursor-pointer min-h-[44px]',
                config.selectedProviderId.value === 'web-llm' && config.selectedLlmModel.value === model.id
                  ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
                !config.webgpuSupported.value ? 'cursor-not-allowed opacity-50' : '',
              ]"
              @click="config.selectWebLlmModel(model.id)"
            >
              <div
                class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl"
                :class="[config.selectedProviderId.value === 'web-llm' && config.selectedLlmModel.value === model.id ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
              >
                <div class="i-solar:cpu-bolt-bold-duotone h-6 w-6" :class="config.selectedProviderId.value === 'web-llm' && config.selectedLlmModel.value === model.id ? 'text-primary-500' : 'text-neutral-500'" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ model.name }}</span>
                  <span
                    v-if="model.id === 'Qwen3.5-4B-q4f16_1-MLC' || (!config.fp16Supported.value && model.id === 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC')"
                    class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400"
                  >
                    {{ t('onboarding.steps.consciousness.recommended') }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {{ model.descriptionKey ? t(model.descriptionKey) : (model.description || '') }}
                </p>
              </div>
              <span class="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                {{ t('onboarding.steps.consciousness.localModels.vram', { toFixed1: (model.vramMB / 1024).toFixed(1) }) }}
              </span>
            </button>
          </div>

          <!-- In-context download & action controls -->
          <div v-if="config.selectedProviderId.value === 'web-llm'" class="flex flex-col gap-2.5 border border-neutral-200/60 rounded-xl bg-white/40 p-3.5 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex flex-1 flex-col">
                <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ t('onboarding.steps.consciousness.localModels.selected', { name: config.availableWebLlmModels.value.find((m: any) => m.id === config.selectedLlmModel.value)?.name }) }}
                </span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {{ config.downloadState.value === 'ready' ? t('onboarding.steps.consciousness.modelIsDownloadedAndReadyToThink') : (config.downloadState.value === 'downloading' ? t('onboarding.steps.consciousness.downloadingModelShardsIntoBrowserCache') : t('onboarding.steps.consciousness.clickToDownloadAndActivateThisModelLocallyOnWebgpu')) }}
                </span>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-shrink-0 items-center gap-2">
                <Button
                  v-if="config.downloadState.value === 'idle'"
                  variant="primary"
                  class="h-[44px] flex cursor-pointer items-center gap-1.5 px-3.5 text-sm font-medium"
                  :disabled="!config.webgpuSupported.value"
                  @click="config.startWebLlmDownload"
                >
                  <div class="i-solar:cloud-download-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.downloadActivate') }}</span>
                </Button>

                <Button
                  v-else-if="config.downloadState.value === 'downloading'"
                  variant="secondary"
                  class="h-[44px] flex cursor-pointer items-center gap-1.5 px-3 text-sm font-medium"
                  @click="config.cancelWebLlmDownload"
                >
                  <div class="i-solar:close-circle-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.provider.cancel') }}</span>
                </Button>

                <div
                  v-else-if="config.downloadState.value === 'ready'"
                  class="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 font-bold dark:text-emerald-400"
                >
                  <div class="i-solar:check-circle-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.activeReady') }}</span>
                </div>

                <Button
                  v-else-if="config.downloadState.value === 'error'"
                  variant="primary"
                  class="h-[44px] flex cursor-pointer items-center gap-1.5 px-3.5 text-sm font-medium"
                  @click="config.startWebLlmDownload"
                >
                  <div class="i-solar:restart-bold-duotone text-base" />
                  <span>{{ t('onboarding.steps.consciousness.retryDownload') }}</span>
                </Button>
              </div>
            </div>

            <!-- Download progress bar -->
            <div v-if="config.downloadState.value === 'downloading'" class="flex flex-col gap-1.5 pt-1">
              <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span class="truncate">{{ config.downloadStatusText.value }}</span>
                <span class="font-bold font-mono">{{ Math.floor(config.downloadProgress.value) }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${config.downloadProgress.value}%` }" />
              </div>
            </div>

            <!-- Error message -->
            <div v-if="config.downloadState.value === 'error' && config.downloadErrorMessage.value" class="break-all text-[11px] text-red-600/80 dark:text-red-400/80">
              {{ config.downloadErrorMessage.value }}
            </div>
          </div>
        </div>
      </div>

      <!-- CUSTOM API KEY ROUTE -->
      <div v-if="config.activeTab.value === 'custom'" class="min-w-0 flex flex-col gap-4">
        <!-- Cloud / Local Provider Matrix -->
        <div :class="['p-4 sm:p-5 rounded-[20px]', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">{{ t('onboarding.steps.consciousness.chooseAnAiBrainProvider') }}</span>
            <span class="flex-shrink-0 text-[10px] text-neutral-400">{{ t('onboarding.steps.consciousness.alphabeticalTapToSelect') }}</span>
          </div>
          <ProviderPickerGrid
            :model-value="config.selectedProviderId.value"
            :providers="config.allChatProvidersMetadata.value"
            @select="config.onSelectProvider"
            @update:model-value="(id: string) => { config.selectedProviderId.value = id }"
          />
        </div>

        <!-- Action Anchor -->
        <div ref="config.actionTargetRef" class="flex flex-col scroll-mt-4 gap-3">
          <!-- Streamlined Inline Credentials Card -->
          <div
            v-if="config.inlineConfigProvider.value"
            class="border border-neutral-200/60 rounded-[20px] bg-white/70 p-4 shadow-sm backdrop-blur-md space-y-3 dark:border-neutral-800/80 dark:bg-neutral-900/70 sm:p-5"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex items-center gap-2.5">
                <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
                  <div :class="[config.inlineConfigProvider.value.iconColor || config.inlineConfigProvider.value.icon || 'i-solar:shield-keyhole-bold-duotone', 'h-5 w-5']" />
                </div>
                <div class="min-w-0">
                  <h4 class="truncate text-sm text-neutral-800 font-bold dark:text-neutral-100">
                    {{ t('onboarding.steps.consciousness.provider.configure', { name: config.inlineConfigProvider.value.name }) }}
                  </h4>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ t('onboarding.steps.consciousness.enterYourApiCredentialsToLoadAiModels') }}
                  </p>
                </div>
              </div>

              <a
                v-if="config.inlineConfigProvider.value.consoleUrl"
                :href="config.inlineConfigProvider.value.consoleUrl"
                target="_blank"
                class="flex flex-shrink-0 items-center gap-1 text-[11px] text-primary-500 font-semibold hover:underline"
              >
                <span>{{ t('onboarding.steps.consciousness.getKey') }}</span>
                <div class="i-solar:square-top-down-bold h-3.5 w-3.5" />
              </a>
            </div>

            <!-- API Key Field -->
            <div class="space-y-1.5">
              <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                {{ t('onboarding.steps.consciousness.apiKey') }}
                <span v-if="!config.keyIsOptional.value" class="text-red-500">*</span>
                <span v-else class="ml-1 text-neutral-400 font-normal">(optional)</span>
              </label>
              <p v-if="config.keyIsOptional.value && config.inlineConfigProvider.value" class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                {{ config.inlineConfigProvider.value.name }} works without a key. Add one to unlock paid models and higher quotas.
              </p>
              <div class="relative flex items-center">
                <input
                  v-model="config.apiKeyInput.value"
                  :type="config.showApiKey.value ? 'text' : 'password'"
                  :placeholder="config.getApiKeyPlaceholder(config.inlineConfigProvider.value.id)"
                  class="min-h-[44px] w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 pr-10 text-sm text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
                  @keydown.enter="config.saveAndConnectInline"
                >
                <button
                  type="button"
                  class="absolute right-2.5 cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  @click="config.showApiKey.value = !config.showApiKey.value"
                >
                  <div :class="config.showApiKey.value ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold'" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Collapsible Base URL -->
            <div class="space-y-1">
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                @click="config.showBaseUrl.value = !config.showBaseUrl.value"
              >
                <div :class="config.showBaseUrl.value ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone'" class="h-3.5 w-3.5" />
                <span>{{ t('onboarding.steps.consciousness.advancedCustomBaseUrl') }}</span>
              </button>
              <div v-if="config.showBaseUrl.value" class="pt-1">
                <input
                  v-model="config.baseUrlInput.value"
                  type="text"
                  placeholder="https://api.example.com/v1"
                  class="min-h-[44px] w-full border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-sm text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
                >
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                class="min-h-[44px] cursor-pointer border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-600 font-semibold dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @click="config.handleCancelConfig"
              >
                {{ t('onboarding.steps.consciousness.provider.cancel') }}
              </button>
              <button
                type="button"
                :disabled="(config.keyIsOptional.value ? false : !config.apiKeyInput.value.trim()) || config.isSavingConfig.value"
                class="min-h-[44px] flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs text-white font-bold shadow-md transition active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
                @click="config.saveAndConnectInline"
              >
                <div v-if="config.isSavingConfig.value" class="i-solar:restart-square-bold h-3.5 w-3.5 animate-spin" />
                <span>{{ config.isSavingConfig.value ? t('onboarding.steps.consciousness.connecting') : (config.keyIsOptional.value && !config.apiKeyInput.value.trim() ? 'Continue without key' : t('onboarding.steps.consciousness.saveConnect')) }}</span>
              </button>
            </div>
          </div>

          <!-- Model Selection -->
          <div
            v-if="config.selectedProviderId.value !== 'web-llm' && config.selectedProviderId.value !== 'apple-core-ai' && config.selectedProviderId.value && (config.isProviderConfigured.value || (config.selectedChatProvider.value && config.keyIsOptional.value))"
            :class="['p-4 sm:p-5 rounded-[20px]', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md space-y-4']"
          >
            <!-- Section Header -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-neutral-500 font-bold uppercase dark:text-neutral-400">{{ t('onboarding.steps.consciousness.model') }}</span>
              <span v-if="config.selectedChatProvider.value" class="truncate text-[11px] text-neutral-400 font-semibold">
                {{ config.selectedChatProvider.value.name }}
              </span>
            </div>

            <!-- Selected Model Input Box -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                  {{ t('onboarding.steps.consciousness.activeModelId') }} <span class="text-red-500">*</span>
                </label>
                <span class="text-[10px] text-neutral-400">{{ t('onboarding.steps.consciousness.typeDirectlyOrPickBelow') }}</span>
              </div>
              <input
                v-model="config.selectedModelId.value"
                type="text"
                :placeholder="t('onboarding.steps.consciousness.eGGemini25FlashGpt4oMiniMistralLargeLatest')"
                class="min-h-[44px] w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-sm text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
              >
            </div>

            <!-- Models Dropdown + Get Models Trigger -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                  {{ t('onboarding.steps.consciousness.discoveredModels') }}
                </label>
                <button
                  type="button"
                  :disabled="config.isLoadingActiveProviderModels.value"
                  class="flex cursor-pointer items-center gap-1 text-[11px] text-primary-500 font-bold hover:underline disabled:opacity-50"
                  @click="config.fetchLiveModels"
                >
                  <div :class="[config.isLoadingActiveProviderModels.value ? 'animate-spin' : '', 'i-solar:restart-square-bold h-3.5 w-3.5']" />
                  <span>{{ config.isLoadingActiveProviderModels.value ? t('onboarding.steps.consciousness.queryingApi') : t('onboarding.steps.consciousness.getModels') }}</span>
                </button>
              </div>

              <div class="relative flex items-center">
                <select
                  :disabled="config.isLoadingActiveProviderModels.value || config.providerModels.value.length === 0"
                  :value="config.selectedModelId.value"
                  class="min-h-[44px] w-full cursor-pointer appearance-none border border-neutral-200 rounded-lg bg-white px-3 py-2 pr-8 text-sm text-neutral-800 outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100 disabled:opacity-60"
                  @change="config.onSelectModelFromDropdown"
                >
                  <option value="" disabled selected>
                    {{ config.isLoadingActiveProviderModels.value ? t('onboarding.steps.consciousness.queryingApiModels') : (config.providerModels.value.length > 0 ? t('onboarding.steps.consciousness.selectADiscoveredModel') : t('onboarding.steps.consciousness.noModelsFound')) }}
                  </option>
                  <option
                    v-for="model in config.providerModels.value"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name || model.id }}
                  </option>
                </select>
                <div class="pointer-events-none absolute right-2.5 text-neutral-400">
                  <div class="i-solar:alt-arrow-down-line-duotone h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
