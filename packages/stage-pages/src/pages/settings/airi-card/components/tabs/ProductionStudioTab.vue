<script setup lang="ts">
import type { DisplayModel } from '@proj-airi/stage-ui/stores/display-models'
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'

import VoiceCreatorModal from '@proj-airi/stage-ui/components/scenarios/dialogs/VoiceCreatorModal.vue'

import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import { StageBackgroundDialogPicker } from '@proj-airi/stage-ui/components/scenarios/dialogs/stage-background-picker'
import { useAnimaDexWizardStore } from '@proj-airi/stage-ui/stores/animadex-wizard'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAutonomousArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry-autonomous'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { computed, onMounted, ref } from 'vue'

import AutoVoiceConfigModal from '../AutoVoiceConfigModal.vue'
import ConceptBuilderModal from '../ConceptBuilderModal.vue'

const props = defineProps<{
  cardId: string
  card: AiriCard
  speechProviderOptions?: { value: string, label: string }[]
  speechModelOptions?: { value: string, label: string }[]
  speechVoiceOptions?: { value: string, label: string }[]
  displayModelOptions?: { value: string, label: string }[]
  sceneOptions?: { value: string, label: string }[]
  speechProviderPlaceholder?: string
  defaultSpeechModelPlaceholder?: string
  defaultSpeechVoiceIdPlaceholder?: string
  speechModelPlaceholder?: string
  speechVoicePlaceholder?: string
  displayModelPlaceholder?: string
  scenePlaceholder?: string
  defaultDisplayModelIdPlaceholder?: string
  speechProviderActive?: boolean
}>()

const selectedSpeechProvider = defineModel<string>('selectedSpeechProvider', { required: false })
const selectedSpeechModel = defineModel<string>('selectedSpeechModel', { required: false })
const selectedSpeechVoiceId = defineModel<string>('selectedSpeechVoiceId', { required: false })
const selectedDisplayModelId = defineModel<string>('selectedDisplayModelId', { required: false })
const selectedActiveBackgroundId = defineModel<string>('selectedActiveBackgroundId', { required: false })

const cardStore = useAiriCardStore()
const backgroundStore = useBackgroundStore()
const displayModelsStore = useDisplayModelsStore()
const speechStore = useSpeechStore()
const autonomousArtistryStore = useAutonomousArtistryStore()
const userProfileStore = useSettingsUserProfile()
const wizardStore = useAnimaDexWizardStore()

const modelSelectorOpen = ref(false)
const scenePickerOpen = ref(false)
const showVoiceCreator = ref(false)
const isJournalDrawerOpen = ref(false)

const selectedModel = computed<DisplayModel | undefined>(() => {
  return displayModelsStore.displayModels.find(m => m.id === selectedDisplayModelId.value)
})

const selectedSceneUrl = computed(() => {
  if (!selectedActiveBackgroundId.value || selectedActiveBackgroundId.value === 'none')
    return null
  return backgroundStore.getBackgroundUrl(selectedActiveBackgroundId.value)
})

const selectedSceneTitle = computed(() => {
  if (!selectedActiveBackgroundId.value || selectedActiveBackgroundId.value === 'none')
    return 'None (Transparent / Solid)'
  const match = backgroundStore.availableBackgrounds?.find(b => b.id === selectedActiveBackgroundId.value)
  if (match)
    return match.title || match.id
  const opt = props.sceneOptions?.find(s => s.value === selectedActiveBackgroundId.value)
  if (opt)
    return opt.label
  return selectedActiveBackgroundId.value
})

function formatLabel(val: string | undefined, placeholder: string | undefined): string {
  if (val)
    return val
  return placeholder || 'Default'
}

const modelFormatLabel = computed(() => {
  if (!selectedModel.value)
    return ''
  const fmt = selectedModel.value.format.toLowerCase()
  if (fmt.includes('live2d'))
    return 'Live2D'
  if (fmt === 'vrm')
    return 'VRM'
  if (fmt.includes('spine'))
    return 'Spine'
  if (fmt.includes('pmx') || fmt === 'pmd')
    return 'MMD'
  return selectedModel.value.format.toUpperCase()
})

const activeVoiceDisplay = computed(() => {
  if (!selectedSpeechVoiceId.value)
    return 'Default Voice'

  const profile = speechStore.savedVoiceProfiles.find(p => p.id === selectedSpeechVoiceId.value)
  if (profile)
    return profile.name

  const opt = props.speechVoiceOptions?.find(v => v.value === selectedSpeechVoiceId.value)
  if (opt)
    return opt.label

  return selectedSpeechVoiceId.value
})

function handleSaveVoice(payload: { baseProvider: string, baseModel: string, baseVoice: string }) {
  // Write unconditionally: these are v-model bindings to the editor form, and
  // guarding on the current (often empty) value silently drops the save.
  selectedSpeechProvider.value = payload.baseProvider
  selectedSpeechModel.value = payload.baseModel
  selectedSpeechVoiceId.value = payload.baseVoice
}

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
    description: userProfileStore.description || 'A hands-on, down-to-earth creator who loves building things from scratch. Prefers honest, direct conversation and cozy downtime after a long day of work.',
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
  <div class="custom-scrollbar h-full flex flex-col gap-6 overflow-y-auto pr-2">
    <!-- Studio Intro Blurb -->
    <div class="border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 text-xs text-neutral-600 dark:border-neutral-700/50 dark:bg-neutral-800/20 dark:text-neutral-400">
      <p class="leading-relaxed">
        <strong>Staging & Studio orchestrates the active visual and vocal presence for your card.</strong> Configure the default avatar vessel, voice profile, and background scene here. Add custom concepts to map different outfits, expressions, or alternate characters, and trigger them dynamically during conversation.
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

    <!-- Section 1: Default Stage Foundation (Avatar, Speech, Scene) -->
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-xs text-neutral-400 font-bold tracking-widest uppercase">
          <div class="i-solar:stage-bold-duotone text-primary-500" />
          Stage Foundation
        </h3>
        <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
          Default Manifestation
        </span>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <!-- 1. Avatar Model Vessel -->
        <div class="flex flex-col justify-between border border-neutral-200 rounded-xl bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-xs text-neutral-700 font-bold dark:text-neutral-200">
                <div class="i-solar:user-bold-duotone text-sm text-primary-500" />
                Avatar Model
              </span>
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                :class="selectedDisplayModelId ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'"
              >
                {{ selectedDisplayModelId ? (modelFormatLabel || 'BOUND') : 'None (Text Only)' }}
              </span>
            </div>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Select a 2D (Live2D) or 3D (VRM) model vessel to inhabit the stage window.
            </p>
            <div class="mt-1 flex items-center gap-3 border border-neutral-200 rounded-lg bg-white p-2.5 dark:border-neutral-700/60 dark:bg-neutral-800/60">
              <!-- Preview Thumbnail -->
              <div class="h-10 w-10 flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-950">
                <img
                  v-if="selectedModel?.previewImage"
                  :src="selectedModel.previewImage"
                  class="h-full w-full object-cover"
                >
                <div v-else class="i-solar:gallery-bold text-lg text-neutral-300 dark:text-neutral-700" />
              </div>

              <!-- Model Details -->
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                  {{ (selectedDisplayModelId === 'none' || !selectedDisplayModelId) ? 'No Avatar (Text Only Mode)' : (selectedModel?.name || selectedDisplayModelId) }}
                </div>
                <div class="truncate text-[10px] text-neutral-400">
                  {{ (selectedDisplayModelId === 'none' || !selectedDisplayModelId) ? 'Dialogue appears without stage avatar rendering' : (selectedModel?.id || 'Active Model') }}
                </div>
              </div>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 inline-flex flex-1 items-center justify-center gap-1.5 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-700 font-medium shadow-sm transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200"
              @click="modelSelectorOpen = true"
            >
              <div class="i-solar:refresh-linear text-xs" />
              Change Avatar
            </button>
            <button
              v-if="selectedDisplayModelId"
              type="button"
              class="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-500 transition-colors dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Switch to Text-Only mode"
              @click="selectedDisplayModelId = ''"
            >
              None
            </button>
          </div>
        </div>

        <!-- 2. Vocal Speech Profile -->
        <div class="flex flex-col justify-between border border-neutral-200 rounded-xl bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-xs text-neutral-700 font-bold dark:text-neutral-200">
                <div class="i-solar:volume-loud-bold-duotone text-sm text-primary-500" />
                Vocal Profile
              </span>
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                :class="selectedSpeechVoiceId ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'"
              >
                {{ formatLabel(selectedSpeechProvider, speechProviderPlaceholder) }}
              </span>
            </div>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Primary text-to-speech voice assigned to synthesize spoken lines.
            </p>
            <div class="mt-1 border border-neutral-200 rounded-lg bg-white p-2.5 dark:border-neutral-700/60 dark:bg-neutral-800/60">
              <div class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                {{ activeVoiceDisplay }}
              </div>
              <div class="truncate text-[10px] text-neutral-400">
                {{ formatLabel(selectedSpeechModel, speechModelPlaceholder) }} &bull; {{ formatLabel(selectedSpeechVoiceId, speechVoicePlaceholder) }}
              </div>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 inline-flex flex-1 items-center justify-center gap-1.5 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-700 font-medium shadow-sm transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200"
              @click="showVoiceCreator = true"
            >
              <div class="i-solar:tuning-2-linear text-xs" />
              Customize Voice
            </button>
          </div>
        </div>

        <!-- 3. Stage Scene Background -->
        <div class="flex flex-col justify-between border border-neutral-200 rounded-xl bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-xs text-neutral-700 font-bold dark:text-neutral-200">
                <div class="i-solar:panorama-bold-duotone text-sm text-primary-500" />
                Default Scene
              </span>
              <span class="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400">
                {{ selectedActiveBackgroundId && selectedActiveBackgroundId !== 'none' ? 'Custom' : 'None' }}
              </span>
            </div>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Default backdrop or ambient environment displayed behind the avatar.
            </p>
            <div class="flex items-center gap-3 py-1">
              <div class="h-10 w-10 flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800">
                <img
                  v-if="selectedSceneUrl"
                  :src="selectedSceneUrl"
                  class="h-full w-full object-cover"
                >
                <div v-else class="i-solar:gallery-linear text-lg text-neutral-400" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ selectedSceneTitle }}
                </div>
                <div class="truncate text-[10px] text-neutral-400">
                  {{ selectedActiveBackgroundId && selectedActiveBackgroundId !== 'none' ? selectedActiveBackgroundId : 'No background active' }}
                </div>
              </div>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 inline-flex flex-1 items-center justify-center gap-1.5 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-700 font-medium shadow-sm transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200"
              @click="scenePickerOpen = true"
            >
              <div class="i-solar:gallery-wide-linear text-xs" />
              Change Scene
            </button>
            <button
              v-if="selectedActiveBackgroundId && selectedActiveBackgroundId !== 'none'"
              type="button"
              class="border border-neutral-200 rounded-lg bg-white px-2 py-1.5 text-xs text-neutral-400 transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:text-red-500 dark:hover:text-red-400"
              title="Clear Scene"
              @click="selectedActiveBackgroundId = 'none'"
            >
              <div class="i-solar:trash-bin-trash-linear text-xs" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 2: Active Concepts Stack -->
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
          No concepts currently stacked. Default Stage Foundation is actively driving manifestation.
        </div>
      </div>
    </section>

    <!-- Section 3: Concept Registry (The Closet) -->
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

      <!-- Full-Width Concept Cards Grid -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <!-- Top Row: Consolidated Badges, Icons, and Buttons (Static) -->
            <div class="mb-1.5 flex items-center justify-between gap-2 border-b border-neutral-100/50 pb-1 dark:border-neutral-700/30">
              <!-- Badges & Support Icons -->
              <div class="flex items-center gap-1.5">
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

              <!-- Action Controls & Active Status -->
              <div class="flex items-center gap-1.5">
                <div v-if="activeConcepts.includes(id as string)" class="i-solar:check-circle-bold text-xs text-primary-500" />
                <button
                  :class="[
                    'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    'bg-neutral-100 text-neutral-600 hover:bg-primary-500 hover:text-white',
                    'dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-primary-500 dark:hover:text-white',
                  ]"
                  @click.stop="handleEditConcept(id as string, asset)"
                >
                  <div class="i-solar:pen-new-square-linear text-[10px]" />
                  <span>Edit</span>
                </button>
                <button
                  :class="[
                    'rounded p-1 text-neutral-400 transition-colors',
                    'bg-neutral-100 hover:bg-red-500 hover:text-white',
                    'dark:bg-neutral-800 dark:hover:bg-red-500 dark:hover:text-white',
                  ]"
                  title="Delete concept"
                  @click.stop="handleDeleteConcept(id as string)"
                >
                  <div class="i-solar:trash-bin-trash-linear text-[10px]" />
                </button>
              </div>
            </div>

            <!-- Second Row: Concept Name (Full Width, non-aggressive ellipsis) -->
            <div class="line-clamp-1 mb-1 break-all text-xs text-neutral-700 font-bold transition-colors dark:text-neutral-200 group-hover:text-primary-500" :title="String(id)">
              {{ id }}
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

        <div
          v-if="Object.keys(visualAssets).length === 0"
          class="col-span-full border border-neutral-200 rounded-xl border-dashed py-12 text-center dark:border-neutral-700"
        >
          <div class="i-solar:t-shirt-bold-duotone mx-auto mb-2 text-3xl text-neutral-300 dark:text-neutral-600" />
          <p class="text-xs text-neutral-400">
            No concepts registered. Click "+ New Concept" to add alternative outfits, cast members, or styles.
          </p>
        </div>
      </div>
    </section>

    <!-- Section 4: Director's Monitor & Collapsible Production Journal -->
    <section class="border border-neutral-200 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-800/30">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="i-solar:clapperboard-play-bold-duotone text-primary-500" />
          <h3 class="text-xs text-neutral-400 font-bold tracking-widest uppercase">
            Director's Monitor
          </h3>
          <span
            v-if="directorNotes.length"
            class="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-500 font-bold"
          >
            State: {{ directorNotes[0].state || 'Active' }}
          </span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
          @click="isJournalDrawerOpen = !isJournalDrawerOpen"
        >
          <div class="i-solar:gallery-wide-bold-duotone text-xs text-primary-500" />
          <span>Production Journal ({{ journalEntries.length }})</span>
          <div :class="[isJournalDrawerOpen ? 'i-solar:alt-arrow-up-linear' : 'i-solar:alt-arrow-down-linear', 'text-xs']" />
        </button>
      </div>

      <!-- Director Note Card -->
      <div v-if="directorNotes.length" class="mt-3 border border-neutral-200 rounded-xl bg-neutral-50/50 p-3.5 dark:border-neutral-700/50 dark:bg-neutral-900/30">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] text-neutral-400 font-mono">
            {{ new Date(directorNotes[0].createdAt || Date.now()).toLocaleTimeString() }}
          </span>
          <span class="rounded bg-neutral-200/50 px-1.5 py-0.5 text-[9px] font-bold dark:bg-neutral-800">
            Intensity: {{ directorNotes[0].intensity }}%
          </span>
        </div>
        <p class="text-xs text-neutral-700 italic dark:text-neutral-300">
          "{{ directorNotes[0].content }}"
        </p>
        <div v-if="directorNotes[0].selected_concepts?.length" class="mt-2.5 flex flex-wrap gap-1">
          <span
            v-for="c in directorNotes[0].selected_concepts"
            :key="c"
            class="border border-primary-500/20 rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 font-bold"
          >
            {{ c }}
          </span>
        </div>
      </div>
      <div v-else class="mt-3 border border-neutral-200 rounded-xl border-dashed py-6 text-center dark:border-neutral-800">
        <p class="text-xs text-neutral-400 italic">
          Waiting for first production session...
        </p>
      </div>

      <!-- Collapsible Journal Drawer -->
      <div v-if="isJournalDrawerOpen" class="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-700/50">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-3">
          <div
            v-for="entry in journalEntries.slice(0, 12)"
            :key="entry.id"
            class="group relative aspect-square overflow-hidden border border-neutral-200 rounded-xl bg-neutral-100 shadow-sm transition-transform hover:scale-[1.02] dark:border-neutral-800 dark:bg-neutral-900"
          >
            <img
              :src="backgroundStore.getBackgroundUrl(entry.id) ?? undefined"
              class="h-full w-full object-cover"
              loading="lazy"
            >
            <div class="absolute inset-0 flex flex-col justify-end from-black/80 via-transparent to-transparent bg-gradient-to-t p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <span class="truncate text-[10px] text-white font-bold">{{ entry.title }}</span>
            </div>
          </div>

          <div v-if="journalEntries.length === 0" class="col-span-full py-6 text-center text-xs text-neutral-400">
            No generated visual journal entries for this production yet.
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- Modals -->
  <ModelSelectorDialog
    v-model:show="modelSelectorOpen"
    :selected-model="selectedModel"
    @pick="(model) => selectedDisplayModelId = model?.id || ''"
  />

  <StageBackgroundDialogPicker
    v-model="scenePickerOpen"
    v-model:selected-id="selectedActiveBackgroundId"
    :card-id="cardId"
    :auto-apply="false"
    close-on-pick
    title="Select Stage Scene"
    subtitle="Choose a background scene for this character or upload a new one."
    @pick="selectedActiveBackgroundId = $event"
  />

  <VoiceCreatorModal
    v-model="showVoiceCreator"
    :initial-provider="selectedSpeechProvider"
    :initial-model="selectedSpeechModel"
    :initial-voice="selectedSpeechVoiceId"
    @save="handleSaveVoice"
  />

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
