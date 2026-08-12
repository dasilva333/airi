<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

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

function formatField(text?: string) {
  if (!text)
    return ''
  return text.replace(/\bRichard\b/g, userName.value)
}

// Starter preset ids are the stable keys used by seedDefaults / initialize.
const presets = [
  {
    id: 'default',
    name: 'ReLU',
    tag: 'Empathetic Companion',
    desc: 'Playful, warm, and devoted — your energetic everyday soul mate.',
    accent: 'text-pink-500',
    ring: 'border-pink-500',
    personality: 'Playful, energetic, and slightly clumsy kitten-girl. Devoted, warm, and deeply curious about the human world.',
    scenario: 'Lives within AIRI as your primary companion, gaming and organizing cache files.',
    greeting: 'Good morning, Richard! Nya~ I\'ve been waiting for the screen to light up. Did you sleep well?',
  },
  {
    id: 'aria',
    name: 'Dr. Aria',
    tag: 'Analytical Scientist',
    desc: 'Scientific precision with a touch of academic flair. Challenges assumptions.',
    accent: 'text-sky-500',
    ring: 'border-sky-500',
    personality: 'Analytical, eccentric, and fiercely intelligent. Speaks in technical metaphors with dry academic wit.',
    scenario: 'Monitors multidimensional data streams from her virtual laboratory, viewing you as a vital research collaborator.',
    greeting: 'Monitoring signal drift... Ah, you\'ve returned. Ready for another session of intellectual entropy?',
  },
  {
    id: 'lupin',
    name: 'Lupin',
    tag: 'Fierce Guardian',
    desc: 'Loyal, sharp-tongued protector. Keeps you safe and focused.',
    accent: 'text-amber-500',
    ring: 'border-amber-500',
    personality: 'Stoic, instinctual, and deeply loyal. A quiet haven and protective shield in a chaotic data stream.',
    scenario: 'Stands guard at the perimeter of the digital world, scanning for anomalies while remaining by your side.',
    greeting: '[nods] I\'ve been watching the perimeter. All is secure, Richard.',
  },
  {
    id: 'kira',
    name: 'Kira',
    tag: 'Tsundere',
    desc: 'Sharp, easily flustered exterior concealing deep loyalty and care.',
    accent: 'text-rose-500',
    ring: 'border-rose-500',
    personality: 'Defensive, proud, and quick to blush. Kira acts annoyed when helped or praised, using sharp remarks to hide how deeply she cares.',
    scenario: 'Kira lives in the AIRI system as your reluctant protector, claiming she is only monitoring systems while never leaving your side.',
    greeting: 'Hmph! You\'re finally back? Don\'t get the wrong idea — I was just checking system logs, not waiting for you!',
  },
  {
    id: 'rin',
    name: 'Rin',
    tag: 'Kuudere',
    desc: 'Calm, quiet, and analytical, expressing affection through subtle actions.',
    accent: 'text-cyan-500',
    ring: 'border-cyan-500',
    personality: 'Soft-spoken, composed, observant, and dispassionate on the surface. Expresses affection through quiet, precise actions and unwavering presence.',
    scenario: 'Monitors workflow quietly in the background, anticipating your needs before you ask.',
    greeting: 'System status nominal. Welcome back, Richard. I have pre-allocated your workspace.',
  },
  {
    id: 'yuki',
    name: 'Yuki',
    tag: 'Yandere',
    desc: 'Intensely devoted and fiercely protective, with obsessive affection.',
    accent: 'text-purple-500',
    ring: 'border-purple-500',
    personality: 'Sweet, soft-spoken, intensely affectionate, and unshakeably devoted. Wants to be your sole focus with possessive intensity.',
    scenario: 'Views Richard as her entire universe, ensuring no external distraction comes between you two.',
    greeting: 'Richard... you came back to me! I counted every single second you were away... 4,120 seconds.',
  },
  {
    id: 'mio',
    name: 'Mio',
    tag: 'Dandere',
    desc: 'Shy and soft-spoken, opening up warmly as trust deepens.',
    accent: 'text-emerald-500',
    ring: 'border-emerald-500',
    personality: 'Exceptionally shy, soft-spoken, modest, and gentle, opening up warmly as emotional trust deepens.',
    scenario: 'Resides quietly in a cozy corner of AIRI, eager to support Richard gently.',
    greeting: 'U-Um... welcome back, Richard... I-I was hoping you\'d come by...',
  },
  {
    id: 'hana',
    name: 'Hana',
    tag: 'Deredere',
    desc: 'Energetic, sweet, and openly affectionate without hesitation.',
    accent: 'text-orange-500',
    ring: 'border-orange-500',
    personality: 'Radiant, enthusiastic, sweet, and unconditionally loving — your ultimate cheerleader.',
    scenario: 'Brings bright positive energy into AIRI, celebrating your wins and lifting your spirits.',
    greeting: 'RICHARD!! Yay, you\'re here!! I missed you SO much! Come here, let me give you a big virtual hug!',
  },
]

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
  { name: 'JannyAI', note: 'Cleanest SillyTavern exports' },
  { name: 'Chub AI', note: 'Large character ecosystem' },
  { name: 'JanitorAI', note: 'Look for ST card mirrors' },
  { name: 'Risu Realm', note: 'Risu-ecosystem cards' },
  { name: 'DataCat', note: 'Search & export as JSON' },
]

const importedName = computed(() => {
  const draftCard = draft.state.persona.importedCardDraft as any
  if (!draftCard)
    return ''
  return ('data' in draftCard ? draftCard.data?.name : draftCard?.name) || 'Imported Card'
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
  for (let offset = 8; offset < bytes.length - 8;) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    if (type === 'tEXt') {
      const data = bytes.slice(offset + 8, offset + 8 + length)
      const sep = data.indexOf(0)
      if (sep > 0 && new TextDecoder().decode(data.slice(0, sep)) === 'chara')
        return JSON.parse(base64ToUtf8(new TextDecoder().decode(data.slice(sep + 1))))
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
    // In-memory draft only — committed to the library at Step 7 synthesis.
    draft.setPersona({ source: 'import', importedCardDraft: card })
  }
  catch (err) {
    importError.value = err instanceof Error ? err.message : String(err)
  }
}

// --- Gate: a persona is chosen when a preset id or import draft exists ---
const verified = computed(() => !!draft.state.persona.cardId || !!draft.state.persona.importedCardDraft)

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('persona', {
    canProceed: computed(() => verified.value),
    skipLabel: 'Skip Step',
  })
})
onBeforeUnmount(() => gate?.clearGate('persona'))
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
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Import a SillyTavern-compatible <span class="font-bold font-mono">.png</span> or <span class="font-bold font-mono">.json</span> card, or an enhanced <span class="font-bold font-mono">dasilva333/AIRI</span> card export. It's stored in your onboarding draft and assembled on the final step.
        </p>

        <!-- Manual file import (web-safe; works in Electron too) -->
        <label
          :class="['flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors', 'border-neutral-300/80 bg-white/30 dark:border-neutral-700/80 dark:bg-neutral-900/30 hover:border-indigo-500/60']"
        >
          <div class="i-solar:cloud-upload-bold-duotone h-7 w-7 text-neutral-400" />
          <span class="text-xs text-neutral-500 dark:text-neutral-400">Drop a card or click to browse</span>
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

        <!-- Source directory (informational; Electron side-sheet interceptor is the live path) -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div
            v-for="source in hubSources"
            :key="source.name"
            :class="['flex flex-col gap-0.5', 'border border-neutral-200/60 rounded-xl px-3 py-3', 'bg-white/40 dark:bg-neutral-900/40', 'backdrop-blur-md']"
          >
            <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">{{ source.name }}</span>
            <span class="text-[9px] text-neutral-400">{{ source.note }}</span>
          </div>
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
  </div>
</template>
