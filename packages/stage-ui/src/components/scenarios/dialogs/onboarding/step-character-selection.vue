<script setup lang="ts">
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  selectedCharacterId: string
  onSelectCharacter: (id: string) => void
  onNext: () => void
  onPrevious: () => void
}>()

const cardStore = useAiriCardStore()
const displayModelsStore = useDisplayModelsStore()

const reluPreviewAttribute = new URL('../../../menu/relu.avif', import.meta.url).href
const fileInput = ref<HTMLInputElement | null>(null)

interface CharacterMetadata extends Partial<AiriCard> {
  name: string
  character_version?: string
  creator_notes?: string
  first_mes?: string
  alternate_greetings?: string[]
}

// Local helper for PNG Chara Card parsing (SillyTavern/v2 standard)
function base64ToUtf8(input: string) {
  return decodeURIComponent(
    window
      .atob(input)
      .split('')
      .map((c) => {
        return `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`
      })
      .join(''),
  )
}

function parsePngCharaPayload(buffer: ArrayBuffer): CharacterMetadata | null {
  const bytes = new Uint8Array(buffer)
  for (let offset = 8; offset < bytes.length - 8; ) {
    const length =
      ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0

    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])

    if (type === 'tEXt') {
      const dataStart = offset + 8
      const dataEnd = dataStart + length
      const data = bytes.slice(dataStart, dataEnd)
      const separator = data.indexOf(0)

      if (separator > 0) {
        const keyword = new TextDecoder().decode(data.slice(0, separator))
        if (keyword === 'chara') {
          const text = new TextDecoder().decode(data.slice(separator + 1))
          try {
            return JSON.parse(base64ToUtf8(text))
          } catch (e) {
            console.error('Failed to parse character card JSON:', e)
            return null
          }
        }
      }
    }
    offset += length + 12
  }
  return null
}

const starterCharacters = computed(() => {
  const seen = new Set<string>()
  return Array.from(cardStore.cards.entries())
    .filter(([_, card]) => {
      const name = card.name?.toLowerCase() || ''
      const isStarter = ['relu', 'dr. aria', 'lupin'].includes(name)
      if (isStarter && !seen.has(name)) {
        seen.add(name)
        return true
      }
      return false
    })
    .map(([id, card]) => {
      const displayModelId = card.extensions?.airi?.modules?.displayModelId
      const model = displayModelsStore.displayModels.find((m) => m.id === displayModelId)
      let preview = model?.previewImage || ''

      if (!preview && (card.name === 'ReLU' || card.name === 'Relu')) preview = reluPreviewAttribute

      return {
        description: card.description || '',
        id,
        name: card.name,
        preview,
      }
    })
})

onMounted(async () => {
  await displayModelsStore.loadDisplayModelsFromIndexedDB()
})

function selectCharacter(id: string) {
  props.onSelectCharacter(id)
}

async function handleNext() {
  props.onNext()
}

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const buffer = await file.arrayBuffer()
    const metadata = parsePngCharaPayload(buffer)

    if (metadata) {
      const cardId = await cardStore.addCard({
        ...metadata,
        extensions: {
          ...metadata.extensions,
          airi: {
            ...metadata.extensions?.airi,
            modules: {
              consciousness: { model: 'gpt-4o', provider: 'openai' },
              speech: { model: 'eleven_multilingual_v2', provider: 'elevenlabs', voice_id: 'alloy' },
              ...metadata.extensions?.airi?.modules,
            },
          },
        },
        name: metadata.name || file.name.replace('.png', ''),
        version: metadata.version || metadata.character_version || '1.0.0',
      } as AiriCard)

      selectCharacter(cardId)
    }
  } catch (err) {
    console.error('Failed to import character card:', err)
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

defineExpose({
  selectedCharacterId: () => props.selectedCharacterId,
})
</script>

<template>
  <div class="flex flex-col items-center gap-10 py-6 pb-24">
    <!-- Header Section -->
    <div class="text-center">
      <h2 class="text-3xl text-neutral-900 font-bold tracking-tight sm:text-4xl dark:text-neutral-50">
        Choose Your Companion
      </h2>
      <p class="mt-4 text-neutral-500 dark:text-neutral-400">
        Start your journey with a pre-configured consciousness.
      </p>
    </div>

    <!-- 3-Column Character Grid (Portrait) -->
    <div class="grid grid-cols-1 max-w-5xl w-full gap-8 px-4 sm:grid-cols-3">
      <div
        v-for="char in starterCharacters"
        :key="char.id"
        :class="[
          'group relative flex flex-col overflow-hidden rounded-3xl transition-all duration-300',
          'h-[440px] w-full',
          'cursor-pointer',
          props.selectedCharacterId === char.id
            ? 'ring-4 ring-primary-500 scale-[1.02] shadow-xl'
            : 'ring-1 ring-neutral-200 dark:ring-neutral-800 hover:ring-neutral-400 dark:hover:ring-neutral-600',
        ]"
        @click="selectCharacter(char.id)"
      >
        <!-- Portrait Image Holder -->
        <div class="relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <img
            v-if="char.preview"
            :src="char.preview"
            :alt="char.name"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          >
          <div v-else class="h-full w-full flex animate-pulse items-center justify-center bg-neutral-200 dark:bg-neutral-800">
            <div class="i-solar-gallery-bold h-12 w-12 text-neutral-400" />
          </div>
          <!-- Selection Effect -->
          <div
            v-if="props.selectedCharacterId === char.id"
            class="pointer-events-none absolute inset-0 bg-primary-500/10"
          />
        </div>

        <!-- Name & Description Overlay (Bottom Gradient) -->
        <div class="absolute bottom-0 left-0 right-0 h-40 flex flex-col justify-end from-black/90 via-black/40 to-transparent bg-gradient-to-t p-6">
          <h3 class="mb-1 text-xl text-white font-bold">
            {{ char.name }}
          </h3>
          <p class="line-clamp-3 text-[10px] text-neutral-200 leading-tight opacity-90">
            {{ char.description }}
          </p>
        </div>

        <!-- Selection Badge -->
        <div
          v-if="props.selectedCharacterId === char.id"
          class="absolute right-4 top-4 rounded-full bg-primary-500 p-2 text-white shadow-lg"
        >
          <div class="i-solar-check-read-bold h-5 w-5" />
        </div>
      </div>
    </div>

    <!-- Discover More Section (Footer) -->
    <div class="max-w-4xl w-full flex flex-col items-center gap-6 border border-neutral-200 rounded-2xl bg-neutral-100/50 p-6 font-sans dark:border-neutral-800 dark:bg-neutral-900/50">
      <div class="w-full flex flex-col items-center justify-between gap-6 px-2 md:flex-row">
        <div class="text-center md:text-left">
          <h4 class="text-xs text-neutral-400 font-bold tracking-widest uppercase dark:text-neutral-500">
            Discover More Characters
          </h4>
          <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Download PNG cards from the community and import them instantly.
          </p>
        </div>

        <!-- Links and Upload Button Grouped -->
        <div class="flex flex-wrap items-center justify-center gap-3 md:justify-end">
          <a
            v-for="link in [
              { name: 'JannyAI', url: 'https://jannyai.com/', icon: 'i-solar-cloud-bold-duotone' },
              { name: 'JanitorAI', url: 'https://janitorai.com/', icon: 'i-solar-ghost-bold-duotone' },
              { name: 'Chub AI', url: 'https://chub.ai/', icon: 'i-solar-folder-2-bold-duotone' },
              { name: 'Risu Realm', url: 'https://realm.risuai.net/', icon: 'i-solar-planet-bold-duotone' },
            ]"
            :key="link.name"
            :href="link.url"
            target="_blank"
            class="dark:hover:bg-neutral-750 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] text-neutral-600 font-bold shadow-sm ring-1 ring-neutral-200 transition-all dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-300 dark:ring-neutral-700 hover:ring-primary-500/50"
          >
            <div :class="[link.icon, 'h-4 w-4 opacity-70']" />
            {{ link.name }}
          </a>

          <!-- Dedicated Upload Button -->
          <Button
            variant="ghost"
            size="sm"
            class="h-9 gap-2 border-primary-500/30 rounded-xl bg-primary-500/5 px-4 text-primary-600 font-bold ring-0 hover:border-primary-500/50 hover:bg-primary-500/10 dark:text-primary-400"
            @click="triggerUpload"
          >
            <div class="i-solar-file-send-bold h-4 w-4" />
            Import Custom Card
          </Button>
          <input
            ref="fileInput"
            type="file"
            accept="image/png"
            class="hidden"
            @change="onFileSelected"
          >
        </div>
      </div>
    </div>

    <!-- Sticky Navigation Controls -->
    <div class="pointer-events-none fixed bottom-8 left-0 right-0 flex justify-center">
      <div class="pointer-events-auto flex items-center gap-4 border border-white/10 rounded-2xl bg-white/10 p-2 px-4 shadow-2xl backdrop-blur-xl dark:bg-black/20">
        <Button
          variant="ghost"
          size="lg"
          class="gap-2 text-neutral-400 hover:text-white"
          @click="onPrevious"
        >
          <div class="i-solar-arrow-left-bold h-5 w-5" />
          Back
        </Button>
        <div class="h-6 w-[1px] bg-white/10" />
        <Button
          variant="primary"
          size="lg"
          class="gap-2 bg-primary-500 px-8 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600"
          @click="handleNext"
        >
          {{ props.selectedCharacterId ? 'Start Your Journey' : 'Pick a Companion' }}
          <div class="i-solar-stars-bold h-5 w-5" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
