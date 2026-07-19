<script setup lang="ts">
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'

import { useAnimaDexWizardStore } from '@proj-airi/stage-ui/stores/animadex-wizard'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAutonomousArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry-autonomous'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { computed, onMounted, ref } from 'vue'

import AutoVoiceConfigModal from '../AutoVoiceConfigModal.vue'
import ConceptBuilderModal from '../ConceptBuilderModal.vue'

const props = defineProps<{
  cardId: string
  card: AiriCard
}>()

const cardStore = useAiriCardStore()
const backgroundStore = useBackgroundStore()
const displayModelsStore = useDisplayModelsStore()
const autonomousArtistryStore = useAutonomousArtistryStore()
const userProfileStore = useSettingsUserProfile()
const wizardStore = useAnimaDexWizardStore()

const showBuilder = ref(false)
const editingConceptId = ref<string>()
const editingConceptData = ref<any>()

const autoVoiceModalOpen = ref(false)

const isCompatibleWithAutoAssign = computed(() => {
  return Object.keys(visualAssets.value).some(key => key.startsWith('actor_'))
})

const mappedCharactersForAutoAssign = computed(() => {
  const result: any[] = []

  Object.entries(visualAssets.value).forEach(([id, asset]: [string, any]) => {
    if (!id.startsWith('actor_'))
      return

    // Reconstruct name from actor key (e.g. actor_amethyst_steven_universe -> Amethyst Steven Universe)
    let name = id.replace(/^actor_/, '').replace(/_/g, ' ')
    name = name.replace(/\b\w/g, c => c.toUpperCase())

    const prompt = asset.prompt || ''
    const catalogEntry = wizardStore.findCatalogCharacter(prompt)
    const trigger = catalogEntry ? catalogEntry.trigger : (prompt.split(',')[0]?.trim() || name)

    let genderVal
    let traits: number[] = []
    if (catalogEntry) {
      genderVal = catalogEntry.traits[0] !== undefined ? wizardStore.facets.gender[catalogEntry.traits[0]] : undefined
      traits = catalogEntry.traits || []
    }

    result.push({
      id,
      name: catalogEntry ? catalogEntry.name : name,
      trigger,
      tags: prompt.slice(trigger.length).replace(/^[,\s()]+|[,\s()]+$/g, '').trim(),
      traits,
      gender: genderVal,
    })
  })

  return result
})

const boundModelsMap = computed(() => {
  const map: Record<string, string> = {}
  Object.entries(visualAssets.value).forEach(([id, asset]: [string, any]) => {
    if (id.startsWith('actor_') && asset.manifestation?.modelId) {
      map[id] = asset.manifestation.modelId
    }
  })
  return map
})

onMounted(async () => {
  if (wizardStore.characters.length === 0) {
    await wizardStore.loadCatalog()
  }
})

function handleAddConcept() {
  editingConceptId.value = undefined
  editingConceptData.value = undefined
  showBuilder.value = true
}

function handleAddUserProfileConcept() {
  const nextAssets = { ...visualAssets.value }
  nextAssets.concept_user = {
    description: userProfileStore.description || 'An observer/manager of this stage.',
    prompt: userProfileStore.prompt || '',
    isBase: false,
  }
  saveAssets(nextAssets)
}

function handleEditConcept(id: string, data: any) {
  editingConceptId.value = id
  editingConceptData.value = { ...data }
  showBuilder.value = true
}

function handleDeleteConcept(id: string) {
  const nextAssets = { ...visualAssets.value }
  delete nextAssets[id]
  saveAssets(nextAssets)
}

function handleSaveConcept(payload: { id: string, data: any, clone: boolean }) {
  const { id, data, clone } = payload
  const assets = { ...visualAssets.value }

  // If the ID changed and this is a save (not a clone), remove the old key — proper rename
  if (!clone && editingConceptId.value && editingConceptId.value !== id) {
    delete assets[editingConceptId.value]
  }

  assets[id] = data
  saveAssets(assets)
}

function handleApplyAutoVoices(payload: Record<string, { baseProvider: string, baseModel: string, baseVoice: string, idleAnimations?: string[] }>) {
  const nextAssets = { ...visualAssets.value }
  const extension = JSON.parse(JSON.stringify(props.card.extensions || {}))
  if (!extension.airi) {
    extension.airi = {}
  }
  if (!extension.airi.modules) {
    extension.airi.modules = {}
  }

  for (const [actorKey, voice] of Object.entries(payload)) {
    if (nextAssets[actorKey]) {
      const asset = nextAssets[actorKey] as any
      asset.speech = {
        provider: voice.baseProvider,
        model: voice.baseModel,
        voice_id: voice.baseVoice,
      }
      if (voice.idleAnimations) {
        asset.idleAnimations = [...voice.idleAnimations]
      }
    }

    if (!extension.airi.modules[actorKey]) {
      extension.airi.modules[actorKey] = {}
    }
    extension.airi.modules[actorKey].speech = {
      provider: voice.baseProvider,
      model: voice.baseModel,
      voice_id: voice.baseVoice,
    }
  }

  extension.airi.visual_assets = nextAssets

  cardStore.updateCard(props.cardId, {
    ...props.card,
    extensions: extension,
  })
}

function getConceptThumbUrl(asset: any): string | undefined {
  if (asset.manifestation?.modelId) {
    const model = displayModelsStore.displayModels.find(m => m.id === asset.manifestation.modelId)
    if (model?.previewImage) {
      return model.previewImage
    }
  }

  if (asset.prompt) {
    const match = wizardStore.findCatalogCharacter(asset.prompt)
    const canonicalTrigger = match ? match.trigger : asset.prompt.split(',')[0]?.trim()
    return wizardStore.getCharacterThumbUrl(canonicalTrigger) || undefined
  }

  return undefined
}

function saveAssets(assets: any) {
  const extension = JSON.parse(JSON.stringify(props.card.extensions || {}))
  if (!extension.airi)
    extension.airi = {}
  extension.airi.visual_assets = assets

  cardStore.updateCard(props.cardId, {
    ...props.card,
    extensions: extension,
  })
}

const visualAssets = computed(() => props.card.extensions?.airi?.visual_assets || {})
const activeConcepts = computed(() => props.card.extensions?.airi?.active_concepts || [])
const journalEntries = computed(() => backgroundStore.getCharacterJournalEntries(props.cardId))
const directorNotes = computed(() => autonomousArtistryStore.directorNotes.slice(-5).reverse())

async function toggleConcept(conceptId: string) {
  const concept = visualAssets.value[conceptId]
  let next = [...activeConcepts.value]

  if (next.includes(conceptId)) {
    // Deactivating: just remove it
    next = next.filter(id => id !== conceptId)
  }
  else {
    // Activating: apply Base vs Layer logic
    if (concept?.isBase) {
      // Base (Exclusionary): Clear the entire stack, add only this concept
      next = [conceptId]
    }
    else {
      // Layer (Additive): Push on top of whatever is already there
      next.push(conceptId)
    }
  }

  const extension = JSON.parse(JSON.stringify(props.card.extensions || {}))
  if (!extension.airi)
    extension.airi = {}
  extension.airi.active_concepts = Array.from(new Set(next))

  await cardStore.updateCard(props.cardId, {
    ...props.card,
    extensions: extension,
  })

  // Sync manifestation immediately (e.g. model swap)
  await autonomousArtistryStore.applyCurrentStackManifestations()
}
</script>

<template>
  <div class="h-full flex flex-col gap-6 overflow-hidden lg:flex-row">
    <!-- Left Pane: The Stage / Production Controls -->
    <div class="custom-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto pr-2">
      <!-- Studio Intro Blurb -->
      <div class="border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 text-xs text-neutral-600 dark:border-neutral-700/50 dark:bg-neutral-800/20 dark:text-neutral-400">
        <p class="leading-relaxed">
          <strong>Studio brings multi-actor and costume orchestration to your cards.</strong> Map concepts to different outfits or characters, binding specific assets like voices, 2D/3D models, or custom background scenes to each. Trigger them automatically with the Director, or programmatically via dialogue tags (<code class="rounded bg-neutral-200/50 px-1 text-[11px] font-mono dark:bg-neutral-800">&lt;|ACTOR:id|&gt;</code>). Sift through the possibilities, mix and match, and build your scene.
        </p>
        <div class="mt-2.5 flex items-center">
          <RouterLink
            to="/settings/docs/manual/tamagotchi/"
            class="inline-flex items-center gap-1 text-[11px] text-primary-500 font-bold hover:underline"
          >
            <div class="i-solar:document-bold-duotone text-sm" />
            Read the Studio orchestration guide in the docs &rarr;
          </RouterLink>
        </div>
      </div>

      <!-- Active Concepts Stack -->
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-xs text-neutral-400 font-bold tracking-widest uppercase">
            <div class="i-solar:layers-minimalistic-bold-duotone text-primary-500" />
            Active Concept Stack
          </h3>
          <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
            {{ activeConcepts.length }} Active
          </span>
        </div>

        <div class="min-h-12 flex flex-wrap gap-2 border border-neutral-200 rounded-xl border-dashed bg-neutral-50/30 p-3 dark:border-neutral-700 dark:bg-black/20">
          <div
            v-for="conceptId in activeConcepts"
            :key="conceptId"
            class="group animate-in fade-in zoom-in relative flex cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-3 py-1.5 text-white shadow-lg shadow-primary-500/20 duration-300"
            @click="toggleConcept(conceptId)"
          >
            <div class="i-solar:stars-minimalistic-bold text-xs" />
            <span class="text-xs font-bold">{{ conceptId }}</span>
            <button class="ml-1 rounded opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100">
              <div class="i-solar:close-circle-linear text-xs" />
            </button>
          </div>

          <div v-if="activeConcepts.length === 0" class="w-full flex items-center justify-center py-2 text-xs text-neutral-400 italic">
            No concepts currently stacked.
          </div>
        </div>
      </section>

      <!-- Concept Registry (The Closet) -->
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-xs text-neutral-400 font-bold tracking-widest uppercase">
            <div class="i-solar:box-minimalistic-bold-duotone text-primary-500" />
            Concept Registry
          </h3>
          <div class="flex items-center gap-3">
            <button
              v-if="isCompatibleWithAutoAssign"
              class="text-[10px] text-primary-500 font-bold hover:underline"
              @click="autoVoiceModalOpen = true"
            >
              Auto-Assign Voices
            </button>
            <span v-if="isCompatibleWithAutoAssign" class="text-xs text-neutral-300 dark:text-neutral-700">|</span>
            <button
              class="text-[10px] text-primary-500 font-bold hover:underline"
              @click="handleAddUserProfileConcept"
            >
              + Add User
            </button>
            <span class="text-xs text-neutral-300 dark:text-neutral-700">|</span>
            <button
              class="text-[10px] text-primary-500 font-bold hover:underline"
              @click="handleAddConcept"
            >
              + New Concept
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="(asset, id) in visualAssets"
            :key="id"
            class="group flex cursor-pointer gap-3 border border-neutral-200 rounded-xl bg-white p-3 transition-all dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-800/50 dark:hover:border-primary-500/50"
            :class="activeConcepts.includes(id as string) ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900' : ''"
            @click="toggleConcept(id as string)"
          >
            <!-- Left Column: Avatar Image -->
            <div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900/50">
              <img
                v-if="getConceptThumbUrl(asset)"
                :src="getConceptThumbUrl(asset)"
                alt=""
                class="h-full w-full object-cover"
                loading="lazy"
              >
              <div v-else class="h-full w-full flex items-center justify-center text-neutral-400">
                <div class="i-solar:ghost-bold text-lg" />
              </div>
            </div>

            <!-- Right Column: Content Details -->
            <div class="min-w-0 flex flex-1 flex-col justify-between">
              <div class="mb-1 flex items-center justify-between gap-2">
                <div class="min-w-0 flex items-center gap-1.5">
                  <span class="truncate text-xs text-neutral-700 font-bold transition-colors dark:text-neutral-200 group-hover:text-primary-500" :title="String(id)">
                    {{ id }}
                  </span>
                  <span
                    v-if="asset.isBase"
                    :class="[
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0',
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                    ]"
                  >BASE</span>
                  <span
                    v-else
                    :class="[
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0',
                      'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
                    ]"
                  >LAYER</span>
                  <div
                    v-if="asset.manifestation && (asset.manifestation.modelId || asset.manifestation.mood || asset.manifestation.backgroundId || asset.manifestation.active_expressions)"
                    class="i-solar:t-shirt-outline shrink-0 text-sm text-neutral-300"
                  />
                  <div
                    v-if="(asset as any).speech && (asset as any).speech.voice_id"
                    class="i-solar:volume-loud-outline shrink-0 text-sm text-neutral-300"
                  />
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <div v-if="activeConcepts.includes(id as string)" class="i-solar:check-circle-bold text-xs text-primary-500" />
                  <button
                    class="rounded bg-neutral-100 p-1 text-neutral-400 opacity-0 transition-all dark:bg-neutral-800 hover:bg-primary-500 hover:text-white group-hover:opacity-100"
                    @click.stop="handleEditConcept(id as string, asset)"
                  >
                    <div class="i-solar:pen-new-square-linear text-[10px]" />
                  </button>
                  <button
                    class="rounded bg-neutral-100 p-1 text-neutral-400 opacity-0 transition-all dark:bg-neutral-800 hover:bg-red-500 hover:text-white group-hover:opacity-100"
                    @click.stop="handleDeleteConcept(id as string)"
                  >
                    <div class="i-solar:trash-bin-trash-linear text-[10px]" />
                  </button>
                </div>
              </div>
              <p class="line-clamp-2 text-[10px] text-neutral-500 leading-normal">
                {{ asset.description }}
              </p>
              <div class="dark:border-neutral-850/50 mt-1.5 overflow-hidden border-t border-neutral-100/50 pt-1">
                <code class="block truncate text-[9px] text-neutral-400 font-mono italic">
                  {{ asset.prompt }}
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Director's Monitor -->
      <section class="mt-2 flex flex-col gap-3">
        <h3 class="flex items-center gap-2 text-xs text-neutral-400 font-bold tracking-widest uppercase">
          <div class="i-solar:monitor-camera-bold-duotone text-primary-500" />
          Director's Monitor
        </h3>

        <div class="flex flex-col gap-2">
          <div
            v-for="note in directorNotes"
            :key="note.id"
            class="animate-in slide-in-from-left-2 border border-neutral-200 rounded-xl bg-neutral-100/50 p-3 duration-300 dark:border-neutral-800 dark:bg-neutral-900/50"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="rounded bg-neutral-200 px-2 py-0.5 text-[10px] text-neutral-500 font-bold dark:bg-neutral-800">
                {{ note.title || 'Untitled Scene' }}
              </span>
              <span
                :class="[
                  'text-[10px] font-mono font-bold',
                  note.intensity >= 70 ? 'text-green-500' : 'text-neutral-400',
                ]"
              >
                Intensity: {{ note.intensity }}%
              </span>
            </div>
            <p class="text-[11px] text-neutral-600 leading-normal italic dark:text-neutral-400">
              "{{ note.content }}"
            </p>
            <div v-if="note.selected_concepts?.length" class="mt-2 flex gap-1">
              <span
                v-for="c in note.selected_concepts"
                :key="c"
                class="border border-primary-500/20 rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold"
              >
                {{ c }}
              </span>
            </div>
          </div>

          <div v-if="directorNotes.length === 0" class="border border-neutral-200 rounded-xl border-dashed py-8 text-center dark:border-neutral-800">
            <div class="i-solar:videocamera-record-linear mx-auto mb-2 text-2xl text-neutral-300" />
            <p class="text-xs text-neutral-400">
              Waiting for first production session...
            </p>
          </div>
        </div>
      </section>
    </div>

    <!-- Right Pane: Production Output (Gallery Preview) -->
    <div class="w-full flex flex-col gap-4 border-l border-neutral-100 pl-0 lg:w-80 dark:border-neutral-700/50 lg:pl-4">
      <h3 class="flex items-center gap-2 text-xs text-neutral-400 font-bold tracking-widest uppercase">
        <div class="i-solar:gallery-wide-bold-duotone text-primary-500" />
        Production Journal
      </h3>

      <div class="custom-scrollbar grid grid-cols-2 gap-3 overflow-y-auto pr-1 lg:grid-cols-1">
        <div
          v-for="entry in journalEntries.slice(0, 8)"
          :key="entry.id"
          class="group relative aspect-square overflow-hidden border border-neutral-200 rounded-xl bg-neutral-100 shadow-sm transition-transform hover:scale-[1.02] dark:border-neutral-800 dark:bg-neutral-900"
        >
          <img
            :src="backgroundStore.getBackgroundUrl(entry.id) ?? undefined"
            class="h-full w-full object-cover"
            loading="lazy"
          >
          <div class="absolute inset-0 flex flex-col justify-end from-black/80 via-transparent to-transparent bg-gradient-to-t p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <span class="truncate text-[10px] text-white font-bold">{{ entry.title }}</span>
            <button class="mt-2 rounded bg-white/20 py-1 text-[9px] text-white font-bold backdrop-blur-md transition-colors hover:bg-white/30">
              VIEW DETAILS
            </button>
          </div>
        </div>

        <div v-if="journalEntries.length === 0" class="aspect-square flex flex-col items-center justify-center border border-neutral-200 rounded-xl border-dashed bg-neutral-50/50 dark:border-neutral-800 dark:bg-black/10">
          <div class="i-solar:album-linear mb-2 text-3xl text-neutral-200" />
          <p class="px-4 text-center text-[10px] text-neutral-400 leading-tight">
            No generated content for this production yet.
          </p>
        </div>
      </div>

      <button class="mt-auto w-full rounded-xl bg-neutral-100 py-2.5 text-[10px] text-neutral-500 font-bold tracking-widest uppercase transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700">
        Open Full Gallery
      </button>
    </div>
  </div>

  <!-- Concept Builder Modal -->
  <ConceptBuilderModal
    v-model="showBuilder"
    :concept-id="editingConceptId"
    :initial-data="editingConceptData"
    @save="handleSaveConcept"
  />

  <AutoVoiceConfigModal
    v-model="autoVoiceModalOpen"
    :selected-characters="mappedCharactersForAutoAssign"
    :copyrights="wizardStore.copyrights"
    :genders="wizardStore.facets.gender"
    :bound-models="boundModelsMap"
    @apply="handleApplyAutoVoices"
  />
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}
</style>
