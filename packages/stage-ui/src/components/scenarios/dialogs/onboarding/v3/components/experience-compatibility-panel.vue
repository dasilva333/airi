<script setup lang="ts">
import type { ExperienceArchetypeId } from '../stores/useOnboardingV3Draft'

import { computed, ref } from 'vue'

import { useOnboardingHardwareSnapshot } from '../composables/useOnboardingHardwareSnapshot'

const props = defineProps<{
  archetypeId: ExperienceArchetypeId
}>()

const emit = defineEmits<{
  (e: 'selectArchetype', id: ExperienceArchetypeId): void
}>()

const { snapshot } = useOnboardingHardwareSnapshot()
const isExpanded = ref(false)

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0)
    return 'Not measured'
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
      title: 'Checking local AI compatibility…',
      explanation: 'Probing hardware acceleration and available system capabilities.',
    }
  }

  // 2. Unknown detection result (check failed or timed out)
  if (snapshot.value.status === 'unknown' || snapshot.value.webgpu.value === null) {
    return {
      severity: 'unknown',
      title: 'We couldn’t fully check local performance. You can continue and choose providers during setup.',
      explanation: 'Browser security or platform restrictions prevented reading detailed GPU capabilities. You can still use local or remote providers freely.',
    }
  }

  // 3. WebGPU is unavailable
  if (snapshot.value.webgpu.value === false) {
    if (props.archetypeId === 'quiet') {
      return {
        severity: 'ready',
        title: 'The Quiet Observer uses lightweight text and memory, which runs smoothly on CPU.',
        explanation: 'Because this archetype operates without a rendered avatar or continuous local audio perception, it does not require WebGPU.',
      }
    }

    return {
      severity: 'advisory',
      title: 'Some local features may run slowly or need another provider. You can continue and adjust your setup.',
      explanation: 'WebGPU acceleration was not detected. Local voice and audio transcription can run via CPU fallback or cloud providers (Cloudflare, ElevenLabs, OpenAI). You can continue and choose your preferred backend in upcoming steps.',
      showLighterPresetRecommendation: true,
    }
  }

  // 4. WebGPU is available
  // Check if system RAM is below the provisional 8GB threshold on heavier multi-worker archetypes
  if (isLowSystemRam.value && props.archetypeId !== 'quiet') {
    return {
      severity: 'advisory',
      title: 'Some local features may run slowly or need another provider. You can continue and adjust your setup.',
      explanation: `Approximately ${formatBytes(snapshot.value.systemMemoryBytes.value)} of system memory was detected. Running the entire local neural stack concurrently may encounter memory pressure. You can select lighter models or remote providers during setup.`,
      showLighterPresetRecommendation: true,
    }
  }

  // Standard acceleration available state
  return {
    severity: 'ready',
    title: 'Hardware acceleration is available. Performance will depend on selected models.',
    explanation: 'WebGPU compute is active. Actual speed will vary depending on your choice of neural speech, transcription, and reasoning models.',
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
        <span>{{ isExpanded ? 'Hide Details' : 'Details' }}</span>
        <div :class="['i-solar:alt-arrow-down-linear text-xs transition-transform duration-200', isExpanded ? 'rotate-180' : '']" />
      </button>
    </div>

    <!-- Suggested Alternative Action (Preserves Profile Data) -->
    <div
      v-if="guidance.showLighterPresetRecommendation && archetypeId !== 'quiet'"
      :class="['mt-2.5 pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2 text-[11px] text-neutral-600 dark:text-neutral-300']"
    >
      <span>Prefer a lighter resource footprint?</span>
      <button
        type="button"
        :class="['px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium transition-all active:scale-95 cursor-pointer']"
        @click="emit('selectArchetype', 'quiet')"
      >
        Switch to The Quiet Observer
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
          <span class="text-neutral-400">WebGPU Acceleration: </span>
          <span :class="snapshot.webgpu.value ? 'text-emerald-400 font-semibold' : snapshot.webgpu.value === false ? 'text-amber-400' : 'text-neutral-400'">
            {{ snapshot.webgpu.value === true ? 'Available' : snapshot.webgpu.value === false ? 'Unavailable' : 'Unknown' }}
          </span>
          <span class="block text-[9px] text-neutral-500">({{ snapshot.webgpu.confidence }})</span>
        </div>

        <div>
          <span class="text-neutral-400">Shader FP16: </span>
          <span :class="snapshot.fp16.value ? 'text-emerald-400' : 'text-neutral-400'">
            {{ snapshot.fp16.value === true ? 'Supported' : snapshot.fp16.value === false ? 'Unsupported' : 'Unknown' }}
          </span>
          <span class="block text-[9px] text-neutral-500">({{ snapshot.fp16.confidence }})</span>
        </div>

        <div v-if="snapshot.gpuDeviceName.value">
          <span class="text-neutral-400">Graphics Adapter: </span>
          <span class="text-neutral-200">{{ snapshot.gpuDeviceName.value }}</span>
          <span class="block text-[9px] text-neutral-500">({{ snapshot.gpuDeviceName.confidence }})</span>
        </div>

        <div>
          <span class="text-neutral-400">System Memory: </span>
          <span class="text-neutral-200">{{ formatBytes(snapshot.systemMemoryBytes.value) }}</span>
          <span class="block text-[9px] text-neutral-500">({{ snapshot.systemMemoryBytes.confidence }})</span>
        </div>
      </div>

      <div :class="['text-[10px] text-neutral-400 italic']">
        Note: Guidance is advisory. You can configure CPU fallbacks, separate local servers, or remote cloud providers at any step.
      </div>
    </div>
  </div>
</template>
