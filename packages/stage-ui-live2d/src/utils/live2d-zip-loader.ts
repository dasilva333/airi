import type { ModelSettings } from 'pixi-live2d-display/cubism4'

import JSZip from 'jszip'

import { Cubism4ModelSettings, ZipLoader } from 'pixi-live2d-display/cubism4'

/**
 * Returns true for macOS AppleDouble resource-fork artifacts that appear in
 *  ZIPs created on macOS (e.g. __MACOSX/ subtree, ._-prefixed sidecars).
 *  These are binary files in AppleDouble format — not real Live2D assets.
 */
export function isMacOSJunk(path: string): boolean {
  const parts = path.split('/')
  return parts[0] === '__MACOSX' || parts.some(p => p.startsWith('._'))
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

const defaultCreateSettings = ZipLoader.createSettings
ZipLoader.createSettings = async (reader: JSZip) => {
  const settings = await (async () => {
    const filePaths = Object.keys(reader.files).filter(p => !isMacOSJunk(p))
    if (!filePaths.find(file => isSettingsFile(file))) {
      return createFakeSettings(filePaths)
    }
    return defaultCreateSettings(reader)
  })()

  // Handle models with anonymous motion groups (empty string)
  // We remap them to 'Idle' to ensure AIRI can start initial animations
  const rawJson = (settings as any).json
  const fileRefs = rawJson?.FileReferences || rawJson?.fileReferences
  const motions = fileRefs?.Motions || (settings as any).motions

  if (motions && motions[''] && !motions.Idle) {
    motions.Idle = motions['']
    delete motions['']
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
  const pose = files.find(f => f.includes('pose'))

  const settings = new Cubism4ModelSettings({
    url: `${modelName}.model3.json`,
    Version: 3,
    FileReferences: {
      Moc: mocFile,
      Textures: textures,
      Physics: physics,
      Pose: pose,
      Motions: motions.length
        ? {
            Idle: motions.map(motion => ({ File: motion })),
          }
        : undefined,
    },
  })

  settings.name = modelName;

  // provide this property for FileLoader
  (settings as any)._objectURL = `example://${settings.url}`

  return settings
}

ZipLoader.readText = (jsZip: JSZip, path: string) => {
  const file = jsZip.file(path)

  if (!file) {
    throw new Error(`Cannot find file: ${path}`)
  }

  return file.async('text')
}

ZipLoader.getFilePaths = (jsZip: JSZip) => {
  const paths: string[] = []

  jsZip.forEach((relativePath, file) => {
    if (!file.dir && !isMacOSJunk(relativePath)) {
      paths.push(relativePath)
    }
  })

  return Promise.resolve(paths)
}

ZipLoader.getFiles = (jsZip: JSZip, paths: string[]) =>
  Promise.all(paths.map(
    async (path) => {
      const fileName = path.slice(path.lastIndexOf('/') + 1)

      const blob = await jsZip.file(path)!.async('blob')

      const file = new File([blob], fileName)
      Object.defineProperty(file, 'webkitRelativePath', {
        value: path,
        writable: false,
        configurable: true,
      })

      return file
    },
  ))
