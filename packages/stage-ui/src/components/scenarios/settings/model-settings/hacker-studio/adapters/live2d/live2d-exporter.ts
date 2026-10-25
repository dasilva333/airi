/**
 * Live2D ZIP exporter.
 *
 * This is a direct port of `LHackerPanel.exportZip()` with two fixes:
 * - mutations are mapped through the runtime texture list after empty slots are
 *   filtered (the loader removes blank `FileReferences.Textures` entries);
 * - the mutation's original mime is metadata only; Live2D pages keep their ZIP
 *   path and PNG payload.
 */

import JSZip from 'jszip'

export interface Live2dTextureMutation {
  index: number
  data: string
  mimeType?: string
}

export interface Live2dExportOptions {
  source: ArrayBuffer
  mutations?: Live2dTextureMutation[]
  model3Path?: string
}

function isJunkPath(path: string): boolean {
  const parts = path.split(/[\\/]/)
  return parts.some(part => part === '__MACOSX' || part.startsWith('._') || part === '.DS_Store')
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '')
}

function resolveRelativePath(base: string, relative: string): string {
  return normalizePath(`${base}${relative}`)
}

function findModel3Path(zip: JSZip, explicit?: string): string | null {
  const files = Object.keys(zip.files).filter(path => !zip.files[path].dir && !isJunkPath(path))
  if (explicit) {
    const explicitPath = normalizePath(explicit.split(/[?#]/)[0])
    const base = explicitPath.split('/').pop()
    const exact = files.find(path => path === explicitPath)
    if (exact)
      return exact
    const lower = explicitPath.toLowerCase()
    const caseMatch = files.find(path => path.toLowerCase() === lower)
    if (caseMatch)
      return caseMatch
    if (base) {
      const baseLower = base.toLowerCase()
      const basenameMatch = files.find(path => path.split('/').pop()?.toLowerCase() === baseLower)
      if (basenameMatch)
        return basenameMatch
    }
  }
  return files
    .filter(path => path.toLowerCase().endsWith('model3.json') || path.toLowerCase().endsWith('model.json'))
    .sort((a, b) => a.length - b.length)[0] ?? null
}

/**
 * Mutations use the runtime/filtered texture index. The loader drops blank
 * texture slots, so map that index back onto the non-empty manifest entries.
 * If the runtime list is longer than the filtered list (unexpected), fall back
 * to the original index to avoid silently dropping a mutation.
 */
function resolveTexturePath(textures: string[], index: number): string | null {
  const filtered = textures.filter(texture => typeof texture === 'string' && texture.trim().length > 0)
  return filtered[index] ?? textures[index] ?? null
}

export async function exportLive2dZip(options: Live2dExportOptions): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(options.source)
  const model3Path = findModel3Path(zip, options.model3Path)
  if (!model3Path)
    throw new Error('model3.json not found in bundle')

  const manifestFile = zip.file(model3Path)
  if (!manifestFile)
    throw new Error('model3.json could not be read from bundle')

  const manifest = JSON.parse(await manifestFile.async('string'))
  const fileReferences = manifest?.FileReferences ?? manifest?.fileReferences
  const textures = fileReferences?.Textures ?? fileReferences?.textures
  if (!Array.isArray(textures))
    throw new Error('model3.json has no texture references')

  const basePath = model3Path.substring(0, model3Path.lastIndexOf('/') + 1)
  const zipFiles = Object.keys(zip.files)

  for (const mutation of options.mutations ?? []) {
    const relativePath = resolveTexturePath(textures, mutation.index)
    if (!relativePath)
      continue

    const normalizedPath = resolveRelativePath(basePath, relativePath)
    const zipKey = zipFiles.find(path =>
      path === normalizedPath || path.toLowerCase() === normalizedPath.toLowerCase(),
    )

    if (zipKey)
      zip.file(zipKey, mutation.data, { base64: true })
    else
      zip.file(normalizedPath, mutation.data, { base64: true })
  }

  return zip.generateAsync({ type: 'uint8array' })
}
