<script setup lang="ts">
import { SPOTLIGHT_MODELS } from '@proj-airi/stage-ui/constants'
import { STARTER_CHARACTERS } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { Button } from '@proj-airi/ui'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import CardImportWizard from '../../../../../../../../stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue'

import { useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draft = useOnboardingV3Draft()
const displayModelsStore = useDisplayModelsStore()

type PersonaTab = 'presets' | 'hub'
const activeTab = ref<PersonaTab>(draft.state.personaSource === 'import' ? 'hub' : 'presets')

// User's name from Step 4 Profile
const userName = computed(() => draft.state.userName?.trim() || 'Richard')
const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

function formatField(text?: string) {
  if (!text)
    return ''
  return text.replace(USER_TOKEN_REGEX, userName.value).replace(/\bRichard\b/g, userName.value)
}

const CHARACTER_EMOJIS: Record<string, string> = {
  default: '🌸',
  aria: '🔬',
  lupin: '🛡️',
  kira: '⚡',
  rin: '❄️',
  yuki: '💜',
  mio: '🍃',
  hana: '☀️',
}

const CHARACTER_GLOWS: Record<string, { ring: string, activeBg: string, text: string }> = {
  default: { ring: 'border-pink-500', activeBg: 'bg-pink-500/5', text: 'text-pink-500' },
  aria: { ring: 'border-sky-500', activeBg: 'bg-sky-500/5', text: 'text-sky-500' },
  lupin: { ring: 'border-amber-500', activeBg: 'bg-amber-500/5', text: 'text-amber-500' },
  kira: { ring: 'border-rose-500', activeBg: 'bg-rose-500/5', text: 'text-rose-500' },
  rin: { ring: 'border-cyan-500', activeBg: 'bg-cyan-500/5', text: 'text-cyan-500' },
  yuki: { ring: 'border-purple-500', activeBg: 'bg-purple-500/5', text: 'text-purple-500' },
  mio: { ring: 'border-emerald-500', activeBg: 'bg-emerald-500/5', text: 'text-emerald-500' },
  hana: { ring: 'border-orange-500', activeBg: 'bg-orange-500/5', text: 'text-orange-500' },
}

// Starter character presets list
const starterPresets = computed(() => {
  return Object.values(STARTER_CHARACTERS).map((c) => {
    const style = CHARACTER_GLOWS[c.id] || { ring: 'border-primary-500', activeBg: 'bg-primary-500/5', text: 'text-primary-500' }
    return {
      id: c.id,
      name: c.name,
      tag: c.tag,
      emoji: CHARACTER_EMOJIS[c.id] || '✨',
      desc: c.description,
      ring: style.ring,
      activeBg: style.activeBg,
      textAccent: style.text,
      personality: c.personality,
      scenario: c.scenario,
      greeting: (c.greetings[0] || '').replace(USER_TOKEN_REGEX, userName.value),
    }
  })
})

function applyPersonaToDraft(persona: { cardId?: string, source?: 'preset' | 'import', importedCardDraft?: any }) {
  if (typeof (draft as any).setPersona === 'function') {
    draft.setPersona(persona)
  }
  else if (draft.state) {
    if (persona.cardId !== undefined)
      draft.state.personaCardId = persona.cardId
    if (persona.source !== undefined)
      draft.state.personaSource = persona.source
    if (persona.importedCardDraft !== undefined)
      draft.state.importedCardDraft = persona.importedCardDraft
  }
}

const selectedPresetId = computed({
  get: () => draft.state.personaSource === 'import' ? '' : (draft.state.personaCardId || 'default'),
  set: (id: string) => {
    applyPersonaToDraft({ cardId: id, source: 'preset' })
  },
})

function selectPreset(id: string) {
  selectedPresetId.value = id
}

// --- Community Hub & Electron Webview Interceptor ---
const hubSources = [
  {
    name: 'DataCat',
    rating: '5 / 5 ⭐',
    badge: 'Recommended',
    note: 'Best-in-class AIRI integration, ultra-clean UI, direct SillyTavern JSON & PNG exports.',
    url: 'https://datacat.run/fresh',
  },
  {
    name: 'Chub AI',
    rating: '4 / 5 ⭐',
    badge: 'Popular',
    note: 'Massive character library. Click "Search without login" to browse freely and download V2 PNG cards.',
    url: 'https://chub.ai',
  },
  {
    name: 'Risu Realm',
    rating: '4 / 5 ⭐',
    note: 'Great community character hub supporting standard PNG (V2) card format.',
    url: 'https://realm.risuai.net',
  },
  {
    name: 'JannyAI',
    rating: '3 / 5 ⭐',
    note: 'Large repository of anime & game characters with direct download links.',
    url: 'https://jannyai.com',
  },
]

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)
const activeBrowserSource = ref<{ name: string, url: string } | null>(null)

function openHubSource(source: { name: string, url: string }) {
  if (isElectron.value) {
    activeBrowserSource.value = source
  }
  else if (typeof window !== 'undefined') {
    window.open(source.url, '_blank', 'noopener,noreferrer')
  }
}

function closeWebview() {
  activeBrowserSource.value = null
}

let removeIpcListener = () => {}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

function parsePngCharaPayload(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  for (let offset = 8; offset < bytes.length - 8;) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    if (type === 'tEXt') {
      const data = bytes.slice(offset + 8, offset + 8 + length)
      const sep = data.indexOf(0)
      const keyword = new TextDecoder().decode(data.slice(0, sep))
      if (sep > 0 && keyword === 'chara') {
        const decodedB64 = new TextDecoder().decode(data.slice(sep + 1))
        const jsonStr = base64ToUtf8(decodedB64)
        return JSON.parse(jsonStr)
      }
    }
    offset += 12 + length
  }
  throw new Error('PNG does not contain a supported chara payload')
}

function parseImportedCard(content: string) {
  const parsed = JSON.parse(content)
  if (parsed?.format === 'airi-card' && parsed?.version === 1 && parsed?.card)
    return parsed.card
  return parsed
}

const importError = ref('')
const isWizardOpen = ref(false)
const wizardCardData = ref<any>(null)

async function handleCharaCardDownloaded(payload: { base64Data: string, filename: string, ext: string }) {
  try {
    const rawData = atob(payload.base64Data)
    const arrayBuffer = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(arrayBuffer)
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i)
    }

    const importedCard = payload.ext === 'png'
      ? parsePngCharaPayload(arrayBuffer)
      : parseImportedCard(new TextDecoder('utf-8').decode(arrayBuffer))

    // Close webview drawer
    activeBrowserSource.value = null

    // Open import wizard modal in draft-only mode
    wizardCardData.value = importedCard
    isWizardOpen.value = true
    toast.success(`Intercepted character card "${payload.filename}"!`)
  }
  catch (err: any) {
    console.error('[Onboarding:Step6] Failed to process intercepted card:', err)
    importError.value = `Failed to parse card: ${err?.message || err}`
    toast.error(importError.value)
  }
}

async function handleImportFiles(files: FileList | null) {
  importError.value = ''
  const file = files?.[0]
  if (!file)
    return
  try {
    const isPng = file.name.toLowerCase().endsWith('.png')
    const card = isPng
      ? parsePngCharaPayload(await file.arrayBuffer())
      : parseImportedCard(await file.text())

    wizardCardData.value = card
    isWizardOpen.value = true
    toast.info(`Opening card preview for ${file.name}...`)
  }
  catch (err: any) {
    importError.value = err instanceof Error ? err.message : String(err)
    toast.error(`Import failed: ${importError.value}`)
  }
}

function handleWizardSubmitDraft(finalCard: any) {
  applyPersonaToDraft({
    source: 'import',
    importedCardDraft: finalCard,
    cardId: finalCard?.id || finalCard?.data?.name || 'custom-import',
  })
  toast.success(`Mounted custom card "${importedName.value}" to draft!`)
}

const importedName = computed(() => {
  const draftCard = draft.state.importedCardDraft as any
  if (!draftCard)
    return ''
  return ('data' in draftCard ? draftCard.data?.name : draftCard?.name) || draftCard?.name || 'Imported Card'
})

function clearImported() {
  applyPersonaToDraft({ source: 'preset', cardId: 'default', importedCardDraft: undefined })
  toast.info('Cleared imported card; reverted to ReLU preset.')
}

// Pairing resolution
const vesselName = computed(() => {
  const id = draft.state.vesselDisplayModelId
  if (!id)
    return 'Hiyori (Live2D)'
  if (id === 'preset-live2d-2')
    return 'Hiyori (Live2D)'
  if (id === 'preset-vrm-2')
    return 'Seed Girl (VRM)'
  if (id === 'preset-vrm-1')
    return 'AvatarSample_A (VRM)'
  const spotlight = SPOTLIGHT_MODELS.find(m => m.id === id)
  if (spotlight)
    return `${spotlight.name} (${spotlight.formatLabel || spotlight.format.toUpperCase()})`
  const custom = displayModelsStore.displayModels.find(m => m.id === id)
  if (custom)
    return `${custom.name || custom.id} (Custom)`
  return id
})

const activePersonaLabel = computed(() => {
  if (draft.state.personaSource === 'import' && importedName.value) {
    return `${importedName.value} (Imported)`
  }
  const id = draft.state.personaCardId || 'default'
  const preset = STARTER_CHARACTERS[id]
  return preset ? `${preset.name} (${preset.tag})` : 'ReLU'
})

onMounted(() => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const handler = (_event: any, payload: { base64Data: string, filename: string, ext: string }) => {
      handleCharaCardDownloaded(payload)
    }
    const ipcRenderer = (window as any).electron.ipcRenderer
    ipcRenderer.on('chara-card-downloaded', handler)
    removeIpcListener = () => {
      if (ipcRenderer.removeListener) {
        ipcRenderer.removeListener('chara-card-downloaded', handler)
      }
    }
  }
})

onBeforeUnmount(() => {
  removeIpcListener()
})
</script>

<template>
  <div :class="['h-full w-full max-w-5xl mx-auto flex flex-col justify-between gap-3 select-none animate-fadeIn']">
    <!-- Header -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -6 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :class="['flex-shrink-0']"
    >
      <div :class="['flex items-center justify-between text-xs text-neutral-400 mb-0.5']">
        <span :class="['text-primary-500 font-semibold']">Step 7 of 16</span>
        <span :class="['font-medium tracking-wide uppercase']">Personality Core</span>
      </div>
      <div :class="['flex items-center justify-between']">
        <div>
          <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Soul & Persona
          </h2>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Pure personality — bodies come first, and any soul pairs with any form.
          </p>
        </div>
        <div :class="['flex items-center gap-2']">
          <span :class="['px-3 py-1 rounded-full text-xs font-medium border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-300 backdrop-blur-md']">
            🎭 {{ starterPresets.length }} Anime Tropes
          </span>
        </div>
      </div>
    </div>

    <!-- Segmented Tabs Switcher (Starter Cards vs Community Hub) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 4 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :delay="80"
      :class="['flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/5 text-xs font-semibold flex-shrink-0']"
    >
      <button
        type="button"
        :class="[
          'flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
          activeTab === 'presets'
            ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
        ]"
        @click="activeTab = 'presets'"
      >
        <span class="text-sm">✨</span>
        <span>Starter Cards ({{ starterPresets.length }})</span>
      </button>

      <button
        type="button"
        :class="[
          'flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2',
          activeTab === 'hub'
            ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
        ]"
        @click="activeTab = 'hub'"
      >
        <span class="text-sm">🪐</span>
        <span>Community Hub & SillyTavern Cards</span>
        <span
          v-if="draft.state.personaSource === 'import' && importedName"
          :class="['px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold']"
        >
          Active
        </span>
      </button>
    </div>

    <!-- Main Content Area -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1']">
      <!-- TAB 1: Starter Cards Grid (8 anime tropes) -->
      <div
        v-if="activeTab === 'presets'"
        :class="['grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2']"
      >
        <div
          v-for="preset in starterPresets"
          :key="preset.id"
          :class="[
            'p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between gap-2.5',
            'backdrop-blur-md relative overflow-hidden',
            selectedPresetId === preset.id
              ? [preset.ring, preset.activeBg, 'shadow-md border-2']
              : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700',
          ]"
          @click="selectPreset(preset.id)"
        >
          <!-- Top Row: Avatar Badge + Name + Trope + Radio -->
          <div :class="['flex items-start justify-between gap-2']">
            <div :class="['flex items-center gap-2.5 min-w-0']">
              <div :class="['h-9 w-9 rounded-xl flex items-center justify-center text-lg bg-neutral-100 dark:bg-neutral-800 shadow-2xs flex-shrink-0']">
                {{ preset.emoji }}
              </div>
              <div :class="['min-w-0 flex-1']">
                <div :class="['flex items-center gap-1.5 flex-wrap']">
                  <span :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                    {{ preset.name }}
                  </span>
                  <span :class="['px-2 py-0.2 rounded-full text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300']">
                    {{ preset.tag }}
                  </span>
                </div>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1']">
                  {{ preset.desc }}
                </p>
              </div>
            </div>

            <!-- Radio Indicator + Lore Popover -->
            <div :class="['flex items-center gap-1 flex-shrink-0']">
              <PopoverRoot>
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    :class="['h-6 w-6 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer']"
                    title="View Lore & Scenario"
                    @click.stop
                  >
                    <div :class="['i-solar:info-circle-bold-duotone h-4 w-4']" />
                  </button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    align="end"
                    :side-offset="6"
                    :class="['z-50 max-w-sm p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-md text-xs']"
                  >
                    <div :class="['flex items-center gap-2 mb-2']">
                      <span class="text-base">{{ preset.emoji }}</span>
                      <span :class="['font-bold text-neutral-900 dark:text-white']">{{ preset.name }}</span>
                      <span :class="['px-2 py-0.2 rounded-full text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300']">{{ preset.tag }}</span>
                    </div>
                    <div :class="['space-y-2 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed']">
                      <div>
                        <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">Personality: </span>
                        <span>{{ formatField(preset.personality) }}</span>
                      </div>
                      <div>
                        <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">Scenario: </span>
                        <span>{{ formatField(preset.scenario) }}</span>
                      </div>
                    </div>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>

              <div
                :class="[
                  'h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-all',
                  selectedPresetId === preset.id
                    ? [preset.ring, 'bg-white dark:bg-neutral-900']
                    : 'border-neutral-300 dark:border-neutral-700',
                ]"
              >
                <div
                  v-if="selectedPresetId === preset.id"
                  :class="['h-2 w-2 rounded-full bg-current', preset.textAccent]"
                />
              </div>
            </div>
          </div>

          <!-- Bottom: Live Sample First Greeting -->
          <div :class="['p-2 px-2.5 rounded-xl bg-neutral-100/60 dark:bg-black/30 border border-neutral-200/50 dark:border-white/5 flex items-start gap-1.5']">
            <span :class="['text-xs text-neutral-400 mt-0.5 flex-shrink-0']">💬</span>
            <span :class="['text-[11px] text-neutral-600 dark:text-neutral-300 italic line-clamp-2']">
              "{{ formatField(preset.greeting) }}"
            </span>
          </div>
        </div>
      </div>

      <!-- TAB 2: Community Hub & Electron Interceptor -->
      <div
        v-else
        :class="['flex flex-col gap-3 pb-2']"
      >
        <!-- Notice Banner -->
        <div :class="['p-3.5 rounded-2xl border border-primary-500/30 bg-primary-500/10 backdrop-blur-md flex items-start gap-3']">
          <div :class="['i-solar:info-circle-bold-duotone text-lg text-primary-500 flex-shrink-0 mt-0.5']" />
          <div :class="['text-xs leading-relaxed text-neutral-700 dark:text-neutral-200']">
            <span :class="['font-bold text-neutral-900 dark:text-white']">Automatic Card Interceptor: </span>
            Browse any repository below and click to download any SillyTavern V2 character PNG or JSON card. AIRI automatically captures the download stream, parses the embedded metadata, and stages your companion.
          </div>
        </div>

        <!-- 4 Community Repositories Grid -->
        <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-3']">
          <div
            v-for="source in hubSources"
            :key="source.name"
            :class="[
              'p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60',
              'backdrop-blur-md flex flex-col justify-between gap-2 hover:border-primary-500/50 transition-all cursor-pointer group',
            ]"
            @click="openHubSource(source)"
          >
            <div :class="['flex items-center justify-between']">
              <div :class="['flex items-center gap-2']">
                <span :class="['text-xs font-bold text-neutral-900 dark:text-white group-hover:text-primary-500 transition-colors']">
                  {{ source.name }}
                </span>
                <span
                  v-if="source.badge"
                  :class="['px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary-500/15 text-primary-600 dark:text-primary-400']"
                >
                  {{ source.badge }}
                </span>
              </div>
              <div :class="['flex items-center gap-1 text-[10px] text-amber-500 font-bold']">
                <span>{{ source.rating }}</span>
                <div :class="['i-solar:arrow-up-right-linear text-xs text-neutral-400 group-hover:text-primary-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform']" />
              </div>
            </div>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight']">
              {{ source.note }}
            </p>
          </div>
        </div>

        <!-- File Drag & Drop Seam -->
        <label
          :class="[
            'p-4 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700/80',
            'bg-neutral-50/50 dark:bg-neutral-900/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50',
            'flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center',
          ]"
        >
          <div :class="['i-solar:cloud-upload-bold-duotone text-2xl text-neutral-400']" />
          <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            Drop a SillyTavern character card or click to browse
          </span>
          <span :class="['text-[10px] text-neutral-400']">
            Supports PNG character cards with embedded tEXt chara chunks or CCv2/CCv3 JSON files.
          </span>
          <input
            type="file"
            accept=".png,.json"
            class="hidden"
            @change="(e: Event) => handleImportFiles((e.target as HTMLInputElement).files)"
          >
        </label>

        <!-- Import Error Alert -->
        <div
          v-if="importError"
          :class="['p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400']"
        >
          {{ importError }}
        </div>

        <!-- Staged Imported Card Banner -->
        <div
          v-if="draft.state.personaSource === 'import' && importedName"
          :class="['p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 backdrop-blur-md flex items-center justify-between gap-3']"
        >
          <div :class="['flex items-center gap-3 min-w-0']">
            <div :class="['h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 text-lg']">
              ✓
            </div>
            <div :class="['min-w-0']">
              <div :class="['text-xs font-bold text-neutral-900 dark:text-white truncate flex items-center gap-1.5']">
                <span>{{ importedName }}</span>
                <span :class="['px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold']">
                  Staged Custom Card
                </span>
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
                Active in onboarding draft — ready to synthesize onto your companion.
              </p>
            </div>
          </div>
          <button
            type="button"
            :class="['text-xs text-neutral-400 hover:text-red-500 underline cursor-pointer flex-shrink-0 transition-colors']"
            @click="clearImported"
          >
            Clear / Revert
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation & Synergy Preview -->
    <div
      :class="[
        'h-14 border-t border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between flex-shrink-0 pt-2',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back to Vessel</span>
      </button>

      <!-- Synergy Preview Pill -->
      <div :class="['text-[11px] text-neutral-400 font-medium truncate max-w-sm hidden sm:block text-center']">
        <span>Soul: </span>
        <span :class="['text-neutral-800 dark:text-neutral-200 font-bold']">{{ activePersonaLabel }}</span>
        <span :class="['mx-1.5 text-neutral-300 dark:text-neutral-600']">•</span>
        <span>Body: </span>
        <span :class="['text-neutral-800 dark:text-neutral-200 font-bold']">{{ vesselName }}</span>
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
        <span>Next: Hearing (STT)</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>

    <!-- Import Wizard Modal for draft-only persona synthesis -->
    <CardImportWizard
      v-if="wizardCardData"
      v-model="isWizardOpen"
      :card-data="wizardCardData"
      :draft-only="true"
      @submit-draft="handleWizardSubmitDraft"
    />

    <!-- Backdrop Overlay for Webview Drawer -->
    <div
      v-if="isElectron && activeBrowserSource"
      class="backdrop-blur-xs fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
      @click="closeWebview"
    />

    <!-- Electron In-App Webview Side Drawer with automatic card download interceptor -->
    <div
      v-if="isElectron"
      :class="[
        'fixed inset-y-0 right-0 z-50 w-[70vw] border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-500 ease-in-out dark:border-neutral-800 dark:bg-neutral-900',
        activeBrowserSource ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none',
      ]"
    >
      <div class="relative z-10 h-full flex flex-col">
        <div class="relative z-20 flex items-center justify-between border-b border-neutral-200 bg-white/95 p-4 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95">
          <div class="flex items-center gap-3">
            <h3 class="text-lg text-neutral-800 font-bold dark:text-neutral-200">
              Browse {{ activeBrowserSource?.name }}
            </h3>
            <span class="rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs text-primary-600 font-semibold dark:text-primary-400">
              Card Interceptor Active
            </span>
          </div>
          <button
            type="button"
            class="relative z-30 flex cursor-pointer items-center justify-center rounded-xl p-2 text-neutral-400 transition-colors active:scale-95 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            title="Close Browser"
            @click.stop="closeWebview"
          >
            <div class="i-solar:close-square-bold-duotone h-6 w-6" />
          </button>
        </div>
        <div class="relative z-10 flex-1 bg-white dark:bg-neutral-950">
          <component
            is="webview"
            v-if="activeBrowserSource"
            :src="activeBrowserSource.url"
            class="h-full w-full"
            allowpopups
          />
        </div>
      </div>
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
