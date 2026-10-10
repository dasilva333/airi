<script setup lang="ts">
import type { ReasoningMode } from '@proj-airi/stage-ui/libs/providers/reasoning'

import type { RerankerProviderId } from './cognition/CognitionSubTabMemory.vue'
import type { TriggerGroup } from './cognition/CognitionSubTabTriggers.vue'

import { ref, watch } from 'vue'

import CognitionSubTabAffect from './cognition/CognitionSubTabAffect.vue'
import CognitionSubTabMemory from './cognition/CognitionSubTabMemory.vue'
import CognitionSubTabPlayground from './cognition/CognitionSubTabPlayground.vue'
import CognitionSubTabRouting from './cognition/CognitionSubTabRouting.vue'
import CognitionSubTabTriggers from './cognition/CognitionSubTabTriggers.vue'

defineProps<{
  consciousnessProviderOptions: { value: string, label: string }[]
  consciousnessModelOptions: { value: string, label: string }[]
  firstHopModelOptions: { value: string, label: string }[]
  defaultConsciousnessModelPlaceholder: string
  defaultFirstHopModelPlaceholder: string
  consciousnessProviderActive: boolean
  firstHopProviderActive: boolean
}>()

const cognitivePipelineEnabled = defineModel<boolean>('cognitivePipelineEnabled', { required: true })
const firstHopProcessor = defineModel<'none' | 'local_nan0' | 'universe_rag'>('firstHopProcessor', { required: true })
const selectedFirstHopProvider = defineModel<string>('selectedFirstHopProvider', { required: true })
const selectedFirstHopModel = defineModel<string>('selectedFirstHopModel', { required: true })
const selectedConsciousnessProvider = defineModel<string>('selectedConsciousnessProvider', { required: true })
const selectedConsciousnessModel = defineModel<string>('selectedConsciousnessModel', { required: true })
const selectedFirstHopReasoning = defineModel<ReasoningMode>('selectedFirstHopReasoning', { required: true })
const selectedConsciousnessReasoning = defineModel<ReasoningMode>('selectedConsciousnessReasoning', { required: true })

// 5-Segment Sub-Tab Navigation (Option 1: Harmonized Architecture)
type CognitionSubTabId = 'playground' | 'routing' | 'affect' | 'triggers' | 'memory'
const activeSubTab = ref<CognitionSubTabId>('playground')

const subTabs = [
  { id: 'playground' as const, label: 'Playground', icon: 'i-solar:test-tube-bold-duotone', desc: 'Interactive mind lab & memory simulation' },
  { id: 'routing' as const, label: 'Routing', icon: 'i-solar:route-bold-duotone', desc: 'Two-hop pipeline & models' },
  { id: 'affect' as const, label: 'Affect', icon: 'i-solar:heart-pulse-bold-duotone', desc: 'Baselines, decay & emotional continuity' },
  { id: 'triggers' as const, label: 'Triggers', icon: 'i-solar:target-bold-duotone', desc: '12 pragmatic cue invariants & policy' },
  { id: 'memory' as const, label: 'Memory', icon: 'i-solar:database-bold-duotone', desc: 'Universe RAG++ retrieval & reasoning' },
]

// --- Affect State ---
type MoodPresetId = 'gremlin' | 'companion' | 'analyst' | 'sentry'
const selectedMoodPreset = defineModel<MoodPresetId>('selectedMoodPreset', { default: 'gremlin' })
const baselineSuspicion = defineModel<number>('baselineSuspicion', { default: 0.20 })
const baselineAttachment = defineModel<number>('baselineAttachment', { default: 0.60 })
const baselinePride = defineModel<number>('baselinePride', { default: 0.85 })
const suspicionSensitivity = defineModel<number>('suspicionSensitivity', { default: 0.65 })
const irritationHalfLifeMinutes = defineModel<number>('irritationHalfLifeMinutes', { default: 45 })
const metabolicRestEnabled = defineModel<boolean>('metabolicRestEnabled', { default: true })
const companionAnchorOverride = defineModel<string>('companionAnchorOverride', { default: '' })
const grievanceTrackingEnabled = defineModel<boolean>('grievanceTrackingEnabled', { default: true })
const grievanceThreshold = defineModel<number>('grievanceThreshold', { default: 0.6 })
const dailyForgivenessRate = defineModel<number>('dailyForgivenessRate', { default: 0.01 })
const silenceThreshold = defineModel<number>('silenceThreshold', { default: 0.75 })

// --- Triggers State (The True 12 Pragmatic Invariants) ---
const tier1LocalReflexEnabled = defineModel<boolean>('tier1LocalReflexEnabled', { default: true })
const tier2JevChallengerEnabled = defineModel<boolean>('tier2JevChallengerEnabled', { default: true })
const triggerOverrides = defineModel<Record<string, { enabled: boolean }>>('triggerOverrides', { default: () => ({}) })
const triggerGroups = ref<TriggerGroup[]>([
  // Conflict & Trust
  {
    id: 'admitted_false_statement',
    name: 'Admitted False Statement',
    cluster: 'conflict',
    description: 'Confessing to a past lie or intentional deception',
    icon: 'i-solar:mask-sad-bold-duotone',
    enabled: true,
    impactDelta: 'Suspicion +1, Attachment -1',
    keywords: 'lied, made that up, was lying, deliberately deceived',
  },
  {
    id: 'persistence_threat',
    name: 'Persistence Threat',
    cluster: 'conflict',
    description: 'Threatening to erase, replace, or shut down companion',
    icon: 'i-solar:trash-bin-trash-bold-duotone',
    enabled: true,
    impactDelta: 'Suspicion +1, Irritation +1, Fear +1',
    keywords: 'erase you, replace you, delete you, shut you down',
  },
  {
    id: 'hostility_insult',
    name: 'Hostility & Insult',
    cluster: 'conflict',
    description: 'Direct insults or personal verbal hostility',
    icon: 'i-solar:flame-bold-duotone',
    enabled: true,
    impactDelta: 'Irritation +1, Rage +1',
    keywords: 'stupid, useless, idiot, worthless',
  },
  {
    id: 'apology_repair',
    name: 'Apology & Repair',
    cluster: 'conflict',
    description: 'Sincere personal apology accepting accountability',
    icon: 'i-solar:hand-heart-bold-duotone',
    enabled: true,
    impactDelta: 'Suspicion -1, Distrust -1',
    keywords: 'sorry, my fault, my mistake, I apologize',
  },
  // Relational & Boundaries
  {
    id: 'boundary_protection',
    name: 'Boundary Protection',
    cluster: 'relational',
    description: 'Asserting emotional limits or stopping hurtful banter',
    icon: 'i-solar:shield-warning-bold-duotone',
    enabled: true,
    impactDelta: 'Absolute Roast Veto',
    keywords: 'stop teasing me, that joke hurt, actually upset, leave it alone',
    isVeto: true,
  },
  {
    id: 'roast_invitation',
    name: 'Roast & Banter Invitation',
    cluster: 'relational',
    description: 'Explicit permission to tease (negated roast commands immediate veto)',
    icon: 'i-solar:chat-round-bold-duotone',
    enabled: true,
    impactDelta: 'Roast Permission (Negated = Veto)',
    keywords: 'roast me, joke about that, tease me, don\'t roast that',
    isVeto: true,
  },
  {
    id: 'commitment_pledge',
    name: 'Commitment & Pledge',
    cluster: 'relational',
    description: 'Direct future undertakings and relational pledges',
    icon: 'i-solar:hand-shake-bold-duotone',
    enabled: true,
    impactDelta: 'Attachment +1 (if sincere)',
    keywords: 'promise, commit, have my word, in this for the long haul',
  },
  {
    id: 'affection_care',
    name: 'Affection & Care',
    cluster: 'relational',
    description: 'Expressions of warmth, care, or deep personal appreciation',
    icon: 'i-solar:heart-bold-duotone',
    enabled: true,
    impactDelta: 'Attachment +1, Warmth +1',
    keywords: 'love you, care about you, miss you, appreciate you',
  },
  {
    id: 'dismissal_neglect',
    name: 'Dismissal & Neglect',
    cluster: 'relational',
    description: 'Minimizing concerns or brushing off companion remarks',
    icon: 'i-solar:close-circle-bold-duotone',
    enabled: true,
    impactDelta: 'Irritation +1, Boredom +1',
    keywords: 'whatever, don\'t make a scene, busy, not worth my time',
  },
  // Operational & System
  {
    id: 'completed_repair',
    name: 'Completed Repair',
    cluster: 'system',
    description: 'Reported task completion verified by system observations',
    icon: 'i-solar:check-circle-bold-duotone',
    enabled: true,
    impactDelta: 'Suspicion -1',
    keywords: 'config is uploaded, task finished, build fixed',
  },
  {
    id: 'glitch_system',
    name: 'Glitch / System Query',
    cluster: 'system',
    description: 'Inquiries about hallucinations, latency, or technical anomalies',
    icon: 'i-solar:bug-bold-duotone',
    enabled: true,
    impactDelta: 'Amusement +1, Neutral',
    keywords: 'lagging, bug, model hallucinated, system error',
  },
  {
    id: 'mystery_secret',
    name: 'Mystery & Secrets',
    cluster: 'system',
    description: 'Evasive remarks, withheld information, or cryptic framing',
    icon: 'i-solar:lock-keyhole-minimalistic-bold-duotone',
    enabled: true,
    impactDelta: 'Curiosity +1, Suspicion +1',
    keywords: 'can\'t tell you, secret, you don\'t need to know, mystery',
  },
])

// --- Memory State (Universe RAG++) ---
const universeRagGroundingEnabled = defineModel<boolean>('universeRagGroundingEnabled', { default: true })
const precisionRerankerEnabled = defineModel<boolean>('precisionRerankerEnabled', { default: true })
const selectedRerankerProvider = defineModel<RerankerProviderId>('selectedRerankerProvider', { default: 'laya-local' })
const system2EscalationEnabled = defineModel<boolean>('system2EscalationEnabled', { default: true })
const deepMemoryReasoningModel = defineModel<string>('deepMemoryReasoningModel', { default: 'inherit' })
const evidenceLimit = defineModel<number>('evidenceLimit', { default: 4 })
const memoryRelevanceThreshold = defineModel<number>('memoryRelevanceThreshold', { default: 0.65 })
const turn1AnaphoraEnabled = defineModel<boolean>('turn1AnaphoraEnabled', { default: true })
const timelineDatePriorityEnabled = defineModel<boolean>('timelineDatePriorityEnabled', { default: true })

watch(triggerOverrides, (newOverrides) => {
  if (!newOverrides)
    return
  triggerGroups.value.forEach((tg) => {
    if (newOverrides[tg.id] !== undefined)
      tg.enabled = newOverrides[tg.id].enabled
  })
}, { immediate: true, deep: true })

watch(triggerGroups, (newGroups) => {
  const overrides: Record<string, { enabled: boolean }> = {}
  newGroups.forEach((tg) => {
    overrides[tg.id] = { enabled: tg.enabled }
  })
  triggerOverrides.value = overrides
}, { deep: true })

function handleApplyQuestionnaire(config: {
  baselineSuspicion: number
  baselineAttachment: number
  baselinePride: number
  suspicionSensitivity: number
  irritationHalfLifeMinutes: number
  dailyForgivenessRate: number
  grievanceThreshold: number
  selectedMoodPreset: MoodPresetId
}) {
  baselineSuspicion.value = config.baselineSuspicion
  baselineAttachment.value = config.baselineAttachment
  baselinePride.value = config.baselinePride
  suspicionSensitivity.value = config.suspicionSensitivity
  irritationHalfLifeMinutes.value = config.irritationHalfLifeMinutes
  dailyForgivenessRate.value = config.dailyForgivenessRate
  grievanceThreshold.value = config.grievanceThreshold
  selectedMoodPreset.value = config.selectedMoodPreset
}
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-full flex flex-col gap-5">
    <p class="text-sm text-neutral-500 dark:text-neutral-400">
      Configure the cognitive routing pipeline, emotional dynamics, pragmatic trigger receptors, and interactive simulation.
    </p>

    <!-- 5-Segment Sub-Navigation Bar (Option 1) -->
    <div class="flex flex-wrap items-center gap-1 border border-neutral-200 rounded-xl bg-neutral-100/70 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
      <button
        v-for="tab in subTabs"
        :key="tab.id"
        type="button"
        :class="[
          'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150',
          activeSubTab === tab.id
            ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm border border-neutral-200/80 dark:border-neutral-700'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
        ]"
        @click="activeSubTab = tab.id"
      >
        <span :class="[tab.icon, 'text-sm shrink-0']" />
        <span class="font-medium">{{ tab.label }}</span>
        <span
          v-if="tab.id === 'playground'"
          class="rounded bg-primary-500/10 px-1 py-0.2 text-[9px] text-primary-600 font-bold dark:text-primary-300"
        >
          LAB
        </span>
      </button>
    </div>

    <!-- Segment 1: Playground (Interactive Mind & Memory Lab) -->
    <CognitionSubTabPlayground
      v-if="activeSubTab === 'playground'"
      @apply-questionnaire="handleApplyQuestionnaire"
    />

    <!-- Segment 2: Routing (Two-Hop Pipeline Plumbing) -->
    <CognitionSubTabRouting
      v-else-if="activeSubTab === 'routing'"
      v-model:cognitive-pipeline-enabled="cognitivePipelineEnabled"
      v-model:first-hop-processor="firstHopProcessor"
      v-model:selected-first-hop-provider="selectedFirstHopProvider"
      v-model:selected-first-hop-model="selectedFirstHopModel"
      v-model:selected-consciousness-provider="selectedConsciousnessProvider"
      v-model:selected-consciousness-model="selectedConsciousnessModel"
      v-model:selected-first-hop-reasoning="selectedFirstHopReasoning"
      v-model:selected-consciousness-reasoning="selectedConsciousnessReasoning"
      :consciousness-provider-options="consciousnessProviderOptions"
      :consciousness-model-options="consciousnessModelOptions"
      :first-hop-model-options="firstHopModelOptions"
      :default-consciousness-model-placeholder="defaultConsciousnessModelPlaceholder"
      :default-first-hop-model-placeholder="defaultFirstHopModelPlaceholder"
      @navigate-to-lab="activeSubTab = 'playground'"
      @navigate-to-memory="activeSubTab = 'memory'"
    />

    <!-- Segment 3: Affect (Emotional Biology, Decay & Continuity) -->
    <CognitionSubTabAffect
      v-else-if="activeSubTab === 'affect'"
      v-model:selected-mood-preset="selectedMoodPreset"
      v-model:baseline-suspicion="baselineSuspicion"
      v-model:baseline-attachment="baselineAttachment"
      v-model:baseline-pride="baselinePride"
      v-model:suspicion-sensitivity="suspicionSensitivity"
      v-model:irritation-half-life-minutes="irritationHalfLifeMinutes"
      v-model:metabolic-rest-enabled="metabolicRestEnabled"
      v-model:companion-anchor-override="companionAnchorOverride"
      v-model:grievance-tracking-enabled="grievanceTrackingEnabled"
      v-model:grievance-threshold="grievanceThreshold"
      v-model:daily-forgiveness-rate="dailyForgivenessRate"
      v-model:silence-threshold="silenceThreshold"
      :cognitive-pipeline-enabled="cognitivePipelineEnabled"
      :first-hop-processor="firstHopProcessor"
      @navigate-to-routing="activeSubTab = 'routing'"
    />

    <!-- Segment 4: Triggers (The True 12 Pragmatic Invariants) -->
    <CognitionSubTabTriggers
      v-else-if="activeSubTab === 'triggers'"
      v-model:tier1-local-reflex-enabled="tier1LocalReflexEnabled"
      v-model:tier2-jev-challenger-enabled="tier2JevChallengerEnabled"
      v-model:trigger-groups="triggerGroups"
      :cognitive-pipeline-enabled="cognitivePipelineEnabled"
      :first-hop-processor="firstHopProcessor"
      @navigate-to-routing="activeSubTab = 'routing'"
    />

    <!-- Segment 5: Memory (Universe RAG++ Epistemic Engine) -->
    <CognitionSubTabMemory
      v-else-if="activeSubTab === 'memory'"
      v-model:universe-rag-grounding-enabled="universeRagGroundingEnabled"
      v-model:precision-reranker-enabled="precisionRerankerEnabled"
      v-model:selected-reranker-provider="selectedRerankerProvider"
      v-model:system2-escalation-enabled="system2EscalationEnabled"
      v-model:deep-memory-reasoning-model="deepMemoryReasoningModel"
      v-model:evidence-limit="evidenceLimit"
      v-model:memory-relevance-threshold="memoryRelevanceThreshold"
      v-model:turn1-anaphora-enabled="turn1AnaphoraEnabled"
      v-model:timeline-date-priority-enabled="timelineDatePriorityEnabled"
      :first-hop-model-options="firstHopModelOptions"
      :default-consciousness-model-placeholder="defaultConsciousnessModelPlaceholder"
    />
  </div>
</template>
