import type { ModelSettings } from 'pixi-live2d-display/cubism4'

import JSZip from 'jszip'

import { Cubism4ModelSettings, ZipLoader } from 'pixi-live2d-display/cubism4'

import { registerDslGroupsFromManifest } from '../runtime/dsl-capture'
import { isMojibakeMatch } from './live2d-cp437'

/**
 * Returns true for macOS AppleDouble resource-fork artifacts that appear in
 *  ZIPs created on macOS (e.g. __MACOSX/ subtree, ._-prefixed sidecars).
 *  These are binary files in AppleDouble format — not real Live2D assets.
 */
export function isMacOSJunk(path: string): boolean {
  if (!path)
    return false
  const parts = path.split(/[\\/]/)
  return parts.some(p => p === '__MACOSX' || p.startsWith('._') || p === '.DS_Store')
}

let onZipLoaded: ((data: ArrayBuffer) => void) | null = null
export function setOnZipLoaded(callback: (data: ArrayBuffer) => void) {
  onZipLoaded = callback
}

ZipLoader.zipReader = async (data: Blob, _url: string) => {
  const buffer = await data.arrayBuffer()
  onZipLoaded?.(buffer)
  return JSZip.loadAsync(buffer)
}

ZipLoader.getFilePaths = async (reader: JSZip) => {
  return Object.keys(reader.files).filter(p => !isMacOSJunk(p))
}

function findZipEntry(reader: JSZip, path: string): JSZip.JSZipObject | null {
  const direct = reader.file(path)
  if (direct)
    return direct

  const allKeys = Object.keys(reader.files).filter(k => !isMacOSJunk(k) && !reader.files[k].dir)

  // 1. Case-insensitive
  const lower = path.toLowerCase()
  const caseMatch = allKeys.find(k => k.toLowerCase() === lower)
  if (caseMatch)
    return reader.file(caseMatch)

  // 2. CP437 Mojibake match
  const mojibakeMatch = allKeys.find(k => isMojibakeMatch(k, path))
  if (mojibakeMatch)
    return reader.file(mojibakeMatch)

  // 3. Subdirectory match by basename
  const base = basename(path).toLowerCase()
  const subdirMatch = allKeys.find(k => k.toLowerCase().endsWith(`/${base}`) || k.toLowerCase() === base)
  if (subdirMatch)
    return reader.file(subdirMatch)

  // 4. Sole MOC3 / CDI3 fallback
  if (path.toLowerCase().endsWith('.moc3')) {
    const mocs = allKeys.filter(k => k.toLowerCase().endsWith('.moc3'))
    if (mocs.length === 1)
      return reader.file(mocs[0])
  }
  if (path.toLowerCase().endsWith('.cdi3.json')) {
    const cdis = allKeys.filter(k => k.toLowerCase().endsWith('.cdi3.json'))
    if (cdis.length === 1)
      return reader.file(cdis[0])
  }

  return null
}

ZipLoader.getFiles = (async (reader: JSZip, paths: string[], type?: any) => {
  const targetType = type || 'blob'
  return Promise.all(paths.map(async (path) => {
    const entry = findZipEntry(reader, path)
    if (!entry) {
      throw new Error(`[ZipLoader] Missing file in zip archive: "${path}"`)
    }
    const blob = await entry.async(targetType as any)
    return new File([blob], basename(path))
  }))
}) as any

ZipLoader.readText = async (reader: JSZip, path: string) => {
  const entry = findZipEntry(reader, path)
  if (!entry) {
    throw new Error(`[ZipLoader] Missing text file in zip archive: "${path}"`)
  }
  return entry.async('text')
}

const defaultCreateSettings = ZipLoader.createSettings
ZipLoader.createSettings = async (reader: JSZip) => {
  const settings = await (async () => {
    const filePaths = Object.keys(reader.files).filter(p => !isMacOSJunk(p))
    if (!filePaths.find(file => isSettingsFile(file))) {
      return createFakeSettings(filePaths)
    }
    return defaultCreateSettings(reader)
  })()

  // Parse the raw manifest JSON file directly from the zip to extract *raw* motion groups
  // (incl. DSL "special sauce": VarFloats, Choices, change_cos, Command chains, Intimacy)
  // BEFORE ZipLoader.unzip sanitizes away any entry without a File/file.
  let motions: any = (settings as any).motions
  try {
    const filePaths = Object.keys(reader.files).filter(p => !isMacOSJunk(p))
    const settingsFile = filePaths.find(file => isSettingsFile(file))
    if (settingsFile) {
      const text = await reader.file(settingsFile)!.async('text')
      const parsedJson = JSON.parse(text)
      const fileRefs = parsedJson?.FileReferences || parsedJson?.fileReferences
      if (fileRefs?.Motions) {
        motions = fileRefs.Motions
      }
    }
  }
  catch (e) {
    console.warn('[ZipLoader] Failed to parse raw manifest JSON for DSL groups:', e)
  }

  registerDslGroupsFromManifest(motions)

  if (motions && motions[''] && !motions.Idle) {
    motions.Idle = motions['']
    delete motions['']
  }

  // Filter out empty/blank texture strings (e.g. "") in FileReferences.Textures
  // which are used by authoring tools as costume-swap slots. PIXI's TextureLoader
  // tries to fetch empty string URLs and crashes with "Texture loading error".
  if (Array.isArray((settings as any).textures)) {
    (settings as any).textures = (settings as any).textures.filter(
      (t: unknown) => typeof t === 'string' && t.trim().length > 0,
    )
  }

  // Sanitize null FileReferences to undefined.
  // The library checks `if (this.physics !== void 0)` but null !== undefined is true,
  // causing url.resolve to receive null (typeof null === 'object') and crash.
  for (const key of ['physics', 'pose'] as const) {
    if ((settings as any)[key] === null) {
      (settings as any)[key] = undefined
    }
  }

  // Extract CDI data from the zip if available
  try {
    const filePaths = Object.keys(reader.files).filter(p => !isMacOSJunk(p))

    // Find and parse CDI file
    const cdiPath = filePaths.find(f => f.toLowerCase().endsWith('.cdi3.json'))
    if (cdiPath) {
      const cdiText = await reader.file(cdiPath)!.async('text')
      ;(settings as any)._cdiData = JSON.parse(cdiText)
      console.info('[ZipLoader] Extracted CDI data from:', cdiPath)
    }

    // Find and collect expression files
    const jsonPaths = filePaths.filter(f => f.toLowerCase().endsWith('.json'))
    const expFiles: Array<{ name: string, fileName: string, data: any }> = []
    for (const jsonPath of jsonPaths) {
      try {
        const text = await reader.file(jsonPath)!.async('text')
        const parsed = JSON.parse(text)
        if (parsed && (parsed.Type === 'Live2D Expression' || parsed.type === 'Live2D Expression')) {
          const baseName = jsonPath.split('/').pop()?.replace(/\.exp3?\.json$/i, '') || jsonPath
          expFiles.push({
            name: baseName,
            fileName: jsonPath,
            data: parsed,
          })
        }
      }
      catch {}
    }
    if (expFiles.length > 0) {
      ;(settings as any)._expFiles = expFiles
      console.info('[ZipLoader] Extracted', expFiles.length, 'expression files')
    }
  }
  catch (e) {
    console.warn('[ZipLoader] Failed to extract CDI/EXP metadata:', e)
  }

  return settings
}

export function isSettingsFile(file: string) {
  return file.endsWith('.model3.json') || file.endsWith('.model.json')
}

export function isMocFile(file: string) {
  return file.endsWith('.moc3')
}

export function basename(path: string): string {
  // https://stackoverflow.com/a/15270931
  return path.split(/[\\/]/).pop()!
}

// copy and modified from https://github.com/guansss/live2d-viewer-web/blob/f6060b2ce52c2e26b6b61fa903c837fe343f72d1/src/app/upload.ts#L81-L142
function createFakeSettings(files: string[]): ModelSettings {
  const mocFiles = files.filter(file => isMocFile(file))

  if (mocFiles.length !== 1) {
    const fileList = mocFiles.length ? `(${mocFiles.map(f => `"${f}"`).join(',')})` : ''

    throw new Error(`Expected exactly one moc file, got ${mocFiles.length} ${fileList}`)
  }

  const mocFile = mocFiles[0]
  const modelName = basename(mocFile).replace(/\.moc3?/, '')

  const textures = files.filter(f => f.endsWith('.png'))

  if (!textures.length) {
    throw new Error('Textures not found')
  }

  const motions = files.filter(f => f.endsWith('.mtn') || f.endsWith('.motion3.json'))
  const physics = files.find(f => f.includes('physics'))

  return new Cubism4ModelSettings({
    url: `${modelName}.model3.json`,
    Version: 3,
    FileReferences: {
      Moc: mocFile,
      Textures: textures,
      Motions: motions.length
        ? {
            '': motions.map(motion => ({
              File: motion,
            })),
          }
        : undefined,
      Physics: physics,
    },
  })
}
