import { loadLive2DModelPreview as generateLive2DPreview } from '@proj-airi/stage-ui-live2d/utils/live2d-preview'
import { loadMmdModelPreview as generateMmdPreview } from '@proj-airi/stage-ui-mmd/utils/mmd-preview'
import type { MmdTextureFile } from '@proj-airi/stage-ui-mmd/utils/mmd-zip-extractor'
import { loadSpineModelPreview as generateSpinePreview } from '@proj-airi/stage-ui-spine/utils/spine-preview'
import { loadVrmModelPreview as generateVrmPreview } from '@proj-airi/stage-ui-three/utils/vrm-preview'
import { until } from '@vueuse/core'
import JSZip from 'jszip'
import localforage from 'localforage'
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

export type DisplayModel = DisplayModelFile | DisplayModelURL

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
  {
    format: DisplayModelFormat.Live2dZip,
    id: 'preset-live2d-1',
    importedAt: 1733113886840,
    name: 'Hiyori (Pro)',
    previewImage: presetLive2dPreview,
    type: 'url',
    url: presetLive2dProUrl,
  },
  {
    format: DisplayModelFormat.Live2dZip,
    id: 'preset-live2d-2',
    importedAt: 1733113886840,
    name: 'Hiyori (Free)',
    previewImage: presetLive2dPreview,
    type: 'url',
    url: presetLive2dFreeUrl,
  },
  {
    format: DisplayModelFormat.VRM,
    id: 'preset-vrm-1',
    importedAt: 1733113886840,
    name: 'AvatarSample_A',
    previewImage: presetVrmAvatarAPreview,
    type: 'url',
    url: presetVrmAvatarAUrl,
  },
  {
    format: DisplayModelFormat.VRM,
    id: 'preset-vrm-2',
    importedAt: 1733113886840,
    name: 'AvatarSample_B',
    previewImage: presetVrmAvatarBPreview,
    type: 'url',
    url: presetVrmAvatarBUrl,
  },
]

// Wrap utility functions in IIFEs to avoid polluting module/global scope
const isLive2DReference = (() => {
  return (value: string): boolean => {
    const lower = value.toLowerCase()
    return (
      LIVE2D_EXTENSIONS.some((ext) => lower.endsWith(ext)) &&
      !lower.startsWith('http://') &&
      !lower.startsWith('https://')
    )
  }
})()

const findLive2dReferences = (() => {
  const DEFAULT_MAX_DEPTH = 10
  return (obj: unknown, refs: string[] = [], depth: number = 0, maxDepth: number = DEFAULT_MAX_DEPTH): string[] => {
    if (depth > maxDepth) {
      console.warn(
        `[DisplayModels] findLive2dReferences: max depth (${maxDepth}) exceeded, stopping recursion to prevent stack overflow`,
      )
      return refs
    }
    if (typeof obj === 'string') {
      if (isLive2DReference(obj)) {
        refs.push(obj)
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        findLive2dReferences(item, refs, depth + 1, maxDepth)
      }
    } else if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        findLive2dReferences((obj as Record<string, unknown>)[key], refs, depth + 1, maxDepth)
      }
    }
    return refs
  }
})()

const resolvePosixPath = (() => {
  return (baseDir: string, relativePath: string): string => {
    const combined = baseDir ? `${baseDir}/${relativePath}` : relativePath
    const normalized = combined.replace(/\\/g, '/')
    const parts = normalized.split('/')
    const stack: string[] = []
    for (const part of parts) {
      if (part === '.' || part === '') continue
      if (part === '..') stack.pop()
      else stack.push(part)
    }
    return stack.join('/')
  }
})()

const getEntryCaseInsensitive = (() => {
  return (zipInstance: JSZip, zipPath: string): JSZip.JSZipObject | null => {
    const target = zipPath.toLowerCase().replace(/\\/g, '/')
    const exact = zipInstance.file(zipPath)
    if (exact) return exact

    for (const key of Object.keys(zipInstance.files)) {
      if (key.toLowerCase().replace(/\\/g, '/') === target && !zipInstance.files[key].dir) {
        return zipInstance.files[key]
      }
    }
    return null
  }
})()

const getModernModelDetails = (() => {
  return async (entryName: string, zipInstance: JSZip): Promise<Live2DModelManifest | null> => {
    const fnLower = entryName.toLowerCase().split(/[\\/]/).pop() ?? ''
    if (MODERN_MODEL_EXCLUDE_SUFFIXES.some((s) => fnLower.endsWith(s))) return null

    try {
      const file = zipInstance.file(entryName)
      if (!file) return null

      const content = await file.async('text')
      const data = JSON.parse(content) as Record<string, unknown>
      if (!data || typeof data !== 'object') return null

      const fileRefs = data.FileReferences as Record<string, unknown> | undefined
      let mocFile: string | null = null

      if (fileRefs?.Moc && typeof fileRefs.Moc === 'string') {
        mocFile = fileRefs.Moc
      } else if (data.model && typeof data.model === 'string') {
        mocFile = data.model
      } else if (data.moc && typeof data.moc === 'string') {
        mocFile = data.moc
      }

      if (mocFile?.toLowerCase().endsWith('.moc3')) {
        return { data, manifestPath: entryName, mocFile }
      }
    } catch {
      // intentionally empty - model details parsing failure is non-critical
    }
    return null
  }
})()

const getMotionRegex = (() => {
  return (isMultiModelNaming: boolean, modelIndex: string | null): RegExp => {
    if (isMultiModelNaming && modelIndex !== null) {
      return new RegExp(`^Motions_(.+)_(\\d+)_File_${modelIndex}\\.json$`, 'i')
    }
    return MOTION_REGEX_SINGLE
  }
})()

const shouldExcludeFile = (() => {
  return (filename: string, manifestBasename: string): boolean => {
    return (
      EXCLUDE_SUFFIXES.some((s) => filename.toLowerCase().endsWith(s)) ||
      filename.toLowerCase() === manifestBasename.toLowerCase()
    )
  }
})()

const isMotionFile = (() => {
  return (filename: string, pathKey: string): boolean => {
    const isJson = filename.toLowerCase().endsWith('.json')
    return (
      isJson ||
      filename.toLowerCase().endsWith('.motion3.json') ||
      pathKey.toLowerCase().includes('/motions/') ||
      pathKey.toLowerCase().includes('/motion/')
    )
  }
})()

interface MotionMatchContext {
  pathKey: string
  filename: string
  match: RegExpMatchArray
  groupName: string
}

function findMotionMatch(
  allPaths: string[],
  zipInstance: JSZip,
  manifestBasename: string,
  motionRegex: RegExp,
): MotionMatchContext | null {
  for (const pathKey of allPaths) {
    if (zipInstance.files[pathKey].dir) continue
    const filename = pathKey.split(/[\\/]/).pop() ?? ''
    if (shouldExcludeFile(filename, manifestBasename)) continue
    if (!isMotionFile(filename, pathKey)) continue

    const match = filename.match(motionRegex) || pathKey.match(motionRegex)
    if (match) {
      const groupName = (match[1] || match[2] || match[3] || 'Idle').trim()
      return { filename, groupName, match, pathKey }
    }
  }
  return null
}

function motionAlreadyExists(model: Live2DModelManifest, groupName: string, filename: string): boolean {
  const motions = model.data.FileReferences as Record<string, unknown> | undefined
  const groupList = motions?.Motions as Record<string, Array<{ File?: string }>> | undefined
  return groupList?.[groupName]?.some((m) => m.File?.toLowerCase() === filename.toLowerCase()) ?? false
}

const findOrphanedMotions = (() => {
  return (
    allPaths: string[],
    zipInstance: JSZip,
    model: Live2DModelManifest,
    manifestBasename: string,
    motionRegex: RegExp,
  ): boolean => {
    const ctx = findMotionMatch(allPaths, zipInstance, manifestBasename, motionRegex)
    if (!ctx) return false

    return !motionAlreadyExists(model, ctx.groupName, ctx.filename)
  }
})()

function ensureMotionsInitialized(
  fileRefs: Record<string, unknown>,
): Record<string, Array<{ File: string; FadeIn: number; FadeOut: number }>> {
  if (!fileRefs.Motions) {
    fileRefs.Motions = {}
  }
  return fileRefs.Motions as Record<string, Array<{ File: string; FadeIn: number; FadeOut: number }>>
}

function injectSingleMotion(model: Live2DModelManifest, ctx: MotionMatchContext): void {
  const fileRefs = model.data.FileReferences as Record<string, unknown>
  const groupList = ensureMotionsInitialized(fileRefs)

  if (motionAlreadyExists(model, ctx.groupName, ctx.filename)) return

  if (!groupList[ctx.groupName]) {
    groupList[ctx.groupName] = []
  }
  groupList[ctx.groupName].push({ FadeIn: 0, FadeOut: 0, File: ctx.filename })
}

const injectMotions = (() => {
  return (
    allPaths: string[],
    zipInstance: JSZip,
    model: Live2DModelManifest,
    manifestBasename: string,
    motionRegex: RegExp,
  ): void => {
    for (const pathKey of allPaths) {
      if (zipInstance.files[pathKey].dir) continue
      const filename = pathKey.split(/[\\/]/).pop() ?? ''
      if (shouldExcludeFile(filename, manifestBasename)) continue
      if (!isMotionFile(filename, pathKey)) continue

      const match = filename.match(motionRegex) || pathKey.match(motionRegex)
      if (!match) continue

      const groupName = (match[1] || match[2] || match[3] || 'Idle').trim()
      injectSingleMotion(model, { filename, groupName, match, pathKey })
    }
  }
})()

const cleanseMotions = (() => {
  return (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      if (obj.toLowerCase().endsWith('.ogg3')) return obj.substring(0, obj.length - 1)
    } else if (Array.isArray(obj)) {
      return obj.map(cleanseMotions)
    } else if (obj && typeof obj === 'object') {
      const newObj: Record<string, unknown> = {}
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        newObj[key] = cleanseMotions((obj as Record<string, unknown>)[key])
      }
      return newObj
    }
    return obj
  }
})()

const adaptMotions = (() => {
  return (obj: unknown, masterIndex: string, modelIndex: string): unknown => {
    if (typeof obj === 'string') {
      if (obj.toLowerCase().endsWith('.json') && FILE_INDEX_REGEX.test(obj)) {
        return obj.replace(FILE_INDEX_REGEX, `_File_${modelIndex}`)
      }
    } else if (Array.isArray(obj)) {
      return obj.map((item) => adaptMotions(item, masterIndex, modelIndex))
    } else if (obj && typeof obj === 'object') {
      const newObj: Record<string, unknown> = {}
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        newObj[key] = adaptMotions((obj as Record<string, unknown>)[key], masterIndex, modelIndex)
      }
      return newObj
    }
    return obj
  }
})()

const selectMasterModel = (() => {
  return (models: Live2DModelManifest[]): Live2DModelManifest | null => {
    let masterModel: Live2DModelManifest | null = null
    let maxMotionsCount = 0
    for (const m of models) {
      let count = 0
      const motions = (m.data.FileReferences as Record<string, unknown>)?.Motions as
        | Record<string, unknown[]>
        | undefined
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
})()

const restoreMotionsFromMaster = (() => {
  return (
    model: Live2DModelManifest,
    masterModel: Live2DModelManifest,
    modelIndex: string,
    masterIndex: string,
  ): void => {
    const copiedMotions = structuredClone((masterModel.data.FileReferences as Record<string, unknown>).Motions)
    const adaptedMotions = adaptMotions(copiedMotions, masterIndex, modelIndex)
    const fileRefs = model.data.FileReferences as Record<string, unknown>
    fileRefs.Motions = adaptedMotions
  }
})()

const processAndAddSplitModel = (() => {
  return async (
    model: Live2DModelManifest,
    zipInstance: JSZip,
    manifestDir: string,
    modelName: string,
  ): Promise<File> => {
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
})()

function ensureFileReferencesInitialized(model: Live2DModelManifest): Record<string, unknown> {
  if (!model.data.FileReferences) {
    model.data.FileReferences = {}
  }
  const fileRefs = model.data.FileReferences as Record<string, unknown>
  if (!fileRefs.Motions) {
    fileRefs.Motions = {}
  }
  return fileRefs
}

function getModelMotionCount(fileRefs: Record<string, unknown>): number {
  let count = 0
  const motions = fileRefs.Motions as Record<string, unknown[]> | undefined
  if (motions) {
    for (const group of Object.keys(motions)) {
      count += motions[group]?.length || 0
    }
  }
  return count
}

function shouldCleansingSplit(modernModels: Live2DModelManifest[]): {
  needsCleansing: boolean
  needsSplitting: boolean
} {
  const needsSplitting = modernModels.length >= 2
  return { needsCleansing: needsSplitting || modernModels.length === 1, needsSplitting }
}

function determineModelsToProcess(
  modernModels: Live2DModelManifest[],
  allPaths: string[],
  zipInstance: JSZip,
): Live2DModelManifest[] {
  const { needsSplitting } = shouldCleansingSplit(modernModels)

  if (needsSplitting) {
    return [...modernModels]
  }

  if (modernModels.length !== 1) return []

  const model = modernModels[0]
  const manifestBasename = model.manifestPath.split(/[\\/]/).pop() ?? ''
  const needsManifestRename = !manifestBasename.toLowerCase().endsWith('.model3.json')

  const mocMatch = model.mocFile.match(MOC_INDEX_REGEX)
  const modelIndex = mocMatch ? mocMatch[1] : null
  const motionRegex = getMotionRegex(modelIndex !== null, modelIndex)

  ensureFileReferencesInitialized(model)
  const needsMotionInjection = findOrphanedMotions(allPaths, zipInstance, model, manifestBasename, motionRegex)

  if (needsManifestRename || needsMotionInjection) {
    return [model]
  }
  return []
}

function showProcessingToast(modelsToProcessLength: number): void {
  if (modelsToProcessLength >= 2) {
    toast.info(`Multi-model Live2D ZIP detected! Extracting ${modelsToProcessLength} models...`)
  } else {
    toast.info('Live2D ZIP requires self-healing! Repairing package...')
  }
}

async function maybeRestoreMotions(
  model: Live2DModelManifest,
  masterModel: Live2DModelManifest | null,
  modelIndex: string | null,
  fileRefs: Record<string, unknown>,
): Promise<void> {
  const motionsCount = getModelMotionCount(fileRefs)
  if (motionsCount >= 10 || !masterModel || model === masterModel) return

  const masterMocMatch = masterModel.mocFile.match(MOC_INDEX_REGEX)
  const masterIndex = masterMocMatch ? masterMocMatch[1] : null
  if (masterIndex !== null && modelIndex !== null) {
    await restoreMotionsFromMaster(model, masterModel, modelIndex, masterIndex)
  }
}

function cleanseAndInjectMotions(
  model: Live2DModelManifest,
  allPaths: string[],
  zipInstance: JSZip,
  manifestBasename: string,
  modelIndex: string | null,
): void {
  const fileRefs = ensureFileReferencesInitialized(model)

  const cleansedMotions = cleanseMotions(fileRefs.Motions)
  fileRefs.Motions = cleansedMotions

  const motionRegex = getMotionRegex(modelIndex !== null, modelIndex)
  injectMotions(allPaths, zipInstance, model, manifestBasename, motionRegex)
}

function showExtractionToast(index: number, total: number, modelName: string): void {
  if (total <= 1) return
  if (index > 1) {
    toast.info(`[${index}/${total}] Extracting next model "${modelName}"...`)
  } else {
    toast.info(`[${index}/${total}] Extracting and compiling "${modelName}"...`)
  }
}

async function processAndAddModel(model: Live2DModelManifest, zipInstance: JSZip, modelName: string): Promise<File> {
  const manifestDir = model.manifestPath.split(/[\\/]/).slice(0, -1).join('/')
  return await processAndAddSplitModel(model, zipInstance, manifestDir, modelName)
}

function showImportToast(index: number, total: number, modelName: string): void {
  if (total > 1) {
    toast.info(`[${index}/${total}] Ingesting "${modelName}" into catalog...`)
  }
}

function showCompletionToast(index: number, total: number, modelName: string): void {
  if (total > 1) {
    toast.success(`[${index}/${total}] Successfully imported: ${modelName}`)
  } else {
    toast.success(`Successfully repaired and imported model: ${modelName}`)
  }
}

const handleMultiModelZip = (() => {
  return async (
    zipInstance: JSZip,
    allPaths: string[],
    modernModels: Live2DModelManifest[],
    addModel: (format: DisplayModelFormat, file: File) => Promise<void>,
  ): Promise<boolean> => {
    const modelsToProcess = determineModelsToProcess(modernModels, allPaths, zipInstance)

    if (modelsToProcess.length === 0) return false

    showProcessingToast(modelsToProcess.length)

    const masterModel = selectMasterModel(modelsToProcess)

    let index = 1
    for (const model of modelsToProcess) {
      const manifestBasename = model.manifestPath.split(/[\\/]/).pop() ?? ''
      const modelName = manifestBasename.replace(/\.model3\.json$/i, '').replace(/\.json$/i, '')

      const mocMatch = model.mocFile.match(MOC_INDEX_REGEX)
      const modelIndex = mocMatch ? mocMatch[1] : null

      const fileRefs = ensureFileReferencesInitialized(model)
      await maybeRestoreMotions(model, masterModel, modelIndex, fileRefs)
      cleanseAndInjectMotions(model, allPaths, zipInstance, manifestBasename, modelIndex)

      showExtractionToast(index, modelsToProcess.length, modelName)
      const subZipFile = await processAndAddModel(model, zipInstance, modelName)
      showImportToast(index, modelsToProcess.length, modelName)

      await addModel(DisplayModelFormat.Live2dZip, subZipFile)
      showCompletionToast(index, modelsToProcess.length, modelName)
      index++
    }

    return true
  }
})()

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
            file: val.file,
            format: val.format,
            id: key,
            importedAt: val.importedAt,
            name: val.file.name,
            previewImage: val.previewImage,
            type: 'file',
          })
        }
      })
    } catch (err) {
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

    return displayModelsPresets.find((model) => model.id === id)
  }

  const loadLive2DModelPreview = (file: File) => generateLive2DPreview(file)

  async function loadVrmModelPreview(file: File) {
    return generateVrmPreview(file)
  }

  async function extractModernModelsFromZip(zipInstance: JSZip, allPaths: string[]): Promise<Live2DModelManifest[]> {
    const modernModels: Live2DModelManifest[] = []
    for (const pathKey of allPaths) {
      if (zipInstance.files[pathKey].dir) continue
      if (pathKey.includes('__MACOSX') || pathKey.includes('.DS_Store')) continue
      if (!pathKey.toLowerCase().endsWith('.json')) continue

      const details = await getModernModelDetails(pathKey, zipInstance)
      if (details) {
        modernModels.push(details)
      }
    }
    return modernModels
  }

  async function tryHandleLive2dZip(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const zipInstance = await JSZip.loadAsync(arrayBuffer)
      const allPaths = Object.keys(zipInstance.files)
      const modernModels = await extractModernModelsFromZip(zipInstance, allPaths)
      const handled = await handleMultiModelZip(zipInstance, allPaths, modernModels, addDisplayModel)
      return handled
    } catch (err) {
      console.error('[DisplayModels] Failed to analyze ZIP for multi-models/sanitization:', err)
      return false
    }
  }

  async function generatePreviewForFormat(format: DisplayModelFormat, file: File): Promise<string | undefined> {
    if (format === DisplayModelFormat.Live2dZip) {
      return await loadLive2DModelPreview(file)
    }
    if (format === DisplayModelFormat.VRM) {
      return await loadVrmModelPreview(file)
    }
    if (format === DisplayModelFormat.SpineZip) {
      return await generateSpinePreview(file)
    }
    return undefined
  }

  function createDisplayModelEntry(format: DisplayModelFormat, file: File): DisplayModelFile {
    return {
      file,
      format,
      id: `display-model-${nanoid()}`,
      importedAt: Date.now(),
      name: file.name,
      type: 'file',
    }
  }

  async function addDisplayModel(format: DisplayModelFormat, file: File) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    if (format === DisplayModelFormat.Live2dZip) {
      const handled = await tryHandleLive2dZip(file)
      if (handled) return
    }

    const newDisplayModel = createDisplayModelEntry(format, file)

    const previewImage = await generatePreviewForFormat(format, file)
    if (format === DisplayModelFormat.SpineZip && !previewImage) {
      return
    }
    if (previewImage) {
      newDisplayModel.previewImage = previewImage
    }

    displayModels.value.unshift(newDisplayModel)

    localforage.setItem<DisplayModelFile>(newDisplayModel.id, newDisplayModel).catch((err) => console.error(err))
  }

  async function addDisplayModelWithTextures(
    format: DisplayModelFormat,
    modelFile: File,
    textureFiles: MmdTextureFile[],
  ) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const newDisplayModel: DisplayModelFile = {
      file: modelFile,
      format,
      id: `display-model-${nanoid()}`,
      importedAt: Date.now(),
      name: modelFile.name,
      type: 'file',
    }

    try {
      const previewImage = await generateMmdPreview(modelFile, textureFiles)
      newDisplayModel.previewImage = previewImage
    } catch (e) {
      console.error('[DisplayModels] Failed to generate MMD preview:', e)
    }

    displayModels.value.unshift(newDisplayModel)

    await localforage.setItem<DisplayModelFile>(newDisplayModel.id, newDisplayModel).catch((err) => console.error(err))

    if (textureFiles.length > 0) {
      await localforage.setItem(`${newDisplayModel.id}-textures`, textureFiles).catch((err) => console.error(err))
    }

    return newDisplayModel
  }

  async function getDisplayModelTextures(id: string): Promise<MmdTextureFile[]> {
    try {
      const textures = await localforage.getItem<MmdTextureFile[]>(`${id}-textures`)
      return textures ?? []
    } catch {
      return []
    }
  }

  async function renameDisplayModel(id: string, name: string) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const displayModel = id.startsWith('display-model-')
      ? await localforage.getItem<DisplayModelFile>(id)
      : displayModels.value.find((m) => m.id === id)

    if (!displayModel) return

    displayModel.name = name

    const index = displayModels.value.findIndex((m) => m.id === id)
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
    displayModels.value = displayModels.value.filter((model) => model.id !== id)
  }

  async function resetDisplayModels() {
    await loadDisplayModelsFromIndexedDB()
    const userModelIds = displayModels.value.filter((model) => model.type === 'file').map((model) => model.id)
    for (const id of userModelIds) {
      await removeDisplayModel(id)
    }

    displayModels.value = [...displayModelsPresets].sort((a, b) => b.importedAt - a.importedAt)
  }

  return {
    addDisplayModel,
    addDisplayModelWithTextures,
    displayModels,
    displayModelsFromIndexedDBLoading,
    getDisplayModel,
    getDisplayModelTextures,

    loadDisplayModelsFromIndexedDB,
    removeDisplayModel,
    renameDisplayModel,
    resetDisplayModels,
  }
})
