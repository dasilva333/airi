<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { onClickOutside } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

interface SearchItem {
  id: string
  title: string
  category: string
  description?: string
  to: string
  icon?: string
}

const router = useRouter()
const cardStore = useAiriCardStore()

const searchQuery = ref('')
const isOpen = ref(false)
const highlightedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

onClickOutside(containerRef, () => {
  isOpen.value = false
})

// ──────────────────────────────────────────────
// Complete search index with verified routes
// ──────────────────────────────────────────────

const staticIndex: SearchItem[] = [
  // ── Level 1: Primary Pages ──
  { id: 'page-card', title: 'AIRI Card Editor', category: 'Primary Page', description: 'Character card management & editing', to: '/settings/airi-card', icon: 'i-solar:emoji-funny-square-bold-duotone' },
  { id: 'page-scene', title: 'Scenes', category: 'Primary Page', description: 'Environment & 3D scene customization', to: '/settings/scene', icon: 'i-solar:armchair-2-bold-duotone' },
  { id: 'page-models', title: 'Models', category: 'Primary Page', description: 'Model catalog & motion customizers', to: '/settings/models', icon: 'i-solar:people-nearby-bold-duotone' },
  { id: 'page-memory', title: 'Memory', category: 'Primary Page', description: 'Cognitive memory, logs & relational bonds', to: '/settings/memory', icon: 'i-solar:leaf-bold-duotone' },
  { id: 'page-dating-sim', title: 'Dating Sim Mode', category: 'Primary Page', description: 'Intimacy gating & game mode rules', to: '/settings/dating-sim', icon: 'i-solar:heart-bold-duotone' },
  { id: 'page-modules', title: 'Modules', category: 'Primary Page', description: 'Integrations & protocol adapters', to: '/settings/modules', icon: 'i-solar:layers-bold-duotone' },
  { id: 'page-providers', title: 'Providers', category: 'Primary Page', description: 'AI inference providers & voice engines', to: '/settings/providers', icon: 'i-solar:box-minimalistic-bold-duotone' },
  { id: 'page-system', title: 'System Settings', category: 'Primary Page', description: 'App system preferences & user identity', to: '/settings/system', icon: 'i-solar:filters-bold-duotone' },
  { id: 'page-data', title: 'Data Management', category: 'Primary Page', description: 'Backup, restore & storage tools', to: '/settings/data', icon: 'i-solar:database-bold-duotone' },
  { id: 'page-docs', title: 'Documentation', category: 'Primary Page', description: 'In-app user guides & reference', to: '/settings/docs', icon: 'i-solar:book-open-bold-duotone' },

  // ── Memory Sub-Pages ──
  // Routes verified from memory/index.vue → memorySections[].route
  { id: 'mem-stmm', title: 'Short-Term Awareness (STMM)', category: 'Memory', description: 'The Active Pulse — recent context & daily summaries', to: '/settings/modules/memory-short-term', icon: 'i-solar:alarm-bold-duotone' },
  { id: 'mem-signals', title: 'Dream State (Echo Chips)', category: 'Memory', description: 'The Echoes — idle consolidation & mood highlights', to: '/settings/modules/memory-signals', icon: 'i-solar:bolt-bold-duotone' },
  { id: 'mem-ltmm', title: 'Episodic Records (LTMM)', category: 'Memory', description: 'The Sentinel\'s Journal — sacred text journal entries', to: '/settings/modules/memory-long-term', icon: 'i-solar:notebook-bookmark-bold-duotone' },
  { id: 'mem-lifetime', title: 'Relational Essence (Lifetime)', category: 'Memory', description: 'The Eternal Thread — relationship identity across resets', to: '/settings/modules/memory-lifetime', icon: 'i-solar:dna-bold-duotone' },

  // ── Modules (Direct Routes) ──
  // Routes verified from use-modules-list.ts → modulesList[].to
  { id: 'mod-consciousness', title: 'Consciousness Module', category: 'Modules', description: 'LLM reasoning provider & model selection', to: '/settings/modules/consciousness', icon: 'i-solar:ghost-bold-duotone' },
  { id: 'mod-speech', title: 'Speech Module', category: 'Modules', description: 'TTS voice output configuration', to: '/settings/modules/speech', icon: 'i-solar:user-speak-rounded-bold-duotone' },
  { id: 'mod-hearing', title: 'Hearing Module', category: 'Modules', description: 'STT microphone & audio input pipeline', to: '/settings/modules/hearing', icon: 'i-solar:microphone-3-bold-duotone' },
  { id: 'mod-vision', title: 'Vision Module', category: 'Modules', description: 'Visual perception & screen analysis', to: '/settings/modules/vision', icon: 'i-solar:eye-closed-bold-duotone' },
  { id: 'mod-artistry', title: 'Artistry Module', category: 'Modules', description: 'Image generation & art provider', to: '/settings/modules/artistry', icon: 'i-iconify-heroicons:photo' },
  { id: 'mod-discord', title: 'Discord Bot Integration', category: 'Modules', description: 'Discord bot relay & channel binding', to: '/settings/modules/messaging-discord', icon: 'i-simple-icons:discord' },
  { id: 'mod-mcp', title: 'MCP Server & Plugins', category: 'Modules', description: 'Model Context Protocol tool extensions', to: '/settings/modules/mcp', icon: 'i-solar:server-bold-duotone' },
  { id: 'mod-cloudsync', title: 'Cloud Sync', category: 'Modules', description: 'Synchronize database and assets', to: '/settings/modules/cloud-sync', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'mod-beat-sync', title: 'Beat Sync', category: 'Modules', description: 'Audio beat detection & lip-sync', to: '/settings/modules/beat-sync', icon: 'i-solar:music-notes-bold-duotone' },
  { id: 'mod-twitter', title: 'X (Twitter) Integration', category: 'Modules', description: 'X / Twitter social integration', to: '/settings/modules/x', icon: 'i-simple-icons:x' },
  { id: 'mod-minecraft', title: 'Minecraft Gaming', category: 'Modules', description: 'Minecraft game bridge', to: '/settings/modules/gaming-minecraft', icon: 'i-vscode-icons:file-type-minecraft' },
  { id: 'mod-factorio', title: 'Factorio Gaming', category: 'Modules', description: 'Factorio game bridge', to: '/settings/modules/gaming-factorio' },

  // ── Providers: Speech (TTS) ──
  // Routes verified from providers/speech/*.vue filenames → /settings/providers/speech/{filename}
  { id: 'prov-kokoro', title: 'Kokoro Local Speech Engine', category: 'Providers (Speech)', description: 'Local neural TTS voice synthesis', to: '/settings/providers/speech/kokoro-local', icon: 'i-solar:volume-loud-bold-duotone' },
  { id: 'prov-deepgram-tts', title: 'Deepgram TTS', category: 'Providers (Speech)', description: 'Cloud TTS voice synthesis', to: '/settings/providers/speech/deepgram-tts', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'prov-polly', title: 'Amazon Polly TTS', category: 'Providers (Speech)', description: 'AWS Polly voice presets', to: '/settings/providers/speech/aws-polly-tts', icon: 'i-solar:server-square-bold-duotone' },
  { id: 'prov-elevenlabs', title: 'ElevenLabs TTS', category: 'Providers (Speech)', description: 'Cloud voice synthesis', to: '/settings/providers/speech/elevenlabs', icon: 'i-solar:microphone-large-bold-duotone' },
  { id: 'prov-microsoft-speech', title: 'Microsoft Azure Speech', category: 'Providers (Speech)', description: 'Azure cloud TTS', to: '/settings/providers/speech/microsoft-speech', icon: 'i-solar:cloud-bolt-bold-duotone' },
  { id: 'prov-openai-speech', title: 'OpenAI Audio Speech', category: 'Providers (Speech)', description: 'OpenAI TTS API', to: '/settings/providers/speech/openai-audio-speech', icon: 'i-solar:key-minimalistic-bold-duotone' },
  { id: 'prov-chatterbox', title: 'Chatterbox TTS', category: 'Providers (Speech)', description: 'Chatterbox voice cloning TTS', to: '/settings/providers/speech/chatterbox', icon: 'i-solar:chat-square-bold-duotone' },
  { id: 'prov-moss-nano', title: 'MOSS-TTS-Nano Local', category: 'Providers (Speech)', description: 'Local MOSS nano TTS engine', to: '/settings/providers/speech/moss-nano-local', icon: 'i-solar:cpu-bold-duotone' },
  { id: 'prov-app-local-speech', title: 'App Local Audio Speech', category: 'Providers (Speech)', description: 'Built-in local audio speech', to: '/settings/providers/speech/app-local-audio-speech', icon: 'i-solar:speaker-minimalistic-bold-duotone' },

  // ── Providers: Transcription (STT) ──
  // Routes verified from providers/transcription/*.vue filenames
  { id: 'prov-whisper', title: 'App Local Whisper STT', category: 'Providers (Transcription)', description: 'Speech-to-text transcription engine', to: '/settings/providers/transcription/whisper-local', icon: 'i-solar:microphone-3-bold-duotone' },
  { id: 'prov-app-local-transcription', title: 'App Local Audio Transcription', category: 'Providers (Transcription)', description: 'Built-in local transcription', to: '/settings/providers/transcription/app-local-audio-transcription', icon: 'i-solar:volume-loud-bold-duotone' },
  { id: 'prov-deepgram-stt', title: 'Deepgram Transcription', category: 'Providers (Transcription)', description: 'Cloud transcription API', to: '/settings/providers/transcription/deepgram-transcription', icon: 'i-solar:bolt-bold-duotone' },
  { id: 'prov-web-speech', title: 'Browser Web Speech API', category: 'Providers (Transcription)', description: 'Browser-native speech recognition', to: '/settings/providers/transcription/browser-web-speech-api', icon: 'i-solar:global-bold-duotone' },

  // ── Providers: Chat (LLM / Consciousness) ──
  // Routes verified from providers/chat/*.vue filenames
  { id: 'prov-ollama', title: 'Ollama Local LLM', category: 'Providers (Chat)', description: 'Local LLM server connection', to: '/settings/providers/chat/ollama', icon: 'i-solar:cpu-bold-duotone' },
  { id: 'prov-lm-studio', title: 'LM Studio', category: 'Providers (Chat)', description: 'LM Studio local LLM', to: '/settings/providers/chat/lm-studio', icon: 'i-solar:monitor-smartphone-bold-duotone' },
  { id: 'prov-amazon-bedrock', title: 'Amazon Bedrock', category: 'Providers (Chat)', description: 'AWS Bedrock LLM gateway', to: '/settings/providers/chat/amazon-bedrock', icon: 'i-solar:server-square-bold-duotone' },
  { id: 'prov-azure-foundry', title: 'Azure AI Foundry', category: 'Providers (Chat)', description: 'Azure AI cloud inference', to: '/settings/providers/chat/azure-ai-foundry', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'prov-web-rwkv', title: 'Web RWKV', category: 'Providers (Chat)', description: 'In-browser RWKV model', to: '/settings/providers/chat/web-rwkv', icon: 'i-solar:cpu-bold-duotone' },

  // ── Providers: Artistry (Image Gen) ──
  // Routes verified from providers/artistry/*.vue filenames
  { id: 'prov-comfyui', title: 'ComfyUI Image Generation', category: 'Providers (Artistry)', description: 'Local image generation runner', to: '/settings/providers/artistry/comfyui', icon: 'i-solar:gallery-bold-duotone' },
  { id: 'prov-replicate', title: 'Replicate', category: 'Providers (Artistry)', description: 'Cloud model inference service', to: '/settings/providers/artistry/replicate', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'prov-nanobanana', title: 'Nano Banana (Google AI)', category: 'Providers (Artistry)', description: 'Google AI Studio Image Preview', to: '/settings/providers/artistry/nanobanana', icon: 'i-solar:gallery-round-bold-duotone' },

  // ── Providers: Cloud & Storage ──
  // Routes verified from providers/cloud/*.vue filenames
  { id: 'prov-local-fs', title: 'Local File System Sync', category: 'Providers (Cloud)', description: 'Local path or Samba network share', to: '/settings/providers/cloud/local-fs', icon: 'i-solar:folder-with-files-bold-duotone' },
  { id: 'prov-s3', title: 'S3-Compatible Cloud Storage', category: 'Providers (Cloud)', description: 'Cloudflare R2, AWS S3, Backblaze B2', to: '/settings/providers/cloud/s3', icon: 'i-solar:cloud-bold-duotone' },

  // ── System Sub-Pages ──
  // Routes verified from apps/stage-tamagotchi/.../system/index.vue → settings[]
  { id: 'sys-user-profile', title: 'User Profile & Connection', category: 'System', description: 'Name, visual prompt tags & personal TTS voice', to: '/settings/system/user-profile', icon: 'i-solar:user-bold-duotone' },
  { id: 'sys-general', title: 'General Settings', category: 'System', description: 'Theme, language, remote sync & controls', to: '/settings/system/general', icon: 'i-solar:emoji-funny-square-bold-duotone' },
  { id: 'sys-color-scheme', title: 'Color Scheme & Themes', category: 'System', description: 'Color palette presets & customization', to: '/settings/system/color-scheme', icon: 'i-solar:pallete-2-bold-duotone' },
  { id: 'sys-chat', title: 'Chat Settings', category: 'System', description: 'Send mode, stream timeout & bubble display', to: '/settings/system/chat', icon: 'i-solar:chat-round-dots-bold-duotone' },
  { id: 'sys-connection', title: 'Connection Settings', category: 'System', description: 'WebSocket URL, auth token & HF token', to: '/settings/system/connection', icon: 'i-solar:wi-fi-router-bold-duotone' },
]

// ── Dynamic Character Card Index ──
// Queries cardStore.cards so typing character names navigates directly to their card editor
const dynamicCharacterIndex = computed<SearchItem[]>(() => {
  const cardEntries = Array.from(cardStore.cards.entries())
  return cardEntries.map(([id, card]) => {
    const cardName = card.name || 'Unnamed Character'
    return {
      id: `card-${id}`,
      title: cardName,
      category: 'Character Card',
      description: `Open ${cardName}'s card editor`,
      to: `/settings/airi-card?cardId=${id}`,
      icon: 'i-solar:user-bold-duotone',
    }
  })
})

const fullSearchIndex = computed<SearchItem[]>(() => {
  return [...dynamicCharacterIndex.value, ...staticIndex]
})

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return fullSearchIndex.value.slice(0, 8)

  return fullSearchIndex.value.filter((item) => {
    return (
      item.title.toLowerCase().includes(query)
      || item.category.toLowerCase().includes(query)
      || (item.description && item.description.toLowerCase().includes(query))
    )
  }).slice(0, 12)
})

function handleSelect(item: SearchItem) {
  isOpen.value = false
  searchQuery.value = ''
  router.push(item.to)
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isOpen.value)
    return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (searchResults.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % searchResults.value.length
    }
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (searchResults.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value - 1 + searchResults.value.length) % searchResults.value.length
    }
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const selected = searchResults.value[highlightedIndex.value]
    if (selected) {
      handleSelect(selected)
    }
  }
  else if (e.key === 'Escape') {
    isOpen.value = false
  }
}

function handleGlobalShortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    isOpen.value = true
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}

function handleInput() {
  highlightedIndex.value = 0
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalShortcut)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcut)
})
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Search Input Bar -->
    <div
      :class="[
        'group relative flex items-center rounded-xl px-3.5 py-2.5 transition-all duration-200',
        'border border-neutral-200/90 bg-white/80 shadow-xs',
        'dark:border-neutral-800/90 dark:bg-neutral-900/80',
        'hover:border-primary-500/50',
        'focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20',
      ]"
      @click="isOpen = true; inputRef?.focus()"
    >
      <div class="i-solar:magnifer-bold-duotone mr-2.5 shrink-0 text-lg text-neutral-400 dark:text-neutral-500 group-focus-within:text-primary-500" />
      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        placeholder="Search all settings, characters, providers, modules..."
        :class="[
          'w-full bg-transparent text-xs outline-none',
          'text-neutral-800 placeholder-neutral-400',
          'dark:text-neutral-100 dark:placeholder-neutral-500',
        ]"
        @focus="isOpen = true"
        @keydown="handleKeyDown"
        @input="handleInput"
      >
      <div class="ml-2 flex shrink-0 items-center gap-1">
        <span
          :class="[
            'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
            'border-neutral-200 bg-neutral-100/80 text-neutral-400',
            'dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-500',
          ]"
        >
          ⌘K
        </span>
      </div>
    </div>

    <!-- Autocomplete Dropdown Overlay -->
    <div
      v-if="isOpen && searchResults.length > 0"
      :class="[
        'absolute left-0 right-0 z-100 mt-1.5 max-h-80 overflow-y-auto p-1.5',
        'border rounded-xl shadow-2xl backdrop-blur-md',
        'border-neutral-200 bg-white/95',
        'dark:border-neutral-800 dark:bg-neutral-900/95',
      ]"
    >
      <div class="px-2.5 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
        {{ searchQuery.trim() ? 'Search Results' : 'Suggested Shortcuts' }}
      </div>
      <div class="flex flex-col gap-0.5">
        <button
          v-for="(item, idx) in searchResults"
          :key="item.id"
          :class="[
            'flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors',
            highlightedIndex === idx
              ? 'bg-primary-500/10 font-semibold text-primary-600 dark:bg-primary-500/20 dark:text-primary-300'
              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60',
          ]"
          @mouseenter="highlightedIndex = idx"
          @click="handleSelect(item)"
        >
          <div class="min-w-0 flex flex-1 items-center gap-2.5">
            <div :class="item.icon || 'i-solar:alt-arrow-right-bold-duotone'" class="shrink-0 text-base text-primary-500" />
            <div class="min-w-0 flex flex-1 flex-col">
              <span class="truncate">{{ item.title }}</span>
              <span v-if="item.description" class="truncate text-[10px] text-neutral-400 font-normal dark:text-neutral-500">
                {{ item.description }}
              </span>
            </div>
          </div>
          <span
            :class="[
              'ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium',
              'bg-neutral-100 text-neutral-400',
              'dark:bg-neutral-800 dark:text-neutral-500',
            ]"
          >
            {{ item.category }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
