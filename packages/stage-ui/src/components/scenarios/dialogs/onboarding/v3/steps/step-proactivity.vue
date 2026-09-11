<script setup lang="ts">
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { Button } from '@proj-airi/ui'
import { computed, onMounted, ref } from 'vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draft = useOnboardingV3Draft()
const proactivityStore = useProactivityStore()

// --- State Bindings: Proactive Heartbeats (Ambient Pull) ---
const heartbeatsEnabled = ref<boolean>(draft.state.heartbeatsEnabled !== false)
const heartbeatsInterval = ref<number>(draft.state.heartbeatsInterval || 5)

// --- State Bindings: Circadian Rhythm & Sleep Gate ---
const operatingScheduleEnabled = ref<boolean>(draft.state.operatingScheduleEnabled !== false)
const wakeUpTime = ref<string>(draft.state.wakeUpTime || '09:00')
const bedTime = ref<string>(draft.state.bedTime || '22:00')
const pauseOnAfk = ref<boolean>(draft.state.pauseOnAfk !== false)
const afkMinutes = ref<number>(draft.state.afkMinutes || 5)

// --- State Bindings: Situational Grounding & Probes ---
const sensorGroundingEnabled = ref<boolean>(draft.state.sensorGroundingEnabled !== false)
const salienceGatingEnabled = ref<boolean>(draft.state.salienceGatingEnabled !== false)
const heartbeatsContextWindowHistory = ref<boolean>(draft.state.heartbeatsContextWindowHistory !== false)
const heartbeatsContextSystemLoad = ref<boolean>(draft.state.heartbeatsContextSystemLoad !== false)
const heartbeatsContextUsageMetrics = ref<boolean>(draft.state.heartbeatsContextUsageMetrics !== false)
const smartSilenceDirectiveEnabled = ref<boolean>(draft.state.smartSilenceDirectiveEnabled !== false)

// --- State Bindings: Event Ledger Stream ---
const eventLedgerEnabled = ref<boolean>(draft.state.eventLedgerEnabled !== false)
const eventLedgerSampleDepth = ref<number>(draft.state.eventLedgerSampleDepth || 6)
const eventLedgerDomains = ref<string[]>(
  draft.state.eventLedgerDomains ? [...draft.state.eventLedgerDomains] : ['vision', 'tools', 'chat', 'memory', 'discord'],
)

function toggleLedgerDomain(domain: string) {
  if (eventLedgerDomains.value.includes(domain)) {
    eventLedgerDomains.value = eventLedgerDomains.value.filter(d => d !== domain)
  }
  else {
    eventLedgerDomains.value = [...eventLedgerDomains.value, domain]
  }
  syncDraft()
}

const heartbeatIntervalPresets = [
  { label: '2 min', value: 2 },
  { label: '5 min (Recommended)', value: 5 },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
]

// --- Circadian Status Calculation ---
const isQuietHoursActive = computed(() => {
  if (!operatingScheduleEnabled.value)
    return false
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [wakeH, wakeM] = wakeUpTime.value.split(':').map(Number)
  const [bedH, bedM] = bedTime.value.split(':').map(Number)
  const wakeTotal = (wakeH || 0) * 60 + (wakeM || 0)
  const bedTotal = (bedH || 0) * 60 + (bedM || 0)

  if (bedTotal > wakeTotal) {
    return currentMinutes >= bedTotal || currentMinutes < wakeTotal
  }
  return currentMinutes >= bedTotal && currentMinutes < wakeTotal
})

onMounted(async () => {
  try {
    await proactivityStore.updateSensors?.()
  }
  catch {
    // Ignore preview error in sandbox/mock environments
  }
})

function syncDraft() {
  draft.setProactivity({
    heartbeatsEnabled: heartbeatsEnabled.value,
    heartbeatsInterval: heartbeatsInterval.value,
    operatingScheduleEnabled: operatingScheduleEnabled.value,
    wakeUpTime: wakeUpTime.value,
    bedTime: bedTime.value,
    pauseOnAfk: pauseOnAfk.value,
    afkMinutes: afkMinutes.value,
    sensorGroundingEnabled: sensorGroundingEnabled.value,
    salienceGatingEnabled: salienceGatingEnabled.value,
    heartbeatsContextWindowHistory: heartbeatsContextWindowHistory.value,
    heartbeatsContextSystemLoad: heartbeatsContextSystemLoad.value,
    heartbeatsContextUsageMetrics: heartbeatsContextUsageMetrics.value,
    eventLedgerEnabled: eventLedgerEnabled.value,
    eventLedgerSampleDepth: eventLedgerSampleDepth.value,
    eventLedgerDomains: eventLedgerDomains.value,
    smartSilenceDirectiveEnabled: smartSilenceDirectiveEnabled.value,
  })
}
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col gap-4 py-1 select-none']">
    <!-- Header Section -->
    <div :class="['flex items-start justify-between gap-4 pb-2 border-b border-neutral-200/80 dark:border-white/10']">
      <div :class="['flex items-start gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl flex-shrink-0 mt-0.5 border border-rose-500/20 shadow-xs']">
          <div :class="['i-solar:heart-pulse-2-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              Daily Routine & Schedule
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400']">
              Step 15 · Proactivity
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            Balance ambient heartbeat check-ins, circadian sleep schedules, quiet hours, and situational grounding with smart silence.
          </p>
        </div>
      </div>

      <!-- Active Status Badge -->
      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          :class="[
            'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono border flex items-center gap-1.5',
            heartbeatsEnabled
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700',
          ]"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', heartbeatsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400']" />
          <span>{{ heartbeatsEnabled ? 'HEARTBEATS ACTIVE' : 'PROACTIVITY OFF' }}</span>
        </span>
      </div>
    </div>

    <!-- Section 1: Proactive Heartbeats & Ambient Pull -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md']">
      <div :class="['flex items-start justify-between gap-4']">
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:heart-pulse-2-bold-duotone w-4 h-4']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                Proactive Heartbeats (Ambient Pull)
              </h3>
              <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20']">
                AMBIENT PULL
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Periodic background timer check-ins evaluating whether to speak. Bound to your operating schedule and quiet hours.
            </p>
          </div>
        </div>

        <!-- Master Switch -->
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            heartbeatsEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="heartbeatsEnabled = !heartbeatsEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              heartbeatsEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <!-- Enabled Options Container -->
      <div v-if="heartbeatsEnabled" :class="['flex flex-col gap-4 pt-3 border-t border-neutral-200/60 dark:border-white/5 animate-fadeIn']">
        <!-- Cadence Presets -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            Ambient Check-In Cadence
          </label>
          <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2']">
            <button
              v-for="preset in heartbeatIntervalPresets"
              :key="preset.value"
              type="button"
              :class="[
                'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer',
                heartbeatsInterval === preset.value
                  ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="heartbeatsInterval = preset.value; syncDraft()"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Circadian Rhythm & Sleep Gate -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md']">
      <div :class="['flex items-start justify-between gap-4']">
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:moon-sleep-bold-duotone w-4 h-4']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                Circadian Rhythm & Sleep Gate
              </h3>
              <span
                :class="[
                  'text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border',
                  isQuietHoursActive
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                ]"
              >
                {{ isQuietHoursActive ? 'QUIET HOURS (ASLEEP)' : 'ACTIVE WAKING HOURS' }}
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Automatically silence ambient heartbeats during sleeping hours and when you step away from the desk.
            </p>
          </div>
        </div>

        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            operatingScheduleEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="operatingScheduleEnabled = !operatingScheduleEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              operatingScheduleEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <div v-if="operatingScheduleEnabled" :class="['flex flex-col gap-4 pt-3 border-t border-neutral-200/60 dark:border-white/5 animate-fadeIn']">
        <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-3']">
          <!-- Wake Up Time -->
          <div :class="['flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
              <div :class="['i-solar:sun-2-bold-duotone text-amber-500']" />
              <span>Wake-Up Time</span>
            </label>
            <input
              v-model="wakeUpTime"
              type="time"
              :class="['px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500']"
              @change="syncDraft()"
            >
          </div>

          <!-- Bed Time -->
          <div :class="['flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
              <div :class="['i-solar:moon-bold-duotone text-indigo-500']" />
              <span>Bedtime / Quiet Hours Start</span>
            </label>
            <input
              v-model="bedTime"
              type="time"
              :class="['px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500']"
              @change="syncDraft()"
            >
          </div>
        </div>

        <!-- AFK Detection Gate -->
        <div :class="['flex items-center justify-between p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
          <div :class="['flex items-center gap-2.5']">
            <input
              id="afk-pause-toggle"
              v-model="pauseOnAfk"
              type="checkbox"
              :class="['h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <label for="afk-pause-toggle" :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer']">
              Pause Proactive Messages When Away (AFK)
            </label>
          </div>
          <div v-if="pauseOnAfk" :class="['flex items-center gap-1 text-xs text-neutral-500']">
            <span>after</span>
            <input
              v-model.number="afkMinutes"
              type="number"
              min="1"
              max="60"
              :class="['w-12 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-center font-mono']"
              @change="syncDraft()"
            >
            <span>min</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Situational Grounding & Event Ledger -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md']">
      <div :class="['flex items-start gap-3']">
        <div :class="['w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
          <div :class="['i-solar:radar-bold-duotone w-4 h-4']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
              Situational Grounding & Event Ledger
            </h3>
            <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20']">
              CONTEXT INJECTIONS
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            Inject active application titles, window history, and system ledger events directly into the prompt context per conversational turn.
          </p>
        </div>
      </div>

      <div :class="['flex flex-col gap-3 pt-1']">
        <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-2.5']">
          <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
            <input
              v-model="heartbeatsContextWindowHistory"
              type="checkbox"
              :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">Window History</span>
          </label>

          <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
            <input
              v-model="heartbeatsContextSystemLoad"
              type="checkbox"
              :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">CPU & System Load</span>
          </label>

          <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
            <input
              v-model="heartbeatsContextUsageMetrics"
              type="checkbox"
              :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">Usage Metrics</span>
          </label>
        </div>

        <!-- Smart Silence (NO_REPLY) Directive Toggle -->
        <div :class="['flex items-center justify-between p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] mt-1']">
          <div :class="['flex flex-col']">
            <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
              Smart Silence (NO_REPLY Directive)
            </span>
            <span :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
              Instructs the model to output NO_REPLY instead of forcing unnecessary speech when nothing noteworthy occurred.
            </span>
          </div>
          <button
            type="button"
            :class="[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              smartSilenceDirectiveEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
            ]"
            @click="smartSilenceDirectiveEnabled = !smartSilenceDirectiveEnabled; syncDraft()"
          >
            <span
              :class="[
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                smartSilenceDirectiveEnabled ? 'translate-x-5' : 'translate-x-0',
              ]"
            />
          </button>
        </div>

        <!-- Unified Event Ledger Integration -->
        <div :class="['flex flex-col gap-3 border-t border-neutral-200/60 dark:border-white/5 pt-3']">
          <div :class="['flex items-center justify-between gap-4']">
            <div :class="['flex items-center gap-2']">
              <input
                id="proactivity-ledger-toggle"
                v-model="eventLedgerEnabled"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <label for="proactivity-ledger-toggle" :class="['text-xs text-neutral-700 font-medium dark:text-neutral-300 cursor-pointer']">
                Attach Unified Event Ledger Stream
              </label>
            </div>
            <div :class="['flex items-center gap-1.5 text-xs text-neutral-500']">
              <span>Sample Last:</span>
              <input
                v-model.number="eventLedgerSampleDepth"
                type="number"
                min="1"
                max="20"
                :class="['w-12 border border-neutral-200 dark:border-white/10 rounded-lg bg-neutral-100 dark:bg-white/5 px-2 py-0.5 text-center text-xs font-mono text-neutral-800 dark:text-white outline-none focus:border-primary-500']"
                @change="syncDraft()"
              >
              <span>Events</span>
            </div>
          </div>

          <!-- Ledger Domain Badges -->
          <div :class="['flex flex-wrap items-center gap-1.5']">
            <button
              v-for="domain in ['vision', 'tools', 'chat', 'memory', 'discord']"
              :key="domain"
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-colors cursor-pointer',
                eventLedgerDomains.includes(domain)
                  ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400'
                  : 'bg-neutral-100 dark:bg-white/5 border-neutral-200/60 dark:border-white/10 text-neutral-400 dark:text-neutral-500',
              ]"
              @click="toggleLedgerDomain(domain)"
            >
              [{{ domain.toUpperCase() }}]
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']">
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Heartbeats: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ heartbeatsEnabled ? `${heartbeatsInterval}m Cadence` : 'Off' }}</span>
        <span v-if="operatingScheduleEnabled" :class="['text-indigo-500 ml-1 font-bold']">(Schedule Active)</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>Continue</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
