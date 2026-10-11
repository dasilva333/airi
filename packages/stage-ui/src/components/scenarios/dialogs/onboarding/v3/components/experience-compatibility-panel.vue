<script setup lang="ts">
import type { ExperienceArchetypeId } from '../stores/useOnboardingV3Draft'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useOnboardingHardwareSnapshot } from '../composables/useOnboardingHardwareSnapshot'

const props = defineProps<{
  archetypeId: ExperienceArchetypeId
}>()

const emit = defineEmits<{
  (e: 'selectArchetype', id: ExperienceArchetypeId): void
}>()

const { t } = useI18n()

const { snapshot } = useOnboardingHardwareSnapshot()
const isExpanded = ref(false)

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0)
    return t('onboarding.steps.experience.hardware.notMeasured')
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`
}

// Low system RAM threshold: configurable heuristic for heavier local plans (provisional, not a hard barrier)
const LOW_RAM_THRESHOLD_BYTES = 8 * 1024 * 1024 * 1024

const isLowSystemRam = computed(() => {
  const bytes = snapshot.value.systemMemoryBytes.value
  return typeof bytes === 'number' && bytes > 0 && bytes < LOW_RAM_THRESHOLD_BYTES
})

type GuidanceSeverity = 'checking' | 'ready' | 'advisory' | 'unknown'

interface GuidanceEvaluation {
  severity: GuidanceSeverity
  title: string
  explanation?: string
  showLighterPresetRecommendation?: boolean
}

const guidance = computed<GuidanceEvaluation>(() => {
  // 1. Initial asynchronous check in-flight
  if (snapshot.value.status === 'checking') {
    return {
      severity: 'checking',
      title: t('onboarding.steps.experience.hardware.checkingTitle'),
      explanation: t('onboarding.steps.experience.hardware.checkingDescription'),
    }
  }

  // 2. Unknown detection result (check failed or timed out)
  if (snapshot.value.status === 'unknown' || snapshot.value.webgpu.value === null) {
    return {
      severity: 'unknown',
      title: t('onboarding.steps.experience.hardware.unknownTitle'),
      explanation: t('onboarding.steps.experience.hardware.unknownDescription'),
    }
  }

  // 3. WebGPU is unavailable
  if (snapshot.value.webgpu.value === false) {
    if (props.archetypeId === 'quiet') {
      return {
        severity: 'ready',
        title: t('onboarding.steps.experience.hardware.quietTitle'),
        explanation: t('onboarding.steps.experience.hardware.quietDescription'),
      }
    }

    return {
      severity: 'advisory',
      title: t('onboarding.steps.experience.hardware.advisoryTitle'),
      explanation: t('onboarding.steps.experience.hardware.noAccelerationDescription'),
      showLighterPresetRecommendation: true,
    }
  }

  // 4. WebGPU is available
  // Check if system RAM is below the provisional 8GB threshold on heavier multi-worker archetypes
  if (isLowSystemRam.value && props.archetypeId !== 'quiet') {
    return {
      severity: 'advisory',
      title: t('onboarding.steps.experience.hardware.advisoryTitle'),
      explanation: t('onboarding.steps.experience.hardware.lowMemoryDescription', { memory: formatBytes(snapshot.value.systemMemoryBytes.value) }),
      showLighterPresetRecommendation: true,
    }
  }

  // Standard acceleration available state
  return {
    severity: 'ready',
    title: t('onboarding.steps.experience.hardware.readyTitle'),
    explanation: t('onboarding.steps.experience.hardware.readyDescription'),
  }
})

const severityClasses = computed(() => {
  switch (guidance.value.severity) {
    case 'ready':
      return {
        cardBorder: 'border-emerald-500/25 dark:border-emerald-500/20',
        cardBg: 'bg-emerald-500/5 dark:bg-emerald-950/15',
        icon: 'i-solar:shield-check-bold-duotone text-emerald-500 dark:text-emerald-400',
        title: 'text-neutral-800 dark:text-neutral-200',
        pill: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      }
    case 'advisory':
      return {
        cardBorder: 'border-amber-500/35 dark:border-amber-500/30',
        cardBg: 'bg-amber-500/5 dark:bg-amber-950/20',
        icon: 'i-solar:danger-triangle-bold-duotone text-amber-500 dark:text-amber-400',
        title: 'text-neutral-800 dark:text-neutral-200',
        pill: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      }
    case 'checking':
      return {
        cardBorder: 'border-primary-500/25 dark:border-primary-500/20',
        cardBg: 'bg-primary-500/5 dark:bg-primary-950/15',
        icon: 'i-solar:refresh-circle-bold-duotone text-primary-500 animate-spin',
        title: 'text-neutral-700 dark:text-neutral-300',
        pill: 'text-primary-600 dark:text-primary-400 bg-primary-500/10 border-primary-500/20',
      }
    default:
      return {
        cardBorder: 'border-neutral-200/80 dark:border-neutral-800/80',
        cardBg: 'bg-neutral-100/50 dark:bg-neutral-900/40',
        icon: 'i-solar:info-circle-bold-duotone text-neutral-400',
        title: 'text-neutral-700 dark:text-neutral-300',
        pill: 'text-neutral-500 dark:text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800/50 border-neutral-300 dark:border-neutral-700',
      }
  }
})
</script>

<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 6 }"
    :enter="{ opacity: 1, y: 0 }"
    :duration="250"
    :class="[
      'rounded-xl border p-3 backdrop-blur-md transition-all text-xs',
      severityClasses.cardBorder,
      severityClasses.cardBg,
    ]"
  >
    <div :class="['flex items-start justify-between gap-3']">
      <!-- Left: Icon & Advisory Title -->
      <div :class="['flex items-start gap-2.5 min-w-0 flex-1']">
        <div :class="['h-5 w-5 flex-shrink-0 mt-0.5', severityClasses.icon]" />
        <div :class="['min-w-0 flex-1']">
          <div :class="['font-medium leading-relaxed', severityClasses.title]">
            {{ guidance.title }}
          </div>
          <div
            v-if="guidance.explanation && !isExpanded"
            :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1']"
          >
            {{ guidance.explanation }}
          </div>
        </div>
      </div>

      <!-- Right: Expand Details Toggle Button -->
      <button
        type="button"
        :class="[
          'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition-colors cursor-pointer flex-shrink-0',
          severityClasses.pill,
        ]"
        @click="isExpanded = !isExpanded"
      >
        <span>{{ isExpanded ? t('onboarding.steps.experience.hardware.hideDetails') : t('onboarding.steps.experience.hardware.details') }}</span>
        <div :class="['i-solar:alt-arrow-down-linear text-xs transition-transform duration-200', isExpanded ? 'rotate-180' : '']" />
      </button>
    </div>

    <!-- Suggested Alternative Action (Preserves Profile Data) -->
    <div
      v-if="guidance.showLighterPresetRecommendation && archetypeId !== 'quiet'"
      :class="['mt-2.5 pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2 text-[11px] text-neutral-600 dark:text-neutral-300']"
    >
      <span>{{ t('onboarding.steps.experience.hardware.lighterQuestion') }}</span>
      <button
        type="button"
        :class="['px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium transition-all active:scale-95 cursor-pointer']"
        @click="emit('selectArchetype', 'quiet')"
      >
        {{ t('onboarding.steps.experience.hardware.switchQuiet') }}
      </button>
    </div>

    <!-- Expandable Observed Limitation & Telemetry Table -->
    <div
      v-if="isExpanded"
      :class="['mt-3 pt-2.5 border-t border-neutral-200/60 dark:border-white/10 flex flex-col gap-2 text-[11px]']"
    >
      <div v-if="guidance.explanation" :class="['text-neutral-600 dark:text-neutral-400 leading-relaxed']">
        {{ guidance.explanation }}
      </div>

      <!-- Observed Capabilities Table -->
      <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 bg-black/5 dark:bg-black/20 p-2.5 rounded-lg font-mono text-[10px]']">
        <div>
          <span class="text-neutral-400">{{ t('onboarding.steps.experience.hardware.webgpuLabel') }}</span>
          <span :class="snapshot.webgpu.value ? 'text-emerald-400 font-semibold' : snapshot.webgpu.value === false ? 'text-amber-400' : 'text-neutral-400'">
            {{ snapshot.webgpu.value === true ? t('onboarding.steps.experience.hardware.available') : snapshot.webgpu.value === false ? t('onboarding.steps.experience.hardware.unavailable') : t('onboarding.steps.experience.hardware.unknown') }}
          </span>
          <span class="block text-[9px] text-neutral-500">({{ t(`onboarding.steps.experience.hardware.sources.${snapshot.webgpu.source}`) }})</span>
        </div>

        <div>
          <span class="text-neutral-400">{{ t('onboarding.steps.experience.hardware.fp16Label') }}</span>
          <span :class="snapshot.fp16.value ? 'text-emerald-400' : 'text-neutral-400'">
            {{ snapshot.fp16.value === true ? t('onboarding.steps.experience.hardware.supported') : snapshot.fp16.value === false ? t('onboarding.steps.experience.hardware.unsupported') : t('onboarding.steps.experience.hardware.unknown') }}
          </span>
          <span class="block text-[9px] text-neutral-500">({{ t(`onboarding.steps.experience.hardware.sources.${snapshot.fp16.source}`) }})</span>
        </div>

        <div v-if="snapshot.gpuDeviceName.value">
          <span class="text-neutral-400">{{ t('onboarding.steps.experience.hardware.gpuLabel') }}</span>
          <span class="text-neutral-200">{{ snapshot.gpuDeviceName.value }}</span>
          <span class="block text-[9px] text-neutral-500">({{ t(`onboarding.steps.experience.hardware.sources.${snapshot.gpuDeviceName.source}`) }})</span>
        </div>

        <div>
          <span class="text-neutral-400">{{ t('onboarding.steps.experience.hardware.memoryLabel') }}</span>
          <span class="text-neutral-200">{{ formatBytes(snapshot.systemMemoryBytes.value) }}</span>
          <span class="block text-[9px] text-neutral-500">({{ t(`onboarding.steps.experience.hardware.sources.${snapshot.systemMemoryBytes.source}`) }})</span>
        </div>
      </div>

      <div :class="['text-[10px] text-neutral-400 italic']">
        {{ t('onboarding.steps.experience.hardware.advisoryNote') }}
      </div>
    </div>
  </div>
</template>
