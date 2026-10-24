<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AssistantBubble from '../components/assistant-bubble.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { describeMusicProvisionFailure, ensureMusicToolProvisioned } from '../../../../../../stores/mcp-tool-bridge'
import { useTextToMotionStore } from '../../../../../../stores/modules/text-to-motion'
import { useProvidersStore } from '../../../../../../stores/providers'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draftStore = useOnboardingV3Draft()
const displayModelsStore = useDisplayModelsStore()
const textToMotionStore = useTextToMotionStore()
const providersStore = useProvidersStore()

// --- Vessel detection (generate_motion only produces VRMA for humanoid VRMs) ---
const activeModelId = computed(() => draftStore.state.vesselDisplayModelId || 'preset-live2d-2')
const currentModel = computed(() => {
  const targetId = activeModelId.value
  return displayModelsStore.displayModels.find((m: { id: string, format?: DisplayModelFormat }) =>
    m.id === targetId
    || m.id === `display-model-${targetId}`
    || m.id.replace(/^display-model-/, '') === targetId.replace(/^display-model-/, ''),
  )
})

const isVrmModel = computed(() => {
  const fmt = currentModel.value?.format
  if (fmt === DisplayModelFormat.VRM)
    return true
  const idLower = (activeModelId.value || '').toLowerCase()
  return idLower.includes('vrm')
})

// --- Platform & capability availability ---
const isDesktop = computed(() => isStageTamagotchi())

const hasArtistry = computed(() => {
  const provider = draftStore.state.artistryProvider || 'pollinations'
  return Boolean(draftStore.state.modules?.artistry) && provider !== 'none'
})

// --- Music tool provisioning (streaming MCP endpoint, not stdio) ---
const musicProvisioning = ref(false)
const musicError = ref('')

async function handleToggleMusic() {
  if (musicProvisioning.value)
    return

  if (draftStore.state.toolMusicEnabled) {
    draftStore.setTools({ toolMusicEnabled: false })
    musicError.value = ''
    return
  }

  musicProvisioning.value = true
  musicError.value = ''
  try {
    const providerBaseUrl = providersStore.getProviderConfig('airi-audio-server')?.baseUrl as string | undefined
    const outcome = await ensureMusicToolProvisioned({ providerBaseUrl })
    if (!outcome.ok) {
      musicError.value = describeMusicProvisionFailure(outcome.reason)
      return
    }
    draftStore.setTools({ toolMusicEnabled: true })
  }
  catch (err) {
    console.error('[StepTools] Failed to provision the music tool:', err)
    musicError.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    musicProvisioning.value = false
  }
}

// --- Motion engine pre-warm (lives in the card's badge slot) ---
const motionPrewarming = computed(() => textToMotionStore.isPrewarming)
const motionReady = computed(() => textToMotionStore.engineReady)

async function triggerMotionPrewarm() {
  if (motionPrewarming.value || motionReady.value)
    return

  try {
    // Also commits the motion engine selection to FlowMDM once the engine is
    // available, so generation actually uses the downloaded weights.
    await textToMotionStore.prewarmEngine()
  }
  catch (err) {
    console.warn('[StepTools] Motion engine pre-warm failed:', err)
  }
}

// --- Tool grid descriptors ---
type ToolCardId = 'web' | 'memory' | 'snapshots' | 'image' | 'music' | 'motion' | 'terminal' | 'files' | 'plugins'
type ToolSectionId = 'find' | 'create' | 'work'

interface ToolCardBadge {
  key: string
  tone: 'neutral' | 'amber'
}

interface ToolCardDef {
  id: ToolCardId
  section: ToolSectionId
  icon: string
  tint: string
  badge?: ToolCardBadge
  available: () => boolean
  enabled: () => boolean
  setEnabled: (value: boolean) => void
}

const TOOL_CARDS: ToolCardDef[] = [
  {
    id: 'web',
    section: 'find',
    icon: 'i-solar:global-bold-duotone',
    tint: 'bg-sky-500/15 text-sky-500',
    available: () => isDesktop.value,
    enabled: () => Boolean(draftStore.state.mcpWebSearchEnabled),
    setEnabled: value => draftStore.setTools({ mcpWebSearchEnabled: value }),
  },
  {
    id: 'memory',
    section: 'find',
    icon: 'i-solar:notebook-bookmark-bold-duotone',
    tint: 'bg-emerald-500/15 text-emerald-500',
    available: () => true,
    enabled: () => draftStore.state.memoryLongTermJournalEnabled !== false,
    setEnabled: value => draftStore.setMemory({ longTermJournalEnabled: value }),
  },
  {
    id: 'snapshots',
    section: 'find',
    icon: 'i-solar:camera-bold-duotone',
    tint: 'bg-teal-500/15 text-teal-500',
    badge: { key: 'onboarding.steps.tools.desktopOnly', tone: 'amber' },
    available: () => isDesktop.value,
    enabled: () => Boolean(draftStore.state.toolScreenshotEnabled),
    setEnabled: value => draftStore.setTools({ toolScreenshotEnabled: value }),
  },
  {
    id: 'image',
    section: 'create',
    icon: 'i-solar:palette-bold-duotone',
    tint: 'bg-purple-500/15 text-purple-500',
    available: () => hasArtistry.value,
    enabled: () => Boolean(draftStore.state.artistryImageJournalToolEnabled),
    setEnabled: value => draftStore.setArtistry({ imageJournalToolEnabled: value }),
  },
  {
    id: 'music',
    section: 'create',
    icon: 'i-solar:music-notes-bold-duotone',
    tint: 'bg-fuchsia-500/15 text-fuchsia-500',
    badge: { key: 'onboarding.steps.tools.badges.audioServerRequired', tone: 'amber' },
    available: () => true,
    enabled: () => Boolean(draftStore.state.toolMusicEnabled),
    setEnabled: value => draftStore.setTools({ toolMusicEnabled: value }),
  },
  {
    id: 'motion',
    section: 'create',
    icon: 'i-solar:running-2-bold-duotone',
    tint: 'bg-rose-500/15 text-rose-500',
    available: () => isVrmModel.value,
    enabled: () => Boolean(draftStore.state.toolMotionGeneratorEnabled),
    setEnabled: value => draftStore.setTools({ toolMotionGeneratorEnabled: value }),
  },
  {
    id: 'terminal',
    section: 'work',
    icon: 'i-solar:code-square-bold-duotone',
    tint: 'bg-violet-500/15 text-violet-500',
    badge: { key: 'onboarding.steps.tools.badges.builtInWorkspace', tone: 'neutral' },
    available: () => true,
    enabled: () => Boolean(draftStore.state.toolTerminalEnabled),
    setEnabled: value => draftStore.setTools({ toolTerminalEnabled: value }),
  },
  {
    id: 'files',
    section: 'work',
    icon: 'i-solar:folder-with-files-bold-duotone',
    tint: 'bg-amber-500/15 text-amber-500',
    badge: { key: 'onboarding.steps.tools.desktopOnly', tone: 'amber' },
    available: () => isDesktop.value,
    enabled: () => Boolean(draftStore.state.mcpFilesystemEnabled),
    setEnabled: value => draftStore.setTools({ mcpFilesystemEnabled: value }),
  },
  {
    id: 'plugins',
    section: 'work',
    icon: 'i-solar:server-square-bold-duotone',
    tint: 'bg-indigo-500/15 text-indigo-500',
    badge: { key: 'onboarding.steps.tools.badges.setupInCardConfig', tone: 'neutral' },
    available: () => true,
    enabled: () => Boolean(draftStore.state.toolCustomMcpEnabled),
    setEnabled: value => draftStore.setTools({ toolCustomMcpEnabled: value }),
  },
]

const SECTIONS: ToolSectionId[] = ['find', 'create', 'work']

const toolCards = computed(() => TOOL_CARDS.filter(card => card.available()))

const sections = computed(() => SECTIONS
  .map(id => ({
    id,
    label: t(`onboarding.steps.tools.sections.${id}`),
    cards: toolCards.value.filter(card => card.section === id),
  }))
  .filter(section => section.cards.length > 0))

const enabledCount = computed(() => toolCards.value.filter(card => card.enabled()).length)

function titleKey(card: ToolCardDef): string {
  return `onboarding.steps.tools.cards.${card.id}.title`
}

function descriptionKey(card: ToolCardDef): string {
  return `onboarding.steps.tools.cards.${card.id}.description`
}

function isCardPending(card: ToolCardDef): boolean {
  return card.id === 'music' && musicProvisioning.value
}

async function toggleCard(card: ToolCardDef) {
  if (isCardPending(card))
    return
  if (card.id === 'music') {
    await handleToggleMusic()
    return
  }
  card.setEnabled(!card.enabled())
}

onMounted(async () => {
  if (displayModelsStore.displayModels.length === 0) {
    await displayModelsStore.loadDisplayModelsFromIndexedDB?.(true)
  }
  // Pre-warm state lives on the store and is derived from Cache Storage, so
  // returning to this step does not reset an already warmed engine to "Pre-warm".
  void textToMotionStore.refreshPrewarmState()
})
</script>

<template>
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['w-full max-w-[1280px] mx-auto flex-1 min-h-0 min-w-0 overflow-y-auto px-1 pt-1 pb-5 flex flex-col gap-6']">
      <!-- Shared centered header -->
      <div :class="['flex flex-col items-center text-center gap-2.5']">
        <h1 :class="['text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white']">
          {{ t('onboarding.steps.tools.title') }}
        </h1>
        <p :class="['text-sm text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed']">
          {{ t('onboarding.steps.tools.description') }}
        </p>
        <AssistantBubble
          :message="t('onboarding.steps.tools.greeting')"
          step-key="tools"
          sticker-id="lupin-cheer"
          tone="primary"
        />
      </div>

      <!-- Capability grid.
           Wide: three section columns exactly like the design.
           Narrow: `display: contents` dissolves each section wrapper so its
           header spans the row and its cards flow through the same grid —
           no per-section column stacks, no dead vertical space. -->
      <div :class="['grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 items-start']">
        <section
          v-for="(section, index) in sections"
          :key="section.id"
          :class="['contents xl:flex xl:flex-col xl:gap-3 xl:min-w-0']"
        >
          <h2
            :class="[
              'col-span-full xl:col-span-1 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500',
              index === 0 ? '' : 'mt-6 xl:mt-0',
            ]"
          >
            {{ section.label }}
          </h2>

          <article
            v-for="card in section.cards"
            :key="card.id"
            :class="[
              'rounded-2xl border p-4 flex flex-col gap-3 min-w-0 transition-all',
              section.cards.length === 1 ? 'md:col-span-2' : '',
              card.enabled()
                ? 'border-primary-500/50 bg-primary-500/5 shadow-sm dark:border-primary-400/30 dark:bg-primary-500/10'
                : 'border-neutral-200/80 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/40',
            ]"
          >
            <!-- Icon, title, toggle, info -->
            <div :class="['flex items-start justify-between gap-2']">
              <div :class="['flex items-start gap-3 min-w-0']">
                <div :class="[card.tint, 'h-10 w-10 rounded-xl flex items-center justify-center shrink-0']">
                  <div :class="[card.icon, 'text-xl']" />
                </div>
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white leading-snug pt-2 min-w-0']">
                  {{ t(titleKey(card)) }}
                </h3>
              </div>

              <div :class="['flex items-center gap-1.5 shrink-0']">
                <button
                  type="button"
                  role="switch"
                  :aria-checked="card.enabled()"
                  :aria-label="t(titleKey(card))"
                  :aria-busy="isCardPending(card)"
                  :disabled="isCardPending(card)"
                  :class="[
                    'relative inline-flex h-6 w-11 items-center shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    card.enabled() ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
                    isCardPending(card) ? 'opacity-60 cursor-wait' : 'cursor-pointer',
                  ]"
                  @click="toggleCard(card)"
                >
                  <span
                    aria-hidden="true"
                    :class="[
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      card.enabled() ? 'translate-x-5' : 'translate-x-0',
                    ]"
                  />
                </button>

                <button
                  type="button"
                  :title="t(descriptionKey(card))"
                  :aria-label="t(descriptionKey(card))"
                  :class="['p-0.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-help']"
                >
                  <div :class="['i-solar:info-circle-bold text-base']" />
                </button>
              </div>
            </div>

            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
              {{ t(descriptionKey(card)) }}
            </p>

            <span
              v-if="card.badge"
              :class="[
                'self-start text-[10px] font-semibold px-2 py-0.5 rounded-md',
                card.badge.tone === 'amber'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
              ]"
            >
              {{ t(card.badge.key) }}
            </span>

            <!-- Motion creation: engine pre-warm occupies the badge slot -->
            <div v-if="card.id === 'motion' && card.enabled()" :class="['flex flex-col gap-2 pt-0.5']">
              <button
                v-if="!motionReady"
                type="button"
                :disabled="motionPrewarming"
                :class="[
                  'px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all cursor-pointer self-start',
                  motionPrewarming
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                    : 'bg-rose-600 hover:bg-rose-500 text-white border-transparent shadow-sm shadow-rose-600/25',
                ]"
                @click="triggerMotionPrewarm"
              >
                <div
                  :class="[
                    motionPrewarming ? 'i-solar:restart-bold animate-spin' : 'i-solar:download-minimalistic-bold',
                    'w-3.5 h-3.5',
                  ]"
                />
                <span>
                  {{
                    motionPrewarming
                      ? t('onboarding.steps.tools.downloadingShardsValue', { percentage15: textToMotionStore.downloadProgress.percentage })
                      : t('onboarding.steps.tools.preWarmDownloadEngine')
                  }}
                </span>
              </button>

              <span
                v-else
                :class="['self-start inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300']"
              >
                <div :class="['i-solar:check-circle-bold w-3 h-3']" />
                {{ t('onboarding.steps.tools.preWarmedCached') }}
              </span>

              <div v-if="motionPrewarming" :class="['w-full h-1.5 bg-rose-500/15 rounded-full overflow-hidden']">
                <div
                  :class="['h-full bg-rose-500 rounded-full transition-all duration-300']"
                  :style="{ width: `${textToMotionStore.downloadProgress.percentage}%` }"
                />
              </div>
            </div>

            <!-- Music provisioning failure -->
            <div
              v-if="card.id === 'music' && musicError"
              :class="['text-[11px] text-rose-600 dark:text-rose-300 leading-relaxed']"
            >
              {{ musicError }}
            </div>
          </article>
        </section>
      </div>

      <!-- Fine-tuning hint -->
      <div :class="['rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-start gap-2.5 text-xs text-sky-700 dark:text-sky-300']">
        <div :class="['i-solar:info-circle-bold text-sky-500 text-base shrink-0 mt-0.5']" />
        <span :class="['leading-relaxed']">{{ t('onboarding.steps.tools.hint') }}</span>
      </div>
    </div>

    <!-- Navigation Footer -->
    <div :class="['w-full max-w-[1280px] mx-auto flex items-center justify-between gap-3 pt-3 px-1 border-t border-neutral-200/80 dark:border-white/5 shrink-0']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        {{ t('onboarding.shell.previous') }}
      </button>

      <span :class="['hidden sm:inline text-[11px] font-mono text-neutral-400 dark:text-neutral-500 text-center']">
        {{ t('onboarding.steps.tools.footer.toolsEnabled', { count: enabledCount }, enabledCount) }}
      </span>

      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer flex items-center gap-1.5']"
        @click="props.onNext"
      >
        <span>{{ t('onboarding.shell.next') }}</span>
        <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
      </button>
    </div>
  </div>
</template>
