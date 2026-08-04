<script setup lang="ts">
import type { Live2DValidationReport } from '@proj-airi/stage-ui-live2d'

import type { DisplayModel } from '../../../../stores/display-models'

import { vAutoAnimate } from '@formkit/auto-animate/vue'
import { validateLive2DZip } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd/stores/mmd'
import { extractMmdFromZip } from '@proj-airi/stage-ui-mmd/utils/mmd-zip-extractor'
import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { Button } from '@proj-airi/ui'
import { refDebounced, useFileDialog, useIntersectionObserver } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import catalogUrl from '../../../../../public/assets/animadex-catalog.json?url'
import Live2DReportModal from './Live2DReportModal.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../stores/display-models'
import { useProvidersStore } from '../../../../stores/providers'
import { useSyncEngineStore } from '../../../../stores/sync-engine'

const props = withDefaults(defineProps<{
  initialTab?: 'library' | 'explore' | 'cloud'
}>(), {
  initialTab: 'library',
})

const emits = defineEmits<{
  (e: 'close', value: void): void
  (e: 'pick', value: DisplayModel | undefined): void
}>()
const selectedModel = defineModel<DisplayModel | undefined>({ type: Object, required: false })

const displayModelStore = useDisplayModelsStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const mmdStore = useMmd()
const providersStore = useProvidersStore()
const syncStore = useSyncEngineStore()
const { displayModelsFromIndexedDBLoading, displayModels, remoteModelsCatalog, remoteCatalogLoading } = storeToRefs(displayModelStore)

// Redesign State
const viewMode = ref<'grid' | 'compact'>('compact')
const searchQuery = ref('')
const debouncedSearchQuery = refDebounced(searchQuery, 150)
const formatFilter = ref<'all' | 'live2d' | 'vrm' | 'spine' | 'mmd'>('all')
const sortBy = ref<'name' | 'date' | 'type'>('date')

// Fast Set lookups for model availability
const downloadedModelIdsSet = computed(() => new Set(displayModels.value.map(m => m.id)))
const cloudModelIdsSet = computed(() => new Set(remoteModelsCatalog.value.map(m => m.id)))

// 100-Item Incremental Loading / Pagination State
const PAGE_SIZE = 100
const visibleCount = ref(PAGE_SIZE)
const loadMoreSentinelRef = ref<HTMLElement | null>(null)

// Expandable search state
const isSearchExpanded = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

// NSFW filter state
const nsfwFilter = ref<'sfw' | 'nsfw' | 'all'>('sfw')

// Groups filter state
const selectedGroups = ref<string[]>([])
const filterNotSet = ref(false)

// Tags filter state
const selectedTags = ref<string[]>([])

// Groups dialog/modal state
const showGroupsDialog = ref(false)
const modelToGroup = ref<DisplayModel | null>(null)
const tempGroupsValue = ref<string[]>([])
const newGroupName = ref('')

const showRenameDialog = ref(false)
const modelToRename = ref<DisplayModel | null>(null)
const tempRenameValue = ref('')

watch(isSearchExpanded, (expanded) => {
  if (expanded) {
    setTimeout(() => {
      searchInputRef.value?.focus()
    }, 50)
  }
})

const highlightDisplayModelCard = ref<string | undefined>(selectedModel.value?.id)
const showReportModal = ref(false)

// Live2D multi-file import queue
interface Live2DQueueItem {
  file: File
  report: Live2DValidationReport
}
const live2dQueue = ref<Live2DQueueItem[]>([])
const live2dQueueIndex = ref(0)
const live2dImportToastId = ref<string | number | null>(null)
const live2dImportedCount = ref(0)
const validationReport = computed(() => live2dQueue.value[live2dQueueIndex.value]?.report ?? null)

const currentTab = ref<'library' | 'explore' | 'cloud'>(props.initialTab || 'library')

watch(() => props.initialTab, (newTab) => {
  if (newTab)
    currentTab.value = newTab
}, { immediate: true })

watch(currentTab, (newTab) => {
  if (newTab === 'cloud' && remoteModelsCatalog.value.length === 0) {
    void displayModelStore.fetchRemoteDisplayModelsCatalog()
  }
})

onMounted(() => {
  const hasLoadedModels = displayModelStore.displayModels.length > 0
  void displayModelStore.loadDisplayModelsFromIndexedDB(hasLoadedModels)
})

const marketplaces = [
  { name: 'Steam Workshop', vrm: false, live2d: true, spine: true, mmd: false, languages: ['us'], origin: 'Steam', url: 'https://steamcommunity.com/workshop/browse/?appid=616720' },
  { name: 'VChaVCha (Hololive MMD)', vrm: false, live2d: false, spine: false, mmd: true, languages: ['us'], origin: 'VChaVCha', url: 'https://vchavcha.com/en/free-resources/hololive-mmd-download/' },
  { name: 'NicoNico 3D (MMD)', vrm: false, live2d: false, spine: false, mmd: true, languages: ['jp'], origin: 'Japan', url: 'https://3d.nicovideo.jp/search?category=all&download_filter=all&limit=28&max_pages=100&order=1&page=1&perfect_match=1&sort=view&usable_animation=&word=MMD&word_type=tag&work_type=mmd' },
  { name: 'Reverse: 1999 (v1.7+)', vrm: false, live2d: true, spine: false, mmd: false, languages: ['cn', 'en'], origin: 'Storm Preservation', url: 'https://dasilva333.github.io/r1999-web-gallery/' },
  { name: 'Eikanya Live2D Archive (4.9k+)', vrm: false, live2d: true, spine: false, mmd: false, languages: ['cn', 'en'], origin: 'Eikanya', url: 'https://dasilva333.github.io/live2d-eikanya-index/' },
  { name: 'SillyTavern Live2D Portal (270)', vrm: false, live2d: true, spine: false, mmd: false, languages: ['cn', 'en'], origin: 'test157t', url: 'https://dasilva333.github.io/live2d-test157t-index/' },
  { name: 'bear0830 (MMD Animations)', vrm: false, live2d: false, spine: false, mmd: true, languages: ['us'], origin: 'GitHub', url: 'https://github.com/bear0830/mmd' },
  { name: 'Booth', vrm: true, live2d: true, spine: false, mmd: false, languages: ['jp', 'us'], origin: 'Japan', url: 'https://booth.pm/en/browse/VTuber' },
  { name: 'Booth VRMA', vrm: true, live2d: false, spine: false, mmd: false, languages: ['jp', 'us'], origin: 'Japan', url: 'https://booth.pm/en/browse/3D%20Motion%20&%20Animation?sort=price_asc&tags%5B%5D=VRMA' },
  { name: 'VGen', vrm: true, live2d: true, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://vgen.co' },
  { name: 'itch.io', vrm: true, live2d: true, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://itch.io/game-assets' },
  { name: 'Gumroad', vrm: true, live2d: true, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://gumroad.com' },
  { name: 'Ko-fi', vrm: true, live2d: true, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://ko-fi.com/shop' },
  { name: 'VRoid Hub', vrm: true, live2d: false, spine: false, mmd: false, languages: ['jp', 'us'], origin: 'Japan', url: 'https://hub.vroid.com' },
  { name: 'Sketchfab', vrm: true, live2d: false, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://sketchfab.com' },
  { name: 'CGTrader', vrm: true, live2d: false, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://cgtrader.com' },
  { name: 'Nizima', vrm: false, live2d: true, spine: false, mmd: false, languages: ['jp', 'us'], origin: 'Japan', url: 'https://nizima.com' },
  { name: 'Avatar Atelier', vrm: false, live2d: true, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://avataratelier.com' },
  { name: 'VTuberAvatars', vrm: false, live2d: true, spine: false, mmd: false, languages: ['us'], origin: 'USA', url: 'https://vtuberavatars.com' },
]

// Filtering Logic
const filteredModels = computed(() => {
  let result = currentTab.value === 'cloud'
    ? remoteModelsCatalog.value.filter((rm: any) => !downloadedModelIdsSet.value.has(rm.id))
    : [...displayModels.value]

  // Search (matches pre-indexed search key or fallback name/tags)
  if (debouncedSearchQuery.value.trim()) {
    const q = debouncedSearchQuery.value.trim().toLowerCase()
    result = result.filter((m: any) => {
      if (m._searchKey) {
        return m._searchKey.includes(q)
      }
      const nameMatches = m.name?.toLowerCase().includes(q)
      const tagMatches = m.tags && Array.isArray(m.tags) && m.tags.some((t: string) => t.toLowerCase().includes(q))
      return nameMatches || tagMatches
    })
  }

  // Format Filter
  if (formatFilter.value !== 'all') {
    result = result.filter((m) => {
      if (formatFilter.value === 'live2d')
        return m.format === DisplayModelFormat.Live2dZip || m.format === DisplayModelFormat.Live2dDirectory
      if (formatFilter.value === 'vrm')
        return m.format === DisplayModelFormat.VRM
      if (formatFilter.value === 'spine')
        return m.format === DisplayModelFormat.SpineZip
      if (formatFilter.value === 'mmd')
        return m.format === DisplayModelFormat.PMXZip || m.format === DisplayModelFormat.PMXDirectory || m.format === DisplayModelFormat.PMD
      return true
    })
  }

  // NSFW Filter
  if (nsfwFilter.value === 'sfw') {
    result = result.filter(m => m.nsfw !== true)
  }
  else if (nsfwFilter.value === 'nsfw') {
    result = result.filter(m => m.nsfw === true)
  }

  // Groups Filter
  if (filterNotSet.value) {
    result = result.filter(m => !m.groups || !Array.isArray(m.groups) || m.groups.length === 0)
  }
  else if (selectedGroups.value.length > 0) {
    result = result.filter((m) => {
      if (!m.groups || !Array.isArray(m.groups))
        return false
      return m.groups.some((g: string) => selectedGroups.value.includes(g))
    })
  }

  // Tags Filter
  if (selectedTags.value.length > 0) {
    result = result.filter((m) => {
      if (!m.tags || !Array.isArray(m.tags))
        return false
      return selectedTags.value.every(t => m.tags!.includes(t))
    })
  }

  // Sort
  result.sort((a, b) => {
    if (sortBy.value === 'name')
      return a.name.localeCompare(b.name)
    if (sortBy.value === 'date')
      return b.importedAt - a.importedAt
    if (sortBy.value === 'type') {
      const typeA = mapFormatRenderer[a.format as DisplayModelFormat] || ''
      const typeB = mapFormatRenderer[b.format as DisplayModelFormat] || ''
      return typeA.localeCompare(typeB)
    }
    return 0
  })

  return result
})

watch([searchQuery, formatFilter, nsfwFilter, selectedGroups, selectedTags, sortBy, currentTab], () => {
  visibleCount.value = PAGE_SIZE
})

const paginatedModels = computed(() => {
  return filteredModels.value.slice(0, visibleCount.value)
})

function loadMore() {
  if (visibleCount.value < filteredModels.value.length) {
    visibleCount.value += PAGE_SIZE
  }
}

useIntersectionObserver(loadMoreSentinelRef, ([entry]) => {
  if (entry?.isIntersecting) {
    loadMore()
  }
})

const activeModelsForFilters = computed(() => {
  return currentTab.value === 'cloud'
    ? remoteModelsCatalog.value.filter((rm: any) => !displayModels.value.some(lm => lm.id === rm.id))
    : displayModels.value
})

const allExistingGroups = computed(() => {
  const groups = new Set<string>()
  activeModelsForFilters.value.forEach((m: any) => {
    if (m.groups && Array.isArray(m.groups)) {
      m.groups.forEach((g: string) => {
        if (g && g.trim()) {
          groups.add(g.trim())
        }
      })
    }
  })
  return Array.from(groups).sort()
})

const groupCounts = computed(() => {
  const counts: Record<string, number> = {}
  activeModelsForFilters.value.forEach((m: any) => {
    if (m.groups && Array.isArray(m.groups)) {
      m.groups.forEach((g: string) => {
        const trimmed = g.trim()
        if (trimmed) {
          counts[trimmed] = (counts[trimmed] || 0) + 1
        }
      })
    }
  })
  return counts
})

const ungroupedCount = computed(() => {
  return activeModelsForFilters.value.filter((m: any) => !m.groups || !Array.isArray(m.groups) || m.groups.length === 0).length
})

const tagCounts = computed(() => {
  const counts: Record<string, number> = {}
  activeModelsForFilters.value.forEach((m: any) => {
    if (m.tags && Array.isArray(m.tags)) {
      m.tags.forEach((t: string) => {
        const trimmed = t.trim().toLowerCase()
        if (trimmed) {
          counts[trimmed] = (counts[trimmed] || 0) + 1
        }
      })
    }
  })
  return counts
})

const top20Tags = computed(() => {
  const counts = tagCounts.value
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 20)
})

const isTagsInitialized = computed(() => {
  return activeModelsForFilters.value.some((m: any) => m.tags && m.tags.length > 0)
})

const localFormatCounts = computed(() => {
  const models = displayModels.value
  return {
    all: models.length,
    live2d: models.filter(m => m.format === DisplayModelFormat.Live2dZip || m.format === DisplayModelFormat.Live2dDirectory).length,
    vrm: models.filter(m => m.format === DisplayModelFormat.VRM).length,
    spine: models.filter(m => m.format === DisplayModelFormat.SpineZip).length,
    mmd: models.filter(m => m.format === DisplayModelFormat.PMXZip || m.format === DisplayModelFormat.PMXDirectory || m.format === DisplayModelFormat.PMD).length,
  }
})

const cloudFormatCounts = computed(() => {
  const models = remoteModelsCatalog.value
  return {
    all: models.length,
    live2d: models.filter(m => m.format === DisplayModelFormat.Live2dZip || m.format === DisplayModelFormat.Live2dDirectory).length,
    vrm: models.filter(m => m.format === DisplayModelFormat.VRM).length,
    spine: models.filter(m => m.format === DisplayModelFormat.SpineZip).length,
    mmd: models.filter(m => m.format === DisplayModelFormat.PMXZip || m.format === DisplayModelFormat.PMXDirectory || m.format === DisplayModelFormat.PMD).length,
  }
})

const formatCounts = computed(() => {
  return currentTab.value === 'cloud' ? cloudFormatCounts.value : localFormatCounts.value
})

function openGroupsDialog(model: DisplayModel) {
  modelToGroup.value = model
  tempGroupsValue.value = model.groups ? [...model.groups] : []
  newGroupName.value = ''
  showGroupsDialog.value = true
}

function confirmGroups() {
  if (modelToGroup.value) {
    const finalGroups = [...tempGroupsValue.value]
    const name = newGroupName.value.trim()
    if (name && !finalGroups.includes(name)) {
      finalGroups.push(name)
    }
    displayModelStore.updateDisplayModelMeta(modelToGroup.value.id, {
      groups: finalGroups,
    })
    newGroupName.value = ''
    showGroupsDialog.value = false
  }
}

function toggleModelNsfw(model: DisplayModel) {
  displayModelStore.updateDisplayModelMeta(model.id, {
    nsfw: !model.nsfw,
  })
}

function handleRemoveModel(model: DisplayModel) {
  displayModelStore.removeDisplayModel(model.id)
}

function openRenameDialog(model: DisplayModel) {
  modelToRename.value = model
  tempRenameValue.value = model.name
  showRenameDialog.value = true
}

function confirmRename() {
  if (modelToRename.value && tempRenameValue.value.trim()) {
    displayModelStore.renameDisplayModel(modelToRename.value.id, tempRenameValue.value.trim())
    showRenameDialog.value = false
  }
}

async function handleAddLive2DModel(files: FileList | null) {
  if (!files || files.length === 0)
    return

  live2dQueue.value = []
  live2dQueueIndex.value = 0
  live2dImportedCount.value = 0

  const zipFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.zip'))
  if (zipFiles.length === 0)
    return

  const total = zipFiles.length
  const toastId = toast.loading(`Validating ${total} Live2D file${total > 1 ? 's' : ''}…`)
  live2dImportToastId.value = toastId

  const reviewQueue: Live2DQueueItem[] = []

  // Validate all files; auto-import clean ones immediately
  for (let i = 0; i < zipFiles.length; i++) {
    const file = zipFiles[i]
    toast(`Validating ${i + 1} / ${total}: ${file.name}`, { id: toastId })
    const report = await validateLive2DZip(file)
    if (report.status === 'VALID' && report.errors.length === 0) {
      await displayModelStore.addDisplayModel(DisplayModelFormat.Live2dZip, file)
      live2dImportedCount.value++
    }
    else {
      reviewQueue.push({ file, report })
    }
  }

  if (reviewQueue.length === 0) {
    const n = live2dImportedCount.value
    toast.success(`Imported ${n} Live2D model${n > 1 ? 's' : ''}.`, { id: toastId })
    live2dImportToastId.value = null
    return
  }

  // Kick off the modal review queue for files that need attention
  live2dQueue.value = reviewQueue
  live2dQueueIndex.value = 0
  const reviewCount = reviewQueue.length
  toast(
    `Auto-imported ${live2dImportedCount.value} clean file${live2dImportedCount.value !== 1 ? 's' : ''}. Reviewing ${reviewCount} file${reviewCount > 1 ? 's' : ''} with issues…`,
    { id: toastId },
  )
  showReportModal.value = true
}

async function confirmImport() {
  const item = live2dQueue.value[live2dQueueIndex.value]
  if (item) {
    await displayModelStore.addDisplayModel(DisplayModelFormat.Live2dZip, item.file)
    live2dImportedCount.value++
  }
  advanceLive2DQueue()
}

function skipQueueItem() {
  advanceLive2DQueue()
}

function advanceLive2DQueue() {
  showReportModal.value = false
  const nextIndex = live2dQueueIndex.value + 1
  const toastId = live2dImportToastId.value

  if (nextIndex < live2dQueue.value.length) {
    live2dQueueIndex.value = nextIndex
    const nextFile = live2dQueue.value[nextIndex].file
    const reviewTotal = live2dQueue.value.length
    if (toastId !== null) {
      toast(`Reviewing ${nextIndex + 1} / ${reviewTotal}: ${nextFile.name}`, { id: toastId })
    }
    // Small delay so the modal close animation completes before re-opening
    setTimeout(() => {
      showReportModal.value = true
    }, 200)
  }
  else {
    // Queue exhausted — show final summary
    const imported = live2dImportedCount.value
    if (toastId !== null) {
      if (imported > 0) {
        toast.success(`Import complete — ${imported} model${imported > 1 ? 's' : ''} imported.`, { id: toastId })
      }
      else {
        toast.info('Import complete — all reviewed files were skipped.', { id: toastId })
      }
    }
    live2dQueue.value = []
    live2dQueueIndex.value = 0
    live2dImportedCount.value = 0
    live2dImportToastId.value = null
  }
}

function handlePick(m: DisplayModel) {
  selectedModel.value = m
  emits('pick', m)
  emits('close', undefined)
}

const remotePreviews = ref<Record<string, string>>({})
const loadingPreviews = ref<Record<string, boolean>>({})
const failedPreviews = ref<Record<string, boolean>>({})

async function loadRemotePreview(id: string) {
  if (remotePreviews.value[id] || loadingPreviews.value[id] || failedPreviews.value[id])
    return
  loadingPreviews.value[id] = true
  try {
    const readRes = await syncStore.readRemoteFile(`assets/models/${id}-preview.png`, 'base64')
    if (readRes.success && readRes.content) {
      remotePreviews.value[id] = `data:image/png;base64,${readRes.content}`
    }
    else {
      failedPreviews.value[id] = true
    }
  }
  catch (e) {
    console.warn('[ModelSelector] Failed to load remote preview:', id, e)
    failedPreviews.value[id] = true
  }
  finally {
    loadingPreviews.value[id] = false
  }
}

function getPreviewSrc(model: any) {
  if (model.previewImage)
    return model.previewImage
  if (remotePreviews.value[model.id])
    return remotePreviews.value[model.id]
  if (failedPreviews.value[model.id])
    return undefined
  if (model.type === 'cloud' && model.hasPreview) {
    void loadRemotePreview(model.id)
  }
  return undefined
}

function isDownloaded(modelId: string) {
  return downloadedModelIdsSet.value.has(modelId)
}

function isAvailableOnCloud(modelId: string) {
  return cloudModelIdsSet.value.has(modelId)
}

const downloadingModelId = ref<string | null>(null)

async function downloadAndPickModel(model: any) {
  downloadingModelId.value = model.id
  try {
    const res = await syncStore.downloadSpecificModel(model.id)
    if (res.success) {
      toast.success(`Model ${model.name} downloaded successfully!`)
      const localModel = displayModelStore.displayModels.find(m => m.id === model.id)
      if (localModel) {
        handlePick(localModel)
      }
      else {
        await displayModelStore.loadDisplayModelsFromIndexedDB()
        const reloadedModel = displayModelStore.displayModels.find(m => m.id === model.id)
        if (reloadedModel)
          handlePick(reloadedModel)
      }
    }
    else {
      toast.error(`Failed to download model: ${res.error}`)
    }
  }
  catch (e: any) {
    toast.error(`Error during download: ${e.message}`)
  }
  finally {
    downloadingModelId.value = null
  }
}

async function handleRemoveLocalCopy(model: DisplayModel) {
  await displayModelStore.removeLocalCopy(model.id)
}

function handleMobilePick() {
  const model = displayModels.value.find(model => model.id === highlightDisplayModelCard.value)
  if (model) {
    selectedModel.value = model
    emits('pick', model)
    emits('close', undefined)
  }
}

async function handleAddVRMModel(files: FileList | null) {
  if (files === null || files.length === 0)
    return

  let importedCount = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.name.endsWith('.vrm')) {
      try {
        await displayModelStore.addDisplayModel(DisplayModelFormat.VRM, file)
        importedCount++
      }
      catch (error) {
        console.error('[Model Selector] Failed to add VRM model:', file.name, error)
        toast.error(`Failed to add VRM model: ${file.name}`)
      }
    }
  }
  if (importedCount > 0) {
    toast.success(`Successfully imported ${importedCount} VRM model(s).`)
  }
}

async function handleAddSpineModel(files: FileList | null) {
  if (files === null || files.length === 0)
    return

  let importedCount = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.name.endsWith('.zip')) {
      try {
        await displayModelStore.addDisplayModel(DisplayModelFormat.SpineZip, file)
        importedCount++
      }
      catch (error) {
        console.error('[Model Selector] Failed to add Spine model:', file.name, error)
        toast.error(`Failed to add Spine model: ${file.name}. ${error instanceof Error ? error.message : ''}`)
      }
    }
  }
  if (importedCount > 0) {
    toast.success(`Successfully imported ${importedCount} Spine model(s).`)
  }
}

async function handleAddMmdModel(file: FileList | null) {
  if (file === null || file.length === 0)
    return

  const zipFile = file[0]
  if (!zipFile.name.toLowerCase().endsWith('.zip'))
    return

  try {
    const extracted = await extractMmdFromZip(zipFile)
    if (!extracted) {
      toast.error('No PMX or PMD model file found in the zip archive.')
      return
    }

    const format = extracted.modelFile.name.toLowerCase().endsWith('.pmd')
      ? DisplayModelFormat.PMD
      : DisplayModelFormat.PMXZip

    await displayModelStore.addDisplayModelWithTextures(format, extracted.modelFile, extracted.textureFiles)
    toast.success('MMD model added successfully!')
  }
  catch (error) {
    console.error('[Model Selector] Failed to add MMD model:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to add MMD model.')
  }
}

async function handleAddVmdMotion(file: FileList | null) {
  if (file === null || file.length === 0)
    return

  const vmdFile = file[0]
  if (!vmdFile.name.toLowerCase().endsWith('.vmd'))
    return

  try {
    const desc = await mmdStore.addMotion(vmdFile)
    toast.success(`Custom motion "${desc.name}" imported successfully!`)
  }
  catch (error) {
    console.error('[Model Selector] Failed to add VMD motion:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to add VMD motion.')
  }
}

async function handleAddVrmaAnimation(file: FileList | null) {
  if (file === null || file.length === 0)
    return
  if (!file[0].name.endsWith('.vrma'))
    return

  try {
    await customVrmAnimationsStore.addCustomAnimation(file[0])
    emits('close', undefined)
    toast.success(`${file[0].name} was added. It now appears in the idle loops dropdown. If it does not start immediately, click Refresh on the stage and then select it there.`)
  }
  catch (error) {
    console.error('[Model Selector] Failed to add VRMA animation', error)
    toast.error('Failed to add custom VRMA animation.')
  }
}

const mapFormatRenderer: Record<DisplayModelFormat, string> = {
  [DisplayModelFormat.Live2dZip]: 'Live2D',
  [DisplayModelFormat.Live2dDirectory]: 'Live2D',
  [DisplayModelFormat.VRM]: 'VRM',
  [DisplayModelFormat.SpineZip]: 'Spine',
  [DisplayModelFormat.PMXDirectory]: 'MMD',
  [DisplayModelFormat.PMXZip]: 'MMD',
  [DisplayModelFormat.PMD]: 'MMD',
}

const live2dDialog = useFileDialog({ accept: '.zip', multiple: true, reset: true })
const vrmDialog = useFileDialog({ accept: '.vrm', multiple: true, reset: true })
const vrmaDialog = useFileDialog({ accept: '.vrma', multiple: false, reset: true })
const spineDialog = useFileDialog({ accept: '.zip', multiple: true, reset: true })
const mmdDialog = useFileDialog({ accept: '.zip', multiple: false, reset: true })
const vmdDialog = useFileDialog({ accept: '.vmd', multiple: false, reset: true })

live2dDialog.onChange(handleAddLive2DModel)
vrmDialog.onChange(handleAddVRMModel)
vrmaDialog.onChange(handleAddVrmaAnimation)
spineDialog.onChange(handleAddSpineModel)
mmdDialog.onChange(handleAddMmdModel)
vmdDialog.onChange(handleAddVmdMotion)

function handleFixError(err: string) {
  // eslint-disable-next-line no-console
  console.log('[Model Selector] Fixing error:', err)
  // Logic to fix common errors (e.g. missing preview)
  // For now, we provide guidance or mark as ignorable in the future
  if (err.toLowerCase().includes('preview') || err.toLowerCase().includes('thumbnail') || err.toLowerCase().includes('icon')) {
    // If it's a missing preview, we could generate a placeholder
    // For this PR feedback, we just acknowledged the "Quick Fix" button existence
  }
}

const TAG_BLOCKLIST = new Set([
  '1girl',
  '1boy',
  'solo',
  'looking at viewer',
  'simple background',
  'white background',
  'black background',
  'grey background',
  'transparent background',
  'outstretched arms',
  'straight-on',
  'spread arms',
  'cowboy shot',
  'standing',
  't-pose',
  'full body',
  'upper body',
  'close-up',
  'tachi-e',
  'closed mouth',
  'blush',
  'blush stickers',
  'smile',
  'parted lips',
  'open mouth',
  'expressionless',
  'male focus',
  'holding',
  'hand on own hip',
])

async function testTagModel(mode: 'reindex' | 'fill-in' = 'reindex') {
  let modelsToTag = displayModels.value.filter(m => m.previewImage)
  if (mode === 'fill-in') {
    modelsToTag = modelsToTag.filter(m => !m.tags || m.tags.length === 0)
  }

  if (modelsToTag.length === 0) {
    if (mode === 'fill-in') {
      const toastId = toast.loading('All models already tagged. Re-evaluating model-to-character bindings...')
      await runAutoLinkCatalog()
      toast.success('Model-to-character bindings successfully re-evaluated!', { id: toastId })
    }
    else {
      toast.info('No models with a preview image found to process.')
    }
    return
  }

  const toastId = toast.loading('Starting Image Tagging process...')
  // eslint-disable-next-line no-console
  console.log(`[Model Selector] Starting batch auto-tagging (${mode}) on models:`, modelsToTag)

  const providerId = 'blip-local'
  try {
    providersStore.initializeProvider(providerId)
    if (!providersStore.addedProviders[providerId]) {
      providersStore.markProviderAdded(providerId)
    }
    if (providersStore.providerRuntimeState[providerId]) {
      providersStore.providerRuntimeState[providerId].isConfigured = true
    }

    const providerInstance = await providersStore.getProviderInstance<any>(providerId)
    if (!providerInstance) {
      throw new Error('Failed to retrieve Sparkle local vision provider instance')
    }

    // eslint-disable-next-line no-console
    console.log('[Model Selector] Loading local vision tagger model...')
    toast('Loading Vision Model (WebGPU)...', { id: toastId })
    await providerInstance.loadModel()

    let count = 0
    for (const model of modelsToTag) {
      toast(`Processing ${count + 1}/${modelsToTag.length} models: ${model.name}`, { id: toastId })

      try {
        // eslint-disable-next-line no-console
        console.log(`[Model Selector] Captioning model preview image for: ${model.name}`)
        const tagsResult = await providerInstance.captionImage(model.previewImage!)

        const tagsArray = tagsResult
          .split(',')
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t && !TAG_BLOCKLIST.has(t))

        await displayModelStore.updateDisplayModelTags(model.id, tagsArray)

        // eslint-disable-next-line no-console
        console.log(`[Model Selector] SUCCESS! Generated Tags for ${model.name}:`, tagsArray)
      }
      catch (err) {
        console.error(`[Model Selector] Failed to tag model ${model.name}:`, err)
      }
      count++
    }

    const exportedDataset = displayModels.value.map(m => ({
      id: m.id,
      name: m.name,
      format: m.format,
      tags: m.tags || [],
    }))

    // eslint-disable-next-line no-console
    console.log('[Model Selector] ALL MODELS TAGGED! Exported Dataset:', exportedDataset)

    // Trigger Auto-linking logic on completed catalog matching
    toast('Auto-linking models to AnimaDex catalog...', { id: toastId })
    await runAutoLinkCatalog()

    toast.success('All Models Tagged & Auto-Linked!', { id: toastId })
  }
  catch (error) {
    console.error('[Model Selector] Auto-tagging batch failed:', error)
    toast.error(`Tagging failed: ${error instanceof Error ? error.message : String(error)}`, { id: toastId })
  }
}

async function runAutoLinkCatalog() {
  try {
    const res = await fetch(catalogUrl)
    const data = await res.json()
    if (!data || !data.characters)
      return

    const rawBindings = localStorage.getItem('settings/airi-card/character-bindings')
    const bindings = rawBindings ? JSON.parse(rawBindings) : {}

    const rawBlacklist = localStorage.getItem('settings/airi-card/character-bindings-blacklist')
    const blacklist = new Set<string>(rawBlacklist ? JSON.parse(rawBlacklist) : [])

    let linkCount = 0
    let groupUpdateCount = 0

    for (const model of displayModels.value) {
      const mTags = new Set(model.tags?.map(t => t.trim().toLowerCase()) || [])
      if (mTags.size === 0)
        continue

      let bestScore = 0.0
      let bestCharTrigger = null
      let bestCharCopyrightIdx = -1

      data.characters.forEach((char: any) => {
        const triggerStr = char[3] // trigger is field index 3
        const tagsStr = char[4] // tags is field index 4
        if (!triggerStr || blacklist.has(triggerStr))
          return

        const cTags = new Set(tagsStr.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean))
        const intersection = [...mTags].filter(t => cTags.has(t)).length
        const union = mTags.size + cTags.size - intersection
        const score = union > 0 ? intersection / union : 0.0

        if (score > bestScore) {
          bestScore = score
          bestCharTrigger = triggerStr
          bestCharCopyrightIdx = char[1] // copyrightIndex is field index 1
        }
      })

      // If matched with >= 0.3 Jaccard score, save the link and upsert groups
      if (bestCharTrigger && bestScore >= 0.3) {
        bindings[bestCharTrigger] = {
          trigger: bestCharTrigger,
          displayModelId: model.id,
        }
        linkCount++

        // Extract series/copyright name from catalog index
        const seriesName = data.copyrights?.[bestCharCopyrightIdx]
        // eslint-disable-next-line no-console
        console.log(`[Auto-Link Debug] Model: ${model.name} matched Character: ${bestCharTrigger} (score: ${bestScore.toFixed(3)}) with Series: ${seriesName}`)

        if (seriesName) {
          const currentGroups = model.groups || []
          if (!currentGroups.includes(seriesName)) {
            const updatedGroups = [...currentGroups, seriesName]
            // eslint-disable-next-line no-console
            console.log(`[Auto-Link Debug] Upserting group "${seriesName}" to Model ${model.id} (current: ${currentGroups.join(', ')})`)
            await displayModelStore.updateDisplayModelMeta(model.id, { groups: updatedGroups })
            groupUpdateCount++
          }
        }
      }
    }

    localStorage.setItem('settings/airi-card/character-bindings', JSON.stringify(bindings))
    // eslint-disable-next-line no-console
    console.log(`[Model Selector] Auto-linked ${linkCount} models, upserted ${groupUpdateCount} model groups.`)
  }
  catch (err) {
    console.error('[Model Selector] Auto-link catalog mapping failed:', err)
  }
}
</script>

<template>
  <div :class="['pt-4 sm:pt-0', 'gap-4 sm:gap-6', 'h-full flex flex-col']">
    <div class="flex items-center">
      <Live2DReportModal
        v-model:open="showReportModal"
        :report="validationReport"
        @confirm="confirmImport"
        @close="skipQueueItem"
        @fix-error="handleFixError"
      />

      <!-- Rename Dialog -->
      <DialogRoot v-model:open="showRenameDialog">
        <DialogPortal>
          <DialogOverlay class="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm" />
          <DialogContent class="fixed left-1/2 top-1/2 z-[10001] max-w-md w-[90dvw] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white p-6 text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100">
            <DialogTitle class="text-lg font-bold">
              Rename Model
            </DialogTitle>
            <div :class="['mt-4 flex flex-col gap-4', 'split-button-container']">
              <input
                v-model="tempRenameValue"
                type="text"
                class="w-full border border-neutral-200 rounded-lg bg-neutral-100 px-3 py-2 outline-none dark:border-neutral-800 dark:bg-neutral-800"
                placeholder="Model Name"
                @keyup.enter="confirmRename"
              >
              <div class="flex justify-end gap-2">
                <Button variant="secondary" @click="showRenameDialog = false">
                  Cancel
                </Button>
                <Button @click="confirmRename">
                  Rename
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      <!-- Manage Groups Dialog -->
      <DialogRoot v-model:open="showGroupsDialog">
        <DialogPortal>
          <DialogOverlay class="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm" />
          <DialogContent class="fixed left-1/2 top-1/2 z-[10001] max-w-md w-[90dvw] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white p-6 text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100">
            <DialogTitle class="text-lg font-bold">
              Manage Groups
            </DialogTitle>
            <div class="mt-4 flex flex-col gap-4">
              <!-- List of existing groups with checkboxes -->
              <div v-if="allExistingGroups.length > 0" class="max-h-48 flex flex-col gap-2 overflow-y-auto">
                <label v-for="group in allExistingGroups" :key="group" class="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    v-model="tempGroupsValue"
                    type="checkbox"
                    :value="group"
                    class="border-neutral-300 rounded text-primary-500 focus:ring-primary-500"
                  >
                  <span>{{ group }}</span>
                </label>
              </div>
              <div v-else class="text-xs text-neutral-400">
                No existing groups. Add a new one below!
              </div>

              <!-- Add new group input -->
              <input
                v-model="newGroupName"
                type="text"
                class="w-full border border-neutral-200 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-800"
                placeholder="New Group Name"
                @keyup.enter="confirmGroups"
              >

              <div class="mt-2 flex justify-end gap-2">
                <Button variant="secondary" @click="showGroupsDialog = false">
                  Cancel
                </Button>
                <Button @click="confirmGroups">
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>
    </div>

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="text-xl font-bold">
          Models
        </div>
        <!-- Tab Navigation -->
        <div class="flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            :class="[
              currentTab === 'library' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'opacity-50 hover:opacity-100',
              'px-3 py-1 rounded-md transition-all text-sm font-bold flex items-center gap-1',
            ]"
            @click="currentTab = 'library'"
          >
            <div class="i-solar:library-bold-duotone" />
            Library ({{ localFormatCounts.all }})
          </button>
          <button
            :class="[
              currentTab === 'explore' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'opacity-50 hover:opacity-100',
              'px-3 py-1 rounded-md transition-all text-sm font-bold flex items-center gap-1',
            ]"
            @click="currentTab = 'explore'"
          >
            <div class="i-solar:compass-bold-duotone" />
            Explore
          </button>
          <button
            :class="[
              currentTab === 'cloud' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'opacity-50 hover:opacity-100',
              'px-3 py-1 rounded-md transition-all text-sm font-bold flex items-center gap-1',
            ]"
            @click="currentTab = 'cloud'"
          >
            <div class="i-solar:cloud-bold-duotone" />
            Cloud ({{ cloudFormatCounts.all }})
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- View Mode Toggle (Only for Library and Cloud) -->
        <div v-if="currentTab === 'library' || currentTab === 'cloud'" class="mr-2 flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            :class="[
              viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50',
              'p-1.5 rounded-md transition-all',
            ]"
            aria-label="Grid View"
            @click="viewMode = 'grid'"
          >
            <div class="i-solar:widget-2-bold-duotone" />
          </button>
          <button
            :class="[
              viewMode === 'compact' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50',
              'p-1.5 rounded-md transition-all',
            ]"
            aria-label="Compact Grid View"
            @click="viewMode = 'compact'"
          >
            <div class="i-solar:list-bold-duotone" />
          </button>
        </div>

        <DropdownMenuRoot v-if="currentTab === 'library'">
          <DropdownMenuTrigger
            class="flex items-center justify-center gap-2 rounded-lg bg-neutral-400/20 px-3 py-1.5 backdrop-blur-sm transition-colors duration-200 ease-in-out active:bg-neutral-400/60 dark:bg-neutral-700/50 hover:bg-neutral-400/45 active:dark:bg-neutral-700/90 hover:dark:bg-neutral-700/65"
            aria-label="Options for Display Models"
          >
            <div class="i-solar:add-circle-bold" />
            <div class="font-bold">
              Add Local
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              class="will-change-[opacity,transform] z-10000 max-w-45 border border-neutral-200 rounded-lg bg-neutral-100 p-0.5 text-neutral-900 shadow-md outline-none backdrop-blur-sm data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              align="end"
              side="bottom"
              :side-offset="8"
            >
              <DropdownMenuItem
                :class="[
                  'data-[disabled]:text-mauve8 relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 leading-none outline-none data-[disabled]:pointer-events-none',
                  'text-base sm:text-sm',
                  'data-[highlighted]:bg-primary-300/20 dark:data-[highlighted]:bg-primary-100/20',
                  'data-[highlighted]:text-primary-400 dark:data-[highlighted]:text-primary-200',
                ]"
                transition="colors duration-200 ease-in-out"
                @click="live2dDialog.open()"
              >
                Live2D (.zip)
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="[
                  'data-[disabled]:text-mauve8 relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 leading-none outline-none data-[disabled]:pointer-events-none',
                  'text-base sm:text-sm',
                  'data-[highlighted]:bg-primary-300/20 dark:data-[highlighted]:bg-primary-100/20',
                  'data-[highlighted]:text-primary-400 dark:data-[highlighted]:text-primary-200',
                ]"
                transition="colors duration-200 ease-in-out" @click="vrmDialog.open()"
              >
                VRM (.vrm)
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="[
                  'data-[disabled]:text-mauve8 relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 leading-none outline-none data-[disabled]:pointer-events-none',
                  'text-base sm:text-sm',
                  'data-[highlighted]:bg-primary-300/20 dark:data-[highlighted]:bg-primary-100/20',
                  'data-[highlighted]:text-primary-400 dark:data-[highlighted]:text-primary-200',
                ]"
                transition="colors duration-200 ease-in-out"
                @click="vrmaDialog.open()"
              >
                VRMA (.vrma)
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="[
                  'data-[disabled]:text-mauve8 relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 leading-none outline-none data-[disabled]:pointer-events-none',
                  'text-base sm:text-sm',
                  'data-[highlighted]:bg-primary-300/20 dark:data-[highlighted]:bg-primary-100/20',
                  'data-[highlighted]:text-primary-400 dark:data-[highlighted]:text-primary-200',
                ]"
                transition="colors duration-200 ease-in-out"
                @click="spineDialog.open()"
              >
                Spine (.zip)
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="[
                  'data-[disabled]:text-mauve8 relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 leading-none outline-none data-[disabled]:pointer-events-none',
                  'text-base sm:text-sm',
                  'data-[highlighted]:bg-primary-300/20 dark:data-[highlighted]:bg-primary-100/20',
                  'data-[highlighted]:text-primary-400 dark:data-[highlighted]:text-primary-200',
                ]"
                transition="colors duration-200 ease-in-out"
                @click="mmdDialog.open()"
              >
                MMD (.zip)
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="[
                  'data-[disabled]:text-mauve8 relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 leading-none outline-none data-[disabled]:pointer-events-none',
                  'text-base sm:text-sm',
                  'data-[highlighted]:bg-primary-300/20 dark:data-[highlighted]:bg-primary-100/20',
                  'data-[highlighted]:text-primary-400 dark:data-[highlighted]:text-primary-200',
                ]"
                transition="colors duration-200 ease-in-out"
                @click="vmdDialog.open()"
              >
                VMD (.vmd)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </div>

    <!-- Library & Cloud Tab Content -->
    <template v-if="currentTab === 'library' || currentTab === 'cloud'">
      <!-- Search & Filter Bar -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Expandable Search Input -->
        <div class="relative flex items-center" :class="isSearchExpanded || searchQuery ? 'flex-1 min-w-40' : ''">
          <button
            v-if="!isSearchExpanded && !searchQuery"
            class="h-[32px] w-[32px] flex items-center justify-center border border-transparent rounded-lg bg-neutral-100 text-neutral-500 transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
            title="Search Models"
            @click="isSearchExpanded = true"
          >
            <div class="i-solar:magnifer-linear text-sm" />
          </button>
          <div v-else class="relative w-full flex items-center">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
              <div class="i-solar:magnifer-linear text-xs text-neutral-500 dark:text-neutral-400" />
            </div>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="Search models..."
              class="h-[32px] w-full border border-transparent rounded-lg bg-neutral-100 py-1 pl-8 pr-7 text-xs outline-none transition-all focus:border-primary-400 dark:bg-neutral-800"
              @blur="searchQuery === '' ? isSearchExpanded = false : null"
            >
            <button
              class="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              @click="searchQuery = ''; isSearchExpanded = false"
            >
              <div class="i-solar:close-square-bold-duotone text-xs" />
            </button>
          </div>
        </div>

        <!-- Format Filter -->
        <select
          v-model="formatFilter"
          class="h-[32px] cursor-pointer border border-transparent rounded-lg bg-neutral-100 px-3 py-1 text-xs font-semibold outline-none transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          <option value="all">
            All Formats
          </option>
          <option value="live2d">
            Live2D ({{ formatCounts.live2d }})
          </option>
          <option value="vrm">
            VRM ({{ formatCounts.vrm }})
          </option>
          <option value="spine">
            Spine ({{ formatCounts.spine }})
          </option>
          <option value="mmd">
            MMD ({{ formatCounts.mmd }})
          </option>
        </select>

        <!-- Groups Popover -->
        <PopoverRoot>
          <PopoverTrigger as-child>
            <button
              :class="[
                'h-[32px] flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1 text-xs font-semibold outline-none transition-all',
                selectedGroups.length > 0 || filterNotSet
                  ? 'bg-primary-500/10 text-primary-500 border-primary-500/20 dark:bg-primary-500/20 dark:text-primary-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
              ]"
            >
              <div class="i-solar:folder-bold-duotone" />
              <span>Groups</span>
              <span v-if="selectedGroups.length > 0" class="rounded-full bg-primary-500 px-1 py-0.2 text-[9px] text-white font-bold">
                {{ selectedGroups.length }}
              </span>
              <span v-else-if="filterNotSet" class="rounded-full bg-primary-500 px-1 py-0.2 text-[9px] text-white font-bold">
                1
              </span>
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              side="bottom"
              :side-offset="6"
              align="start"
              class="animate-in fade-in zoom-in z-10000 w-64 border border-neutral-200/50 rounded-xl bg-white/95 p-3 shadow-xl backdrop-blur-xl duration-150 dark:border-neutral-700/50 dark:bg-neutral-900/95"
            >
              <div class="mb-2 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Filter by Groups
              </div>
              <div v-if="allExistingGroups.length === 0" class="py-2 text-center text-xs text-neutral-400">
                No groups found.
              </div>
              <div v-else class="max-h-32 flex flex-wrap gap-1.5 overflow-y-auto pr-1">
                <button
                  v-for="group in allExistingGroups"
                  :key="group"
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border',
                    selectedGroups.includes(group)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700',
                  ]"
                  @click="selectedGroups.includes(group) ? selectedGroups = selectedGroups.filter(g => g !== group) : (selectedGroups.push(group), filterNotSet = false)"
                >
                  {{ group }} ({{ groupCounts[group] || 0 }})
                </button>
              </div>
              <div class="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800">
                <button
                  class="text-[10px] font-bold transition-all"
                  :class="filterNotSet ? 'text-primary-500 hover:text-primary-600' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
                  @click="() => { filterNotSet = !filterNotSet; selectedGroups = [] }"
                >
                  Not Set ({{ ungroupedCount }})
                </button>
                <button
                  class="text-[10px] text-neutral-400 font-bold hover:text-neutral-600 dark:hover:text-neutral-200"
                  :disabled="selectedGroups.length === 0 && !filterNotSet"
                  :class="selectedGroups.length === 0 && !filterNotSet ? 'opacity-40 cursor-not-allowed' : ''"
                  @click="selectedGroups = []; filterNotSet = false"
                >
                  Reset
                </button>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <!-- Sort Popover -->
        <PopoverRoot>
          <PopoverTrigger as-child>
            <button
              class="h-[32px] flex items-center justify-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1 text-xs text-neutral-600 font-semibold outline-none transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              <div class="i-solar:sort-vertical-line-duotone" />
              <span>
                Sort: {{ sortBy === 'name' ? 'Name' : sortBy === 'type' ? 'Type' : 'Last Added' }}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              side="bottom"
              :side-offset="6"
              align="end"
              class="animate-in fade-in zoom-in z-10000 w-44 border border-neutral-200/50 rounded-xl bg-white/95 p-1 shadow-xl backdrop-blur-xl duration-150 dark:border-neutral-700/50 dark:bg-neutral-900/95"
            >
              <button
                :class="[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors',
                  sortBy === 'date' ? 'bg-primary-500/10 text-primary-500 dark:bg-primary-500/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                ]"
                @click="sortBy = 'date'"
              >
                Last Added
              </button>
              <button
                :class="[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors',
                  sortBy === 'name' ? 'bg-primary-500/10 text-primary-500 dark:bg-primary-500/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                ]"
                @click="sortBy = 'name'"
              >
                Name (A-Z)
              </button>
              <button
                :class="[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors',
                  sortBy === 'type' ? 'bg-primary-500/10 text-primary-500 dark:bg-primary-500/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                ]"
                @click="sortBy = 'type'"
              >
                Type (Format)
              </button>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <!-- NSFW Filter Popover -->
        <PopoverRoot>
          <PopoverTrigger as-child>
            <button
              :class="[
                'h-[32px] flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold outline-none transition-all active:scale-95',
                nsfwFilter === 'sfw'
                  ? 'bg-neutral-100 border-transparent text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  : nsfwFilter === 'nsfw'
                    ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 shadow-md shadow-red-500/10'
                    : 'bg-primary-500/10 text-primary-500 border-primary-500/20 dark:bg-primary-500/20 dark:text-primary-400',
              ]"
            >
              <div :class="nsfwFilter === 'nsfw' ? 'i-solar:eye-bold' : nsfwFilter === 'sfw' ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold'" />
              <span>
                {{ nsfwFilter === 'sfw' ? 'SFW Only' : nsfwFilter === 'nsfw' ? 'NSFW Only' : 'Show All' }}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              side="bottom"
              :side-offset="6"
              align="end"
              class="animate-in fade-in zoom-in z-10000 w-36 border border-neutral-200/50 rounded-xl bg-white/95 p-1 shadow-xl backdrop-blur-xl duration-150 dark:border-neutral-700/50 dark:bg-neutral-900/95"
            >
              <button
                :class="[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors',
                  nsfwFilter === 'sfw' ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 font-bold' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="nsfwFilter = 'sfw'"
              >
                SFW Only
              </button>
              <button
                :class="[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors',
                  nsfwFilter === 'nsfw' ? 'bg-red-500/10 text-red-500 font-bold' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="nsfwFilter = 'nsfw'"
              >
                NSFW Only
              </button>
              <button
                :class="[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded-lg transition-colors',
                  nsfwFilter === 'all' ? 'bg-primary-500/10 text-primary-500 dark:bg-primary-500/20 font-bold' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="nsfwFilter = 'all'"
              >
                Show All
              </button>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <!-- Tag Button / Popover -->
        <PopoverRoot v-if="isTagsInitialized">
          <PopoverTrigger as-child>
            <button
              :class="[
                'h-[32px] flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1 text-xs font-semibold outline-none transition-all',
                selectedTags.length > 0
                  ? 'bg-primary-500/10 text-primary-500 border-primary-500/20 dark:bg-primary-500/20 dark:text-primary-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
              ]"
            >
              <div class="i-solar:tag-bold-duotone text-xs" />
              <span>Tags</span>
              <span v-if="selectedTags.length > 0" class="rounded-full bg-primary-500 px-1 py-0.2 text-[9px] text-white font-bold">
                {{ selectedTags.length }}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              side="bottom"
              :side-offset="6"
              align="start"
              class="animate-in fade-in zoom-in z-10000 w-68 border border-neutral-200/50 rounded-xl bg-white/95 p-3 shadow-xl backdrop-blur-xl duration-150 dark:border-neutral-700/50 dark:bg-neutral-900/95"
            >
              <div class="mb-2 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Filter by Tags
              </div>
              <div v-if="top20Tags.length === 0" class="py-2 text-center text-xs text-neutral-400">
                No tags found.
              </div>
              <div v-else class="max-h-40 flex flex-wrap gap-1.5 overflow-y-auto pr-1">
                <button
                  v-for="tag in top20Tags"
                  :key="tag"
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border',
                    selectedTags.includes(tag)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700',
                  ]"
                  @click="selectedTags.includes(tag) ? selectedTags = selectedTags.filter(t => t !== tag) : selectedTags.push(tag)"
                >
                  {{ tag }} ({{ tagCounts[tag] || 0 }})
                </button>
              </div>

              <div class="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800">
                <div class="flex gap-1.5">
                  <button
                    class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 font-bold transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    @click="testTagModel('fill-in')"
                  >
                    Fill In
                  </button>
                  <button
                    class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 font-bold transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    @click="testTagModel('reindex')"
                  >
                    Reindex
                  </button>
                </div>
                <button
                  class="text-[10px] text-neutral-400 font-bold hover:text-neutral-600 dark:hover:text-neutral-200"
                  :disabled="selectedTags.length === 0"
                  :class="selectedTags.length === 0 ? 'opacity-40 cursor-not-allowed' : ''"
                  @click="selectedTags = []"
                >
                  Reset
                </button>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <!-- Uninitialized Tag Button -->
        <button
          v-else
          class="h-[32px] flex items-center justify-center gap-1.5 border border-transparent rounded-lg bg-neutral-100 px-3 py-1 text-xs text-neutral-600 font-semibold outline-none transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          @click="testTagModel('reindex')"
        >
          <div class="i-solar:tag-bold-duotone text-xs" />
          <span>Tag</span>
        </button>

        <!-- Manual Refresh Button (Only for Cloud Tab) -->
        <button
          v-if="currentTab === 'cloud'"
          class="h-[32px] flex items-center justify-center gap-1.5 border border-transparent rounded-lg bg-neutral-100 px-3 py-1 text-xs text-neutral-600 font-semibold outline-none transition-all dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          :disabled="remoteCatalogLoading"
          title="Refresh Cloud Catalog"
          @click="displayModelStore.fetchRemoteCatalog()"
        >
          <div :class="['i-solar:refresh-bold text-xs', remoteCatalogLoading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </button>
      </div>

      <div v-if="currentTab === 'library' && displayModelsFromIndexedDBLoading" class="py-6 text-center text-sm text-neutral-400">
        Loading library models...
      </div>
      <div v-else-if="currentTab === 'cloud' && remoteCatalogLoading" class="py-6 text-center text-sm text-neutral-400">
        Loading cloud catalog...
      </div>

      <div class="flex-1 overflow-y-auto pr-1">
        <div
          class="w-full lg:max-h-80dvh"
          :class="[
            viewMode === 'grid' ? 'flex flex-col gap-2 md:grid lg:grid-cols-2 md:grid-cols-1' : 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2',
          ]"
        >
          <!-- (Rest of Library Model Grid) -->
          <div
            v-for="(model) of paginatedModels"
            :key="model.id"
            class="group relative transition-all duration-200"
            :class="[
              viewMode === 'grid' ? 'block h-full w-full md:flex md:flex-row gap-2' : 'flex flex-col',
              highlightDisplayModelCard === model.id ? 'z-10' : 'z-0',
            ]"
            @click="() => highlightDisplayModelCard = model.id"
          >
            <!-- Options Menu -->
            <div v-if="isDownloaded(model.id)" class="absolute right-2 top-2 z-10">
              <DropdownMenuRoot>
                <DropdownMenuTrigger
                  :class="[
                    'bg-neutral-900/40 group-hover:bg-neutral-900/60 dark:bg-neutral-950/40 group-hover:dark:bg-neutral-900/80',
                    viewMode === 'compact' ? 'h-5 w-5' : 'h-7 w-7',
                    'text-white flex items-center justify-center rounded-lg backdrop-blur-md transition-all duration-200 ease-in-out shadow-sm',
                  ]"
                  aria-label="Options for Display Models"
                  @click.stop
                >
                  <div :class="['i-solar:menu-dots-bold', viewMode === 'compact' ? 'text-xs' : 'text-base']" />
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    :class="[
                      'will-change-[opacity,transform] z-10000 max-w-45 rounded-xl p-1 text-white shadow-2xl outline-none data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade dark:text-black',
                      'bg-neutral-900/90 dark:bg-neutral-100/90',
                      'backdrop-blur-xl border border-white/10 dark:border-black/10',
                    ]"
                    transition="colors duration-200 ease-in-out"
                    align="start"
                    side="bottom"
                    :side-offset="4"
                  >
                    <DropdownMenuItem
                      class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-base leading-none outline-none data-[highlighted]:bg-white/10 sm:text-sm dark:data-[highlighted]:bg-black/10"
                      @click="openRenameDialog(model)"
                    >
                      <div class="flex items-center gap-2">
                        <div class="i-solar:pen-bold" />
                        <div>Rename</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-base leading-none outline-none data-[highlighted]:bg-white/10 sm:text-sm dark:data-[highlighted]:bg-black/10"
                      @click="openGroupsDialog(model)"
                    >
                      <div class="flex items-center gap-2">
                        <div class="i-solar:folder-bold" />
                        <div>Groups</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-base leading-none outline-none data-[highlighted]:bg-white/10 sm:text-sm dark:data-[highlighted]:bg-black/10"
                      @click="toggleModelNsfw(model)"
                    >
                      <div class="flex items-center gap-2">
                        <div :class="model.nsfw ? 'i-solar:eye-closed-bold' : 'i-solar:eye-bold'" />
                        <div>{{ model.nsfw ? 'Mark as SFW' : 'Mark as NSFW' }}</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="isAvailableOnCloud(model.id)"
                      class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-base leading-none outline-none data-[highlighted]:bg-white/10 sm:text-sm dark:data-[highlighted]:bg-black/10"
                      @click="handleRemoveLocalCopy(model)"
                    >
                      <div class="flex items-center gap-2">
                        <div class="i-solar:cloud-download-bold" />
                        <div>Remove Local Copy</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-base text-red-400 font-semibold leading-none outline-none data-[highlighted]:bg-red-500/20 sm:text-sm"
                      @click="handleRemoveModel(model)"
                    >
                      <div class="flex items-center gap-2">
                        <div class="i-solar:trash-bin-minimalistic-bold-duotone" />
                        <div>{{ isAvailableOnCloud(model.id) ? 'Delete Everywhere' : 'Remove' }}</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </div>

            <!-- Preview Image Area -->
            <div
              class="relative cursor-pointer overflow-hidden transition-all duration-300"
              :class="[
                viewMode === 'grid' ? 'h-50 md:h-60 w-full md:w-45 lg:w-50 shrink-0' : 'aspect-[3/4] w-full',
              ]"
              @click="downloadingModelId === model.id ? null : (isDownloaded(model.id) ? handlePick(model) : downloadAndPickModel(model))"
            >
              <img
                v-if="getPreviewSrc(model)"
                :src="getPreviewSrc(model)"
                h-full w-full rounded-xl object-cover
                loading="lazy"
                :class="[
                  highlightDisplayModelCard === model.id ? 'ring-3 ring-primary-500 shadow-lg' : 'ring-1 ring-white/10 dark:ring-black/10',
                  'group-hover:scale-105 transition-transform duration-500',
                ]"
              >
              <div
                v-else
                :class="['h-full w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-neutral-200 dark:bg-neutral-800', highlightDisplayModelCard === model.id ? 'ring-3 ring-primary-500 shadow-lg' : 'ring-1 ring-white/10 dark:ring-black/10']"
              >
                <div v-if="loadingPreviews[model.id]" class="i-solar:refresh-bold animate-spin text-4xl opacity-50" />
                <div v-else class="i-solar:question-square-bold-duotone text-4xl opacity-30" />
              </div>

              <!-- Hover Effects Overlay -->
              <div
                class="pointer-events-none absolute inset-0 flex items-end justify-center rounded-xl from-black/60 to-transparent bg-gradient-to-t p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <div :class="['text-white text-xs font-bold flex items-center gap-1', 'translate-y-2 group-hover:translate-y-0 transition-transform duration-300']">
                  <template v-if="downloadingModelId === model.id">
                    <div class="i-solar:refresh-bold animate-spin" />
                    Downloading...
                  </template>
                  <template v-else-if="isDownloaded(model.id)">
                    <div class="i-solar:map-arrow-up-bold" />
                    Pick Model
                  </template>
                  <template v-else>
                    <div class="i-solar:cloud-download-bold" />
                    Download & Pick
                  </template>
                </div>
              </div>
            </div>

            <!-- Labels Area -->
            <div
              class="flex flex-1 flex-col"
              :class="[viewMode === 'grid' ? 'justify-between p-2' : 'p-1.5']"
            >
              <div class="w-full">
                <div class="mb-1 flex flex-wrap items-center gap-1">
                  <!-- Local vs Cloud Badge -->
                  <span v-if="isDownloaded(model.id)" class="rounded bg-green-500/10 px-1 py-0.2 text-[8px] text-green-500 font-bold tracking-wider uppercase">Local</span>
                  <span v-else class="rounded bg-sky-500/10 px-1 py-0.2 text-[8px] text-sky-500 font-bold tracking-wider uppercase">Cloud</span>
                  <!-- NSFW Badge -->
                  <span v-if="model.nsfw" class="rounded bg-red-500/10 px-1 py-0.2 text-[8px] text-red-500 font-bold tracking-wider uppercase">NSFW</span>
                  <!-- Group Badges -->
                  <span v-for="g in model.groups" :key="g" class="select-none rounded bg-primary-500/10 px-1.5 py-0.2 text-[8px] text-primary-500 font-semibold">{{ g }}</span>
                  <!-- Tag Badge -->
                  <span
                    v-if="model.tags && model.tags.length > 0"
                    :title="model.tags.join(', ')"
                    class="flex cursor-help select-none items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.2 text-[8px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    <div class="i-solar:tag-bold text-[8px]" />
                    <span>{{ model.tags.length }}</span>
                  </span>
                </div>
                <div
                  class="font-bold transition-colors"
                  :class="[
                    viewMode === 'grid' ? 'text-lg line-clamp-2 leading-tight' : 'text-sm line-clamp-1',
                    highlightDisplayModelCard === model.id ? 'text-primary-500' : '',
                  ]"
                >
                  {{ model.name }}
                </div>
                <div
                  class="mt-1 flex items-center gap-1 opacity-60"
                  :class="[viewMode === 'grid' ? 'text-sm' : 'text-xs']"
                >
                  <div v-if="model.format === DisplayModelFormat.VRM" class="i-solar:box-bold" />
                  <div v-else class="i-solar:mask-hachi-bold" />
                  <div>{{ mapFormatRenderer[model.format as DisplayModelFormat] }}</div>
                </div>
              </div>

              <!-- Pick / Download button for Grid View -->
              <Button
                v-if="viewMode === 'grid'"
                variant="secondary"
                class="mt-2 w-full !rounded-lg !py-1.5"
                :disabled="downloadingModelId === model.id"
                @click="isDownloaded(model.id) ? handlePick(model) : downloadAndPickModel(model)"
              >
                <span v-if="downloadingModelId === model.id" class="flex items-center justify-center gap-1">
                  <span class="i-solar:refresh-bold animate-spin" />
                  Downloading...
                </span>
                <span v-else-if="isDownloaded(model.id)">Pick</span>
                <span v-else class="flex items-center justify-center gap-1">
                  <span class="i-solar:cloud-download-bold" />
                  Download & Pick
                </span>
              </Button>
            </div>
          </div>

          <!-- Infinite Scroll Sentinel & Load More Trigger -->
          <div
            v-if="visibleCount < filteredModels.length"
            ref="loadMoreSentinelRef"
            class="col-span-full my-4 text-center"
          >
            <button
              class="border border-neutral-300 rounded-lg bg-neutral-100 px-4 py-2 text-xs text-neutral-700 font-semibold transition-all dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-700"
              @click="loadMore"
            >
              Load More ({{ paginatedModels.length }} of {{ filteredModels.length }})
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Explore Tab Content -->
    <template v-else-if="currentTab === 'explore'">
      <div class="flex-1 overflow-y-auto pb-4 pr-2">
        <div v-auto-animate class="grid grid-cols-1 gap-4 lg:grid-cols-3 md:grid-cols-2">
          <a
            v-for="site in marketplaces"
            :key="site.name"
            :href="site.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex flex-col gap-3 border border-transparent rounded-xl bg-neutral-100 p-4 shadow-sm transition-all duration-300 hover:border-primary-500/50 dark:bg-neutral-800/50 hover:bg-white hover:shadow-md dark:hover:bg-neutral-800"
          >
            <div class="flex items-start justify-between">
              <div class="text-lg font-bold transition-colors group-hover:text-primary-500">{{ site.name }}</div>
              <div class="i-solar:share-circle-bold-duotone text-primary-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <div class="flex flex-wrap gap-2">
              <div v-if="site.vrm" class="border border-blue-500/20 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-500 font-bold">VRM</div>
              <div v-if="site.live2d" class="border border-green-500/20 rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500 font-bold">LIVE2D</div>
              <div v-if="site.spine" class="border border-purple-500/20 rounded bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-500 font-bold">SPINE</div>
              <div v-if="site.mmd" class="border border-pink-500/20 rounded bg-pink-500/10 px-2 py-0.5 text-[10px] text-pink-500 font-bold">MMD</div>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
              <div class="flex items-center gap-1 text-xs opacity-50">
                <div class="i-solar:globus-linear" />
                {{ site.origin }}
              </div>
              <div class="flex gap-1">
                <span v-for="lang in site.languages" :key="lang" class="text-xs">
                  {{ lang === 'jp' ? '日本語' : 'English' }}
                </span>
              </div>
            </div>
          </a>
        </div>

        <div class="mt-8 flex flex-col items-center gap-2 border border-primary-500/10 rounded-2xl bg-primary-500/5 p-6 text-center">
          <div class="i-solar:info-circle-bold-duotone text-3xl text-primary-500" />
          <div class="text-lg font-bold">
            Know more resources?
          </div>
          <div class="max-w-sm text-sm opacity-70">
            Help the community by suggesting more marketplaces for VRM and Live2D models!
          </div>
          <a href="https://github.com/moeru-ai/airi/issues" target="_blank" class="mt-2 rounded-lg bg-primary-500 px-4 py-2 text-white font-bold transition-colors hover:bg-primary-600">Suggest a Site</a>
        </div>
      </div>
    </template>
    <Button class="block md:hidden" @click="handleMobilePick()">
      Confirm
    </Button>
  </div>
</template>
