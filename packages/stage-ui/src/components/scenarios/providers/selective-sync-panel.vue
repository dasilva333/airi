<script setup lang="ts">
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import { useBackgroundStore } from '../../../stores/background'
import { useDisplayModelsStore } from '../../../stores/display-models'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useSyncEngineStore } from '../../../stores/sync-engine'

interface Props {
  showActions?: boolean
  actionLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  actionLabel: 'Sync Selected',
})

const emit = defineEmits<Emits>()

interface Emits {
  (e: 'cancel'): void
  (e: 'sync', checkedIds: string[]): void
}

const syncStore = useSyncEngineStore()
const cardStore = useAiriCardStore()
const backgroundStore = useBackgroundStore()
const displayModelsStore = useDisplayModelsStore()
const mmdStore = useMmd()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const {
  selectiveSyncEnabled,
  selectiveCheckedIds,
} = storeToRefs(syncStore)

const searchCharQuery = ref('')
const remoteCards = ref<Map<string, any>>(new Map())
const remoteModels = ref<any[]>([])
const remoteBgs = ref<any[]>([])
const remoteVmds = ref<any[]>([])
const remoteVrmas = ref<any[]>([])
const remoteFilesList = ref<any[]>([])
const isLoadingRemote = ref(false)
const remoteLoadError = ref('')

interface TreeNode {
  id: string
  label: string
  size?: string
  checked: boolean
  required?: boolean
  children?: TreeNode[]
}

const syncTree = ref<TreeNode[]>([
  {
    id: 'metadata',
    label: 'Database Core & Settings',
    checked: true,
    required: true,
    children: [
      { id: 'meta-configs', label: 'App Settings & Provider Configurations', checked: true, required: true },
      { id: 'meta-cards', label: 'Character Cards Database (JSON metadata)', checked: true, required: true },
      { id: 'meta-shortmemory', label: 'Short-Term Memory summaries', checked: true, required: true },
    ],
  },
  {
    id: 'chats',
    label: 'Chat Sessions',
    checked: true,
    children: [],
  },
  {
    id: 'backgrounds',
    label: 'Custom Background Images',
    checked: false,
    children: [],
  },
  {
    id: 'models',
    label: 'Display Models (VRM / Live2D / Spine / MMD)',
    checked: false,
    children: [],
  },
  {
    id: 'animations',
    label: 'Custom Motions & Animations (VMD / VRMA)',
    checked: false,
    children: [],
  },
])

async function fetchRemoteCatalogData() {
  isLoadingRemote.value = true
  remoteLoadError.value = ''
  try {
    const res = await syncStore.fetchRemoteSyncManifestCatalog()
    if (res && res.success) {
      const cardsMap = new Map()
      if (Array.isArray(res.cards)) {
        for (const [id, card] of res.cards) {
          cardsMap.set(id, card)
        }
      }
      remoteCards.value = cardsMap
      remoteModels.value = res.models || []
      remoteBgs.value = res.backgrounds || []
      remoteFilesList.value = res.remoteFiles || []
      remoteVmds.value = (res as any).vmds || []
      remoteVrmas.value = (res as any).vrmas || []
    }
    else {
      remoteLoadError.value = res?.error || 'Failed to retrieve remote catalog.'
    }
  }
  catch (e: any) {
    console.error('Failed to fetch remote catalog:', e)
    remoteLoadError.value = e.message || 'Network or connection error occurred.'
  }
  finally {
    isLoadingRemote.value = false
    updateSyncTree()
  }
}

onMounted(() => {
  void fetchRemoteCatalogData()
})

function updateSyncTree() {
  const checkedMap: Record<string, boolean> = {}

  if (selectiveSyncEnabled.value && selectiveCheckedIds.value && selectiveCheckedIds.value.length > 0) {
    for (const id of selectiveCheckedIds.value) {
      checkedMap[id] = true
    }
  }
  else {
    const saveCheckedState = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        checkedMap[node.id] = node.checked
        if (node.children) {
          saveCheckedState(node.children)
        }
      }
    }
    saveCheckedState(syncTree.value)
  }

  const allCards = new Map<string, any>()
  for (const [id, card] of remoteCards.value.entries()) {
    allCards.set(id, card)
  }
  for (const [id, card] of cardStore.cards.entries()) {
    allCards.set(id, card)
  }

  // 1. Core Metadata
  const metadataNode: TreeNode = {
    id: 'metadata',
    label: 'Database Core & Settings',
    checked: true,
    required: true,
    children: [
      { id: 'meta-configs', label: 'App Settings & Provider Configurations', checked: true, required: true },
      { id: 'meta-cards', label: 'Character Cards Database (JSON metadata)', checked: true, required: true },
      { id: 'meta-shortmemory', label: 'Short-Term Memory summaries', checked: true, required: true },
    ],
  }

  // 2. Chats
  const chatChildren: TreeNode[] = []
  if (allCards.size > 0) {
    for (const [id, card] of allCards.entries()) {
      const chatNodeId = `chat-${id}`
      const remoteChatFile = remoteFilesList.value.find(f =>
        f.relPath.replace(/\\/g, '/').startsWith(`db/chat/sessions/${id}.json`),
      )
      const sizeStr = remoteChatFile ? formatSize(remoteChatFile.size) : '150 KB'

      chatChildren.push({
        id: chatNodeId,
        label: card.name || 'Unnamed Session',
        size: sizeStr,
        checked: checkedMap[chatNodeId] !== false,
      })
    }
  }
  else {
    chatChildren.push(
      { id: 'chat-asuka', label: 'Asuka Langley Soryu', size: '250 KB', checked: checkedMap['chat-asuka'] !== false },
      { id: 'chat-kiana', label: 'Kiana Kaslana', size: '420 KB', checked: checkedMap['chat-kiana'] !== false },
      { id: 'chat-bronya', label: 'Bronya Zaychik', size: '1.2 MB', checked: checkedMap['chat-bronya'] !== false },
    )
  }

  const chatsNode: TreeNode = {
    id: 'chats',
    label: 'Chat Sessions',
    checked: checkedMap.chats !== false,
    children: chatChildren,
  }
  chatsNode.checked = chatChildren.some(c => c.checked)

  // 3. Backgrounds
  const localBgs = Array.from(backgroundStore.entries.values()).filter((e: any) => e.type !== 'builtin')
  const allBgsMap = new Map<string, any>()
  for (const bg of remoteBgs.value as any[]) {
    allBgsMap.set(bg.id, {
      id: bg.id,
      characterId: bg.characterId,
      title: bg.title,
      size: bg.sizeBytes || 0,
      isRemote: true,
    })
  }
  for (const bg of localBgs as any[]) {
    allBgsMap.set(bg.id, {
      id: bg.id,
      characterId: bg.characterId,
      title: bg.title,
      size: bg.blob?.size || 0,
      isLocal: true,
    })
  }

  const bgEntries = Array.from(allBgsMap.values())
  const bgGroups: Record<string, { entries: any[], totalSize: number }> = {}
  for (const entry of bgEntries) {
    const charId = entry.characterId || 'shared'
    if (!bgGroups[charId]) {
      bgGroups[charId] = { entries: [], totalSize: 0 }
    }
    bgGroups[charId].entries.push(entry)
    bgGroups[charId].totalSize += entry.size
  }

  const backgroundChildren: TreeNode[] = []
  for (const [charId, group] of Object.entries(bgGroups)) {
    let id = ''
    let label = ''
    if (charId === 'shared') {
      id = 'bg-char-shared'
      label = 'Shared / Global Backgrounds'
    }
    else {
      const card = allCards.get(charId)
      if (card) {
        id = `bg-char-${charId}`
        label = `${card.name}'s Backgrounds`
      }
      else {
        id = `bg-char-uncategorized-${charId}`
        label = `Orphaned (${charId.slice(0, 8)})`
      }
    }

    const count = group.entries.length
    const sizeStr = `${formatSize(group.totalSize)} (${count} image${count === 1 ? '' : 's'})`
    backgroundChildren.push({
      id,
      label,
      size: sizeStr,
      checked: checkedMap[id] || false,
      totalSize: group.totalSize,
    } as any)
  }
  backgroundChildren.sort((a: any, b: any) => b.totalSize - a.totalSize)

  const backgroundsNode: TreeNode = {
    id: 'backgrounds',
    label: 'Custom Background Images',
    checked: checkedMap.backgrounds || false,
    children: backgroundChildren,
  }
  if (backgroundChildren.length > 0) {
    backgroundsNode.checked = backgroundChildren.some(c => c.checked)
  }

  // 4. Display Models
  const localModels = displayModelsStore.displayModels.filter((m: any) => m.type === 'file')
  const allModelsMap = new Map<string, any>()
  for (const m of remoteModels.value as any[]) {
    allModelsMap.set(m.id, {
      id: m.id,
      name: m.name,
      format: m.format,
      sizeBytes: m.sizeBytes || 0,
      isRemote: true,
    })
  }
  for (const m of localModels as any[]) {
    const sizeBytes = (m as any).file?.size || 0
    allModelsMap.set(m.id, {
      id: m.id,
      name: m.name,
      format: m.format,
      sizeBytes,
      isLocal: true,
    })
  }

  for (const m of allModelsMap.values()) {
    if (!m.sizeBytes) {
      const binPath = `assets/models/${m.id}.bin`
      const remoteFile = remoteFilesList.value.find(rf => rf.relPath === binPath)
      if (remoteFile) {
        m.sizeBytes = remoteFile.size
      }
    }
  }

  const modelChildren: TreeNode[] = Array.from(allModelsMap.values()).map((model) => {
    return {
      id: `model-${model.id}`,
      label: `${model.name} (${model.format.toUpperCase()})`,
      size: formatSize(model.sizeBytes),
      checked: checkedMap[`model-${model.id}`] || false,
    }
  })

  const modelsNode: TreeNode = {
    id: 'models',
    label: 'Display Models (VRM / Live2D / Spine / MMD)',
    checked: checkedMap.models || false,
    children: modelChildren,
  }
  if (modelChildren.length > 0) {
    modelsNode.checked = modelChildren.some(c => c.checked)
  }

  // Merge VMDs
  const allVmdsMap = new Map<string, any>()
  for (const m of remoteVmds.value) {
    const binPath = `assets/mmd/animations/${m.id}.bin`
    const remoteFile = remoteFilesList.value.find(rf => rf.relPath === binPath)
    allVmdsMap.set(m.id, {
      id: m.id,
      name: m.name,
      sizeBytes: remoteFile?.size || 0,
    })
  }
  for (const m of mmdStore.customMotions || []) {
    const existing = allVmdsMap.get(m.id)
    allVmdsMap.set(m.id, {
      id: m.id,
      name: m.name,
      sizeBytes: existing?.sizeBytes || 0,
    })
  }

  // Merge VRMAs
  const allVrmasMap = new Map<string, any>()
  for (const a of remoteVrmas.value) {
    const binPath = `assets/vrma/animations/${a.id}.bin`
    const remoteFile = remoteFilesList.value.find(rf => rf.relPath === binPath)
    allVrmasMap.set(a.id, {
      id: a.id,
      name: a.name,
      sizeBytes: remoteFile?.size || 0,
    })
  }
  for (const a of Object.values(customVrmAnimationsStore.customAnimations || {})) {
    const id = (a as any).key.replace('custom-vrma:', '')
    const existing = allVrmasMap.get(id)
    allVrmasMap.set(id, {
      id,
      name: (a as any).name,
      sizeBytes: existing?.sizeBytes || (a as any).file?.size || 0,
    })
  }

  const animationChildren: TreeNode[] = []
  for (const m of allVmdsMap.values()) {
    animationChildren.push({
      id: `vmd-${m.id}`,
      label: `VMD: ${m.name}`,
      size: m.sizeBytes ? formatSize(m.sizeBytes) : undefined,
      checked: checkedMap[`vmd-${m.id}`] || false,
    })
  }
  for (const a of allVrmasMap.values()) {
    animationChildren.push({
      id: `vrma-${a.id}`,
      label: `VRMA: ${a.name}`,
      size: a.sizeBytes ? formatSize(a.sizeBytes) : undefined,
      checked: checkedMap[`vrma-${a.id}`] || false,
    })
  }

  const animationsNode: TreeNode = {
    id: 'animations',
    label: 'Custom Motions & Animations (VMD / VRMA)',
    checked: checkedMap.animations || false,
    children: animationChildren,
  }
  if (animationChildren.length > 0) {
    animationsNode.checked = animationChildren.some(c => c.checked)
  }

  syncTree.value = [
    metadataNode,
    chatsNode,
    backgroundsNode,
    modelsNode,
    animationsNode,
  ]
}

const allCardsMap = computed(() => {
  const cardsMap = new Map<string, any>()
  for (const [id, card] of remoteCards.value.entries()) {
    cardsMap.set(id, card)
  }
  for (const [id, card] of cardStore.cards.entries()) {
    cardsMap.set(id, card)
  }
  return cardsMap
})

watch(
  [
    () => backgroundStore.entries,
    () => displayModelsStore.displayModels,
    () => cardStore.cards,
    () => mmdStore.customMotions,
    () => customVrmAnimationsStore.customAnimations,
  ],
  () => {
    updateSyncTree()
  },
  { deep: true, immediate: true },
)

const allModelsList = computed(() => {
  const localModels = displayModelsStore.displayModels.filter((m: any) => m.type === 'file')
  const allModelsMap = new Map<string, any>()
  for (const m of remoteModels.value as any[]) {
    allModelsMap.set(m.id, m)
  }
  for (const m of localModels as any[]) {
    allModelsMap.set(m.id, m)
  }
  return Array.from(allModelsMap.values())
})

const searchMatchesMessage = computed(() => {
  const query = searchCharQuery.value.trim().toLowerCase()
  if (!query)
    return ''

  const foundEntry = Array.from(allCardsMap.value.entries()).find(([_, card]) =>
    card.name?.toLowerCase().includes(query),
  )
  if (foundEntry) {
    const [cardId, matchedCard] = foundEntry

    const localBgs = Array.from(backgroundStore.entries.values()).filter((e: any) => e.type !== 'builtin')
    const allBgs = [...remoteBgs.value, ...localBgs]
    const charBgs = allBgs.filter((e: any) => e.characterId === cardId)

    const referencedModelIds = new Set<string>()
    const defaultModelId = matchedCard.extensions?.airi?.modules?.displayModelId
    if (defaultModelId)
      referencedModelIds.add(defaultModelId)

    const visualAssets = matchedCard.extensions?.airi?.visual_assets || {}
    for (const asset of Object.values(visualAssets) as any[]) {
      if (asset.manifestation?.modelId) {
        referencedModelIds.add(asset.manifestation.modelId)
      }
    }

    const localModels = displayModelsStore.displayModels.filter((m: any) => m.type === 'file')
    const allModels = [...remoteModels.value, ...localModels]
    const matchedModels = allModels.filter((m: any) => referencedModelIds.has(m.id))

    return `Found: ${matchedCard.name} (${charBgs.length} Backgrounds, ${matchedModels.length} Models)`
  }

  // Fallback to models
  const matchedModels = allModelsList.value.filter(m =>
    m.name?.toLowerCase().includes(query),
  )
  if (matchedModels.length > 0) {
    return `Found: ${matchedModels.length} model${matchedModels.length === 1 ? '' : 's'}`
  }

  return 'No matches'
})

function handleSelectRelated() {
  const query = searchCharQuery.value.trim().toLowerCase()
  if (!query)
    return

  const foundEntry = Array.from(allCardsMap.value.entries()).find(([_, card]) =>
    card.name?.toLowerCase().includes(query),
  )

  if (foundEntry) {
    const [cardId, matchedCard] = foundEntry
    const targetIds = new Set<string>()

    targetIds.add(`bg-char-${cardId}`)

    const defaultModelId = matchedCard.extensions?.airi?.modules?.displayModelId
    if (defaultModelId)
      targetIds.add(`model-${defaultModelId}`)
    const defaultBgId = matchedCard.extensions?.airi?.modules?.activeBackgroundId
    if (defaultBgId) {
      const localBgs = Array.from(backgroundStore.entries.values()).filter((e: any) => e.type !== 'builtin')
      const allBgs = [...remoteBgs.value, ...localBgs]
      const bgEntry = allBgs.find((e: any) => e.id === defaultBgId)
      if (bgEntry) {
        const charId = bgEntry.characterId || 'shared'
        targetIds.add(charId === 'shared' ? 'bg-char-shared' : `bg-char-${charId}`)
      }
    }

    const visualAssets = matchedCard.extensions?.airi?.visual_assets || {}
    for (const asset of Object.values(visualAssets) as any[]) {
      if (asset.manifestation?.modelId) {
        targetIds.add(`model-${asset.manifestation.modelId}`)
      }
      if (asset.manifestation?.backgroundId) {
        const localBgs = Array.from(backgroundStore.entries.values()).filter((e: any) => e.type !== 'builtin')
        const allBgs = [...remoteBgs.value, ...localBgs]
        const bgEntry = allBgs.find((e: any) => e.id === asset.manifestation.backgroundId)
        if (bgEntry) {
          const charId = bgEntry.characterId || 'shared'
          targetIds.add(charId === 'shared' ? 'bg-char-shared' : `bg-char-${charId}`)
        }
      }
    }

    const cardNameLower = matchedCard.name?.toLowerCase() || ''

    for (const group of syncTree.value) {
      if (group.children) {
        for (const child of group.children) {
          if (child.required)
            continue

          const isChatMatch = group.id === 'chats' && (
            child.id.includes(cardId)
            || (cardNameLower && child.id.includes(cardNameLower))
            || child.label.toLowerCase().includes(cardNameLower)
          )

          if (targetIds.has(child.id) || isChatMatch) {
            child.checked = true
            group.checked = true
          }
        }
      }
    }
  }
  else {
    // Fallback: search and check matching models directly
    const matchedModels = allModelsList.value.filter(m =>
      m.name?.toLowerCase().includes(query),
    )
    if (matchedModels.length > 0) {
      const targetModelIds = new Set(matchedModels.map(m => `model-${m.id}`))
      for (const group of syncTree.value) {
        if (group.id === 'models' && group.children) {
          for (const child of group.children) {
            if (targetModelIds.has(child.id)) {
              child.checked = true
              group.checked = true
            }
          }
        }
      }
    }
  }
}

function selectRelatedAssetsForCard(cardId: string) {
  const card = allCardsMap.value.get(cardId)
  if (!card)
    return

  const targetIds = new Set<string>()
  targetIds.add(`bg-char-${cardId}`)

  const defaultModelId = card.extensions?.airi?.modules?.displayModelId
  if (defaultModelId)
    targetIds.add(`model-${defaultModelId}`)

  const defaultBgId = card.extensions?.airi?.modules?.activeBackgroundId
  if (defaultBgId) {
    const localBgs = Array.from(backgroundStore.entries.values()).filter((e: any) => e.type !== 'builtin')
    const allBgs = [...remoteBgs.value, ...localBgs]
    const bgEntry = allBgs.find((e: any) => e.id === defaultBgId)
    if (bgEntry) {
      const charId = bgEntry.characterId || 'shared'
      targetIds.add(charId === 'shared' ? 'bg-char-shared' : `bg-char-${charId}`)
    }
  }

  const visualAssets = card.extensions?.airi?.visual_assets || {}
  for (const asset of Object.values(visualAssets) as any[]) {
    if (asset.manifestation?.modelId) {
      targetIds.add(`model-${asset.manifestation.modelId}`)
    }
    if (asset.manifestation?.backgroundId) {
      const localBgs = Array.from(backgroundStore.entries.values()).filter((e: any) => e.type !== 'builtin')
      const allBgs = [...remoteBgs.value, ...localBgs]
      const bgEntry = allBgs.find((e: any) => e.id === asset.manifestation.backgroundId)
      if (bgEntry) {
        const charId = bgEntry.characterId || 'shared'
        targetIds.add(charId === 'shared' ? 'bg-char-shared' : `bg-char-${charId}`)
      }
    }
  }

  for (const group of syncTree.value) {
    // If models group is explicitly unchecked, skip auto-checking models
    if (group.id === 'models' && !group.checked && selectiveSyncEnabled.value)
      continue

    if (group.children) {
      for (const child of group.children) {
        if (child.required)
          continue
        if (targetIds.has(child.id)) {
          child.checked = true
          group.checked = true
        }
      }
    }
  }
}

function toggleChild(parentIndex: number, childIndex: number) {
  const parent = syncTree.value[parentIndex]
  const child = parent.children![childIndex]
  if (child.required)
    return
  child.checked = !child.checked

  if (parent.id === 'chats' && child.checked) {
    const cardId = child.id.replace('chat-', '')
    selectRelatedAssetsForCard(cardId)
  }

  const anyChecked = parent.children!.some(c => c.checked)
  parent.checked = anyChecked
}

function toggleParent(parentIndex: number) {
  const parent = syncTree.value[parentIndex]
  if (parent.required)
    return
  parent.checked = !parent.checked
  if (parent.children) {
    for (const child of parent.children) {
      if (child.required)
        continue
      child.checked = parent.checked
      if (parent.id === 'chats' && child.checked) {
        const cardId = child.id.replace('chat-', '')
        selectRelatedAssetsForCard(cardId)
      }
    }
  }
}

function getSelectedCheckedIds() {
  const checkedIds: string[] = []
  const collectChecked = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.checked) {
        checkedIds.push(node.id)
      }
      if (node.children) {
        collectChecked(node.children)
      }
    }
  }
  collectChecked(syncTree.value)
  return checkedIds
}

function handleSync() {
  emit('sync', getSelectedCheckedIds())
}

function formatSize(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

const totalSelectedSize = computed(() => {
  // Rough size simulation based on checked nodes
  let totalBytes = 0

  // We look through nodes to sum parsed size
  const parseSizeStr = (str: string): number => {
    if (!str)
      return 0
    const val = Number.parseFloat(str)
    if (str.includes('GB'))
      return val * 1024 * 1024 * 1024
    if (str.includes('MB'))
      return val * 1024 * 1024
    if (str.includes('KB'))
      return val * 1024
    return val
  }

  for (const parent of syncTree.value) {
    if (parent.children) {
      for (const child of parent.children) {
        if (child.checked && child.size) {
          totalBytes += parseSizeStr(child.size)
        }
      }
    }
  }

  if (totalBytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(totalBytes) / Math.log(k))
  return `${Number.parseFloat((totalBytes / k ** i).toFixed(1))} ${sizes[i]}`
})

defineExpose({
  getSelectedCheckedIds,
  fetchRemoteCatalogData,
  isLoadingRemote,
})
</script>

<template>
  <div class="h-full flex flex-1 flex-col gap-4 text-neutral-800 dark:text-white">
    <!-- Search Character Helper -->
    <div class="border border-neutral-200 rounded-xl bg-neutral-100/50 p-3 dark:border-white/5 dark:bg-neutral-950/40">
      <div class="mb-1.5 text-[10px] text-primary-500 font-bold tracking-wider uppercase dark:text-primary-400">
        Select by Character Profile
      </div>
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <input
            v-model="searchCharQuery"
            type="text"
            placeholder="Type character name (e.g. Asuka, Kiana, Bronya)..."
            class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-800 outline-none transition-colors dark:border-white/10 focus:border-primary-500 dark:bg-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
            @keydown.enter="handleSelectRelated"
          >
          <span v-if="searchMatchesMessage" class="absolute right-3 top-1/2 text-[10px] text-primary-500 font-semibold -translate-y-1/2 dark:text-primary-400">
            {{ searchMatchesMessage }}
          </span>
        </div>
        <button
          class="rounded-lg bg-primary-500 px-3 py-1.5 text-xs text-white font-bold transition-all hover:bg-primary-600 disabled:opacity-50"
          :disabled="!searchCharQuery"
          @click="handleSelectRelated"
        >
          Select All Related
        </button>
      </div>
    </div>

    <!-- Tree View Container -->
    <div class="min-h-[200px] flex flex-1 flex-col gap-4 overflow-y-auto border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 scrollbar-thin dark:border-white/5 dark:bg-neutral-950/25">
      <div v-if="isLoadingRemote" class="flex flex-col items-center justify-center gap-3 py-12 text-neutral-500 dark:text-neutral-400">
        <div class="i-solar:refresh-bold animate-spin text-3xl text-primary-500 dark:text-primary-400" />
        <div class="text-xs">
          Fetching remote assets and catalogs...
        </div>
      </div>

      <div v-else-if="remoteLoadError" class="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-rose-500 dark:text-rose-400">
        <div class="i-solar:danger-bold text-2xl" />
        <div class="text-xs font-semibold">
          Failed to fetch remote catalog
        </div>
        <div class="max-w-md break-words text-[10px] text-rose-600 dark:text-rose-500/85">
          {{ remoteLoadError }}
        </div>
        <button
          class="mt-2 rounded-lg bg-rose-500/10 px-3.5 py-1.5 text-xs text-rose-600 font-bold transition-colors dark:bg-rose-500/20 hover:bg-rose-500/25 dark:text-rose-300 dark:hover:bg-rose-500/30"
          @click="fetchRemoteCatalogData"
        >
          Retry Connection
        </button>
      </div>

      <template v-else>
        <div class="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2 text-xs text-neutral-500 dark:border-white/5 dark:text-neutral-400">
          <span>Resource Directory</span>
          <span class="text-primary-500 font-semibold dark:text-primary-400">Est. download size: {{ totalSelectedSize }}</span>
        </div>

        <div v-for="(parent, pIdx) in syncTree" :key="parent.id" class="flex flex-col gap-2">
          <!-- Parent Node -->
          <div class="group flex items-center justify-between">
            <label class="flex cursor-pointer select-none items-center gap-2.5">
              <input
                type="checkbox"
                :checked="parent.checked"
                :disabled="parent.required"
                class="border-neutral-300 rounded bg-white text-primary-500 dark:border-white/10 dark:bg-neutral-800 disabled:opacity-50 focus:ring-0 focus:ring-offset-0"
                @change="toggleParent(pIdx)"
              >
              <span class="text-xs text-neutral-800 font-bold transition-colors dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white" :class="{ 'text-primary-500 dark:text-primary-400': parent.required }">
                {{ parent.label }}
                <span v-if="parent.required" class="ml-1.5 rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 tracking-wider uppercase dark:bg-primary-500/25 dark:text-primary-400">Required</span>
              </span>
            </label>
          </div>

          <!-- Children Nodes -->
          <div v-if="parent.children" class="ml-1.5 flex flex-col gap-2.5 border-l border-neutral-200 pl-6 dark:border-white/5">
            <div v-for="(child, cIdx) in parent.children" :key="child.id" class="group flex items-center justify-between">
              <label class="flex cursor-pointer select-none items-center gap-2.5">
                <input
                  type="checkbox"
                  :checked="child.checked"
                  :disabled="child.required"
                  class="border-neutral-300 rounded bg-white text-primary-500 dark:border-white/10 dark:bg-neutral-800 disabled:opacity-50 focus:ring-0 focus:ring-offset-0"
                  @change="toggleChild(pIdx, cIdx)"
                >
                <span class="text-xs text-neutral-500 transition-colors dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200" :class="{ 'text-neutral-800 dark:text-neutral-300 font-medium': child.checked }">
                  {{ child.label }}
                </span>
              </label>
              <div class="flex items-center gap-2">
                <span v-if="child.size" class="text-[10px] text-neutral-400 font-semibold dark:text-neutral-500">{{ child.size }}</span>
                <span v-if="child.required" class="rounded bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-500 dark:text-primary-400">ALWAYS SYNCED</span>
                <span v-else-if="child.size" class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-500 dark:text-amber-400">HEAVY ASSET</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Action Footer if enabled -->
    <div v-if="props.showActions" class="flex items-center justify-between border-t border-white/5 pt-4">
      <span class="text-[10px] text-neutral-400">Values are stored locally for subsequent background sync cycles.</span>
      <div class="flex gap-2">
        <button
          class="border border-white/10 rounded-xl px-4 py-2 text-xs text-neutral-300 font-semibold outline-none transition-colors duration-200 hover:bg-white/5"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="rounded-xl bg-primary-500 px-4 py-2 text-xs text-white font-bold transition-all hover:bg-primary-600"
          @click="handleSync"
        >
          {{ props.actionLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
