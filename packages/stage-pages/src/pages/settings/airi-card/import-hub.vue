<script setup lang="ts">
import {
  DEFAULT_COMPANION_SCENARIO,
  DEFAULT_COMPANION_SYSTEM_PROMPT,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
} from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { Button } from '@proj-airi/ui'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const CardImportWizard = defineAsyncComponent(() => import('./components/CardImportWizard.vue'))

const router = useRouter()

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)
const activeBrowserSource = ref<{ name: string, url: string, desc?: string } | null>(null)
const webviewRef = ref<any>(null)

const isImportWizardOpen = ref(false)
const importedCardData = ref<any>(null)

const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

let removeIpcListener = () => {}

// Supported community card hub repositories
const cardHubs = [
  {
    name: 'Chub AI',
    tag: 'POPULAR HUB · 50K+',
    desc: 'Massive character-sharing ecosystem with tagged avatars, scenario lore, and direct CCv2 / CCv3 card downloads.',
    url: 'https://chub.ai',
    icon: 'i-solar:fire-bold-duotone',
    accent: 'text-amber-500 dark:text-amber-400',
    tagBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  {
    name: 'Character Tavern',
    tag: 'CLEAN UI · 19K+',
    desc: 'Fast and clean character platform with thousands of unique AI companions, intuitive navigation, and direct SillyTavern card downloads.',
    url: 'https://character-tavern.com',
    icon: 'i-solar:cup-star-bold-duotone',
    accent: 'text-emerald-500 dark:text-emerald-400',
    tagBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    name: 'DataCat',
    tag: 'RECOMMENDED · CLEAN ST',
    desc: 'Fast discovery and database search tool tailored for clean SillyTavern JSON and PNG exports.',
    url: 'https://datacat.run/fresh',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'text-primary-500 dark:text-primary-400',
    tagBg: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
  },
  {
    name: 'CharacterHub',
    tag: 'CURATED CARDS · ST V2',
    desc: 'Community-driven roleplay repository featuring rich character lore, alternate greetings, and high-res avatar PNGs.',
    url: 'https://characterhub.org',
    icon: 'i-solar:users-group-rounded-bold-duotone',
    accent: 'text-blue-500 dark:text-blue-400',
    tagBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  {
    name: 'JanitorAI',
    tag: 'HIGH ENGAGEMENT',
    desc: 'Widely used character platform with popular scenario cards, rich personalities, and community exports.',
    url: 'https://janitorai.com',
    icon: 'i-solar:heart-bold-duotone',
    accent: 'text-pink-500 dark:text-pink-400',
    tagBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  },
  {
    name: 'Risu Realm',
    tag: 'ADVANCED LORE',
    desc: 'Exchange platform tied to the Risu ecosystem, providing deep multi-turn definitions and portable formats.',
    url: 'https://realm.risuai.net',
    icon: 'i-solar:planet-3-bold-duotone',
    accent: 'text-purple-500 dark:text-purple-400',
    tagBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
]

// --- Helper Parser Functions ---

function base64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function parsePngCharaPayload(buffer: ArrayBuffer): any {
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

function parseImportedCard(content: string): any {
  const parsed = JSON.parse(content)
  if (parsed?.format === 'airi-card' && parsed?.version === 1 && parsed?.card) {
    return parsed.card
  }
  return parsed
}

function parseStMessageExamples(example: string | string[]): string[][] {
  if (Array.isArray(example)) {
    return example.map(ex => (typeof ex === 'string' ? [ex] : ex))
  }
  if (!example || typeof example !== 'string')
    return []
  const blocks = example.split(/<START>/i).map(b => b.trim()).filter(Boolean)
  if (blocks.length === 0)
    return []
  return blocks.map(block => block.split('\n').map(l => l.trim()).filter(Boolean))
}

function removeNullValues(obj: any): any {
  if (Array.isArray(obj))
    return obj.map(removeNullValues)
  if (obj !== null && typeof obj === 'object') {
    const clean: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        clean[key] = removeNullValues(value)
      }
    }
    return clean
  }
  return obj
}

function addCardPreviewNormalize(card: any) {
  const data = card.data || card
  let normalized: any
  const normalizedVersion = (v: unknown): string => {
    if (typeof v === 'string' && v.trim())
      return v.trim()
    if (typeof v === 'number' && !Number.isNaN(v))
      return String(v)
    return '1.0.0'
  }
  if (card.format === 'airi-card' || card.systemPrompt !== undefined) {
    normalized = {
      ...card,
      version: normalizedVersion(card.version),
      messageExample: typeof card.messageExample === 'string'
        ? parseStMessageExamples(card.messageExample)
        : card.messageExample,
    }
  }
  else {
    normalized = {
      name: data.name || 'Imported Card',
      version: normalizedVersion(data.character_version),
      description: data.description ?? '',
      notes: data.creator_notes ?? '',
      personality: data.personality ?? '',
      scenario: data.scenario?.trim() ? data.scenario : DEFAULT_COMPANION_SCENARIO,
      systemPrompt: data.system_prompt?.trim() ? data.system_prompt : DEFAULT_COMPANION_SYSTEM_PROMPT,
      postHistoryInstructions: data.post_history_instructions?.trim() ? data.post_history_instructions : DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings: [
        data.first_mes,
        ...(data.alternate_greetings ?? []),
      ].filter(Boolean),
      messageExample: parseStMessageExamples(data.mes_example || ''),
      extensions: {
        airi: data.extensions?.airi,
        ...data.extensions,
      },
    }
  }
  return removeNullValues(normalized)
}

// --- Browser Actions ---

function openHub(hub: { name: string, url: string, desc?: string }) {
  if (isElectron.value) {
    activeBrowserSource.value = hub
  }
  else if (typeof window !== 'undefined') {
    window.open(hub.url, '_blank', 'noopener,noreferrer')
  }
}

function closeBrowser() {
  activeBrowserSource.value = null
}

function browserBack() {
  webviewRef.value?.goBack?.()
}

function browserForward() {
  webviewRef.value?.goForward?.()
}

function browserReload() {
  webviewRef.value?.reload?.()
}

function openInExternalBrowser() {
  if (activeBrowserSource.value?.url && typeof window !== 'undefined') {
    if ((window as any).electron?.shell?.openExternal) {
      void (window as any).electron.shell.openExternal(activeBrowserSource.value.url)
    }
    else {
      window.open(activeBrowserSource.value.url, '_blank', 'noopener,noreferrer')
    }
  }
}

// --- File Handling & Drag Drop ---

async function handleFile(file: File) {
  try {
    let importedCard: any
    if (file.name.toLowerCase().endsWith('.png')) {
      const buffer = await file.arrayBuffer()
      importedCard = parsePngCharaPayload(buffer)
    }
    else if (file.name.toLowerCase().endsWith('.json')) {
      const text = await file.text()
      importedCard = parseImportedCard(text)
    }
    else {
      toast.error('Unsupported file format. Please drop a .png or .json card.')
      return
    }

    const normalized = addCardPreviewNormalize(importedCard)
    importedCardData.value = normalized
    isImportWizardOpen.value = true
  }
  catch (err: any) {
    console.error('[ImportHub] Failed to parse card file:', err)
    toast.error(err.message || 'Failed to parse card file')
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  if (!e.relatedTarget || (e.currentTarget && !(e.currentTarget as Node).contains(e.relatedTarget as Node))) {
    isDragging.value = false
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    await handleFile(files[0])
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    void handleFile(target.files[0])
    target.value = ''
  }
}

function handleCardImported(cardId: string) {
  isImportWizardOpen.value = false
  toast.success('Character card imported and configured!')
  router.push({
    path: '/settings/airi-card',
    query: { cardId },
  })
}

function handleBack() {
  if (activeBrowserSource.value) {
    activeBrowserSource.value = null
    return
  }
  if (window.history.length > 1) {
    router.back()
  }
  else {
    router.push('/settings/airi-card')
  }
}

// --- Lifecycle Hooks ---

onMounted(() => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const handler = (_event: any, payload: { base64Data: string, filename: string, ext: string }) => {
      try {
        const rawData = atob(payload.base64Data)
        const arrayBuffer = new ArrayBuffer(rawData.length)
        const view = new Uint8Array(arrayBuffer)
        for (let i = 0; i < rawData.length; i++) {
          view[i] = rawData.charCodeAt(i)
        }

        let importedCard: any
        if (payload.ext === 'png') {
          importedCard = parsePngCharaPayload(arrayBuffer)
        }
        else {
          const decoder = new TextDecoder('utf-8')
          const text = decoder.decode(arrayBuffer)
          importedCard = parseImportedCard(text)
        }

        const normalized = addCardPreviewNormalize(importedCard)
        importedCardData.value = normalized
        isImportWizardOpen.value = true
        toast.info(`Intercepted card download: ${payload.filename}`)
      }
      catch (err) {
        console.error('[ImportHub] Failed to process intercepted card:', err)
        toast.error('Failed to parse intercepted card file')
      }
    }

    (window as any).electron.ipcRenderer.on('chara-card-downloaded', handler)
    removeIpcListener = () => {
      (window as any).electron?.ipcRenderer.removeListener('chara-card-downloaded', handler)
    }
  }

  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
})

onUnmounted(() => {
  removeIpcListener()
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <div class="mx-auto max-w-6xl w-full flex flex-col gap-6 pb-20 pt-1">
    <!-- Hidden File Input for Native File Picker -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".png,.json"
      class="hidden"
      @change="onFileSelect"
    >

    <!-- Top Navigation Bar -->
    <div class="flex items-center justify-between border-b border-neutral-200/80 pb-4 dark:border-neutral-800/80">
      <div class="flex items-center gap-3">
        <Button
          variant="secondary"
          class="size-9 flex items-center justify-center rounded-xl p-0"
          @click="handleBack"
        >
          <div class="i-solar:alt-arrow-left-bold text-base" />
        </Button>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl text-neutral-900 font-bold dark:text-white">
              {{ activeBrowserSource ? `Browse ${activeBrowserSource.name}` : 'Card Hub Importer' }}
            </h2>
            <span
              v-if="isElectron && activeBrowserSource"
              class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
            >
              ⚡ Interceptor Active
            </span>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ activeBrowserSource ? 'Click any card download/export to launch the 5-step wizard' : 'Browse repositories or drop character card files to configure your companion' }}
          </p>
        </div>
      </div>

      <!-- Header Action Controls -->
      <div class="flex items-center gap-2">
        <template v-if="activeBrowserSource">
          <Button
            variant="secondary"
            class="h-8.5 px-3 text-xs"
            @click="openInExternalBrowser"
          >
            <div class="i-solar:arrow-right-up-linear mr-1 text-xs" />
            Open in Browser
          </Button>
          <Button
            variant="secondary"
            class="h-8.5 px-3 text-xs"
            @click="closeBrowser"
          >
            <div class="i-solar:close-circle-linear mr-1 text-xs" />
            Close View
          </Button>
        </template>
        <template v-else>
          <Button
            variant="primary"
            class="h-8.5 px-3 text-xs"
            @click="triggerFileInput"
          >
            <div class="i-solar:upload-track-2-bold-duotone mr-1.5 text-sm" />
            Choose Card File
          </Button>
        </template>
      </div>
    </div>

    <!-- VIEW A: Full-Width Embedded Browser Workspace (Electron) -->
    <div
      v-if="isElectron && activeBrowserSource"
      class="flex flex-col gap-3"
    >
      <!-- Sleek Browser Control Strip -->
      <div
        :class="[
          'flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 shadow-sm',
          'border-neutral-200/80 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/80 backdrop-blur-sm',
        ]"
      >
        <div class="flex items-center gap-1.5">
          <Button
            variant="ghost"
            class="size-8 flex items-center justify-center rounded-lg p-0"
            title="Go Back"
            @click="browserBack"
          >
            <div class="i-solar:alt-arrow-left-linear text-sm" />
          </Button>
          <Button
            variant="ghost"
            class="size-8 flex items-center justify-center rounded-lg p-0"
            title="Go Forward"
            @click="browserForward"
          >
            <div class="i-solar:alt-arrow-right-linear text-sm" />
          </Button>
          <Button
            variant="ghost"
            class="size-8 flex items-center justify-center rounded-lg p-0"
            title="Reload"
            @click="browserReload"
          >
            <div class="i-solar:restart-bold text-xs" />
          </Button>
        </div>

        <!-- URL Address Display -->
        <div
          :class="[
            'flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs',
            'border-neutral-200 bg-white dark:border-neutral-700/60 dark:bg-neutral-950 font-mono text-neutral-600 dark:text-neutral-400',
          ]"
        >
          <div class="i-solar:lock-bold text-xs text-emerald-500" />
          <span class="truncate">{{ activeBrowserSource.url }}</span>
        </div>

        <!-- Active Interception Notice -->
        <div class="items-center gap-1.5 hidden sm:flex">
          <span class="size-2 animate-pulse rounded-full bg-emerald-500" />
          <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
            Auto-Interception Armed
          </span>
        </div>
      </div>

      <!-- Embedded Webview Canvas -->
      <div class="relative overflow-hidden border border-neutral-200/80 rounded-2xl bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <component
          is="webview"
          ref="webviewRef"
          :src="activeBrowserSource.url"
          class="h-[74vh] min-h-[580px] w-full"
          allowpopups
        />
      </div>
    </div>

    <!-- VIEW B: Hubs Catalog & Drag & Drop Landing View -->
    <div
      v-else
      class="flex flex-col gap-6"
    >
      <!-- Drag & Drop Zone -->
      <div
        :class="[
          'group relative flex flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed p-9 text-center transition-all duration-300 cursor-pointer',
          'border-primary-500/35 bg-primary-500/[0.03] hover:border-primary-500/70 hover:bg-primary-500/[0.07] dark:bg-primary-500/[0.05]',
        ]"
        @click="triggerFileInput"
      >
        <div
          :class="[
            'size-14 flex items-center justify-center rounded-2xl transition-all duration-300',
            'bg-primary-500/15 text-primary-500 group-hover:scale-110 shadow-sm',
          ]"
        >
          <div class="i-solar:cloud-upload-bold-duotone size-7" />
        </div>

        <div class="flex flex-col items-center gap-1">
          <h3 class="text-base text-neutral-900 font-bold dark:text-white">
            Drop SillyTavern Character Card Here
          </h3>
          <p class="max-w-md text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            Drag and drop your <code class="text-primary-600 font-mono dark:text-primary-400">.png</code> (Chara Card V2 / V3) or <code class="text-primary-600 font-mono dark:text-primary-400">.json</code> file, or click anywhere to select from disk.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          <span class="rounded-md bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-700 font-medium font-mono dark:bg-neutral-800 dark:text-neutral-300">
            PNG (tEXt Chara)
          </span>
          <span class="rounded-md bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-700 font-medium font-mono dark:bg-neutral-800 dark:text-neutral-300">
            JSON (ST v2 / v3)
          </span>
          <span class="rounded-md bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-bold dark:text-primary-400">
            ⚡ 5-Step Calibrator
          </span>
        </div>
      </div>

      <!-- Integrated Repositories Section -->
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm text-neutral-900 font-bold dark:text-white">
              Community Card Repositories
            </h3>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Browse public libraries. Downloaded character cards are automatically caught by AIRI.
            </p>
          </div>
          <span class="border border-primary-500/20 rounded-lg bg-primary-500/10 px-2.5 py-0.5 text-[10px] text-primary-600 font-bold uppercase dark:text-primary-400">
            5 Integrated Hubs
          </span>
        </div>

        <!-- 5 Hub Hero Cards Grid -->
        <div class="grid grid-cols-1 gap-3.5 lg:grid-cols-3 md:grid-cols-2">
          <div
            v-for="hub in cardHubs"
            :key="hub.name"
            :class="[
              'group relative flex flex-col justify-between rounded-2xl p-4.5 transition-all duration-200 text-left',
              'border border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-800/40',
              'hover:border-primary-500/60 dark:hover:border-primary-400/60 hover:bg-white dark:hover:bg-neutral-800',
              'hover:-translate-y-1 hover:shadow-lg',
            ]"
          >
            <!-- Card Top: Icon & Tag -->
            <div class="flex items-start justify-between gap-2">
              <div :class="['size-10 flex shrink-0 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs transition-transform group-hover:scale-105', hub.accent]">
                <div :class="[hub.icon, 'size-5']" />
              </div>
              <span :class="['text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md border uppercase', hub.tagBg]">
                {{ hub.tag }}
              </span>
            </div>

            <!-- Card Content: Name & Description -->
            <div class="mb-4 mt-3 flex flex-col gap-1">
              <span class="text-sm text-neutral-900 font-bold transition-colors dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                {{ hub.name }}
              </span>
              <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                {{ hub.desc }}
              </p>
            </div>

            <!-- Card Footer: Direct Browse CTA -->
            <div class="mt-auto flex items-center justify-between border-t border-neutral-200/60 pt-3 dark:border-neutral-700/40">
              <span class="text-[10px] text-neutral-400 font-mono">
                {{ hub.url.replace('https://', '') }}
              </span>
              <Button
                variant="primary"
                class="h-7 px-2.5 text-[11px]"
                @click="openHub(hub)"
              >
                <span v-if="isElectron">Browse</span>
                <span v-else>Open</span>
                <div class="i-solar:alt-arrow-right-linear ml-1 text-xs" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Full-Screen Drag and Drop Overlay -->
    <div
      v-if="isDragging"
      class="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-md"
    >
      <div class="max-w-sm flex flex-col items-center gap-4 border-2 border-primary-500 rounded-2xl border-dashed bg-neutral-900/80 p-8 text-center">
        <div class="i-solar:upload-square-bold-duotone animate-bounce text-6xl text-primary-500" />
        <h3 class="text-xl font-bold">
          Import Character Card
        </h3>
        <p class="text-sm opacity-80">
          Drop your .png (Chara Card V2/V3) or .json files here to configure and stage
        </p>
      </div>
    </div>

    <!-- 5-Step Card Import Wizard Modal -->
    <CardImportWizard
      v-if="isImportWizardOpen"
      v-model="isImportWizardOpen"
      :card-data="importedCardData"
      @imported="handleCardImported"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
</route>
