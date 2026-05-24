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

const displayModelsPresets: DisplayModel[] = [
  { id: 'preset-live2d-1', format: DisplayModelFormat.Live2dZip, type: 'url', url: presetLive2dProUrl, name: 'Hiyori (Pro)', previewImage: presetLive2dPreview, importedAt: 1733113886840 },
  { id: 'preset-live2d-2', format: DisplayModelFormat.Live2dZip, type: 'url', url: presetLive2dFreeUrl, name: 'Hiyori (Free)', previewImage: presetLive2dPreview, importedAt: 1733113886840 },
  { id: 'preset-vrm-1', format: DisplayModelFormat.VRM, type: 'url', url: presetVrmAvatarAUrl, name: 'AvatarSample_A', previewImage: presetVrmAvatarAPreview, importedAt: 1733113886840 },
  { id: 'preset-vrm-2', format: DisplayModelFormat.VRM, type: 'url', url: presetVrmAvatarBUrl, name: 'AvatarSample_B', previewImage: presetVrmAvatarBPreview, importedAt: 1733113886840 },
]

export const useDisplayModelsStore = defineStore('display-models', () => {
  const displayModels = ref<DisplayModel[]>([])

  const displayModelsFromIndexedDBLoading = ref(false)

  async function loadDisplayModelsFromIndexedDB() {
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    displayModelsFromIndexedDBLoading.value = true
    const models = [...displayModelsPresets]

    try {
      await localforage.iterate<{ format: DisplayModelFormat, file: File, importedAt: number, previewImage?: string }, void>((val, key) => {
        if (key.startsWith('display-model-')) {
          if (!val.file) {
            console.warn(`[DisplayModels] Model ${key} is missing file property! Skipping.`, val)
            return
          }
          models.push({ id: key, format: val.format, type: 'file', file: val.file, name: val.file.name, importedAt: val.importedAt, previewImage: val.previewImage })
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
      console.warn('[PipelineTTS:Models] getDisplayModel called while loading is TRUE, waiting...', { id })
    }
    await until(displayModelsFromIndexedDBLoading).toBe(false)

    console.log('[PipelineTTS:Models] Accessing localforage for:', id)
    const modelFromFile = await localforage.getItem<DisplayModelFile>(id).catch((err) => {
      console.error('[PipelineTTS:Models] localforage.getItem FAILED:', err)
      return null
    })
    if (modelFromFile) {
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
      const exts = ['.moc3', '.png', '.json', '.jpg', '.jpeg']
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

        if (modernModels.length >= 2) {
          toast.info(`Multi-model Live2D ZIP detected! Extracting ${modernModels.length} models...`)
          console.log(`[DisplayModels] Multi-model ZIP detected! Splitting into ${modernModels.length} models:`)

          let index = 1
          for (const model of modernModels) {
            const manifestBasename = model.manifestPath.split(/[\\/]/).pop()!
            const modelName = manifestBasename.replace(/\.model3\.json$/i, '').replace(/\.json$/i, '')

            // Auto-discover loose motion files for this model index in the original ZIP
            let modelIndex = null
            const mocMatch = model.mocFile.match(/Moc_(\d+)\.moc3$/i)
            if (mocMatch) {
              modelIndex = mocMatch[1]
            }

            if (modelIndex !== null) {
              if (!model.data.FileReferences) {
                model.data.FileReferences = {}
              }
              if (!model.data.FileReferences.Motions) {
                model.data.FileReferences.Motions = {}
              }

              const motionRegex = new RegExp(`^Motions_(.+)_(\\d+)_File_${modelIndex}\\.json$`, 'i')
              for (const pathKey of allPaths) {
                if (zipInstance.files[pathKey].dir)
                  continue
                const filename = pathKey.split(/[\\/]/).pop()!
                const match = filename.match(motionRegex)
                if (match) {
                  const groupName = match[1]
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
                    console.log(`[DisplayModels] Auto-discovered and injected motion: ${filename} into group: ${groupName}`)
                  }
                }
              }
            }

            if (index > 1) {
              toast.info(`[${index}/${modernModels.length}] Extracting next model "${modelName}"...`)
            }
            else {
              toast.info(`[${index}/${modernModels.length}] Extracting and compiling "${modelName}"...`)
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
                console.warn(`[DisplayModels] Referenced asset not found in source zip: ${ref} (resolved: ${originalZipPath})`)
              }
            }

            // Generate ZIP Blob and File
            const subZipBlob = await subZip.generateAsync({ type: 'blob' })
            const subZipFile = new File([subZipBlob], `${modelName}.zip`, { type: 'application/zip' })

            console.log(`[DisplayModels] Splitted sub-model created: ${subZipFile.name} (${(subZipBlob.size / 1024 / 1024).toFixed(2)} MB)`)

            toast.info(`[${index}/${modernModels.length}] Ingesting "${modelName}" into catalog...`)

            // Add the splitted model recursively (which gets treated as single-model zip)
            await addDisplayModel(DisplayModelFormat.Live2dZip, subZipFile)
            toast.success(`[${index}/${modernModels.length}] Successfully imported: ${modelName}`)
            index++
          }

          // Return early to bypass the parent zip import
          return
        }
      }
      catch (err) {
        console.error('[DisplayModels] Failed to analyze ZIP for multi-models:', err)
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
        console.warn('[DisplayModels] Failed to generate preview or unsupported Spine version. Skipping import.')
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
