<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'

import CardImportWizard from '../../../../../../../../stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue'
import CompanionBubble from '../components/companion-bubble.vue'

import { STARTER_CHARACTERS } from '../../../../../../constants/prompts/character-defaults'
import { useOnboardingV2Draft } from '../draft-store'
import { onboardingV2GateKey } from '../gate'

// V2 onboarding — Step 4: Soul & Persona (Transient Draft Composition).
// Principle 6: selections record into `draft.persona` ONLY. No `activateCard`,
// no `updateCard`, no IndexedDB writes — the active card library is never
// touched mid-onboarding. Atomic synthesis is deferred to Step 7.

type TierId = 'presets' | 'hub' | 'wizard'

const draft = useOnboardingV2Draft()

const activeTier = ref<TierId>('presets')

// Live name replacement: replaces 'Richard' with user's custom name from Step 3 draft.
const userName = computed(() => draft.state.userProfile?.name?.trim() || 'Richard')

const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

function formatField(text?: string) {
  if (!text)
    return ''
  return text.replace(/\bRichard\b/g, userName.value)
}

// Starter presets computed directly from central STARTER_CHARACTERS single source of truth
const presets = computed(() => {
  return Object.values(STARTER_CHARACTERS).map(c => ({
    id: c.id,
    name: c.name,
    tag: c.tag,
    desc: c.description,
    accent: c.accent,
    ring: c.ring,
    personality: c.personality,
    scenario: c.scenario.replace(USER_TOKEN_REGEX, userName.value),
    greeting: (c.greetings[0] || '').replace(USER_TOKEN_REGEX, userName.value),
  }))
})

// Persona selection reads from the draft (resume mid-flow), not the card store.
const selectedPresetId = computed({
  get: () => draft.state.persona.source === 'preset' ? draft.state.persona.cardId ?? '' : '',
  set: (id: string) => selectPreset(id),
})

function selectPreset(id: string) {
  draft.setPersona({ cardId: id, source: 'preset' })
}

// --- Tier 2: community import → in-memory draft (no card-library write) ---
const hubSources = [
  {
    name: 'DataCat',
    rating: '5 / 5 ⭐',
    badge: 'Recommended',
    note: 'Best-in-class AIRI integration, ultra-clean UI, no ads or redirects. Direct SillyTavern JSON & PNG exports.',
    url: 'https://datacat.run/fresh',
  },
  {
    name: 'Chub AI',
    rating: '4 / 5 ⭐',
    note: 'Massive character library. Tip: click "Search without login" if prompted to browse freely and download V2 PNG cards.',
    url: 'https://chub.ai',
  },
  {
    name: 'Risu Realm',
    rating: '4 / 5 ⭐',
    note: 'Great community character hub. Look for cards supporting standard PNG (V2) card format.',
    url: 'https://realm.risuai.net',
  },
  {
    name: 'JannyAI',
    rating: '1 / 5 ⭐',
    note: 'Legacy provider. May experience redirect popups or multi-click navigation.',
    url: 'https://jannyai.com',
  },
]

// Check if running in Electron
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
  console.info('[Onboarding:Step4] Closing webview drawer')
  activeBrowserSource.value = null
}

let removeIpcListener = () => {}

async function handleCharaCardDownloaded(payload: { base64Data: string, filename: string, ext: string }) {
  try {
    console.info('[CardImport:Stage1:ElectronDownload]', {
      filename: payload.filename,
      ext: payload.ext,
      base64Length: payload.base64Data ? payload.base64Data.length : 0,
    })

    const rawData = atob(payload.base64Data)
    const arrayBuffer = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(arrayBuffer)
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i)
    }

    const importedCard = payload.ext === 'png'
      ? parsePngCharaPayload(arrayBuffer)
      : parseImportedCard(new TextDecoder('utf-8').decode(arrayBuffer))

    console.info('[CardImport:Stage2:ParsedResult]', {
      importedCard,
      topLevelKeys: Object.keys(importedCard),
      dataKeys: importedCard?.data ? Object.keys(importedCard.data) : null,
    })

    // Close webview drawer
    activeBrowserSource.value = null

    // Open import wizard modal in draft-only mode
    wizardCardData.value = importedCard
    isWizardOpen.value = true
  }
  catch (err) {
    console.error('[Onboarding:Step4] Failed to process intercepted card:', err)
    importError.value = 'Failed to parse intercepted card file'
  }
}

const importedName = computed(() => {
  const draftCard = draft.state.persona.importedCardDraft as any
  if (!draftCard)
    return ''
  return ('data' in draftCard ? draftCard.data?.name : draftCard?.name) || draftCard?.name || 'Imported Card'
})

function clearImported() {
  draft.setPersona({})
}

// In-memory parse helpers (ported from airi-card/index.vue; NO addCard() call).
function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

function parsePngCharaPayload(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  console.info('[CardImport:Stage2:PNGParseStart]', { totalBytes: bytes.length })
  for (let offset = 8; offset < bytes.length - 8;) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    if (type === 'tEXt') {
      const data = bytes.slice(offset + 8, offset + 8 + length)
      const sep = data.indexOf(0)
      const keyword = new TextDecoder().decode(data.slice(0, sep))
      console.info('[CardImport:Stage2:tEXtChunkFound]', { keyword, chunkLength: length })
      if (sep > 0 && keyword === 'chara') {
        const decodedB64 = new TextDecoder().decode(data.slice(sep + 1))
        const jsonStr = base64ToUtf8(decodedB64)
        console.info('[CardImport:Stage2:CharaPayloadDecoded]', { jsonStrLength: jsonStr.length, jsonStrSnippet: jsonStr.slice(0, 150) })
        const parsed = JSON.parse(jsonStr)
        console.info('[CardImport:Stage2:CharaPayloadParsed]', { parsedKeys: Object.keys(parsed), dataKeys: parsed.data ? Object.keys(parsed.data) : null })
        return parsed
      }
    }
    offset += 12 + length
  }
  throw new Error('PNG does not contain a supported chara payload')
}

function parseImportedCard(content: string) {
  const parsed = JSON.parse(content)
  console.info('[CardImport:Stage2:JSONParseStart]', { parsedKeys: Object.keys(parsed) })
  if (parsed?.format === 'airi-card' && parsed?.version === 1 && parsed?.card)
    return parsed.card
  return parsed
}

const importError = ref('')
const isWizardOpen = ref(false)
const wizardCardData = ref<any>(null)

async function handleImportFiles(files: FileList | null) {
  importError.value = ''
  const file = files?.[0]
  if (!file)
    return
  try {
    console.info('[CardImport:Stage1:FileSelected]', { filename: file.name, size: file.size })
    const isPng = file.name.toLowerCase().endsWith('.png')
    const card = isPng
      ? parsePngCharaPayload(await file.arrayBuffer())
      : parseImportedCard(await file.text())

    console.info('[CardImport:Stage2:FileParsedResult]', {
      card,
      topLevelKeys: Object.keys(card),
      dataKeys: card?.data ? Object.keys(card.data) : null,
    })

    wizardCardData.value = card
    isWizardOpen.value = true
  }
  catch (err) {
    importError.value = err instanceof Error ? err.message : String(err)
  }
}

function handleWizardSubmitDraft(finalCard: any) {
  console.info('[CardImport:Stage5:DraftCommitted]', { finalCard })
  draft.setPersona({ source: 'import', importedCardDraft: finalCard })
}

// --- Gate: a persona is chosen when a preset id or import draft exists ---
const verified = computed(() => !!draft.state.persona.cardId || !!draft.state.persona.importedCardDraft)

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('persona', {
    canProceed: computed(() => verified.value),
    skipLabel: 'Skip Step',
  })

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
  gate?.clearGate('persona')
  removeIpcListener()
})
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Soul & Persona
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Pure personality — bodies come next, and any soul pairs with any form.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="Select your companion's core persona. This defines her voice, personality traits, and behavioral prompt. You can customize her prompt or create additional cards under AIRI Cards in settings anytime later."
    />

    <!-- Tier tabs -->
    <div class="flex flex-shrink-0 items-center gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
      <button
        v-for="tier in [
          { id: 'presets', label: 'Starter Cards', icon: 'i-solar:stars-line-bold-duotone' },
          { id: 'hub', label: 'Community Hub', icon: 'i-solar:planet-bold-duotone' },
          { id: 'wizard', label: 'AI Creator', icon: 'i-solar:magic-stick-3-bold-duotone' },
        ]"
        :key="tier.id"
        :class="[
          'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
          activeTier === tier.id
            ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
        ]"
        @click="activeTier = tier.id as TierId"
      >
        <div :class="tier.icon" class="h-4 w-4" />
        {{ tier.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <!-- Tier 1: presets → draft.persona.cardId -->
      <div v-if="activeTier === 'presets'" class="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2">
        <button
          v-for="preset in presets"
          :key="preset.id"
          :class="[
            'flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300',
            selectedPresetId === preset.id
              ? `${preset.ring} bg-white/60 shadow-lg dark:bg-neutral-900/60`
              : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/40',
          ]"
          @click="selectPreset(preset.id)"
        >
          <div class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div class="i-solar:user-heart-rounded-bold-duotone h-5 w-5" :class="preset.accent" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
              <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] text-neutral-500 font-medium dark:bg-neutral-800 dark:text-neutral-400">{{ preset.tag }}</span>
            </div>
            <p class="mt-0.5 text-[11px] text-neutral-500 leading-tight dark:text-neutral-400">
              {{ preset.desc }}
            </p>
          </div>
          <PopoverRoot>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="h-6 w-6 flex flex-shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-200/50 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-200"
                title="Preview Card Details"
                @click.stop
              >
                <div class="i-solar:info-circle-bold-duotone h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent
                align="end"
                :side-offset="8"
                class="z-50 max-w-xs border border-neutral-200 rounded-xl bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ preset.name }}</span>
                  <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] text-neutral-500 font-medium dark:bg-neutral-800 dark:text-neutral-400">{{ preset.tag }}</span>
                </div>
                <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {{ preset.desc }}
                </p>

                <div class="mt-3 flex flex-col gap-2 text-[11px]">
                  <div>
                    <span class="text-neutral-700 font-bold dark:text-neutral-300">Personality: </span>
                    <span class="text-neutral-500 dark:text-neutral-400">{{ formatField(preset.personality) }}</span>
                  </div>
                  <div>
                    <span class="text-neutral-700 font-bold dark:text-neutral-300">Scenario: </span>
                    <span class="text-neutral-500 dark:text-neutral-400">{{ formatField(preset.scenario) }}</span>
                  </div>
                  <div class="rounded-lg bg-neutral-100/70 p-2 text-neutral-600 italic dark:bg-neutral-800/70 dark:text-neutral-300">
                    "{{ formatField(preset.greeting) }}"
                  </div>
                </div>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>

          <div
            class="h-4.5 w-4.5 flex flex-shrink-0 items-center justify-center border-2 rounded-full"
            :class="selectedPresetId === preset.id ? preset.ring : 'border-neutral-300 dark:border-neutral-600'"
          >
            <div v-if="selectedPresetId === preset.id" class="h-2 w-2 rounded-full bg-current" :class="preset.accent" />
          </div>
        </button>
      </div>

      <!-- Tier 2: community hub → draft.persona.importedCardDraft -->
      <div v-else-if="activeTier === 'hub'" class="flex flex-col gap-3 pb-2">
        <!-- Prominent Import Guidance Banner -->
        <div class="flex items-start gap-3 border border-purple-500/30 rounded-xl bg-purple-500/10 p-3.5 backdrop-blur-md">
          <div class="i-solar:info-circle-bold-duotone mt-0.5 h-5 w-5 shrink-0 text-purple-500" />
          <div class="flex flex-col gap-0.5 text-xs">
            <span class="text-neutral-800 font-bold dark:text-neutral-100">How Community Card Import Works</span>
            <span class="text-neutral-600 leading-relaxed dark:text-neutral-300">
              Browse any community hub below and click the button to download a character PNG card file. AIRI's automatic download interceptor will instantly capture the card and open the companion staging preview for you.
            </span>
          </div>
        </div>

        <!-- Ecosystem community website tiles (Top) -->
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            v-for="source in hubSources"
            :key="source.name"
            type="button"
            :class="[
              'group flex flex-col gap-1 text-left cursor-pointer transition-all duration-200',
              'border border-neutral-200/60 rounded-xl px-3.5 py-2.5',
              'bg-white/40 dark:bg-neutral-900/40 dark:border-neutral-800/80',
              'backdrop-blur-md hover:border-primary-500/60 hover:bg-white/60 dark:hover:bg-neutral-900/60 active:scale-[0.99]',
            ]"
            @click="openHubSource(source)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-800 font-bold transition-colors dark:text-neutral-100 group-hover:text-primary-500">{{ source.name }}</span>
                <span v-if="source.badge" class="rounded bg-purple-500/15 px-1.5 py-0.2 text-[9px] text-purple-600 font-bold dark:text-purple-400">{{ source.badge }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-amber-500 font-bold dark:text-amber-400">{{ source.rating }}</span>
                <div class="i-solar:export-bold-duotone h-3.5 w-3.5 text-neutral-400 transition-colors group-hover:text-primary-500" />
              </div>
            </div>
            <span class="text-[10px] text-neutral-500 leading-tight dark:text-neutral-400">{{ source.note }}</span>
          </button>
        </div>

        <!-- Manual file import drop zone (Bottom) -->
        <label
          :class="['flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-4 py-3.5 text-center cursor-pointer transition-colors', 'border-neutral-300/80 bg-white/30 dark:border-neutral-700/80 dark:bg-neutral-900/30 hover:border-primary-500/60']"
        >
          <div class="i-solar:cloud-upload-bold-duotone h-5 w-5 text-neutral-400" />
          <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">Drop a card or click to browse (.png / .json)</span>
          <input type="file" accept=".png,.json" class="hidden" @change="(e: Event) => handleImportFiles((e.target as HTMLInputElement).files)">
        </label>

        <div v-if="importError" class="border border-red-200 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {{ importError }}
        </div>

        <!-- Imported draft preview -->
        <div
          v-if="draft.state.persona.source === 'import' && importedName"
          class="flex items-center gap-3 border border-emerald-500/30 rounded-xl bg-emerald-500/5 p-3"
        >
          <div class="i-solar:check-circle-bold-duotone h-5 w-5 text-emerald-500" />
          <div class="min-w-0 flex-1">
            <div class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
              {{ importedName }}
            </div>
            <div class="text-[10px] text-emerald-600 dark:text-emerald-400">
              Staged in draft — will be assembled on the final step.
            </div>
          </div>
          <button class="text-xs text-neutral-400 underline hover:text-neutral-600 dark:hover:text-neutral-200" @click="clearImported">
            Clear
          </button>
        </div>
      </div>

      <!-- Tier 3: AI guided wizard → Feature Preview (no live wiring) -->
      <div v-else class="flex flex-col gap-3 pb-2">
        <div class="flex flex-col gap-3 border border-purple-500/20 rounded-xl from-purple-500/10 to-pink-500/10 bg-gradient-to-br p-5 backdrop-blur-md">
          <div class="flex items-center gap-2">
            <div class="i-solar:magic-stick-3-bold-duotone h-6 w-6 text-purple-500" />
            <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">AnimaDex Guided Creator</span>
            <span class="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-600 font-bold dark:text-purple-400">COMING SOON</span>
          </div>
          <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
            A 4-step guided wizard will use your Step 2 brain and Step 3 profile to synthesize a fully custom companion — lore, greeting, and portrait prompts — straight into your draft.
          </p>
        </div>
      </div>
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
            <span class="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs text-purple-600 font-semibold dark:text-purple-400">
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
