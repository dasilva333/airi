import type { MmdTextureFile } from '@proj-airi/stage-ui-mmd/utils/mmd-zip-extractor'

import JSZip from 'jszip'
import localforage from 'localforage'

import { loadLive2DModelPreview as generateLive2DPreview } from '@proj-airi/stage-ui-live2d/utils/live2d-preview'
import { loadMmdModelPreview as generateMmdPreview } from '@proj-airi/stage-ui-mmd/utils/mmd-preview'
import { loadSpineModelPreview as generateSpinePreview } from '@proj-airi/stage-ui-spine/utils/spine-preview'
import { loadVrmModelPreview as generateVrmPreview } from '@proj-airi/stage-ui-three/utils/vrm-preview'
import { until } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import '@proj-airi/stage-ui-live2d/utils/live2d-zip-loader'
import '@proj-airi/stage-ui-live2d/utils/live2d-opfs-registration'

// Hoisted RegExp literals to module scope to avoid recompilation in loops
const MOTION_REGEX_SINGLE = /^Motions_(.+)\.json$|motions?\/(.+)\.(?:motion3\.)?json$/i
const MOC_INDEX_REGEX = /Moc_(\d+)\.moc3$/i
const FILE_INDEX_REGEX = /_File_(\d+)/gi

const EXCLUDE_SUFFIXES = [
  '.moc3',
  '.png',
  '.jpg',
  '.jpeg',
  '.exp3.json',
  '.physics3.json',
  '.physics.json',
  '.pose3.json',
  '.pose.json',
  '.userdata3.json',
  '.cdi3.json',
  '.vtube.json',
  '.vtube-settings.json',
  'manifest.json',
]

const LIVE2D_EXTENSIONS = ['.moc3', '.png', '.json', '.jpg', '.jpeg', '.wav', '.mp3', '.ogg', '.aac', '.flac', '.m4a']

const MODERN_MODEL_EXCLUDE_SUFFIXES = [
  '.motion3.json',
  '.exp3.json',
  '.physics3.json',
  '.physics.json',
  '.pose3.json',
  '.pose.json',
  '.userdata3.json',
  '.cdi3.json',
  '.vtube.json',
  '.vtube-settings.json',
  'manifest.json',
]

export enum DisplayModelFormat {
  Live2dZip = 'live2d-zip',
  Live2dDirectory = 'live2d-directory',
  VRM = 'vrm',
  SpineZip = 'spine-zip',
  PMXZip = 'pmx-zip',
  PMXDirectory = 'pmx-directory',
  PMD = 'pmd',
}

export type DisplayModel
  = | DisplayModelFile
    | DisplayModelURL

const presetLive2dProUrl = new URL('../assets/live2d/models/hiyori_pro_zh.zip', import.meta.url).href
const presetLive2dFreeUrl = new URL('../assets/live2d/models/hiyori_free_zh.zip', import.meta.url).href
const presetLive2dPreview = new URL('../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAUrl = new URL('../assets/vrm/models/AvatarSample-A/AvatarSample_A.vrm', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBUrl = new URL('../assets/vrm/models/AvatarSample-B/AvatarSample_B.vrm', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

export interface DisplayModelFile {
  id: string
  format: DisplayModelFormat
  type: 'file'
  file: File
  name: string
  previewImage?: string
  importedAt: number
}

export interface DisplayModelURL {
  id: string
  format: DisplayModelFormat
  type: 'url'
  url: string
  name: string
  previewImage?: string
  importedAt: number
}

interface Live2DModelManifest {
  manifestPath: string
  mocFile: string
  data: Record<string, unknown>
}

interface IndexedDBModelValue {
  format: DisplayModelFormat
  file: File
  importedAt: number
  previewImage?: string
}

const displayModelsPresets: DisplayModel[] = [
  { id: 'preset-live2d-1', format: DisplayModelFormat.Live2dZip, type: 'url', url: presetLive2dProUrl, name: 'Hiyori (Pro)', previewImage: presetLive2dPreview, importedAt: 1733113886840 },
  { id: 'preset-live2d-2', format: DisplayModelFormat.Live2dZip, type: 'url', url: presetLive2dFreeUrl, name: 'Hiyori (Free)', previewImage: presetLive2dPreview, importedAt: 1733113886840 },
  { id: 'preset-vrm-1', format: DisplayModelFormat.VRM, type: 'url', url: presetVrmAvatarAUrl, name: 'AvatarSample_A', previewImage: presetVrmAvatarAPreview, importedAt: 1733113886840 },
  { id: 'preset-vrm-2', format: DisplayModelFormat.VRM, type: 'url', url: presetVrmAvatarBUrl, name: 'AvatarSample_B', previewImage: presetVrmAvatarBPreview, importedAt: 1733113886840 },
]

function isLive2DReference(value: string): boolean {
  const lower = value.toLowerCase()
  return LIVE2D_EXTENSIONS.some(ext => lower.endsWith(ext))
    && !lower.startsWith('http://')
    && !lower.startsWith('https://')
}

function findLive2dReferences(obj: unknown, refs: string[] = []): string[] {
  if (typeof obj === 'string') {
    if (isLive2DReference(obj)) {
      refs.push(obj)
    }
  }
  else if (Array.isArray(obj)) {
    for (const item of obj) {
      findLive2dReferences(item, refs)
    }
  }
  else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      findLive2dReferences((obj as Record<string, unknown>)[key], refs)
    }
  }
  return refs
}

function resolvePosixPath(baseDir: string, relativePath: string): string {
  const combined = baseDir ? `${baseDir}/${relativePath}` : relativePath
  const normalized = combined.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '')
      continue
    if (part === '..')
      stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function getEntryCaseInsensitive(zipInstance: JSZip, zipPath: string): JSZip.JSZipObject | null {
  const target = zipPath.toLowerCase().replace(/\\/g, '/')
  const exact = zipInstance.file(zipPath)
  if (exact)
    return exact

  for (const key of Object.keys(zipInstance.files)) {
    if (key.toLowerCase().replace(/\\/g, '/') === target && !zipInstance.files[key].dir) {
      return zipInstance.files[key]
    }
  }
  return null
}

async function getModernModelDetails(entryName: string, zipInstance: JSZip): Promise<Live2DModelManifest | null> {
  const fnLower = entryName.toLowerCase().split(/[\\/]/).pop() ?? ''
  if (MODERN_MODEL_EXCLUDE_SUFFIXES.some(s => fnLower.endsWith(s)))
    return null

  try {
    const file = zipInstance.file(entryName)
    if (!file)
      return null

    const content = await file.async('text')
    const data = JSON.parse(content) as Record<string, unknown>
    if (!data || typeof data !== 'object')
      return null

    const fileRefs = data.FileReferences as Record<string, unknown> | undefined
    let mocFile: string | null = null

    if (fileRefs?.Moc && typeof fileRefs.Moc === 'string') {
      mocFile = fileRefs.Moc
    }
    else if (data.model && typeof data.model === 'string') {
      mocFile = data.model
    }
    else if (data.moc && typeof data.moc === 'string') {
      mocFile = data.moc
    }

    if (mocFile && mocFile.toLowerCase().endsWith('.moc3')) {
      return { manifestPath: entryName, mocFile, data }
    }
  }
  catch {}
  return null
}

function getMotionRegex(isMultiModelNaming: boolean, modelIndex: string | null): RegExp {
  if (isMultiModelNaming && modelIndex !== null) {
    return new RegExp(`^Motions_(.+)_(\\d+)_File_${modelIndex}\\.json$`, 'i')
  }
  return MOTION_REGEX_SINGLE
}

function shouldExcludeFile(filename: string, manifestBasename: string): boolean {
  if (EXCLUDE_SUFFIXES.some(s => filename.toLowerCase().endsWith(s)))
    return true
  if (filename.toLowerCase() === manifestBasename.toLowerCase())
    return true
  return false
}

function isMotionFile(filename: string, pathKey: string): boolean {
  const isJson = filename.toLowerCase().endsWith('.json')
  return isJson || filename.toLowerCase().endsWith('.motion3.json') || pathKey.toLowerCase().includes('/motions/') || pathKey.toLowerCase().includes('/motion/')
}

function findOrphanedMotions(
  allPaths: string[],
  zipInstance: JSZip,
  model: Live2DModelManifest,
  manifestBasename: string,
  motionRegex: RegExp,
): boolean {
  for (const pathKey of allPaths) {
    if (zipInstance.files[pathKey].dir)
      continue
    const filename = pathKey.split(/[\\/]/).pop() ?? ''
    if (shouldExcludeFile(filename, manifestBasename))
      continue
    if (!isMotionFile(filename, pathKey))
      continue

    const match = filename.match(motionRegex) || pathKey.match(motionRegex)
    if (match) {
      const groupName = (match[1] || match[2] || match[3] || 'Idle').trim()
      const motions = model.data.FileReferences as Record<string, unknown> | undefined
      const groupList = motions?.Motions as Record<string, Array<{ File?: string }>> | undefined
      const alreadyExists = groupList?.[groupName]?.some(m => m.File?.toLowerCase() === filename.toLowerCase()) ?? false
      if (!alreadyExists)
        return true
    }
  }
  return false
}

function injectMotions(
  allPaths: string[],
  zipInstance: JSZip,
  model: Live2DModelManifest,
  manifestBasename: string,
  motionRegex: RegExp,
): void {
  for (const pathKey of allPaths) {
    if (zipInstance.files[pathKey].dir)
      continue
    const filename = pathKey.split(/[\\/]/).pop() ?? ''
    if (shouldExcludeFile(filename, manifestBasename))
      continue
    if (!isMotionFile(filename, pathKey))
      continue

    const match = filename.match(motionRegex) || pathKey.match(motionRegex)
    if (match) {
      const groupName = (match[1] || match[2] || match[3] || 'Idle').trim()
      const motions = model.data.FileReferences as Record<string, unknown>
      if (!motions.Motions) {
        motions.Motions = {}
      }
      const groupList = motions.Motions as Record<string, Array<{ File: string, FadeIn: number, FadeOut: number }>>
      const alreadyExists = groupList[groupName]?.some(m => m.File?.toLowerCase() === filename.toLowerCase()) ?? false
      if (!alreadyExists) {
        if (!groupList[groupName]) {
          groupList[groupName] = []
        }
        groupList[groupName].push({ File: filename, FadeIn: 0, FadeOut: 0 })
      }
    }
  }
}

function cleanseMotions(obj: unknown): unknown {
  if (typeof obj === 'string') {
    if (obj.toLowerCase().endsWith('.ogg3'))
      return obj.substring(0, obj.length - 1)
  }
  else if (Array.isArray(obj)) {
    return obj.map(cleanseMotions)
  }
  else if (obj && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {}
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      newObj[key] = cleanseMotions((obj as Record<string, unknown>)[key])
    }
    return newObj
  }
  return obj
}

function adaptMotions(obj: unknown, masterIndex: string, modelIndex: string): unknown {
  if (typeof obj === 'string') {
    if (obj.toLowerCase().endsWith('.json') && FILE_INDEX_REGEX.test(obj)) {
      return obj.replace(FILE_INDEX_REGEX, `_File_${modelIndex}`)
    }
  }
  else if (Array.isArray(obj)) {
    return obj.map(item => adaptMotions(item, masterIndex, modelIndex))
  }
  else if (obj && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {}
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      newObj[key] = adaptMotions((obj as Record<string, unknown>)[key], masterIndex, modelIndex)
    }
    return newObj
  }
  return obj
}

function selectMasterModel(models: Live2DModelManifest[]): Live2DModelManifest | null {
  let masterModel: Live2DModelManifest | null = null
  let maxMotionsCount = 0
  for (const m of models) {
    let count = 0
    const motions = (m.data.FileReferences as Record<string, unknown>)?.Motions as Record<string, unknown[]> | undefined
    if (motions) {
      for (const group of Object.keys(motions)) {
        count += motions[group]?.length || 0
      }
    }
    if (count > maxMotionsCount) {
      maxMotionsCount = count
      masterModel = m
    }
  }
  return masterModel
}

async function restoreMotionsFromMaster(
  model: Live2DModelManifest,
  masterModel: Live2DModelManifest,
  modelIndex: string,
  masterIndex: string,
): Promise<void> {
  const copiedMotions = structuredClone((masterModel.data.FileReferences as Record<string, unknown>).Motions)
  const adaptedMotions = adaptMotions(copiedMotions, masterIndex, modelIndex)
  const fileRefs = model.data.FileReferences as Record<string, unknown>
  fileRefs.Motions = adaptedMotions
}

async function processAndAddSplitModel(
  model: Live2DModelManifest,
  zipInstance: JSZip,
  manifestDir: string,
  modelName: string,
): Promise<File> {
  const subZip = new JSZip()
  const rawRefs = findLive2dReferences(model.data)
  const manifestBasename = model.manifestPath.split(/[\\/]/).pop() ?? ''
  const uniqueRefs = [...new Set(rawRefs)].filter((r) => {
    const rBase = r.toLowerCase().split(/[\\/]/).pop() ?? ''
    return rBase !== manifestBasename
  })

  const finalManifestName = manifestBasename.toLowerCase().endsWith('.model3.json')
    ? manifestBasename
    : `${modelName}.model3.json`
  const manifestString = JSON.stringify(model.data, null, 4)
  subZip.file(finalManifestName, manifestString)

  for (const ref of uniqueRefs) {
    const originalZipPath = resolvePosixPath(manifestDir, ref)
    const assetEntry = getEntryCaseInsensitive(zipInstance, originalZipPath)
    if (assetEntry) {
      const assetData = await assetEntry.async('uint8array')
      const destPath = ref.replace(/\\/g, '/')
      subZip.file(destPath, assetData)
    }
  }

  const subZipBlob = await subZip.generateAsync({ type: 'blob' })
  return new File([subZipBlob], `${modelName}.zip`, { type: 'application/zip' })
}

async function handleMultiModelZip(
  zipInstance: JSZip,
  allPaths: string[],
  modernModels: Live2DModelManifest[],
  addModel: (format: DisplayModelFormat, file: File) => Promise<void>,
): Promise<boolean> {
  const needsSplitting = modernModels.length >= 2
  let needsCleansing = false
  const modelsToProcess: Live2DModelManifest[] = []

  if (needsSplitting) {
    needsCleansing = true
    modelsToProcess.push(...modernModels)
  }
  else if (modernModels.length === 1) {
    const model = modernModels[0]
    const manifestBasename = model.manifestPath.split(/[\\/]/).pop() ?? ''
    const needsManifestRename = !manifestBasename.toLowerCase().endsWith('.model3.json')

    const mocMatch = model.mocFile.match(MOC_INDEX_REGEX)
    const modelIndex = mocMatch ? mocMatch[1] : null
    const isMultiModelNaming = modelIndex !== null
    const motionRegex = getMotionRegex(isMultiModelNaming, modelIndex)

    if (!model.data.FileReferences) {
      model.data.FileReferences = {}
    }
    const fileRefs = model.data.FileReferences as Record<string, unknown>
    if (!fileRefs.Motions) {
      fileRefs.Motions = {}
    }

    const needsMotionInjection = findOrphanedMotions(allPaths, zipInstance, model, manifestBasename, motionRegex)

    if (needsManifestRename || needsMotionInjection) {
      needsCleansing = true
      modelsToProcess.push(model)
    }
  }

  if (!needsCleansing || modelsToProcess.length === 0)
    return false

  if (needsSplitting) {
    toast.info(`Multi-model Live2D ZIP detected! Extracting ${modelsToProcess.length} models...`)
  }
  else {
    toast.info(`Live2D ZIP requires self-healing! Repairing package...`)
  }

  const masterModel = selectMasterModel(modelsToProcess)

  let index = 1
  for (const model of modelsToProcess) {
    const manifestBasename = model.manifestPath.split(/[\\/]/).pop() ?? ''
    const modelName = manifestBasename.replace(/\.model3\.json$/i, '').replace(/\.json$/i, '')

    const mocMatch = model.mocFile.match(MOC_INDEX_REGEX)
    const modelIndex = mocMatch ? mocMatch[1] : null

    if (!model.data.FileReferences) {
      model.data.FileReferences = {}
    }
    const fileRefs = model.data.FileReferences as Record<string, unknown>
    if (!fileRefs.Motions) {
      fileRefs.Motions = {}
    }

    let motionsCount = 0
    const motions = fileRefs.Motions as Record<string, unknown[]> | undefined
    if (motions) {
      for (const group of Object.keys(motions)) {
        motionsCount += motions[group]?.length || 0
      }
    }

    if (motionsCount < 10 && masterModel && model !== masterModel) {
      const masterMocMatch = masterModel.mocFile.match(MOC_INDEX_REGEX)
      const masterIndex = masterMocMatch ? masterMocMatch[1] : null
      if (masterIndex !== null && modelIndex !== null) {
        await restoreMotionsFromMaster(model, masterModel, modelIndex, masterIndex)
      }
    }

    const cleansedMotions = cleanseMotions(fileRefs.Motions)
    fileRefs.Motions = cleansedMotions

    const isMultiModelNaming = modelIndex !== null
    const motionRegex = getMotionRegex(isMultiModelNaming, modelIndex)
    injectMotions(allPaths, zipInstance, model, manifestBasename, motionRegex)

    if (modelsToProcess.length > 1) {
      if (index > 1) {
        toast.info(`[${index}/${modelsToProcess.length}] Extracting next model "${modelName}"...`)
      }
      else {
        toast.info(`[${index}/${modelsToProcess.length}] Extracting and compiling "${modelName}"...`)
      }
    }

    const manifestDir = model.manifestPath.split(/[\\/]/).slice(0, -1).join('/')
    const subZipFile = await processAndAddSplitModel(model, zipInstance, manifestDir, modelName)

    if (modelsToProcess.length > 1) {
      toast.info(`[${index}/${modelsToProcess.length}] Ingesting "${modelName}" into catalog...`)
    }

    await addModel(DisplayModelFormat.Live2dZip, subZipFile)

    if (modelsToProcess.length > 1) {
      toast.success(`[${index}/${modelsToProcess.length}] Successfully imported: ${modelName}`)
    }
    else {
      toast.success(`Successfully repaired and imported model: ${modelName}`)
    }
    index++
  }

  return true
}

export const useDisplayModelsStore = defineStore('display-models', () => {
  const displayModels = ref<DisplayModel[]>([])
  const displayModelsFromIndexedDBLoading = ref(false)

  async function loadDisplayModelsFromIndexedDB() {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    displayModelsFromIndexedDBLoading.value = true
    const models: DisplayModel[] = [...displayModelsPresets]

    try {
      await localforage.iterate<IndexedDBModelValue, void>((val, key) => {
        if (key.startsWith('display-model-')) {
          if (!val.file) {
            return
          }
          models.push({
            id: key,
            format: val.format,
            type: 'file',
            file: val.file,
            name: val.file.name,
            importedAt: val.importedAt,
            previewImage: val.previewImage,
          })
        }
      })
    }
    catch (err) {
      console.error(err)
    }

    displayModels.value = models.sort((a, b) => b.importedAt - a.importedAt)
    displayModelsFromIndexedDBLoading.value = false
  }

  async function getDisplayModel(id: string) {
    if (displayModelsFromIndexedDBLoading.value) {
      await until(displayModelsFromIndexedDBLoading).toBe(false)
    }

    const modelFromFile = await localforage.getItem<DisplayModelFile>(id).catch(() => null)
    if (modelFromFile) {
      return modelFromFile
    }

    return displayModelsPresets.find(model => model.id === id)
  }

  const loadLive2DModelPreview = (file: File) => generateLive2DPreview(file)

  async function loadVrmModelPreview(file: File) {
    return generateVrmPreview(file)
  }

  async function addDisplayModel(format: DisplayModelFormat, file: File) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    if (format === DisplayModelFormat.Live2dZip) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const zipInstance = await JSZip.loadAsync(arrayBuffer)
        const allPaths = Object.keys(zipInstance.files)

        const modernModels: Live2DModelManifest[] = []
        for (const pathKey of allPaths) {
          if (zipInstance.files[pathKey].dir)
            continue
          if (pathKey.includes('__MACOSX') || pathKey.includes('.DS_Store'))
            continue
          if (pathKey.toLowerCase().endsWith('.json')) {
            const details = await getModernModelDetails(pathKey, zipInstance)
            if (details) {
              modernModels.push(details)
            }
          }
        }

        const handled = await handleMultiModelZip(zipInstance, allPaths, modernModels, addDisplayModel)
        if (handled)
          return
      }
      catch (err) {
        console.error('[DisplayModels] Failed to analyze ZIP for multi-models/sanitization:', err)
      }
    }

    const newDisplayModel: DisplayModelFile = {
      id: `display-model-${nanoid()}`,
      format,
      type: 'file',
      file,
      name: file.name,
      importedAt: Date.now(),
    }

    if (format === DisplayModelFormat.Live2dZip) {
      newDisplayModel.previewImage = await loadLive2DModelPreview(file)
    }
    else if (format === DisplayModelFormat.VRM) {
      newDisplayModel.previewImage = await loadVrmModelPreview(file)
    }
    else if (format === DisplayModelFormat.SpineZip) {
      const previewImage = await generateSpinePreview(file)
      if (!previewImage) {
        return
      }
      newDisplayModel.previewImage = previewImage
    }

    displayModels.value.unshift(newDisplayModel)

    localforage.setItem<DisplayModelFile>(newDisplayModel.id, newDisplayModel)
      .catch(err => console.error(err))
  }

  async function addDisplayModelWithTextures(format: DisplayModelFormat, modelFile: File, textureFiles: MmdTextureFile[]) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const newDisplayModel: DisplayModelFile = {
      id: `display-model-${nanoid()}`,
      format,
      type: 'file',
      file: modelFile,
      name: modelFile.name,
      importedAt: Date.now(),
    }

    try {
      const previewImage = await generateMmdPreview(modelFile, textureFiles)
      newDisplayModel.previewImage = previewImage
    }
    catch (e) {
      console.error('[DisplayModels] Failed to generate MMD preview:', e)
    }

    displayModels.value.unshift(newDisplayModel)

    await localforage.setItem<DisplayModelFile>(newDisplayModel.id, newDisplayModel)
      .catch(err => console.error(err))

    if (textureFiles.length > 0) {
      await localforage.setItem(`${newDisplayModel.id}-textures`, textureFiles)
        .catch(err => console.error(err))
    }

    return newDisplayModel
  }

  async function getDisplayModelTextures(id: string): Promise<MmdTextureFile[]> {
    try {
      const textures = await localforage.getItem<MmdTextureFile[]>(`${id}-textures`)
      return textures ?? []
    }
    catch {
      return []
    }
  }

  async function renameDisplayModel(id: string, name: string) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const displayModel = id.startsWith('display-model-')
      ? await localforage.getItem<DisplayModelFile>(id)
      : displayModels.value.find(m => m.id === id)

    if (!displayModel)
      return

    displayModel.name = name

    const index = displayModels.value.findIndex(m => m.id === id)
    if (index !== -1) {
      displayModels.value[index].name = name
    }

    if (id.startsWith('display-model-')) {
      await localforage.setItem(id, displayModel)
    }
  }

  async function removeDisplayModel(id: string) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    await localforage.removeItem(id)
    displayModels.value = displayModels.value.filter(model => model.id !== id)
  }

  async function resetDisplayModels() {
    await loadDisplayModelsFromIndexedDB()
    const userModelIds = displayModels.value.filter(model => model.type === 'file').map(model => model.id)
    for (const id of userModelIds) {
      await removeDisplayModel(id)
    }

    displayModels.value = [...displayModelsPresets].sort((a, b) => b.importedAt - a.importedAt)
  }

  return {
    displayModels,
    displayModelsFromIndexedDBLoading,

    loadDisplayModelsFromIndexedDB,
    getDisplayModel,
    addDisplayModel,
    addDisplayModelWithTextures,
    getDisplayModelTextures,
    renameDisplayModel,
    removeDisplayModel,
    resetDisplayModels,
  }
})
