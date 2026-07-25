import type { MmdTextureFile } from '@proj-airi/stage-ui-mmd/utils/mmd-zip-extractor'

import JSZip from 'jszip'
import localforage from 'localforage'

import { debug } from '@proj-airi/stage-shared'
import { loadLive2DModelPreview as generateLive2DPreview } from '@proj-airi/stage-ui-live2d/utils/live2d-preview'
import { loadMMDModelPreview as generateMmdPreview } from '@proj-airi/stage-ui-mmd/utils/mmd-preview'
import { loadSpineModelPreview as generateSpinePreview } from '@proj-airi/stage-ui-spine/utils/spine-preview'
import { detectSpineVersionFromBinary, detectSpineVersionFromJson } from '@proj-airi/stage-ui-spine/utils/spine-version'
import { loadVrmModelPreview as generateVrmPreview } from '@proj-airi/stage-ui-three/utils/vrm-preview'
import { until, useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { storage } from '../database/storage'
import { convertSpineSkeleton } from '../utils/spine-converter/converter'
import { useSyncEngineStore } from './sync-engine'

import '@proj-airi/stage-ui-live2d/utils/live2d-zip-loader'
import '@proj-airi/stage-ui-live2d/utils/live2d-opfs-registration'

export enum DisplayModelFormat {
  Live2dZip = 'live2d-zip',
  Live2dDirectory = 'live2d-directory',
  VRM = 'vrm',
  SpineZip = 'spine-zip',
  PMXZip = 'pmx-zip',
  PMXDirectory = 'pmx-directory',
  PMD = 'pmd',
}

export interface DisplayModelCloud {
  id: string
  format: DisplayModelFormat
  type: 'cloud'
  name: string
  previewImage?: string
  importedAt: number
  nsfw?: boolean
  groups?: string[]
  tags?: string[]
  expressions?: string[]
  motions?: string[]
  emotionMappings?: Record<string, string>
  motionMappings?: Record<string, string>
  hiddenExpressions?: string[]
  hiddenMotions?: string[]
  favoriteExpressions?: string[]
}

export type DisplayModel
  = | DisplayModelFile
    | DisplayModelURL
    | DisplayModelCloud

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
  nsfw?: boolean
  groups?: string[]
  tags?: string[]
  expressions?: string[]
  motions?: string[]
  emotionMappings?: Record<string, string>
  motionMappings?: Record<string, string>
  hiddenExpressions?: string[]
  hiddenMotions?: string[]
  favoriteExpressions?: string[]
}

export interface DisplayModelURL {
  id: string
  format: DisplayModelFormat
  type: 'url'
  url: string
  name: string
  previewImage?: string
  importedAt: number
  nsfw?: boolean
  groups?: string[]
  tags?: string[]
  expressions?: string[]
  motions?: string[]
  emotionMappings?: Record<string, string>
  motionMappings?: Record<string, string>
  hiddenExpressions?: string[]
  hiddenMotions?: string[]
  favoriteExpressions?: string[]
}

const displayModelsPresets: DisplayModel[] = [
  { id: 'preset-live2d-1', format: DisplayModelFormat.Live2dZip, type: 'url', url: presetLive2dProUrl, name: 'Hiyori (Pro)', previewImage: presetLive2dPreview, importedAt: 1733113886840 },
  { id: 'preset-live2d-2', format: DisplayModelFormat.Live2dZip, type: 'url', url: presetLive2dFreeUrl, name: 'Hiyori (Free)', previewImage: presetLive2dPreview, importedAt: 1733113886840 },
  { id: 'preset-vrm-1', format: DisplayModelFormat.VRM, type: 'url', url: presetVrmAvatarAUrl, name: 'AvatarSample_A', previewImage: presetVrmAvatarAPreview, importedAt: 1733113886840 },
  { id: 'preset-vrm-2', format: DisplayModelFormat.VRM, type: 'url', url: presetVrmAvatarBUrl, name: 'AvatarSample_B', previewImage: presetVrmAvatarBPreview, importedAt: 1733113886840 },
]

export const useDisplayModelsStore = defineStore('display-models', () => {
  const displayModels = ref<DisplayModel[]>([])
  const displayModelsFromIndexedDBLoading = ref(false)
  const remoteModelsCatalog = ref<any[]>([])
  const remoteCatalogLoading = ref(false)

  // Load remote catalog cache eagerly on initialization
  void (async () => {
    debug('[DisplayModels] Initializing: Loading remote catalog cache from local storage...')
    try {
      const cached = await storage.getItemRaw<any>('local:sync-metadata/remote-catalog-cache')
      if (cached) {
        remoteModelsCatalog.value = cached
        debug(`[DisplayModels] Initializing: Cache loaded successfully. Found ${cached.length} remote models.`)
      }
      else {
        debug('[DisplayModels] Initializing: No cached remote catalog found.')
      }
    }
    catch (e) {
      console.error('[DisplayModels] Failed to load remote catalog cache:', e)
    }
  })()

  const { data: modelsSyncSignal, post: broadcastModelsSync } = useBroadcastChannel({ name: 'airi:display-models-sync' })

  watch(modelsSyncSignal, (val) => {
    if (val) {
      debug('[DisplayModels] Received display models sync signal, reloading from IndexedDB...')
      void loadDisplayModelsFromIndexedDB(true)
    }
  })

  async function loadDisplayModelsFromIndexedDB(silent = false) {
    const startTime = performance.now()
    debug('[DisplayModels] loadDisplayModelsFromIndexedDB starting...', { silent })
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    if (!silent)
      displayModelsFromIndexedDBLoading.value = true
    const models = [...displayModelsPresets]

    try {
      const keys = await localforage.keys()
      const modelKeys = keys.filter(key => key.startsWith('display-model-') && !key.endsWith('-textures'))
      debug(`[DisplayModels] loadDisplayModelsFromIndexedDB: Found ${modelKeys.length} user models in IndexedDB.`)

      for (const key of modelKeys) {
        const val = await localforage.getItem<any>(key)
        if (val) {
          if (!val.file || typeof val.file.arrayBuffer !== 'function') {
            // Attempt defensive Blob/File re-wrapping if val.file is a Blob clone missing prototype methods
            if (val.file && (val.file instanceof Blob || (typeof val.file === 'object' && val.file.size > 0))) {
              try {
                val.file = new File([val.file], val.name || val.file.name || `${key}.bin`, { type: val.file.type || 'application/octet-stream' })
              }
              catch (reconstructErr) {
                debug(`[DisplayModels] Could not re-wrap Blob instance for ${key}:`, reconstructErr)
              }
            }
          }

          if (!val.file || typeof val.file.arrayBuffer !== 'function') {
            debug(`[DisplayModels] Model ${key} is missing file property! Attempting self-healing...`)
            const electron = (window as any).electron
            if (electron?.ipcRenderer) {
              try {
                const syncEngineStore = useSyncEngineStore()
                const backupDir = syncEngineStore.fsBackupPath
                  ? `${syncEngineStore.fsBackupPath.replace(/[/\\]+$/, '')}/assets/models`
                  : ''

                if (!backupDir) {
                  debug(`[DisplayModels] No BYOS backup path configured. Cannot self-heal ${key}.`)
                  continue
                }

                // Set a 3-second timeout for reading from the network backup drive
                const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))
                const ipcPromise = electron.ipcRenderer.invoke('byos-fs:read-file', {
                  dir: backupDir,
                  relPath: `${key}.bin`,
                  encoding: 'base64',
                })
                const res = await Promise.race([ipcPromise, timeoutPromise])

                if (res === null) {
                  debug(`[DisplayModels] Self-healing for ${key} timed out after 3 seconds. Network share may be offline or sleeping.`)
                  continue
                }

                if (res?.success && res.content) {
                  const byteCharacters = atob(res.content)
                  const byteNumbers = new Uint8Array(byteCharacters.length)
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                  }
                  const restoredFile = new File([byteNumbers], val.name || `${key}.bin`, { type: 'application/octet-stream' })
                  val.file = restoredFile

                  // Update IndexedDB
                  await localforage.setItem(key, val)
                  debug(`[DisplayModels] Successfully self-healed and restored model: ${val.name || key}`)
                }
                else {
                  console.error(`[DisplayModels] Self-healing failed for ${key}: backup file not found or unreadable.`, res?.error)
                  if (res?.error?.includes('ENOENT') || res?.error?.includes('no such file')) {
                    debug(`[DisplayModels] Removing unrecoverable orphaned model entry from IndexedDB: ${key}`)
                    await localforage.removeItem(key)
                    await localforage.removeItem(`${key}-textures`).catch(() => {})
                  }
                  continue
                }
              }
              catch (healErr) {
                console.error(`[DisplayModels] Self-healing error for ${key}:`, healErr)
                continue
              }
            }
            else {
              debug(`[DisplayModels] Electron IPC not available. Cannot self-heal ${key}.`)
              continue
            }
          }
          models.push({
            id: key,
            format: val.format,
            type: 'file',
            file: val.file,
            name: val.file.name,
            importedAt: val.importedAt,
            previewImage: val.previewImage,
            nsfw: val.nsfw,
            groups: val.groups,
            tags: val.tags,
            expressions: val.expressions,
            motions: val.motions,
            emotionMappings: val.emotionMappings,
            motionMappings: val.motionMappings,
            hiddenExpressions: val.hiddenExpressions,
            hiddenMotions: val.hiddenMotions,
            favoriteExpressions: val.favoriteExpressions,
          })
        }
      }
    }
    catch (err) {
      console.error('[DisplayModels] loadDisplayModelsFromIndexedDB encountered an error:', err)
    }

    displayModels.value = models.sort((a, b) => b.importedAt - a.importedAt)
    if (!silent)
      displayModelsFromIndexedDBLoading.value = false
    debug(`[DisplayModels] loadDisplayModelsFromIndexedDB finished successfully in ${(performance.now() - startTime).toFixed(2)} ms. Loaded ${displayModels.value.length} total models.`)
  }

  const displayModelCache = new Map<string, { model: DisplayModelFile, addedTime: number }>()

  async function getDisplayModel(id: string) {
    if (displayModelsFromIndexedDBLoading.value) {
      debug('[PipelineTTS:Models] getDisplayModel called while loading is TRUE, waiting...', { id })
    }
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    // Check in-memory cache
    if (displayModelCache.has(id)) {
      debug('[PipelineTTS:Models] In-memory cache hit for:', id)
      displayModelCache.get(id)!.addedTime = Date.now() // Update access time
      return displayModelCache.get(id)!.model
    }

    debug('[PipelineTTS:Models] Accessing localforage for:', id)
    const modelFromFile = await localforage.getItem<DisplayModelFile>(id).catch((err) => {
      console.error('[PipelineTTS:Models] localforage.getItem FAILED:', err)
      return null
    })
    if (modelFromFile) {
      // LRU cache eviction if size exceeds 3
      if (displayModelCache.size >= 3) {
        let oldestId: string | null = null
        let oldestTime = Infinity
        for (const [key, value] of displayModelCache.entries()) {
          if (value.addedTime < oldestTime) {
            oldestTime = value.addedTime
            oldestId = key
          }
        }
        if (oldestId) {
          debug('[PipelineTTS:Models] Evicting oldest display model cache entry:', oldestId)
          displayModelCache.delete(oldestId)
        }
      }
      displayModelCache.set(id, { model: modelFromFile, addedTime: Date.now() })
      return modelFromFile
    }

    // Fallback to in-memory presets if not found in localforage
    const preset = displayModelsPresets.find(model => model.id === id)
    return preset
  }

  const loadLive2DModelPreview = (file: File) => generateLive2DPreview(file)

  async function loadVrmModelPreview(file: File) {
    return generateVrmPreview(file)
  }

  // In-memory split resolution helpers
  function resolvePosixPath(baseDir: string, relativePath: string): string {
    let combined = baseDir ? `${baseDir}/${relativePath}` : relativePath
    combined = combined.replace(/\\/g, '/')
    const parts = combined.split('/')
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

  function getEntryCaseInsensitive(zipInstance: JSZip, zipPath: string) {
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

  function findLive2dReferences(obj: any, refs: string[] = []): string[] {
    if (typeof obj === 'string') {
      const lower = obj.toLowerCase()
      const exts = ['.moc3', '.png', '.json', '.jpg', '.jpeg', '.wav', '.mp3', '.ogg', '.aac', '.flac', '.m4a']
      if (exts.some(ext => lower.endsWith(ext))) {
        if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
          refs.push(obj)
        }
      }
    }
    else if (Array.isArray(obj)) {
      for (const item of obj) {
        findLive2dReferences(item, refs)
      }
    }
    else if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        findLive2dReferences(obj[key], refs)
      }
    }
    return refs
  }

  async function getModernModelDetails(entryName: string, zipInstance: JSZip) {
    const fnLower = entryName.toLowerCase().split(/[\\/]/).pop()!
    const excludeSuffixes = [
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
    if (excludeSuffixes.some(s => fnLower.endsWith(s))) {
      return null
    }

    try {
      const file = zipInstance.file(entryName)
      if (!file)
        return null

      const content = await file.async('text')
      const data = JSON.parse(content)
      if (!data || typeof data !== 'object')
        return null

      let mocFile = null
      if (data.FileReferences && data.FileReferences.Moc) {
        mocFile = data.FileReferences.Moc
      }
      else if (data.model) {
        mocFile = data.model
      }
      else if (data.moc) {
        mocFile = data.moc
      }

      if (mocFile && typeof mocFile === 'string' && mocFile.toLowerCase().endsWith('.moc3')) {
        return {
          manifestPath: entryName,
          mocFile,
          data,
        }
      }
    }
    catch (e) {
      // ignore
    }
    return null
  }

  async function addDisplayModel(format: DisplayModelFormat, file: File) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    // Intercept Spine ZIP files to check and upgrade Spine 3.x files on-the-fly
    if (format === DisplayModelFormat.SpineZip) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const zipInstance = await JSZip.loadAsync(arrayBuffer)
        const allPaths = Object.keys(zipInstance.files)

        // Find skeleton files (.skel or .json)
        let skeletonPath = ''
        let skeletonFormat: 'binary' | 'json' = 'binary'

        // Prioritize binary skeleton (.skel) files first
        for (const pathKey of allPaths) {
          if (zipInstance.files[pathKey].dir)
            continue
          const lower = pathKey.toLowerCase()
          if (lower.endsWith('.skel')) {
            skeletonPath = pathKey
            skeletonFormat = 'binary'
            break
          }
        }

        // If no binary skeleton is found, fall back to JSON skeleton
        if (!skeletonPath) {
          for (const pathKey of allPaths) {
            if (zipInstance.files[pathKey].dir)
              continue
            const lower = pathKey.toLowerCase()
            if (lower.endsWith('.json')) {
              // Exclude metadata/config files
              if (lower.endsWith('manifest.json') || lower.endsWith('package.json') || lower.endsWith('model.json') || lower.endsWith('model0.json') || lower.endsWith('model1.json')) {
                continue
              }
              skeletonPath = pathKey
              skeletonFormat = 'json'
              break
            }
          }
        }

        if (skeletonPath) {
          const fileEntry = zipInstance.file(skeletonPath)
          if (fileEntry) {
            let is3x = false
            let detectedVersion = ''
            if (skeletonFormat === 'binary') {
              const data = await fileEntry.async('uint8array')
              const version = detectSpineVersionFromBinary(data)
              if (version) {
                detectedVersion = version
                if (version.startsWith('3.')) {
                  is3x = true
                }
              }
            }
            else {
              const text = await fileEntry.async('text')
              const version = detectSpineVersionFromJson(text)
              if (version) {
                detectedVersion = version
                if (version.startsWith('3.')) {
                  is3x = true
                }
              }
            }

            if (is3x) {
              debug(`[DisplayModels] Spine 3.x skeleton detected ("${detectedVersion}" at "${skeletonPath}"). Self-healing / Upgrading to 4.1.20 using Wasm...`)
              toast.info(`Spine 3.x skeleton detected (${detectedVersion}). Upgrading to 4.1.20 in-memory...`)

              // Load input bytes
              const inputBytes = await fileEntry.async('uint8array')
              const filename = skeletonPath.split(/[\\/]/).pop()!

              // Run the in-memory conversion
              const convertedBytes = await convertSpineSkeleton(inputBytes, filename, '4.1.20')

              // Replace the file inside the ZIP!
              if (skeletonFormat === 'binary') {
                zipInstance.file(skeletonPath, convertedBytes)
              }
              else {
                // If it was json, remove the .json entry and write a new .skel entry
                const newSkeletonPath = skeletonPath.replace(/\.json$/i, '.skel')
                zipInstance.remove(skeletonPath)
                zipInstance.file(newSkeletonPath, convertedBytes)
                debug(`[DisplayModels] Upgraded Spine JSON to binary: renamed "${skeletonPath}" to "${newSkeletonPath}"`)
              }

              // Rebuild the ZIP Blob and replace the input file parameter!
              const upgradedZipBlob = await zipInstance.generateAsync({ type: 'blob' })
              file = new File([upgradedZipBlob], file.name, { type: 'application/zip' })
              toast.success(`Successfully upgraded and healed Spine skeleton!`)
            }
          }
        }
      }
      catch (err) {
        console.error('[DisplayModels] Spine self-healing compilation failed:', err)
        toast.error('Spine self-healing compilation failed. Proceeding with original file.')
      }
    }

    // Intercept Live2D ZIP files to check for multi-model packages
    if (format === DisplayModelFormat.Live2dZip) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const zipInstance = await JSZip.loadAsync(arrayBuffer)
        const allPaths = Object.keys(zipInstance.files)

        const modernModels: any[] = []
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

        // Unified Self-Healing Compiler and Splitter
        const needsSplitting = modernModels.length >= 2
        let needsCleansing = false
        const modelsToProcess: any[] = []

        if (needsSplitting) {
          needsCleansing = true
          modelsToProcess.push(...modernModels)
        }
        else if (modernModels.length === 1) {
          const model = modernModels[0]
          const manifestBasename = model.manifestPath.split(/[\\/]/).pop()!
          const needsManifestRename = !manifestBasename.toLowerCase().endsWith('.model3.json')

          // Check for orphaned/loose motions
          let needsMotionInjection = false
          let modelIndex = null
          const mocMatch = model.mocFile.match(/Moc_(\d+)\.moc3$/i)
          if (mocMatch) {
            modelIndex = mocMatch[1]
          }

          if (!model.data.FileReferences) {
            model.data.FileReferences = {}
          }
          if (!model.data.FileReferences.Motions) {
            model.data.FileReferences.Motions = {}
          }

          const isMultiModelNaming = modelIndex !== null
          const motionRegex = isMultiModelNaming
            ? new RegExp(`^Motions_(.+)_(\\d+)_File_${modelIndex}\\.json$`, 'i')
            : new RegExp(`^Motions_(.+)\\.json$|motions?[\\/](.+)\\.(?:motion3\\.)?json$`, 'i')

          const excludeSuffixes = [
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

          for (const pathKey of allPaths) {
            if (zipInstance.files[pathKey].dir)
              continue
            const filename = pathKey.split(/[\\/]/).pop()!
            if (excludeSuffixes.some(s => filename.toLowerCase().endsWith(s)))
              continue
            if (filename.toLowerCase() === manifestBasename.toLowerCase())
              continue

            // Is it a JSON or motion file?
            const isJson = filename.toLowerCase().endsWith('.json')
            const isMotion = isJson || filename.toLowerCase().endsWith('.motion3.json') || pathKey.toLowerCase().includes('/motions/') || pathKey.toLowerCase().includes('/motion/')
            if (!isMotion)
              continue

            const match = filename.match(motionRegex) || pathKey.match(motionRegex)
            if (match) {
              const groupName = (match[1] || match[2] || match[3] || 'Idle').trim()
              const groupList = model.data.FileReferences.Motions[groupName] || []
              const alreadyExists = groupList.some((m: any) => m.File && m.File.toLowerCase() === filename.toLowerCase())
              if (!alreadyExists) {
                needsMotionInjection = true
                break
              }
            }
          }

          if (needsManifestRename || needsMotionInjection) {
            needsCleansing = true
            modelsToProcess.push(model)
            debug(`[DisplayModels] Single-model Live2D ZIP needs self-healing: needsManifestRename=${needsManifestRename}, needsMotionInjection=${needsMotionInjection}. Compiler running...`)
          }
        }

        if (needsCleansing && modelsToProcess.length > 0) {
          if (needsSplitting) {
            toast.info(`Multi-model Live2D ZIP detected! Extracting ${modelsToProcess.length} models...`)
            debug(`[DisplayModels] Multi-model ZIP detected! Splitting into ${modelsToProcess.length} models:`)
          }
          else {
            toast.info(`Live2D ZIP requires self-healing! Repairing package...`)
          }

          // Self-Healing Step: Identify a "master" model (the one with the largest motions dictionary)
          let masterModel: any = null
          let maxMotionsCount = 0
          for (const m of modelsToProcess) {
            let count = 0
            if (m.data && m.data.FileReferences && m.data.FileReferences.Motions) {
              for (const group of Object.keys(m.data.FileReferences.Motions)) {
                count += m.data.FileReferences.Motions[group]?.length || 0
              }
            }
            if (count > maxMotionsCount) {
              maxMotionsCount = count
              masterModel = m
            }
          }

          if (masterModel) {
            debug(`[DisplayModels] Selected master model for motion dictionary: "${masterModel.manifestPath.split(/[\\/]/).pop()!}" with ${maxMotionsCount} motions.`)
          }

          let index = 1
          for (const model of modelsToProcess) {
            const manifestBasename = model.manifestPath.split(/[\\/]/).pop()!
            const modelName = manifestBasename.replace(/\.model3\.json$/i, '').replace(/\.json$/i, '')

            // Auto-discover loose motion files for this model in the original ZIP
            let modelIndex = null
            const mocMatch = model.mocFile.match(/Moc_(\d+)\.moc3$/i)
            if (mocMatch) {
              modelIndex = mocMatch[1]
            }

            if (!model.data.FileReferences) {
              model.data.FileReferences = {}
            }
            if (!model.data.FileReferences.Motions) {
              model.data.FileReferences.Motions = {}
            }

            // Detect if this model has empty or barebones motions list
            let motionsCount = 0
            for (const group of Object.keys(model.data.FileReferences.Motions)) {
              motionsCount += model.data.FileReferences.Motions[group]?.length || 0
            }

            // If it is barebones, copy and adapt from master model
            if (motionsCount < 10 && masterModel && model !== masterModel) {
              let masterIndex = null
              const masterMocMatch = masterModel.mocFile.match(/Moc_(\d+)\.moc3$/i)
              if (masterMocMatch) {
                masterIndex = masterMocMatch[1]
              }

              if (masterIndex !== null && modelIndex !== null) {
                debug(`[DisplayModels] [Self-Healing] Restoring empty motions dictionary from master model index ${masterIndex} -> ${modelIndex}...`)
                const copiedMotions = JSON.parse(JSON.stringify(masterModel.data.FileReferences.Motions))

                // Adapt motions: replace file path endings from masterIndex to modelIndex
                const adaptMotions = (obj: any): any => {
                  if (typeof obj === 'string') {
                    const fromRegex = new RegExp(`_File_${masterIndex}`, 'gi')
                    const toStr = `_File_${modelIndex}`
                    if (obj.toLowerCase().endsWith('.json') && fromRegex.test(obj)) {
                      return obj.replace(fromRegex, toStr)
                    }
                  }
                  else if (Array.isArray(obj)) {
                    return obj.map(adaptMotions)
                  }
                  else if (obj && typeof obj === 'object') {
                    const newObj: any = {}
                    for (const key of Object.keys(obj)) {
                      newObj[key] = adaptMotions(obj[key])
                    }
                    return newObj
                  }
                  return obj
                }

                model.data.FileReferences.Motions = adaptMotions(copiedMotions)
                debug(`[DisplayModels] [Self-Healing] Restored motions successfully: ${Object.keys(model.data.FileReferences.Motions).length} groups.`)
              }
            }

            // Generic typo correction (e.g. `.ogg3` -> `.ogg` in Sound properties)
            const cleanseMotions = (obj: any): any => {
              if (typeof obj === 'string') {
                if (obj.toLowerCase().endsWith('.ogg3')) {
                  return obj.substring(0, obj.length - 1)
                }
              }
              else if (Array.isArray(obj)) {
                return obj.map(cleanseMotions)
              }
              else if (obj && typeof obj === 'object') {
                const newObj: any = {}
                for (const key of Object.keys(obj)) {
                  newObj[key] = cleanseMotions(obj[key])
                }
                return newObj
              }
              return obj
            }
            model.data.FileReferences.Motions = cleanseMotions(model.data.FileReferences.Motions)

            const isMultiModelNaming = modelIndex !== null
            const motionRegex = isMultiModelNaming
              ? new RegExp(`^Motions_(.+)_(\\d+)_File_${modelIndex}\\.json$`, 'i')
              : new RegExp(`^Motions_(.+)\\.json$|motions?[\\/](.+)\\.(?:motion3\\.)?json$`, 'i')

            const excludeSuffixes = [
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

            for (const pathKey of allPaths) {
              if (zipInstance.files[pathKey].dir)
                continue
              const filename = pathKey.split(/[\\/]/).pop()!
              if (excludeSuffixes.some(s => filename.toLowerCase().endsWith(s)))
                continue
              if (filename.toLowerCase() === manifestBasename.toLowerCase())
                continue

              // Is it a JSON or motion file?
              const isJson = filename.toLowerCase().endsWith('.json')
              const isMotion = isJson || filename.toLowerCase().endsWith('.motion3.json') || pathKey.toLowerCase().includes('/motions/') || pathKey.toLowerCase().includes('/motion/')
              if (!isMotion)
                continue

              const match = filename.match(motionRegex) || pathKey.match(motionRegex)
              if (match) {
                const groupName = (match[1] || match[2] || match[3] || 'Idle').trim()
                const groupList = model.data.FileReferences.Motions[groupName] || []
                const alreadyExists = groupList.some((m: any) => m.File && m.File.toLowerCase() === filename.toLowerCase())
                if (!alreadyExists) {
                  if (!model.data.FileReferences.Motions[groupName]) {
                    model.data.FileReferences.Motions[groupName] = []
                  }
                  model.data.FileReferences.Motions[groupName].push({
                    File: filename,
                    FadeIn: 0,
                    FadeOut: 0,
                  })
                  debug(`[DisplayModels] Auto-discovered and injected motion: ${filename} into group: ${groupName}`)
                }
              }
            }

            if (modelsToProcess.length > 1) {
              if (index > 1) {
                toast.info(`[${index}/${modelsToProcess.length}] Extracting next model "${modelName}"...`)
              }
              else {
                toast.info(`[${index}/${modelsToProcess.length}] Extracting and compiling "${modelName}"...`)
              }
            }

            const subZip = new JSZip()
            const manifestDir = model.manifestPath.split(/[\\/]/).slice(0, -1).join('/')
            const rawRefs = findLive2dReferences(model.data)
            const uniqueRefs = [...new Set(rawRefs)].filter((r) => {
              const rBase = r.toLowerCase().split(/[\\/]/).pop()!
              return rBase !== manifestBasename
            })

            // Add manifest at the root. Ensure it ends in .model3.json so standard ZipLoader recognizes it
            const finalManifestName = manifestBasename.toLowerCase().endsWith('.model3.json')
              ? manifestBasename
              : `${modelName}.model3.json`
            const manifestString = JSON.stringify(model.data, null, 4)
            subZip.file(finalManifestName, manifestString)

            // Add referenced assets
            for (const ref of uniqueRefs) {
              const originalZipPath = resolvePosixPath(manifestDir, ref)
              const assetEntry = getEntryCaseInsensitive(zipInstance, originalZipPath)
              if (assetEntry) {
                const assetData = await assetEntry.async('uint8array')
                const destPath = ref.replace(/\\/g, '/')
                subZip.file(destPath, assetData)
              }
              else {
                // Fallback: search subdirectories for file with matching basename.
                // Many models reference files (expressions, motions) without subdirectory prefix.
                const basename = ref.split(/[\\/]/).pop()!
                const subdirKey = Object.keys(zipInstance.files).find(p =>
                  !zipInstance.files[p].dir && p.toLowerCase().endsWith(`/${basename.toLowerCase()}`),
                )
                if (subdirKey) {
                  const assetData = await zipInstance.file(subdirKey)!.async('uint8array')
                  const destPath = ref.replace(/\\/g, '/')
                  subZip.file(destPath, assetData)
                  debug(`[DisplayModels] Self-healed asset ref: "${ref}" (found at "${subdirKey}")`)
                }
                else {
                  debug(`[DisplayModels] Referenced asset not found in source zip: ${ref} (resolved: ${originalZipPath})`)
                }
              }
            }

            // Generate ZIP Blob and File
            const subZipBlob = await subZip.generateAsync({ type: 'blob' })
            const subZipFile = new File([subZipBlob], `${modelName}.zip`, { type: 'application/zip' })

            debug(`[DisplayModels] Sanitized/Splitted model created: ${subZipFile.name} (${(subZipBlob.size / 1024 / 1024).toFixed(2)} MB)`)

            if (modelsToProcess.length > 1) {
              toast.info(`[${index}/${modelsToProcess.length}] Ingesting "${modelName}" into catalog...`)
            }

            // Add the splitted model recursively (which gets treated as single-model zip)
            await addDisplayModel(DisplayModelFormat.Live2dZip, subZipFile)

            if (modelsToProcess.length > 1) {
              toast.success(`[${index}/${modelsToProcess.length}] Successfully imported: ${modelName}`)
            }
            else {
              toast.success(`Successfully repaired and imported model: ${modelName}`)
            }
            index++
          }

          // Return early to bypass the parent zip import
          return
        }
      }
      catch (err) {
        console.error('[DisplayModels] Failed to analyze ZIP for multi-models/sanitization:', err)
      }
    }

    const newDisplayModel: DisplayModelFile = { id: `display-model-${nanoid()}`, format, type: 'file', file, name: file.name, importedAt: Date.now() }

    if (format === DisplayModelFormat.Live2dZip) {
      const previewImage = await loadLive2DModelPreview(file)
      newDisplayModel.previewImage = previewImage
    }
    else if (format === DisplayModelFormat.VRM) {
      const previewImage = await loadVrmModelPreview(file)
      newDisplayModel.previewImage = previewImage
    }
    else if (format === DisplayModelFormat.SpineZip) {
      const previewImage = await generateSpinePreview(file)
      if (!previewImage) {
        debug('[DisplayModels] Failed to generate preview or unsupported Spine version. Skipping import.')
        return
      }
      newDisplayModel.previewImage = previewImage
    }

    displayModels.value.unshift(newDisplayModel)

    await localforage.setItem<DisplayModelFile>(newDisplayModel.id, newDisplayModel)
      .catch(err => console.error(err))
    broadcastModelsSync(Date.now())
  }

  async function addDisplayModelWithTextures(format: DisplayModelFormat, modelFile: File, textureFiles: MmdTextureFile[]) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const newDisplayModel: DisplayModelFile = { id: `display-model-${nanoid()}`, format, type: 'file', file: modelFile, name: modelFile.name, importedAt: Date.now() }

    // Generate preview for MMD model
    try {
      const previewImage = await generateMmdPreview(modelFile, textureFiles)
      newDisplayModel.previewImage = previewImage
    }
    catch (e) {
      console.error('[DisplayModels] Failed to generate MMD preview:', e)
    }

    displayModels.value.unshift(newDisplayModel)

    // Persist model file
    await localforage.setItem<DisplayModelFile>(newDisplayModel.id, newDisplayModel)
      .catch(err => console.error(err))

    // Persist texture files keyed by model ID
    if (textureFiles.length > 0) {
      await localforage.setItem(`${newDisplayModel.id}-textures`, textureFiles)
        .catch(err => console.error(err))
    }

    broadcastModelsSync(Date.now())

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

    // Update reactive state
    const index = displayModels.value.findIndex(m => m.id === id)
    if (index !== -1) {
      displayModels.value[index].name = name
    }

    // Persist if it's a file-based model
    if (id.startsWith('display-model-')) {
      await localforage.setItem(id, displayModel)
      broadcastModelsSync(Date.now())
    }
  }

  async function updateDisplayModelMeta(id: string, updates: { nsfw?: boolean, groups?: string[] }) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const displayModel = id.startsWith('display-model-')
      ? await localforage.getItem<DisplayModelFile>(id)
      : displayModels.value.find(m => m.id === id)

    if (!displayModel)
      return

    if ('nsfw' in updates) {
      displayModel.nsfw = updates.nsfw
    }
    if ('groups' in updates) {
      displayModel.groups = updates.groups
    }

    // Update reactive state
    const index = displayModels.value.findIndex(m => m.id === id)
    if (index !== -1) {
      if ('nsfw' in updates) {
        displayModels.value[index].nsfw = updates.nsfw
      }
      if ('groups' in updates) {
        displayModels.value[index].groups = updates.groups
      }
    }

    // Persist if it's a file-based model
    if (id.startsWith('display-model-')) {
      await localforage.setItem(id, displayModel)
      broadcastModelsSync(Date.now())
    }
  }

  async function updateDisplayModelTags(id: string, tags: string[]) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    const displayModel = id.startsWith('display-model-')
      ? await localforage.getItem<DisplayModelFile>(id)
      : displayModels.value.find(m => m.id === id)

    if (!displayModel)
      return

    displayModel.tags = tags

    // Update reactive state
    const index = displayModels.value.findIndex(m => m.id === id)
    if (index !== -1) {
      displayModels.value[index].tags = tags
    }

    // Persist if it's a file-based model
    if (id.startsWith('display-model-')) {
      await localforage.setItem(id, displayModel)
      broadcastModelsSync(Date.now())
    }
  }

  async function removeDisplayModel(id: string) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    await localforage.removeItem(id)
    await localforage.removeItem(`${id}-textures`)
    // Track deletion for sync propagation
    await storage.setItemRaw(`local:sync-metadata/deleted-models/${id}`, true)
    displayModels.value = displayModels.value.filter(model => model.id !== id)
    broadcastModelsSync(Date.now())
  }

  async function fetchRemoteCatalog() {
    debug('[DisplayModels] fetchRemoteCatalog: Starting fetch from remote sync client...')
    remoteCatalogLoading.value = true
    try {
      const { useSyncEngineStore } = await import('./sync-engine')
      const syncStore = useSyncEngineStore()
      debug('[DisplayModels] fetchRemoteCatalog: Sync engine store loaded. Active provider:', syncStore.activeProvider)
      const res = await syncStore.getRemoteCatalog()
      if (res && res.success) {
        remoteModelsCatalog.value = (res.models || []).map((m: any) => ({
          ...m,
          type: 'cloud',
        }))
        debug(`[DisplayModels] fetchRemoteCatalog: Successfully fetched ${remoteModelsCatalog.value.length} remote models. Saving to local storage cache...`)
        await storage.setItemRaw('local:sync-metadata/remote-catalog-cache', remoteModelsCatalog.value)
      }
      else {
        debug('[DisplayModels] fetchRemoteCatalog: Sync store returned unsuccessful response:', res)
      }
    }
    catch (e) {
      console.error('[DisplayModels] Failed to fetch remote catalog:', e)
    }
    finally {
      remoteCatalogLoading.value = false
      debug('[DisplayModels] fetchRemoteCatalog: Fetch routine completed.')
    }
  }

  async function removeLocalCopy(id: string) {
    await until(displayModelsFromIndexedDBLoading).toBe(false)
    try {
      await localforage.removeItem(id)
      await localforage.removeItem(`${id}-textures`)

      // Clean local timestamps and outbox so they don't sync
      const keyWithoutPrefix = id.replace('display-model-', '')
      await storage.removeItem(`local:sync-metadata/timestamps/${keyWithoutPrefix}`)
      await storage.removeItem(`outbox:queue/${keyWithoutPrefix}`)

      // If selective sync is active, uncheck it so it doesn't auto-download on next sync
      const { useSyncEngineStore } = await import('./sync-engine')
      const syncStore = useSyncEngineStore()
      const modelNodeId = `model-${id}`
      if (syncStore.selectiveCheckedIds.includes(modelNodeId)) {
        syncStore.selectiveCheckedIds = syncStore.selectiveCheckedIds.filter(cid => cid !== modelNodeId)
      }

      displayModels.value = displayModels.value.filter(model => model.id !== id)
      broadcastModelsSync(Date.now())
      toast.success('Local copy removed successfully')
    }
    catch (e: any) {
      console.error('[DisplayModels] Failed to remove local copy:', e)
      toast.error(`Failed to remove local copy: ${e.message}`)
    }
  }

  async function resetDisplayModels() {
    await loadDisplayModelsFromIndexedDB()
    const userModelIds = displayModels.value.filter(model => model.type === 'file').map(model => model.id)
    for (const id of userModelIds) {
      await removeDisplayModel(id)
    }

    displayModels.value = [...displayModelsPresets].sort((a, b) => b.importedAt - a.importedAt)
    broadcastModelsSync(Date.now())
  }

  async function getOrLoadModelCapabilities(id: string): Promise<{ expressions: string[], motions: string[] }> {
    const model = displayModels.value.find(m => m.id === id)
    if (!model) {
      return { expressions: [], motions: [] }
    }

    const isSpine = model.format === DisplayModelFormat.SpineZip
    const hasLegacySpineCache = isSpine && model.expressions && model.expressions.length > 0 && !model.expressions.some(e => e.includes('['))

    if (!hasLegacySpineCache && ((model as any).capabilitiesLoaded || (model.expressions && model.expressions.length > 0) || (model.motions && model.motions.length > 0))) {
      return { expressions: model.expressions || [], motions: model.motions || [] }
    }

    let file: File | Blob | null = null
    if (model.type === 'file') {
      const modelFromFile = await getDisplayModel(id)
      if (modelFromFile && (modelFromFile as any).file && typeof (modelFromFile as any).file.arrayBuffer === 'function') {
        file = (modelFromFile as any).file
      }
    }
    else if (model.type === 'url') {
      try {
        const res = await fetch(model.url)
        file = await res.blob()
      }
      catch (e) {
        console.error('[DisplayModels] Failed to fetch URL model:', e)
      }
    }

    if (!file) {
      return { expressions: [], motions: [] }
    }

    const expressions: string[] = []
    const motions: string[] = []

    try {
      const format = model.format.toLowerCase()
      const arrayBuffer = await file.arrayBuffer()

      if (format.includes('live2d')) {
        const zipInstance = await JSZip.loadAsync(arrayBuffer)
        debug('[DisplayModels] getOrLoadModelCapabilities: ZIP loaded. Total files:', Object.keys(zipInstance.files).length)

        // Parse expressions directly by scanning zip files (Case 1 in resolveMetadata)
        const filePaths = Object.keys(zipInstance.files)
        const jsonPaths = filePaths.filter((f: string) => f.toLowerCase().endsWith('.json') && !zipInstance.files[f].dir)

        for (const jsonPath of jsonPaths) {
          try {
            const text = await zipInstance.file(jsonPath)!.async('text')
            const parsed = JSON.parse(text)
            if (parsed && (parsed.Type === 'Live2D Expression' || parsed.type === 'Live2D Expression')) {
              // Store the relative path inside the zip as the unique key (this matches mapped labels)
              expressions.push(jsonPath)
            }
          }
          catch {}
        }

        // Parse motions and fallbacks via model3.json FileReferences
        let modelJsonPath = ''
        for (const filename of filePaths) {
          if (filename.toLowerCase().endsWith('.model3.json') && !zipInstance.files[filename].dir) {
            modelJsonPath = filename
            break
          }
        }

        if (modelJsonPath) {
          const content = await zipInstance.files[modelJsonPath].async('text')
          const data = JSON.parse(content)
          const manifestDir = modelJsonPath.substring(0, modelJsonPath.lastIndexOf('/') + 1)

          if (data && data.FileReferences) {
            // Sourcing expressions from manifest as fallback if direct scan found nothing
            if (expressions.length === 0 && Array.isArray(data.FileReferences.Expressions)) {
              data.FileReferences.Expressions.forEach((exp: any) => {
                const relativeFile = exp.File || exp.file
                if (relativeFile) {
                  // Resolve path relative to the manifest directory
                  const fullPath = manifestDir ? `${manifestDir}${relativeFile}` : relativeFile
                  expressions.push(fullPath.replace(/\\/g, '/'))
                }
              })
            }
            if (data.FileReferences.Motions) {
              Object.keys(data.FileReferences.Motions).forEach((groupName) => {
                const group = data.FileReferences.Motions[groupName]
                if (Array.isArray(group)) {
                  group.forEach((m: any) => {
                    const relativeFile = m.File || m.file
                    if (relativeFile) {
                      const fullPath = manifestDir ? `${manifestDir}${relativeFile}` : relativeFile
                      motions.push(fullPath.replace(/\\/g, '/'))
                    }
                  })
                }
              })
            }
          }
        }
        debug('[DisplayModels] getOrLoadModelCapabilities parsed counts:', {
          expressions: expressions.length,
          motions: motions.length,
        })
      }
      else if (format === 'vrm') {
        const dataView = new DataView(arrayBuffer)
        const magic = dataView.getUint32(0, true)
        if (magic === 0x46546C67) { // 'glTF' binary
          const length = dataView.getUint32(8, true)
          let chunkOffset = 12
          while (chunkOffset < length) {
            const chunkLength = dataView.getUint32(chunkOffset, true)
            const chunkType = dataView.getUint32(chunkOffset + 4, true)
            if (chunkType === 0x4E4F534A) { // 'JSON' chunk
              const jsonSlice = new Uint8Array(arrayBuffer, chunkOffset + 8, chunkLength)
              const decoder = new TextDecoder()
              const gltf = JSON.parse(decoder.decode(jsonSlice))

              // 1. Standard VRM 0.x blendshapes
              const blendShapes = gltf.extensions?.VRM?.blendShapeMaster?.blendShapeGroups
              if (Array.isArray(blendShapes)) {
                blendShapes.forEach((group: any) => {
                  if (group.name)
                    expressions.push(group.name)
                })
              }

              // 2. VRM 1.0 (VRMC_vrm) expressions
              const vrm1Expressions = gltf.extensions?.VRMC_vrm?.expressions
              if (vrm1Expressions) {
                if (Array.isArray(vrm1Expressions)) {
                  vrm1Expressions.forEach((exp: any) => {
                    if (exp.name)
                      expressions.push(exp.name)
                  })
                }
                else if (typeof vrm1Expressions === 'object') {
                  Object.keys(vrm1Expressions).forEach((expKey) => {
                    expressions.push(expKey)
                  })
                }
              }

              // 3. Raw Morph Target names (including numbered/hidden shape keys)
              const meshes = gltf.meshes
              if (Array.isArray(meshes)) {
                meshes.forEach((mesh: any) => {
                  if (mesh.primitives) {
                    mesh.primitives.forEach((primitive: any) => {
                      const targetNames = primitive.extras?.targetNames
                      if (Array.isArray(targetNames)) {
                        targetNames.forEach((tname: string) => {
                          if (tname)
                            expressions.push(tname)
                        })
                      }
                    })
                  }
                  const meshTargetNames = mesh.extras?.targetNames
                  if (Array.isArray(meshTargetNames)) {
                    meshTargetNames.forEach((tname: string) => {
                      if (tname)
                        expressions.push(tname)
                    })
                  }
                })
              }
              break
            }
            chunkOffset += 8 + chunkLength
          }
        }
      }
      else if (format.includes('spine')) {
        const zipInstance = await JSZip.loadAsync(arrayBuffer)
        const filePaths = Object.keys(zipInstance.files)

        const variantsMap = new Map<string, { skeletonPath?: string, model0Path?: string }>()

        for (const path of filePaths) {
          if (zipInstance.files[path].dir)
            continue
          const lower = path.toLowerCase()
          if (lower.endsWith('.skel') || (lower.endsWith('.json') && !lower.endsWith('model0.json'))) {
            const dir = path.substring(0, path.lastIndexOf('/') + 1)
            const variantName = dir ? dir.replace(/\/$/, '').split('/').pop()! : 'Default'
            if (!variantsMap.has(variantName)) {
              variantsMap.set(variantName, {})
            }
            variantsMap.get(variantName)!.skeletonPath = path
          }
          else if (lower.endsWith('model0.json')) {
            const dir = path.substring(0, path.lastIndexOf('/') + 1)
            const variantName = dir ? dir.replace(/\/$/, '').split('/').pop()! : 'Default'
            if (!variantsMap.has(variantName)) {
              variantsMap.set(variantName, {})
            }
            variantsMap.get(variantName)!.model0Path = path
          }
        }

        for (const [variantName, paths] of variantsMap.entries()) {
          const variantSkins = new Set<string>(['default'])

          if (paths.skeletonPath) {
            const isJson = paths.skeletonPath.toLowerCase().endsWith('.json')
            if (isJson) {
              try {
                const text = await zipInstance.file(paths.skeletonPath)!.async('text')
                const parsed = JSON.parse(text)
                if (parsed) {
                  if (parsed.skins) {
                    if (Array.isArray(parsed.skins)) {
                      parsed.skins.forEach((s: any) => {
                        if (s && s.name)
                          variantSkins.add(s.name)
                      })
                    }
                    else {
                      Object.keys(parsed.skins).forEach(k => variantSkins.add(k))
                    }
                  }
                  if (parsed.animations) {
                    Object.keys(parsed.animations).forEach(a => motions.push(a))
                  }
                }
              }
              catch {}
            }
            else {
              try {
                const uint8 = await zipInstance.file(paths.skeletonPath)!.async('uint8array')
                const knownSkinCandidates = ['Normal', 'Resistance', 'Gun', 'Thema_MaskOff', 'Weapon_Off']
                const knownAnimCandidates = [
                  'Angry_1',
                  'Angry_2',
                  'Angry_3',
                  'Close_1',
                  'Dizzy_1',
                  'Dizzy_2',
                  'Eat_1',
                  'Eat_2',
                  'Happy_1',
                  'Happy_2',
                  'Happy_3',
                  'Happy_4',
                  'Happy_5',
                  'Idle_1',
                  'Panic_1',
                  'Panic_2',
                  'Panic_3',
                  'Pat_End',
                  'Pat_Idle',
                  'Proud_1',
                  'Proud_2',
                  'Sad_1',
                  'Sad_2',
                  'Sad_3',
                  'Sad_4',
                  'Serious_1',
                  'Serious_2',
                  'Smash_End_1',
                  'Smash_End_2',
                  'Smell_1',
                  'Surprise_1',
                  'Taunt_1',
                  'Taunt_2',
                  'Taunt_3',
                  'Taunt_4',
                  'Tickle_End',
                  'Tickle_Idle_1',
                  'Tickle_Idle_2',
                  'Touch_End',
                  'Touch_Idle',
                ]

                function findLengthPrefixedString(haystack: Uint8Array, needle: string): boolean {
                  const encoded = new TextEncoder().encode(needle)
                  const prefix = encoded.length + 1
                  for (let i = 0; i < haystack.length - encoded.length; i++) {
                    if (haystack[i] !== prefix)
                      continue
                    let match = true
                    for (let j = 0; j < encoded.length; j++) {
                      if (haystack[i + 1 + j] !== encoded[j]) {
                        match = false
                        break
                      }
                    }
                    if (match)
                      return true
                  }
                  return false
                }

                for (const skin of knownSkinCandidates) {
                  if (findLengthPrefixedString(uint8, skin)) {
                    variantSkins.add(skin)
                  }
                }
                for (const anim of knownAnimCandidates) {
                  if (findLengthPrefixedString(uint8, anim)) {
                    motions.push(anim)
                  }
                }
              }
              catch {}
            }
          }

          if (paths.model0Path) {
            try {
              const text = await zipInstance.file(paths.model0Path)!.async('text')
              const parsed = JSON.parse(text)
              if (parsed) {
                if (parsed.motions) {
                  Object.keys(parsed.motions).forEach((k) => {
                    motions.push(k)
                    const subList = parsed.motions[k]
                    if (Array.isArray(subList)) {
                      subList.forEach((item: any) => {
                        if (item && item.file) {
                          motions.push(item.file)
                        }
                      })
                    }
                  })
                }
              }
            }
            catch {}
          }

          // Generate composite variant [skin] keys
          const skinsList = Array.from(variantSkins)
          const hasCustomSkins = skinsList.some(s => s !== 'default')

          if (hasCustomSkins) {
            skinsList.forEach((skin) => {
              if (skin === 'default' && skinsList.includes('Normal')) {
                // skip default to avoid stub weapon-less doublets
                return
              }
              expressions.push(`${variantName} [${skin}]`)
            })
          }
          else {
            expressions.push(variantName)
          }
        }
      }
      else if (format.includes('pmx') || format.includes('pmd')) {
        // Simple PMX/PMD binary morph parser
        const dataView = new DataView(arrayBuffer)
        const signature = String.fromCharCode(
          dataView.getUint8(0),
          dataView.getUint8(1),
          dataView.getUint8(2),
          dataView.getUint8(3),
        )
        if (signature === 'PMX ') {
          // PMX format header parsing - scan for morph names using a text decoder
          const decoder = new TextDecoder('utf-16le')
          const text = decoder.decode(new Uint8Array(arrayBuffer))
          const morphs = text.match(/[\u4E00-\u9FA5\w-]{2,10}/g) || []
          const uniqueMorphs = [...new Set(morphs)].filter(m => m.length > 1)
          expressions.push(...uniqueMorphs.slice(0, 30)) // Cap list for sanity
        }
      }
    }
    catch (e) {
      console.error('[DisplayModels] Error extracting capabilities:', e)
    }

    model.expressions = [...new Set(expressions)].sort((a, b) => a.localeCompare(b))
    model.motions = [...new Set(motions)].sort((a, b) => a.localeCompare(b))

    // Save to IndexedDB, loading the full DisplayModelFile first to avoid erasing the file property
    if (model.type === 'file') {
      const fullModel = await localforage.getItem<any>(id)
      if (fullModel) {
        // Strip any Vue reactivity proxies that might be nested inside the retrieved object
        const cleanModel = JSON.parse(JSON.stringify(fullModel))
        cleanModel.expressions = [...model.expressions]
        cleanModel.motions = [...model.motions]

        // Restore the original Blob file since JSON.stringify converts Blobs to empty objects
        cleanModel.file = fullModel.file

        await localforage.setItem(id, cleanModel)
      }
    }

    (model as any).capabilitiesLoaded = true

    return { expressions: model.expressions, motions: model.motions }
  }

  return {
    getOrLoadModelCapabilities,
    displayModels,
    displayModelsFromIndexedDBLoading,
    broadcastModelsSync,

    loadDisplayModelsFromIndexedDB,
    getDisplayModel,
    addDisplayModel,
    addDisplayModelWithTextures,
    getDisplayModelTextures,
    renameDisplayModel,
    updateDisplayModelMeta,
    updateDisplayModelTags,
    removeDisplayModel,
    resetDisplayModels,

    remoteModelsCatalog,
    remoteCatalogLoading,
    fetchRemoteCatalog,
    removeLocalCopy,
  }
})
